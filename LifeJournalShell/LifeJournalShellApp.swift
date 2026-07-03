// Life Journal — TestFlight shell.
// A thin full-screen WKWebView around the live web app, so every web deploy
// updates the app instantly without a new TestFlight build. Apple Pencil
// input (with pressure) flows through WKWebView's pointer events, and all
// journal data lives in the web app's IndexedDB inside this app's sandbox.
import SwiftUI
import WebKit

@main
struct LifeJournalShellApp: App {
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

final class WebModel: NSObject, ObservableObject, WKNavigationDelegate {
    static let appURL = URL(string: "https://life-journal-lake.vercel.app")!

    @Published var failed = false
    let webView: WKWebView

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()   // persistent IndexedDB / localStorage

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
        wv.navigationDelegate = self
        load()
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
}

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebModel
    func makeUIView(context: Context) -> WKWebView { model.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
