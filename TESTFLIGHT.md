# Getting Life Journal onto TestFlight

The repo has two Xcode projects:

| Project | What it is |
|---|---|
| `LifeJournalShell.xcodeproj` | **Ship this one.** A thin full-screen WKWebView around the live web app (https://life-journal-lake.vercel.app). Every web deploy updates the app instantly — no new TestFlight build needed. Apple Pencil, pressure, and all journal data (IndexedDB) work inside it. |
| `LifeJournal.xcodeproj` | The original native SwiftUI + PencilKit prototype. Feature-wise it is far behind the web app; keep it for a future fully-native version. |

## One-time setup (your side)

1. **Apple Developer Program** — enroll at https://developer.apple.com/programs/ ($99/yr).
2. **App Store Connect record** — at https://appstoreconnect.apple.com → My Apps → “+” → New App:
   - Platform: iOS
   - Name: Life Journal (or your pick — must be unique on the store)
   - Bundle ID: register `com.raiselaunch.lifejournal` (Certificates → Identifiers → “+” → App ID), then select it here
   - SKU: anything, e.g. `lifejournal-001`

If you want a different bundle ID, change `PRODUCT_BUNDLE_IDENTIFIER` in
`LifeJournalShell.xcodeproj` (Xcode → target → Signing & Capabilities) to match.

## Build & upload (repeat per build)

On a Mac with Xcode 16+:

1. Clone the repo and open **`LifeJournalShell.xcodeproj`**.
2. Select the `LifeJournalShell` target → Signing & Capabilities → set **Team** to your team (Automatic signing).
3. Pick the destination **Any iOS Device (arm64)**.
4. **Product → Archive.**
5. In the Organizer window: **Distribute App → TestFlight & App Store → Upload** (defaults are fine).
6. Wait ~5–15 min for processing in App Store Connect.

## Start testing

In App Store Connect → your app → **TestFlight** tab:

- **Internal testing** (fastest, no review): create a group, add yourself/teammates
  (they need to be added as users under Users & Access first), toggle the build on.
  Everyone gets an email → install via the TestFlight app on iPhone/iPad.
- **External testing** (up to 10,000 testers, needs a one-time beta review):
  create an external group and submit the build for beta review.

## Notes

- Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption = NO`) since the
  app only uses standard HTTPS — no questionnaire per build.
- Because the shell loads the live URL, **web fixes ship without a new build**. You
  only need to re-archive when the Swift shell itself changes (rare) or to bump the
  version for App Store review later.
- First launch needs internet; after that WKWebView caches the app shell, and all
  journal data is stored on-device (IndexedDB) with optional cloud sync via ☁ Sync.
