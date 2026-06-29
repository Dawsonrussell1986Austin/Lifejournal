// Draws each page template onto a 2D canvas context.
// The context is pre-scaled so drawing happens in canonical page units
// (LJData.PAGE.W x LJData.PAGE.H).
window.LJTemplates = (function () {
  const { PAGE, COLORS, COVERS } = LJData;
  const W = PAGE.W, H = PAGE.H, M = PAGE.M;
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';

  // ---- low-level helpers ----
  function setLetterSpacing(ctx, px) {
    try { ctx.letterSpacing = px + 'px'; } catch (e) { /* unsupported */ }
  }
  function label(ctx, text, x, y, opts) {
    opts = opts || {};
    const size = opts.size || 17;
    const str = (opts.caps === false ? text : text.toUpperCase());
    ctx.save();
    ctx.font = `600 ${size}px ${opts.serif ? SERIF : SANS}`;
    ctx.fillStyle = opts.color || COLORS.softInk;
    ctx.textBaseline = 'alphabetic';
    setLetterSpacing(ctx, opts.tracking == null ? 3 : opts.tracking);
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w; // measured with the real font + tracking, for inline layout
  }
  function caption(ctx, text, x, y) {
    ctx.save();
    ctx.font = `italic 14px ${SANS}`;
    ctx.fillStyle = COLORS.softInk;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function hline(ctx, x, y, w, color) {
    ctx.save();
    ctx.strokeStyle = color || COLORS.faint;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + w, y + 0.5); ctx.stroke();
    ctx.restore();
  }
  function ruled(ctx, x, y, w, count, gap, color) {
    for (let i = 0; i < count; i++) hline(ctx, x, y + i * gap, w, color || COLORS.faint);
  }
  function fieldLine(ctx, lab, x, y, w, labelW) {
    label(ctx, lab, x, y, { size: 13, tracking: 2 });
    hline(ctx, x + (labelW || 92), y + 2, w - (labelW || 92), COLORS.rule);
  }
  function checkbox(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = COLORS.rule; ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, s, s, 3); ctx.stroke();
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function dot(ctx, x, y, r, color) {
    ctx.save(); ctx.fillStyle = color || COLORS.accent;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function text(ctx, str, x, y, font, color, baseline) {
    ctx.save();
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(str, x, y); ctx.restore();
  }

  // ---- templates ----
  function cover(ctx, o) {
    const cv = COVERS[o.cover] || COVERS.sage;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, cv.c1); g.addColorStop(1, cv.c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = cv.foil; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
    roundRect(ctx, 40, 40, W - 80, H - 80, 6); ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    text(ctx, '✝', W / 2, H * 0.30, `300 60px ${SERIF}`, cv.foil, 'middle');

    ctx.save();
    ctx.fillStyle = cv.foil; ctx.textBaseline = 'middle';
    wrapCentered(ctx, o.title || 'Life Journal', W / 2, H * 0.40, W - 220, 66, `700 64px ${SERIF}`);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = cv.foil; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 60, H * 0.475); ctx.lineTo(W / 2 + 60, H * 0.475); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = cv.foil; ctx.globalAlpha = 0.95; ctx.textBaseline = 'middle';
    wrapCentered(ctx, cv.verse, W / 2, H * 0.56, W - 240, 30, `italic 21px ${SERIF}`);
    ctx.restore();

    setLetterSpacing(ctx, 2);
    text(ctx, 'THIS JOURNAL BELONGS TO', W / 2, H * 0.86, `600 13px ${SANS}`, cv.foil, 'middle');
    setLetterSpacing(ctx, 0);
    ctx.save(); ctx.strokeStyle = cv.foil; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(W / 2 - 150, H * 0.89); ctx.lineTo(W / 2 + 150, H * 0.89); ctx.stroke(); ctx.restore();
    ctx.textAlign = 'left';
  }

  function wrapCentered(ctx, str, cx, cy, maxW, lineH, font) {
    ctx.save();
    ctx.font = font; ctx.textAlign = 'center';
    const words = str.split(' ');
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const startY = cy - (lines.length - 1) * lineH / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
    ctx.restore();
  }

  function headerRow(ctx, title, withDate) {
    label(ctx, title, M, M + 26, { size: 22, color: COLORS.ink });
    if (withDate) fieldLine(ctx, 'Date', W - M - 240, M + 22, 240, 48);
  }

  function soap(ctx) {
    headerRow(ctx, 'Daily Devotion', true);
    fieldLine(ctx, 'Passage', M, M + 78, W - 2 * M, 92);
    const blocks = [
      ['Scripture', 'Write out the verse that speaks to you.'],
      ['Observation', 'What is happening? What is God showing you?'],
      ['Application', 'How will you live this out today?'],
      ['Prayer', 'Talk to God about what you read.']
    ];
    let y = M + 150;
    for (const [t, c] of blocks) {
      dot(ctx, M + 4, y - 5, 4);
      const lw = label(ctx, t, M + 18, y, { size: 15, color: COLORS.ink });
      caption(ctx, '— ' + c, M + 18 + lw + 22, y);
      ruled(ctx, M, y + 38, W - 2 * M, 3, 40);
      y += 168;
    }
  }

  function sermonNotes(ctx) {
    label(ctx, 'Sermon Notes', M, M + 26, { size: 22, color: COLORS.ink });
    fieldLine(ctx, 'Date', M, M + 76, (W - 2 * M) / 2 - 20, 48);
    fieldLine(ctx, 'Speaker', M + (W - 2 * M) / 2 + 20, M + 76, (W - 2 * M) / 2 - 20, 74);
    fieldLine(ctx, 'Series', M, M + 120, (W - 2 * M) / 2 - 20, 60);
    fieldLine(ctx, 'Passage', M + (W - 2 * M) / 2 + 20, M + 120, (W - 2 * M) / 2 - 20, 74);
    hline(ctx, M, M + 150, W - 2 * M, COLORS.rule);
    label(ctx, 'Message', M, M + 186, { size: 14 });
    ruled(ctx, M, M + 214, W - 2 * M, 11, 46);
    const colW = (W - 2 * M) / 2 - 16;
    label(ctx, 'Key Verse', M, M + 760, { size: 14, color: COLORS.ink });
    ruled(ctx, M, M + 790, colW, 2, 36);
    label(ctx, "How I'll Apply This", M + colW + 32, M + 760, { size: 14, color: COLORS.ink });
    ruled(ctx, M + colW + 32, M + 790, colW, 2, 36);
  }

  function prayerList(ctx) {
    label(ctx, 'Prayer List', M, M + 26, { size: 22, color: COLORS.ink });
    fieldLine(ctx, 'Week of', W - M - 280, M + 22, 280, 78);
    caption(ctx, '“Do not be anxious… present your requests to God.” — Philippians 4:6', M, M + 60);
    const colW = (W - 2 * M) / 2 - 20;
    label(ctx, 'Requests', M, M + 104, { size: 15, color: COLORS.ink });
    label(ctx, 'Answered Prayers', M + colW + 40, M + 104, { size: 15, color: COLORS.ink });
    for (let i = 0; i < 9; i++) {
      const y = M + 140 + i * 110;
      checkbox(ctx, M, y, 20); hline(ctx, M + 32, y + 16, colW - 32, COLORS.faint);
      checkbox(ctx, M + colW + 40, y, 20); hline(ctx, M + colW + 72, y + 16, colW - 32, COLORS.faint);
    }
  }

  function gratitude(ctx) {
    headerRow(ctx, 'Gratitude', true);
    caption(ctx, '“Give thanks in all circumstances.” — 1 Thessalonians 5:18', M, M + 62);
    label(ctx, "Today I'm thankful for", M, M + 108, { size: 15, color: COLORS.ink });
    for (let i = 0; i < 5; i++) {
      const y = M + 150 + i * 64;
      text(ctx, (i + 1) + '.', M, y, `600 17px ${SERIF}`, COLORS.softInk);
      hline(ctx, M + 30, y, W - 2 * M - 30, COLORS.faint);
    }
    label(ctx, 'God showed up today by…', M, M + 510, { size: 15, color: COLORS.ink });
    ruled(ctx, M, M + 548, W - 2 * M, 4, 48);
    label(ctx, 'Someone I want to encourage', M, M + 770, { size: 15, color: COLORS.ink });
    hline(ctx, M, M + 808, W - 2 * M, COLORS.faint);
  }

  function dailyPlanner(ctx) {
    label(ctx, 'Day', M, M + 30, { size: 26, color: COLORS.ink });
    hline(ctx, M + 110, M + 22, 200, COLORS.rule);
    text(ctx, '/        /', M + 330, M + 28, `400 20px ${SANS}`, COLORS.softInk);
    const hours = ['6','7','8','9','10','11','12','1','2','3','4','5','6','7','8','9'];
    label(ctx, 'Schedule', M, M + 76, { size: 14 });
    const schedW = 410;
    hours.forEach((h, i) => {
      const y = M + 120 + i * 52;
      text(ctx, h, M + 24, y, `500 13px ${SANS}`, COLORS.softInk, 'alphabetic');
      hline(ctx, M + 44, y, schedW - 44, COLORS.faint);
    });
    const rx = M + schedW + 40;
    const rw = W - M - rx;
    label(ctx, 'Top Priorities', rx, M + 76, { size: 14, color: COLORS.softInk });
    for (let i = 0; i < 3; i++) {
      const y = M + 118 + i * 56;
      text(ctx, (i + 1) + '.', rx, y, `600 17px ${SERIF}`, COLORS.softInk);
      hline(ctx, rx + 30, y, rw - 30, COLORS.faint);
    }
    label(ctx, 'Notes / Tasks', rx, M + 320, { size: 14, color: COLORS.softInk });
    for (let i = 0; i < 6; i++) {
      const y = M + 358 + i * 56;
      checkbox(ctx, rx, y - 14, 18); hline(ctx, rx + 28, y, rw - 28, COLORS.faint);
    }
    label(ctx, "Today's Verse", rx, M + 720, { size: 14, color: COLORS.softInk });
    ruled(ctx, rx, M + 752, rw, 2, 36);
  }

  function weeklyTop3(ctx) {
    label(ctx, 'Weekly Top 3', M, M + 30, { size: 26, color: COLORS.ink });
    fieldLine(ctx, 'Week of', W - M - 280, M + 22, 280, 78);
    caption(ctx, 'Three tasks that must be completed this week.', M, M + 64);
    for (let n = 1; n <= 3; n++) {
      const y = M + 96 + (n - 1) * 176;
      text(ctx, String(n), M, y + 56, `700 40px ${SERIF}`, COLORS.accent);
      ctx.save(); ctx.strokeStyle = COLORS.rule; ctx.lineWidth = 1.5;
      roundRect(ctx, M + 76, y, W - 2 * M - 76, 150, 10); ctx.stroke(); ctx.restore();
    }
    label(ctx, 'Notes', M, M + 660, { size: 15, color: COLORS.ink });
    ruled(ctx, M, M + 698, W - 2 * M, 5, 46);
  }

  function weeklySchedule(ctx) {
    label(ctx, 'Weekly Schedule', M, M + 28, { size: 24, color: COLORS.ink });
    fieldLine(ctx, 'Week of', W - M - 280, M + 22, 280, 78);
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    let y = M + 70;
    days.forEach((d, i) => {
      const weekend = i >= 5;
      label(ctx, d, M, y + 18, { size: 13, color: weekend ? COLORS.accent : COLORS.ink });
      hline(ctx, M, y + 30, W - 2 * M, COLORS.faint);
      y += weekend ? 110 : 130;
    });
  }

  function monthlyCalendar(ctx) {
    label(ctx, 'Month', M, M + 28, { size: 24, color: COLORS.ink });
    hline(ctx, M + 130, M + 22, 320, COLORS.rule);
    const wd = ['S','M','T','W','T','F','S'];
    const gridY = M + 70, gridW = W - 2 * M, gridH = H - gridY - M;
    const cols = 7, rows = 6, headerH = 34;
    const cw = gridW / cols, ch = (gridH - headerH) / rows;
    ctx.textAlign = 'center';
    setLetterSpacing(ctx, 2);
    wd.forEach((d, c) => {
      text(ctx, d, M + c * cw + cw / 2, gridY + 22, `600 13px ${SANS}`,
        (c === 0 || c === 6) ? COLORS.accent : COLORS.softInk);
    });
    setLetterSpacing(ctx, 0);
    ctx.textAlign = 'left';
    ctx.save(); ctx.strokeStyle = COLORS.faint; ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      ctx.strokeRect(M + c * cw, gridY + headerH + r * ch, cw, ch);
    }
    ctx.restore();
  }

  function notesTasks(ctx) {
    headerRow(ctx, 'Notes / Tasks', true);
    for (let i = 0; i < 18; i++) {
      const y = M + 80 + i * 62;
      checkbox(ctx, M, y - 14, 20); hline(ctx, M + 32, y, W - 2 * M - 32, COLORS.faint);
    }
  }

  // ---- LifeJournal 2026 planner pages ----
  function planYear(ctx, o) {
    const P = LJPlanner;
    text(ctx, String(o.year), M, M + 64, `700 56px ${SERIF}`, COLORS.ink);
    caption(ctx, 'Tap a month to open its calendar.', M, M + 96);
    P.yearMonthRects().forEach((mr) => drawMiniMonth(ctx, o.year, mr.month, mr));
  }
  function drawMiniMonth(ctx, year, month, box) {
    const P = LJPlanner;
    text(ctx, P.MONTHS[month], box.x, box.y + 2, `600 16px ${SANS}`, COLORS.accent, 'top');
    const top = box.y + 30, cellW = box.w / 7, rowH = (box.h - 30) / 7;
    ctx.textAlign = 'center';
    for (let c = 0; c < 7; c++) {
      text(ctx, P.WD_LETTER[c], box.x + c * cellW + cellW / 2, top, `500 9px ${SANS}`, COLORS.softInk, 'top');
    }
    const cells = P.monthCells(year, month);
    for (let i = 0; i < 42; i++) {
      const cell = cells[i]; if (!cell.day) continue;
      const c = i % 7, r = Math.floor(i / 7);
      text(ctx, String(cell.day), box.x + c * cellW + cellW / 2, top + rowH * (r + 1),
           `400 10px ${SANS}`, (c === 0 || c === 6) ? COLORS.accent : COLORS.ink, 'top');
    }
    ctx.textAlign = 'left';
  }

  function planMonth(ctx, o) {
    const P = LJPlanner, g = P.monthGeom();
    label(ctx, P.MONTHS[o.month], M, M + 50, { size: 34, color: COLORS.ink, serif: true, tracking: 0, caps: false });
    text(ctx, String(o.year), M, M + 92, `400 20px ${SANS}`, COLORS.softInk);
    caption(ctx, 'Tap a date to open that day · tap the month name for the year.', M, M + 126);
    ctx.textAlign = 'center'; setLetterSpacing(ctx, 2);
    for (let c = 0; c < 7; c++) {
      text(ctx, P.WD_LETTER[c], g.gridLeft + c * g.cellW + g.cellW / 2, g.gridTop + 26,
           `600 13px ${SANS}`, (c === 0 || c === 6) ? COLORS.accent : COLORS.softInk);
    }
    setLetterSpacing(ctx, 0); ctx.textAlign = 'left';
    ctx.save(); ctx.strokeStyle = COLORS.faint; ctx.lineWidth = 1;
    P.monthCellRects(o.year, o.month).forEach((c) => {
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      if (c.day) text(ctx, String(c.day), c.x + 10, c.y + 8, `600 16px ${SANS}`, COLORS.ink, 'top');
    });
    ctx.restore();
  }

  function planDay(ctx, o) {
    const P = LJPlanner, d = P.partsFor(o.date);
    label(ctx, d.weekdayName, M, M + 40, { size: 26, color: COLORS.ink });
    text(ctx, d.long, M, M + 74, `400 18px ${SANS}`, COLORS.softInk);
    text(ctx, '‹ ' + d.monthName, W - M - 170, M + 38, `500 15px ${SANS}`, COLORS.accent);
    hline(ctx, M, M + 96, W - 2 * M, COLORS.rule);
    const hours = ['6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    label(ctx, 'Schedule', M, M + 138, { size: 14 });
    const schedW = 410;
    hours.forEach((h, i) => {
      const y = M + 180 + i * 52;
      text(ctx, h, M + 24, y, `500 13px ${SANS}`, COLORS.softInk);
      hline(ctx, M + 44, y, schedW - 44, COLORS.faint);
    });
    const rx = M + schedW + 40, rw = W - M - rx;
    label(ctx, 'Top Priorities', rx, M + 138, { size: 14 });
    for (let i = 0; i < 3; i++) {
      const y = M + 180 + i * 56;
      text(ctx, (i + 1) + '.', rx, y, `600 17px ${SERIF}`, COLORS.softInk);
      hline(ctx, rx + 30, y, rw - 30, COLORS.faint);
    }
    label(ctx, 'Notes / Tasks', rx, M + 382, { size: 14 });
    for (let i = 0; i < 6; i++) {
      const y = M + 420 + i * 56;
      checkbox(ctx, rx, y - 14, 18); hline(ctx, rx + 28, y, rw - 28, COLORS.faint);
    }
    label(ctx, "Today's Verse", rx, M + 782, { size: 14 });
    ruled(ctx, rx, M + 814, rw, 2, 36);
  }

  function planWeek(ctx, o) {
    const P = LJPlanner, ws = P.partsFor(o.weekStart);
    const endIso = P.isoFromTs(Date.UTC(ws.year, ws.month, ws.day) + 6 * P.DAY_MS);
    const we = P.partsFor(endIso);
    label(ctx, 'Week', M, M + 40, { size: 24, color: COLORS.ink });
    text(ctx, `${ws.shortMonthDay} – ${we.shortMonthDay}, ${we.year}`, M, M + 74, `400 16px ${SANS}`, COLORS.softInk);
    text(ctx, '‹ ' + ws.monthName, W - M - 170, M + 38, `500 15px ${SANS}`, COLORS.accent);
    caption(ctx, 'Tap a day to open it.', M, M + 102);
    P.weekDayRects(o.weekStart).forEach((r, i) => {
      const d = P.partsFor(r.date);
      hline(ctx, r.x, r.y, r.w, COLORS.rule);
      text(ctx, d.weekdayName, r.x, r.y + 32, `600 16px ${SANS}`, (i === 0 || i === 6) ? COLORS.accent : COLORS.ink);
      text(ctx, d.long, r.x + 200, r.y + 32, `400 14px ${SANS}`, COLORS.softInk);
      ruled(ctx, r.x, r.y + 58, r.w, 1, 40);
    });
  }

  function planWeekSermon(ctx, o) {
    const P = LJPlanner, ws = P.partsFor(o.weekStart);
    const endIso = P.isoFromTs(Date.UTC(ws.year, ws.month, ws.day) + 6 * P.DAY_MS);
    const we = P.partsFor(endIso);
    label(ctx, 'Sermon Notes', M, M + 40, { size: 24, color: COLORS.ink });
    text(ctx, `Week of ${ws.shortMonthDay} – ${we.shortMonthDay}, ${we.year}`, M, M + 74, `400 16px ${SANS}`, COLORS.softInk);
    text(ctx, '‹ ' + ws.monthName, W - M - 170, M + 38, `500 15px ${SANS}`, COLORS.accent);
    hline(ctx, M, M + 94, W - 2 * M, COLORS.rule);
    const half = (W - 2 * M) / 2 - 20;
    fieldLine(ctx, 'Speaker', M, M + 138, half, 74);
    fieldLine(ctx, 'Passage', M + half + 40, M + 138, half, 74);
    label(ctx, 'Message', M, M + 188, { size: 14 });
    ruled(ctx, M, M + 216, W - 2 * M, 11, 46);
    const colW = (W - 2 * M) / 2 - 16;
    label(ctx, 'Key Verse', M, M + 760, { size: 14, color: COLORS.ink });
    ruled(ctx, M, M + 790, colW, 2, 36);
    label(ctx, "How I'll Apply This", M + colW + 32, M + 760, { size: 14, color: COLORS.ink });
    ruled(ctx, M + colW + 32, M + 790, colW, 2, 36);
  }

  function lined(ctx) { ruled(ctx, M, M + 48, W - 2 * M, 26, 48); }
  function dotted(ctx) {
    for (let y = M; y < H - M; y += 42) for (let x = M; x < W - M; x += 42) dot(ctx, x, y, 1.4, COLORS.rule);
  }
  function blank() { /* nothing */ }

  const DRAW = {
    cover, soap, sermonNotes, prayerList, gratitude, dailyPlanner,
    weeklyTop3, weeklySchedule, monthlyCalendar, notesTasks, lined, dotted, blank,
    planYear, planMonth, planDay, planWeek, planWeekSermon
  };

  // Public: draw a template into ctx (already scaled to page units).
  function draw(ctx, type, opts) {
    ctx.save();
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
    (DRAW[type] || blank)(ctx, opts || {});
    ctx.restore();
  }

  return { draw };
})();
