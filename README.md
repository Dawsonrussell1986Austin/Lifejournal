# Life Journal

A Christian journaling app for iPad with **Apple Pencil** handwriting — the same
"write directly on the page" experience you get in GoodNotes, built around the
**Life Journal** planner layouts plus classic faith journaling formats.

You create journals, flip through pages, and write on each page with the Pencil.
Handwriting is captured with Apple's **PencilKit** engine, so you get real
pressure, tilt, palm rejection, low-latency ink, the system tool picker
(pen / marker / pencil / eraser / lasso / ruler / colors), and undo.

---

## What's inside

- **Shelf / Library** — your journals as book covers; create as many as you like.
- **Page templates** (write on any of these with the Pencil):
  - **Cover** — title + opening scripture
  - **Daily Devotion (S.O.A.P.)** — Scripture · Observation · Application · Prayer
  - **Sermon Notes** — date, speaker, series, passage, notes, application
  - **Prayer List** — requests + answered prayers
  - **Gratitude** — daily blessings
  - **Daily Planner** — hourly schedule, top priorities, tasks, verse of the day
    (mirrors the printed Life Journal planner)
  - **Weekly Top 3**, **Weekly Schedule**, **Monthly Calendar**
  - **Notes / Tasks**, **Lined**, **Dotted**, **Blank**
- **Per-page handwriting** saved to disk automatically (debounced) and reloaded.
- **Page navigation** — prev/next, a page thumbnail grid, add a page (any
  template), and delete a page.
- **Pencil-only by default** with a one-tap toggle to also allow finger drawing.
- **Pinch to zoom** the page while writing; the template scrolls and zooms with
  the ink.

## Project layout

```
LifeJournal.xcodeproj          Xcode project (uses file-system synchronized groups)
LifeJournal/
  LifeJournalApp.swift         App entry point
  Theme.swift                  Shared sizing + palette; canonical page size
  Models/
    Journal.swift              Journal, JournalPage, CoverStyle (+ verses)
    PageTemplate.swift          The set of page layouts
    JournalStore.swift          Library + drawing persistence (Documents/)
  Templates/
    TemplateComponents.swift    Reusable rule/checkbox/field building blocks
    TemplateBackground.swift    The printed layout for every template
  Views/
    LibraryView.swift           The shelf
    JournalCoverView.swift      Book-cover thumbnail
    NewJournalSheet.swift       Create-journal flow (title, cover, first page)
    JournalView.swift           The editor: toolbar + Pencil canvas + navigation
    PencilCanvas.swift          PencilKit canvas (UIViewControllerRepresentable)
    TemplatePickerSheet.swift   Add-a-page picker with live previews
    PageThumbnailGrid.swift     All pages at a glance
  Assets.xcassets/             App icon + accent color
```

## Build & run

This is a native iPadOS app, so it builds on a Mac with Xcode.

1. Open `LifeJournal.xcodeproj` in **Xcode 16** or newer.
2. Select your **Apple Developer team** under *Signing & Capabilities* (the
   bundle id is `com.lifejournal.LifeJournal` — change it to your own).
3. Choose an **iPad** simulator or a connected iPad and press **Run**.
4. Apple Pencil works on a physical iPad; in the Simulator you can draw with the
   mouse/trackpad (turn on the finger-drawing toggle in the editor toolbar).

Minimum deployment target: **iOS 17**. Built with SwiftUI + PencilKit; no
third-party dependencies.

## How handwriting is stored

Each page's strokes are saved as a PencilKit drawing
(`Documents/LifeJournal/Drawings/<pageID>.pkdrawing`) and the journal/page
metadata lives in `Documents/LifeJournal/library.json`. Pages render at a fixed
canonical size (1024 × 1325) so your handwriting stays aligned to the template.

## Ideas for next steps

- iCloud sync (Documents are already file-based — drop them in an iCloud
  container).
- Export a journal (or page) to PDF.
- Import the original Life Journal PDF pages as custom backgrounds.
- Stickers, photo insertion, and text boxes.
- Daily verse / reading-plan integration.
