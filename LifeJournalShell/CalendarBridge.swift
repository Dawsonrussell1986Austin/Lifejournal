// Apple Calendar (EventKit) bridge: the web layer asks for a day's events
// and paints them onto the journal's schedule. Read-only — we never write
// to the user's calendar.
import WebKit
import EventKit
import UIKit

final class CalendarBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private let store = EKEventStore()

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? String,
              let action = dict["action"] as? String else { return }
        switch action {
        case "status":
            send(id, ["state": stateString()])
        case "request":
            let done: (Bool, Error?) -> Void = { granted, _ in
                self.send(id, ["granted": granted, "state": self.stateString()])
            }
            if #available(iOS 17.0, *) { store.requestFullAccessToEvents(completion: done) }
            else { store.requestAccess(to: .event, completion: done) }
        case "events":
            events(id, dateStr: dict["date"] as? String ?? "")
        default:
            send(id, ["error": "unknown action"])
        }
    }

    private func stateString() -> String {
        let s = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *), s == .fullAccess { return "authorized" }
        switch s {
        case .authorized: return "authorized"
        case .notDetermined: return "undetermined"
        default: return "denied"
        }
    }

    private func events(_ id: String, dateStr: String) {
        guard stateString() == "authorized" else { send(id, ["state": stateString(), "events": []]); return }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = .current
        guard let dayStart = fmt.date(from: dateStr) else { send(id, ["error": "bad date"]); return }
        let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!
        let predicate = store.predicateForEvents(withStart: dayStart, end: dayEnd, calendars: nil)
        let items = store.events(matching: predicate).map { ev -> [String: Any] in
            let cal = Calendar.current
            let h = Double(cal.component(.hour, from: ev.startDate)) +
                    Double(cal.component(.minute, from: ev.startDate)) / 60.0
            let tf = DateFormatter()
            tf.timeStyle = .short
            tf.dateStyle = .none
            return [
                "title": ev.title ?? "Event",
                "allDay": ev.isAllDay,
                "startH": h,
                "time": ev.isAllDay ? "" : tf.string(from: ev.startDate),
                "color": hex(ev.calendar?.cgColor)
            ]
        }
        send(id, ["state": "authorized", "events": items])
    }

    private func hex(_ cg: CGColor?) -> String {
        guard let cg = cg else { return "#5a8c6e" }
        let ui = UIColor(cgColor: cg)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02x%02x%02x", Int(r * 255), Int(g * 255), Int(b * 255))
    }

    private func send(_ id: String, _ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript("window.LJCal && window.LJCal._resolve('\(id)', \(json))")
        }
    }
}
