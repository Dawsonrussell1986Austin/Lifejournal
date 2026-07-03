// Builds the pre-made "LifeJournal 2026" calendar journal and provides the
// shared geometry used to both DRAW the calendars and place the clickable
// links over them. All date math is done in UTC to avoid timezone drift.
window.LJPlanner = (function () {
  const PAGE = LJData.PAGE;
  const M = PAGE.M;
  const DAY_MS = 86400000;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WD_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  function isoFromTs(ts) {
    const d = new Date(ts);
    return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m: m - 1, d };
  }
  function partsFor(isoStr) {
    const p = parseISO(isoStr);
    const wd = new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay();
    return {
      year: p.y, month: p.m, day: p.d, weekday: wd,
      weekdayName: WEEKDAYS[wd],
      monthName: MONTHS[p.m],
      long: `${MONTHS[p.m]} ${p.d}, ${p.y}`,
      shortMonthDay: `${MONTHS[p.m].slice(0, 3)} ${p.d}`
    };
  }

  // ---- Photobook: a themed Unsplash photo per month (replaceable) ----
  const MONTH_PHOTO_IDS = [
    '1419242902214-272b3f66ee7a', // Jan — winter peaks
    '1483728642387-6c3bdd6c93e5', // Feb — snow forest
    '1490750967868-88aa4486c946', // Mar — spring blossom
    '1522383225653-ed111181a951', // Apr — pink flowers
    '1416879595882-3373a0480b5b', // May — green field
    '1507525428034-b723cf961d3e', // Jun — beach
    '1500382017468-9049fed747ef', // Jul — summer field
    '1470509037663-253afd7f0f51', // Aug — sunflowers
    '1507371341162-763b5e419408', // Sep — autumn road
    '1508255139162-e1f7b7288ab7', // Oct — autumn
    '1444090542259-0af8fa96557e', // Nov — misty autumn
    '1512389142860-9c449e58a543'  // Dec — winter lights
  ];
  function defaultPhotoURL(month, w) {
    const id = MONTH_PHOTO_IDS[((month % 12) + 12) % 12];
    return `https://images.unsplash.com/photo-${id}?w=${w || 1200}&q=75&auto=format&fit=crop`;
  }
  function fallbackPhotoURL(month, w) {
    return `https://picsum.photos/seed/lifejournal-${month}/${w || 1200}/520`;
  }
  const PHOTO_H = 430;
  function monthPhotoRect() { return { x: M, y: M, w: PAGE.W - 2 * M, h: PHOTO_H }; }

  // ---- Month calendar geometry (page units) ----
  function monthGeom() {
    const gridLeft = M, gridW = PAGE.W - 2 * M;
    const gridTop = M + PHOTO_H + 96, headerH = 42;   // sits below the photo + title
    const gridH = PAGE.H - gridTop - M;
    return { gridLeft, gridTop, gridW, gridH, headerH,
             cellW: gridW / 7, cellH: (gridH - headerH) / 6 };
  }
  function monthCells(year, month) {
    const startWd = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startWd + 1;
      if (dayNum >= 1 && dayNum <= days) cells.push({ day: dayNum, date: iso(year, month, dayNum) });
      else cells.push({ day: null, date: null });
    }
    return cells;
  }
  function monthCellRects(year, month) {
    const g = monthGeom(), cells = monthCells(year, month), out = [];
    for (let i = 0; i < 42; i++) {
      const r = Math.floor(i / 7), c = i % 7;
      out.push({ day: cells[i].day, date: cells[i].date,
                 x: g.gridLeft + c * g.cellW, y: g.gridTop + g.headerH + r * g.cellH,
                 w: g.cellW, h: g.cellH });
    }
    return out;
  }
  // Tappable title (month name, now below the photo) → year overview.
  function monthTitleRect() { return { x: M, y: M + PHOTO_H + 22, w: 460, h: 60 }; }

  // ---- Year overview geometry ----
  function yearGeom() {
    const top = M + 120, cols = 3, rows = 4, gapX = 42, gapY = 40;
    const cellW = (PAGE.W - 2 * M - (cols - 1) * gapX) / cols;
    const cellH = (PAGE.H - top - M - (rows - 1) * gapY) / rows;
    return { top, cols, rows, gapX, gapY, cellW, cellH };
  }
  function yearMonthRects() {
    const g = yearGeom(), out = [];
    for (let m = 0; m < 12; m++) {
      const c = m % 3, r = Math.floor(m / 3);
      out.push({ month: m, x: M + c * (g.cellW + g.gapX), y: g.top + r * (g.cellH + g.gapY),
                 w: g.cellW, h: g.cellH });
    }
    return out;
  }

  // Tappable header on day / sermon pages → that month's calendar.
  function headerBackRect() { return { x: M, y: M, w: 360, h: 96 }; }

  // ---- Week view geometry ----
  function weekRowGeom() {
    const top = M + 132;
    return { top, rowH: (PAGE.H - top - M) / 7 };
  }
  function weekDayRects(weekStart) {
    const g = weekRowGeom(), p = parseISO(weekStart), base = Date.UTC(p.y, p.m, p.d), out = [];
    for (let i = 0; i < 7; i++) {
      out.push({ date: isoFromTs(base + i * DAY_MS), x: M, y: g.top + i * g.rowH, w: PAGE.W - 2 * M, h: g.rowH });
    }
    return out;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ---- Journal generation ----
  function generate(year) {
    const uid = LJData.uid;
    const pages = [
      { id: uid(), template: 'cover' },
      { id: uid(), template: 'planYear', year: year }
    ];
    for (let q = 0; q < 4; q++) pages.push({ id: uid(), template: 'foundationsGoals', year: year, quarter: q });
    for (let m = 0; m < 12; m++) pages.push({ id: uid(), template: 'planMonth', year: year, month: m });

    const jan1 = Date.UTC(year, 0, 1);
    const dec31 = Date.UTC(year, 11, 31);
    const start = jan1 - new Date(jan1).getUTCDay() * DAY_MS;          // Sunday on/before Jan 1
    const end = dec31 + (6 - new Date(dec31).getUTCDay()) * DAY_MS;     // Saturday on/after Dec 31
    for (let ws = start; ws <= end; ws += 7 * DAY_MS) {
      const wIso = isoFromTs(ws);
      pages.push({ id: uid(), template: 'planWeek', weekStart: wIso });
      pages.push({ id: uid(), template: 'weeklyFoundations', weekStart: wIso });
      pages.push({ id: uid(), template: 'weeklyPrayer', weekStart: wIso });
      pages.push({ id: uid(), template: 'planWeekSermon', weekStart: wIso });
      for (let i = 0; i < 7; i++) pages.push({ id: uid(), template: 'planDay', date: isoFromTs(ws + i * DAY_MS) });
    }
    return { id: uid(), title: `LifeJournal ${year}`, cover: 'navy', kind: 'planner', year: year, pver: 4, pages: pages };
  }

  // Upgrade older planners in place so existing pages (and their handwriting)
  // are preserved. Each step is additive and runs in sequence:
  //   pver 1 → 2: add a week-overview page before each week's sermon page.
  //   pver 2 → 3: add the Five Foundations + Prayer pages after each week page.
  // Returns true if the journal changed.
  function migrate(journal) {
    if (journal.kind !== 'planner') return false;
    let changed = false;
    const pver = journal.pver || 1;

    if (pver < 2) {
      const out = [];
      for (const p of journal.pages) {
        if (p.template === 'planWeekSermon') out.push({ id: LJData.uid(), template: 'planWeek', weekStart: p.weekStart });
        out.push(p);
      }
      journal.pages = out;
      journal.pver = 2;
      changed = true;
    }

    if ((journal.pver || 1) < 3) {
      const out = [];
      for (const p of journal.pages) {
        out.push(p);
        if (p.template === 'planWeek') {
          out.push({ id: LJData.uid(), template: 'weeklyFoundations', weekStart: p.weekStart });
          out.push({ id: LJData.uid(), template: 'weeklyPrayer', weekStart: p.weekStart });
        }
      }
      journal.pages = out;
      journal.pver = 3;
      changed = true;
    }

    if ((journal.pver || 1) < 4) {
      // Insert the four quarterly 12-week goal pages right after the year page.
      const yi = journal.pages.findIndex((p) => p.template === 'planYear');
      const goals = [0, 1, 2, 3].map((q) => ({ id: LJData.uid(), template: 'foundationsGoals', year: journal.year, quarter: q }));
      journal.pages.splice(yi >= 0 ? yi + 1 : 1, 0, ...goals);
      journal.pver = 4;
      changed = true;
    }

    return changed;
  }

  return {
    MONTHS, WEEKDAYS, WD_LETTER, DAY_MS,
    iso, isoFromTs, parseISO, partsFor,
    monthGeom, monthCells, monthCellRects, monthTitleRect,
    monthPhotoRect, defaultPhotoURL, fallbackPhotoURL,
    yearGeom, yearMonthRects, headerBackRect,
    weekRowGeom, weekDayRects, todayISO,
    generate, migrate
  };
})();
