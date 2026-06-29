# Life Journal — Web

The browser version of Life Journal. Runs on any device and supports Apple
Pencil pressure in iPad Safari via Pointer Events. Deployed as a static site on
Vercel with one serverless function for cloud sync.

**Live:** https://life-journal-lake.vercel.app

## Features

- **Journal shelf** — create/delete journals, 6 cover themes, opening verses.
- **Write or type** — handwrite with pen/highlighter (Apple Pencil pressure),
  erase, undo; or use the **T** tool to add keyboard text boxes (move, recolor,
  resize, delete). Both coexist on a page.
- **Templates** — Daily Devotion (S.O.A.P.), Sermon Notes, Prayer List,
  Gratitude, Daily Planner, Weekly Top 3, Weekly Schedule, Monthly Calendar,
  Notes/Tasks, Lined, Dotted, Blank.
- **LifeJournal 2026** — a prebuilt calendar journal (~491 pages): cover, a year
  overview, 12 month calendars, and for each week a Week page, a Sermon Notes
  page, and 7 dated daily pages. Calendars are **clickable**: year → month,
  month date → that day, week day → that day, and headers link back. A **Today**
  button jumps to the current date.
- **PDF export**, per-page autosave (localStorage), thumbnail overview.
- **Cloud sync** — set a sync code (Sync button) and Upload/Download to share
  all journals + handwriting across devices.

## Layout

```
web/
  index.html
  styles.css
  js/
    data.js        page geometry, cover styles, template catalog
    templates.js   canvas renderers for every template
    planner.js     LifeJournal 2026 generation + calendar geometry/date math
    store.js       localStorage persistence (+ one-time planner seed/migrate)
    canvas.js      handwriting engine (Pointer Events) + page rendering
    pdf.js         multi-page PDF export (jsPDF, lazy-loaded)
    sync.js        cloud sync client
    app.js         UI: shelf, editor, navigation, modals, links, sync
api/
  sync.js          serverless sync endpoint (private Vercel Blob store)
```

## Cloud sync

Storage is per-browser (localStorage) until you sync. The **Sync** button stores
a single payload (library + every page's strokes/text) under a sync code:

- `POST /api/sync?code=XXXX` writes the payload.
- `GET  /api/sync?code=XXXX` returns it (204 if none).

Data lives in a **private** Vercel Blob store at `sync/<sha256(code)>.json`, read
and written only by the serverless function via `BLOB_READ_WRITE_TOKEN`. The sync
code is a shared secret — anyone who knows it can read/overwrite that data, so
pick something long and personal. The request body limit is ~4.5 MB, which is
plenty for text/handwriting but not unlimited.

### Local dev / deploy

It's a static site plus one function. Deploy from the repo root:

```bash
vercel deploy --prod
```

`vercel.json` serves `web/` as the static output; `api/sync.js` is built as a
serverless function. The Blob store is already created and linked to the project
(`BLOB_READ_WRITE_TOKEN` is set in the project's environment).
