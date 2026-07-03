// Local notification bridge: a repeating morning reminder to check in on
// yesterday and set up today. No push servers — everything stays on device.
import WebKit
import UserNotifications

final class NotifyBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private let reminderId = "lj.morning.checkin"

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? String,
              let action = dict["action"] as? String else { return }
        let center = UNUserNotificationCenter.current()
        switch action {
        case "status":
            center.getNotificationSettings { settings in
                let state = settings.authorizationStatus == .notDetermined ? "undetermined"
                    : (settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional) ? "authorized" : "denied"
                let scheduled = UserDefaults.standard.string(forKey: "lj.reminderTime") ?? ""
                self.send(id, ["state": state, "time": scheduled])
            }
        case "schedule":
            let hour = dict["hour"] as? Int ?? 7
            let minute = dict["minute"] as? Int ?? 0
            center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                guard granted else { self.send(id, ["granted": false]); return }
                let content = UNMutableNotificationContent()
                content.title = "Life Journal"
                content.body = "Good morning — check in on yesterday and set up today."
                content.sound = .default
                var comps = DateComponents()
                comps.hour = hour
                comps.minute = minute
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
                let request = UNNotificationRequest(identifier: self.reminderId, content: content, trigger: trigger)
                center.removePendingNotificationRequests(withIdentifiers: [self.reminderId])
                center.add(request) { error in
                    if error == nil {
                        UserDefaults.standard.set(String(format: "%02d:%02d", hour, minute), forKey: "lj.reminderTime")
                    }
                    self.send(id, ["granted": true, "scheduled": error == nil])
                }
            }
        case "cancel":
            center.removePendingNotificationRequests(withIdentifiers: [reminderId])
            UserDefaults.standard.removeObject(forKey: "lj.reminderTime")
            send(id, ["ok": true])
        default:
            send(id, ["error": "unknown action"])
        }
    }

    private func send(_ id: String, _ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript("window.LJNotify && window.LJNotify._resolve('\(id)', \(json))")
        }
    }
}
