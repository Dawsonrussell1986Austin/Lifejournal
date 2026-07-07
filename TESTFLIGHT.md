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

## RevenueCat (subscriptions)

The shell already includes the RevenueCat SDK and a JS bridge; the web app
gates **AI Bible study generation** behind a `pro` entitlement and shows a
paywall. Until the steps below are done, everything stays unlocked (the
bridge reports "not configured"), so beta testing is unaffected.

1. **App Store Connect — money paperwork (one-time):** Business →
   Agreements: sign the *Paid Applications* agreement and complete banking +
   tax info. IAP testing will not work without this.
2. **Create the subscription:** Your app → Monetization → Subscriptions →
   create a group ("Pro"), then add products, e.g.
   `lj_pro_monthly` and `lj_pro_annual`, with prices. Add localization
   (display name + description) so they can be submitted with the app later.
3. **RevenueCat account:** sign up at https://app.revenuecat.com → New
   project "Life Journal" → add an **App Store** app with bundle id
   `com.raiselaunch.lifejournal`.
4. **Connect App Store Connect to RevenueCat:** in App Store Connect →
   Users & Access → Integrations → **In-App Purchase** keys → generate one,
   upload the .p8 (plus Key ID + Issuer ID) into the RevenueCat app config.
5. **In RevenueCat:** create entitlement **`pro`**, attach both products to
   it; create an Offering ("default") with the monthly + annual packages.
6. **Drop the key in the shell:** RevenueCat → API keys → copy the *public*
   Apple key (`appl_…`) into `IAP.apiKey` in
   `LifeJournalShell/IAPBridge.swift`, re-archive, upload.
7. **Test:** TestFlight builds use the sandbox automatically — buy with your
   sandbox Apple ID, confirm the ✦ Study button unlocks, and Restore works.

## Notes

- Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption = NO`) since the
  app only uses standard HTTPS — no questionnaire per build.
- Because the shell loads the live URL, **web fixes ship without a new build**. You
  only need to re-archive when the Swift shell itself changes (rare) or to bump the
  version for App Store review later.
- First launch needs internet; after that a service worker (`web/sw.js`) caches the
  app shell (HTML/JS/CSS) so the app opens and runs offline, and all journal data is
  stored on-device (IndexedDB) with optional cloud sync via ☁ Sync. API calls
  (`/api/*`) always go to the network and are never cached.

## Sign in with Apple + iCal (added later)

The shell now includes Sign in with Apple (drives automatic cross-device
sync) and read-only Apple Calendar access (events on daily pages). Two
things to know when archiving:

- Xcode may prompt to register the **Sign In with Apple** capability on the
  App ID — with automatic signing just accept; otherwise tick the capability
  on the App ID at developer.apple.com → Identifiers.
- Calendar permission strings are already in the build settings; iOS asks
  the user the first time they tap ⋯ → 📅 iCal.
