// Life Journal — TestFlight shell.
// A thin full-screen WKWebView around the live web app, so every web deploy
// updates the app instantly without a new TestFlight build. Apple Pencil
// input (with pressure) flows through WKWebView's pointer events, and all
// journal data lives in the web app's IndexedDB inside this app's sandbox.
import SwiftUI
import WebKit
import UIKit

@main
struct LifeJournalShellApp: App {
    init() { IAP.configureIfPossible() }
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @StateObject private var model = WebModel()

    var body: some View {
        ZStack {
            // Matches the app's "Quiet Paper" background while loading.
            Color(red: 0.914, green: 0.906, blue: 0.886).ignoresSafeArea()
            WebView(model: model)
                .ignoresSafeArea()
                .opacity(model.failed ? 0 : 1)
            if model.failed {
                OfflineView { model.load() }
            }
        }
        .preferredColorScheme(.light)
    }
}

struct OfflineView: View {
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 14) {
            Text("Life Journal")
                .font(.system(size: 28, weight: .semibold, design: .serif))
            Text("Couldn't reach your journal.\nCheck your connection and try again.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: retry) {
                Text("Retry")
                    .font(.headline)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 12)
                    .background(Color(red: 0.184, green: 0.290, blue: 0.231))
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
        .padding(32)
    }
}

final class WebModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let appURL = URL(string: "https://life-journal-lake.vercel.app")!

    @Published var failed = false
    let webView: WKWebView
    private let iapBridge = IAPBridge()
    private let calBridge = CalendarBridge()
    private let authBridge = AuthBridge()
    private let notifyBridge = NotifyBridge()

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()   // persistent IndexedDB / localStorage
        config.userContentController.add(iapBridge, name: "ljiap")
        config.userContentController.add(calBridge, name: "ljcal")
        config.userContentController.add(authBridge, name: "ljauth")
        config.userContentController.add(notifyBridge, name: "ljnotify")

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.scrollView.bounces = false
        wv.allowsBackForwardNavigationGestures = false
        wv.isOpaque = false
        wv.backgroundColor = .clear
        #if DEBUG
        if #available(iOS 16.4, *) { wv.isInspectable = true }
        #endif
        self.webView = wv
        super.init()
        iapBridge.webView = wv
        calBridge.webView = wv
        authBridge.webView = wv
        notifyBridge.webView = wv
        wv.navigationDelegate = self
        wv.uiDelegate = self
        load()
    }

    // Open a URL outside the app (system browser / Mail), rather than
    // navigating the single-page app away from itself.
    private func openExternally(_ url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    private func isAppOrigin(_ url: URL?) -> Bool {
        guard let host = url?.host, let scheme = url?.scheme else { return false }
        return (scheme == "https" || scheme == "http") && host == Self.appURL.host
    }

    func load() {
        failed = false
        webView.load(URLRequest(url: Self.appURL))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed = true }
    }

    // A `target="_blank"` link (or window.open) has no frame to open into in a
    // single WKWebView; without this the tap is silently dropped. Route it to
    // the system browser instead.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { openExternally(url) }
        return nil
    }

    // Keep the app's own pages in-app; send any user-initiated navigation to a
    // different origin (or mailto:/tel:) out to the system, so external links —
    // including the Terms/Privacy links on the paywall — don't strand the user
    // inside a chrome-less webview.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        if let scheme = url?.scheme, ["mailto", "tel", "sms", "facetime"].contains(scheme) {
            if let url = url { openExternally(url) }
            decisionHandler(.cancel)
            return
        }
        if navigationAction.navigationType == .linkActivated,
           let url = url, !isAppOrigin(url) {
            openExternally(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebModel
    func makeUIView(context: Context) -> WKWebView { model.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
