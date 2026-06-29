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

  // ---- Month calendar geometry (page units) ----
  function monthGeom() {
    const gridLeft = M, gridW = PAGE.W - 2 * M;
    const gridTop = M + 150, headerH = 42;
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
  // Tappable title (month name) → year overview.
  function monthTitleRect() { return { x: M, y: M + 16, w: 460, h: 64 }; }

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
    for (let m = 0; m < 12; m++) pages.push({ id: uid(), template: 'planMonth', year: year, month: m });

    const jan1 = Date.UTC(year, 0, 1);
    const dec31 = Date.UTC(year, 11, 31);
    const start = jan1 - new Date(jan1).getUTCDay() * DAY_MS;          // Sunday on/before Jan 1
    const end = dec31 + (6 - new Date(dec31).getUTCDay()) * DAY_MS;     // Saturday on/after Dec 31
    for (let ws = start; ws <= end; ws += 7 * DAY_MS) {
      pages.push({ id: uid(), template: 'planWeekSermon', weekStart: isoFromTs(ws) });
      for (let i = 0; i < 7; i++) pages.push({ id: uid(), template: 'planDay', date: isoFromTs(ws + i * DAY_MS) });
    }
    return { id: uid(), title: `LifeJournal ${year}`, cover: 'navy', kind: 'planner', year: year, pages: pages };
  }

  return {
    MONTHS, WEEKDAYS, WD_LETTER, DAY_MS,
    iso, isoFromTs, parseISO, partsFor,
    monthGeom, monthCells, monthCellRects, monthTitleRect,
    yearGeom, yearMonthRects, headerBackRect,
    generate
  };
})();
