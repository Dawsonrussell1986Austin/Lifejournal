// RevenueCat bridge: the web UI posts messages to `ljiap` and receives
// results via window.LJIAP._resolve(id, payload). Purchases run natively
// through StoreKit/RevenueCat; the web side only shows the paywall.
import WebKit
import RevenueCat

enum IAP {
    /// Paste the RevenueCat *public* SDK key (starts with appl_) here.
    static let apiKey = "appl_REPLACE_WITH_REVENUECAT_PUBLIC_KEY"
    static let entitlement = "pro"
    static private(set) var configured = false

    static func configureIfPossible() {
        guard apiKey.hasPrefix("appl_"), !apiKey.contains("REPLACE") else { return }
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: apiKey)
        configured = true
    }
}

final class IAPBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? String,
              let action = dict["action"] as? String else { return }
        guard IAP.configured else {
            send(id, ["configured": false])
            return
        }
        switch action {
        case "status": status(id)
        case "offerings": offerings(id)
        case "purchase": purchase(id, pkg: dict["pkg"] as? String ?? "")
        case "restore": restore(id)
        default: send(id, ["error": "unknown action"])
        }
    }

    private func send(_ id: String, _ payload: [String: Any]) {
        var body = payload
        if body["configured"] == nil { body["configured"] = true }
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript("window.LJIAP && window.LJIAP._resolve('\(id)', \(json))")
        }
    }

    private func status(_ id: String) {
        Purchases.shared.getCustomerInfo { info, error in
            if let error = error { self.send(id, ["error": error.localizedDescription]); return }
            let pro = info?.entitlements[IAP.entitlement]?.isActive == true
            self.send(id, ["pro": pro])
        }
    }

    private func offerings(_ id: String) {
        Purchases.shared.getOfferings { offerings, error in
            if let error = error { self.send(id, ["error": error.localizedDescription]); return }
            let packages = (offerings?.current?.availablePackages ?? []).map { pkg -> [String: Any] in
                [
                    "id": pkg.identifier,
                    "title": pkg.storeProduct.localizedTitle,
                    "price": pkg.storeProduct.localizedPriceString,
                    "period": pkg.packageType == .annual ? "year"
                        : pkg.packageType == .monthly ? "month"
                        : pkg.packageType == .lifetime ? "lifetime" : ""
                ]
            }
            self.send(id, ["packages": packages])
        }
    }

    private func purchase(_ id: String, pkg: String) {
        Purchases.shared.getOfferings { offerings, error in
            guard let package = offerings?.current?.availablePackages.first(where: { $0.identifier == pkg }) else {
                self.send(id, ["error": error?.localizedDescription ?? "That plan isn’t available right now."])
                return
            }
            Purchases.shared.purchase(package: package) { _, info, error, cancelled in
                if cancelled { self.send(id, ["cancelled": true]); return }
                if let error = error { self.send(id, ["error": error.localizedDescription]); return }
                let pro = info?.entitlements[IAP.entitlement]?.isActive == true
                self.send(id, ["pro": pro])
            }
        }
    }

    private func restore(_ id: String) {
        Purchases.shared.restorePurchases { info, error in
            if let error = error { self.send(id, ["error": error.localizedDescription]); return }
            let pro = info?.entitlements[IAP.entitlement]?.isActive == true
            self.send(id, ["pro": pro, "restored": true])
        }
    }
}
