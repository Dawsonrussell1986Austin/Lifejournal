// Sign in with Apple bridge. The stable Apple user identifier becomes the
// key for automatic cross-device sync in the web layer. Stored locally in
// UserDefaults; no server-side account is created.
import WebKit
import AuthenticationServices
import UIKit

final class AuthBridge: NSObject, WKScriptMessageHandler,
                        ASAuthorizationControllerDelegate,
                        ASAuthorizationControllerPresentationContextProviding {
    weak var webView: WKWebView?
    private var pendingId: String?
    private let idKey = "lj.appleUserId"
    private let nameKey = "lj.appleName"

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? String,
              let action = dict["action"] as? String else { return }
        let d = UserDefaults.standard
        switch action {
        case "status":
            send(id, ["userId": d.string(forKey: idKey) ?? "", "name": d.string(forKey: nameKey) ?? ""])
        case "signin":
            pendingId = id
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        case "signout":
            d.removeObject(forKey: idKey)
            d.removeObject(forKey: nameKey)
            send(id, ["ok": true])
        default:
            send(id, ["error": "unknown action"])
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let id = pendingId else { return }
        pendingId = nil
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential else {
            send(id, ["error": "Unexpected credential"])
            return
        }
        let d = UserDefaults.standard
        d.set(cred.user, forKey: idKey)
        var name = d.string(forKey: nameKey) ?? ""
        if let given = cred.fullName?.givenName, !given.isEmpty { name = given }
        d.set(name, forKey: nameKey)
        send(id, ["userId": cred.user, "name": name])
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let id = pendingId else { return }
        pendingId = nil
        let ns = error as NSError
        if ns.code == ASAuthorizationError.canceled.rawValue { send(id, ["cancelled": true]) }
        else { send(id, ["error": error.localizedDescription]) }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return webView?.window ?? ASPresentationAnchor()
    }

    private func send(_ id: String, _ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript("window.LJAuth && window.LJAuth._resolve('\(id)', \(json))")
        }
    }
}
