import SwiftUI

@main
struct LifeJournalApp: App {
    @StateObject private var store = JournalStore()

    var body: some Scene {
        WindowGroup {
            LibraryView()
                .environmentObject(store)
        }
    }
}
