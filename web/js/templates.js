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
  // Draw an image cover-fit (centered, cropped) into a rounded rect.
  function drawCover(ctx, img, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    const ir = img.width / img.height, rr = w / h;
    let dw, dh, dx, dy;
    if (ir > rr) { dh = h; dw = h * ir; dx = x - (dw - w) / 2; dy = y; }
    else { dw = w; dh = w / ir; dx = x; dy = y - (dh - h) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
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

    // --- cloth hardcover ---
    const g = ctx.createLinearGradient(0, 0, W * 0.5, H);
    g.addColorStop(0, cv.c2); g.addColorStop(1, cv.c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint woven texture
    ctx.save(); ctx.globalAlpha = 0.04; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.restore();

    // --- page block along the right edge ---
    const edgeW = 24;
    ctx.fillStyle = '#f1eee5'; ctx.fillRect(W - edgeW, 10, edgeW, H - 20);
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
    for (let y = 18; y < H - 14; y += 4) { ctx.beginPath(); ctx.moveTo(W - edgeW, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // --- elastic band (flat, near the right edge) ---
    const band = cv.band || '#d8432e';
    const bx = Math.round(W * 0.82), bw = 40;
    ctx.fillStyle = band; ctx.fillRect(bx, -6, bw, H + 12);

    // --- title content, centered in the cloth area left of the band ---
    const cw = bx, cx = cw / 2;
    ctx.textAlign = 'center';
    text(ctx, '✝', cx, H * 0.30, `300 54px ${SERIF}`, cv.foil, 'middle');
    ctx.fillStyle = cv.foil; ctx.textBaseline = 'middle';
    wrapCentered(ctx, o.title || 'Life Journal', cx, H * 0.42, cw - 130, 54, `700 52px ${SERIF}`);
    ctx.strokeStyle = cv.foil; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 48, H * 0.515); ctx.lineTo(cx + 48, H * 0.515); ctx.stroke();
    ctx.fillStyle = cv.foil; ctx.globalAlpha = 0.95; ctx.textBaseline = 'middle';
    wrapCentered(ctx, cv.verse, cx, H * 0.60, cw - 150, 27, `italic 18px ${SERIF}`);
    ctx.globalAlpha = 1;
    setLetterSpacing(ctx, 2);
    text(ctx, 'THIS JOURNAL BELONGS TO', cx, H * 0.86, `600 12px ${SANS}`, cv.foil, 'middle');
    setLetterSpacing(ctx, 0);
    ctx.save(); ctx.strokeStyle = cv.foil; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(cx - 120, H * 0.89); ctx.lineTo(cx + 120, H * 0.89); ctx.stroke(); ctx.restore();
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
    // Photo band placeholder — the live editor overlays the real photo here,
    // and PDF export draws it in (see o.photo). This soft gradient shows in
    // thumbnails / if a photo is missing.
    const pb = P.monthPhotoRect();
    if (o.photo) {
      drawCover(ctx, o.photo, pb.x, pb.y, pb.w, pb.h, 18);
    } else {
      ctx.save();
      roundRect(ctx, pb.x, pb.y, pb.w, pb.h, 18);
      const grad = ctx.createLinearGradient(pb.x, pb.y, pb.x, pb.y + pb.h);
      grad.addColorStop(0, '#e3e8ee'); grad.addColorStop(1, '#cdd5df');
      ctx.fillStyle = grad; ctx.fill();
      ctx.fillStyle = '#9aa3b0'; ctx.textAlign = 'center';
      text(ctx, '⛰  Add a photo', pb.x + pb.w / 2, pb.y + pb.h / 2, `500 22px ${SANS}`, '#8b94a3', 'middle');
      ctx.textAlign = 'left'; ctx.restore();
    }
    const ty = pb.y + pb.h + 60;
    label(ctx, P.MONTHS[o.month], M, ty, { size: 34, color: COLORS.ink, serif: true, tracking: 0, caps: false });
    text(ctx, String(o.year), M + 330, ty, `400 20px ${SANS}`, COLORS.softInk);
    ctx.textAlign = 'center'; setLetterSpacing(ctx, 2);
    for (let c = 0; c < 7; c++) {
      text(ctx, P.WD_LETTER[c], g.gridLeft + c * g.cellW + g.cellW / 2, g.gridTop + 26,
           `600 13px ${SANS}`, (c === 0 || c === 6) ? COLORS.accent : COLORS.softInk);
    }
    setLetterSpacing(ctx, 0); ctx.textAlign = 'left';
    const today = P.todayISO();
    ctx.save(); ctx.strokeStyle = COLORS.faint; ctx.lineWidth = 1;
    P.monthCellRects(o.year, o.month).forEach((c) => {
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      if (!c.day) return;
      if (c.date === today) {
        ctx.save();
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath(); ctx.arc(c.x + 18, c.y + 17, 15, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'center';
        text(ctx, String(c.day), c.x + 18, c.y + 17, `700 16px ${SANS}`, '#ffffff', 'middle');
        ctx.restore();
      } else {
        text(ctx, String(c.day), c.x + 10, c.y + 8, `600 16px ${SANS}`, COLORS.ink, 'top');
      }
    });
    ctx.restore();
  }

  // Shared daily-page geometry so the drawn boxes and the interactive overlay
  // (tappable checks + "now" marker) never drift apart.
  const SCHED_HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; // 5am–9pm

  // Five-Foundations-style daily page geometry, shared by planDay (dated) and
  // the foundationsDaily template so the drawn lines, typed fields, tappable
  // checkboxes and the "now" marker all stay aligned.
  function dailyLayout() {
    const rx = M + 446, rw = W - M - rx;
    return {
      rx, rw, schedLineX: M + 42, schedRight: M + 406,
      thankY: M + 58, thankGap: 28, thankRows: 2, thankW: (W - 2 * M) / 2,
      schedLabelY: M + 124, schedTop: M + 168, schedRowH: 42,
      top3Y: M + 160, top3Gap: 42,
      scr: { y: M + 320, d: [M + 368, M + 402] },
      obs: { y: M + 430, d: [M + 478, M + 512] },
      gos: { y: M + 540, d: [M + 588, M + 622] },
      stepsY: M + 700, stepsGap: 34,
      jrnLabelY: M + 904, jrnTop: M + 940, jrnGap: 36, jrnRows: 7
    };
  }
  function dailyChecks() {
    const L = dailyLayout(), out = [];
    for (let i = 0; i < 3; i++) out.push({ id: 'top' + i, x: L.rx + L.rw - 26, y: L.top3Y + i * L.top3Gap - 16, size: 20 });
    for (let i = 0; i < 5; i++) out.push({ id: 'step' + i, x: L.rx + L.rw - 26, y: L.stepsY + i * L.stepsGap - 13, size: 18 });
    return out;
  }
  function dailyFields() {
    const L = dailyLayout(), f = [];
    for (let i = 0; i < L.thankRows; i++) f.push({ id: 'th' + i, x: M, y: L.thankY + i * L.thankGap, w: L.thankW, size: 22 });
    SCHED_HOURS.forEach((h, i) => f.push({ id: 'sch' + i, x: L.schedLineX, y: L.schedTop + i * L.schedRowH, w: L.schedRight - L.schedLineX, size: 22 }));
    L.scr.d.forEach((y, i) => f.push({ id: 'scr' + i, x: L.rx, y, w: L.rw, size: 20 }));
    L.obs.d.forEach((y, i) => f.push({ id: 'obs' + i, x: L.rx, y, w: L.rw, size: 20 }));
    L.gos.d.forEach((y, i) => f.push({ id: 'gos' + i, x: L.rx, y, w: L.rw, size: 20 }));
    for (let i = 0; i < 3; i++) f.push({ id: 'top' + i, x: L.rx + 26, y: L.top3Y + i * L.top3Gap, w: L.rw - 62, size: 22 });
    for (let i = 0; i < 5; i++) f.push({ id: 'step' + i, x: L.rx + 100, y: L.stepsY + i * L.stepsGap, w: L.rw - 100 - 34, size: 20 });
    for (let i = 0; i < L.jrnRows; i++) f.push({ id: 'jrn' + i, x: M, y: L.jrnTop + i * L.jrnGap, w: W - 2 * M, size: 22 });
    return f;
  }
  function daySection(ctx, title, prompt, x, y) {
    ctx.save();
    ctx.font = `700 13px ${SANS}`; ctx.fillStyle = COLORS.ink; ctx.textBaseline = 'alphabetic';
    setLetterSpacing(ctx, 1); ctx.fillText(title, x, y);
    const w = ctx.measureText(title).width;
    setLetterSpacing(ctx, 0); ctx.restore();
    text(ctx, prompt, x + w + 14, y, `400 12px ${SANS}`, COLORS.softInk);
  }
  function drawDaily(ctx, dated) {
    const L = dailyLayout(), FIVE = ['Faith', 'Family', 'Finances', 'Fitness', 'Focus'];
    setLetterSpacing(ctx, 1);
    text(ctx, 'I AM THANKFUL FOR…', M, M + 30, `700 15px ${SANS}`, COLORS.ink);
    setLetterSpacing(ctx, 0);
    // date (far top-right corner) + weekday markers below it
    let activeWd = -1, dateStr = 'DATE      /      /';
    if (dated && window.LJPlanner) { const p = LJPlanner.partsFor(dated); activeWd = p.weekday; dateStr = p.long; }
    ctx.save(); ctx.textAlign = 'right';
    text(ctx, dateStr, W - M, M + 30, `600 15px ${SANS}`, COLORS.ink);
    ctx.restore();
    const wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    ctx.save(); ctx.textAlign = 'center';
    wd.forEach((d, i) => {
      const x = W - M - 128 + i * 20, on = i === activeWd;
      if (on) { ctx.fillStyle = COLORS.accent; ctx.beginPath(); ctx.arc(x, M + 56, 9, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, d, x, M + 60, `700 12px ${SANS}`, on ? '#fff' : COLORS.softInk);
    });
    ctx.textAlign = 'left'; ctx.restore();
    dotRows(ctx, M, L.thankY, L.thankW, L.thankRows, L.thankGap);

    setLetterSpacing(ctx, 1); text(ctx, 'DAILY SCHEDULE', M, L.schedLabelY, `700 13px ${SANS}`, COLORS.ink); setLetterSpacing(ctx, 0);
    SCHED_HOURS.forEach((h, i) => {
      const y = L.schedTop + i * L.schedRowH, lbl = h > 12 ? h - 12 : h;
      text(ctx, String(lbl), M + 8, y, `600 12px ${SANS}`, COLORS.softInk);
      dotLine(ctx, L.schedLineX, y, L.schedRight - L.schedLineX);
    });

    daySection(ctx, 'SCRIPTURE', 'What did I read?', L.rx, L.scr.y);
    L.scr.d.forEach((y) => dotLine(ctx, L.rx, y, L.rw));
    daySection(ctx, 'OBSERVE & APPLY', 'What did I learn?', L.rx, L.obs.y);
    L.obs.d.forEach((y) => dotLine(ctx, L.rx, y, L.rw));
    daySection(ctx, 'THE GOSPEL', 'How does this point to Christ?', L.rx, L.gos.y);
    L.gos.d.forEach((y) => dotLine(ctx, L.rx, y, L.rw));

    daySection(ctx, "TODAY'S TOP 3", 'Three tasks that must be done today.', L.rx, L.top3Y - 30);
    for (let i = 0; i < 3; i++) { const y = L.top3Y + i * L.top3Gap; text(ctx, (i + 1) + '.', L.rx, y, `600 14px ${SERIF}`, COLORS.softInk); dotLine(ctx, L.rx + 26, y, L.rw - 62); }
    setLetterSpacing(ctx, 1); text(ctx, 'FIVE FOUNDATIONS DAILY STEPS', L.rx, L.stepsY - 32, `700 13px ${SANS}`, COLORS.ink); setLetterSpacing(ctx, 0);
    FIVE.forEach((fn, i) => { const y = L.stepsY + i * L.stepsGap; text(ctx, fn.toUpperCase(), L.rx, y, `600 12px ${SANS}`, COLORS.ink); dotLine(ctx, L.rx + 100, y, L.rw - 100 - 34); });

    setLetterSpacing(ctx, 1); text(ctx, 'JOURNAL / NOTES / PRAYER', M, L.jrnLabelY, `700 13px ${SANS}`, COLORS.ink); setLetterSpacing(ctx, 0);
    for (let i = 0; i < L.jrnRows; i++) dotLine(ctx, M, L.jrnTop + i * L.jrnGap, W - 2 * M);

    dailyChecks().forEach((r) => checkbox(ctx, r.x, r.y, r.size));
  }
  function planDay(ctx, o) { drawDaily(ctx, o.date); }

  // Tappable S M T W T F S markers in the daily header → jump to that weekday.
  function dailyWeekdayRects() {
    const out = [];
    for (let i = 0; i < 7; i++) out.push({ wd: i, x: W - M - 128 + i * 20 - 11, y: M + 56 - 12, w: 22, h: 24 });
    return out;
  }

  // Interactive checkbox rects for a template (empty = none).
  function checkRects(template) {
    if (template === 'planDay' || template === 'foundationsDaily') return dailyChecks();
    if (template === 'dailyPlanner') {
      const rx = M + 450, out = [];
      for (let i = 0; i < 6; i++) out.push({ id: 'task' + i, x: rx, y: M + 358 + i * 56 - 14, size: 18 });
      return out;
    }
    if (template === 'notesTasks') {
      const out = [];
      for (let i = 0; i < 18; i++) out.push({ id: 'task' + i, x: M, y: M + 80 + i * 62 - 14, size: 20 });
      return out;
    }
    if (template === 'prayerList') {
      const colW = (W - 2 * M) / 2 - 20, out = [];
      for (let i = 0; i < 9; i++) {
        out.push({ id: 'req' + i, x: M, y: M + 140 + i * 110, size: 20 });
        out.push({ id: 'ans' + i, x: M + colW + 40, y: M + 140 + i * 110, size: 20 });
      }
      return out;
    }
    if (template === 'weeklyFoundations') {
      const L = weeklyFoundationsLayout(), out = [];
      for (let i = 0; i < 5; i++) out.push({ id: 'wprog' + i, x: W - M - 26, y: L.progY + i * L.progGap - 14, size: 18 });
      return out;
    }
    return [];
  }

  // ---- Typed fields: where you can click-and-type into a template's slots ----
  function lineFields(prefix, x, y0, w, count, gap, size) {
    const out = [];
    for (let i = 0; i < count; i++) out.push({ id: prefix + i, x: x, y: y0 + i * gap, w: w, size: size || 28 });
    return out;
  }
  function dailyPlannerFields() {
    const schedW = 410, rx = M + schedW + 40, rw = W - M - rx, f = [];
    for (let i = 0; i < 16; i++) f.push({ id: 'sch' + i, x: M + 44, y: M + 120 + i * 52, w: schedW - 44, size: 24 });
    for (let i = 0; i < 3; i++) f.push({ id: 'pri' + i, x: rx + 30, y: M + 118 + i * 56, w: rw - 30, size: 26 });
    for (let i = 0; i < 6; i++) f.push({ id: 'tsk' + i, x: rx + 28, y: M + 358 + i * 56, w: rw - 28, size: 24 });
    for (let i = 0; i < 2; i++) f.push({ id: 'vrs' + i, x: rx, y: M + 752 + i * 36, w: rw, size: 22 });
    return f;
  }
  function weeklyPrayerFields() {
    let f = lineFields('p', M, M + 116, W - 2 * M, 6, 30, 24);
    f = f.concat(lineFields('w', M, M + 380, W - 2 * M, 9, 40, 26));
    f = f.concat(lineFields('g', M, M + 790, W - 2 * M, 7, 30, 24));
    return f;
  }
  function weeklyFoundationsFields() {
    const L = weeklyFoundationsLayout(), f = [];
    for (let i = 0; i < 5; i++) f.push({ id: 'goal' + i, x: M + 110, y: M + 124 + i * 40, w: W - 2 * M - 110, size: 22 });
    for (let i = 0; i < 5; i++) f.push({ id: 'prog' + i, x: M + 96, y: L.progY + i * L.progGap, w: W - 2 * M - 96 - 40, size: 22 });
    f.push({ id: 'fpray', x: M, y: L.prayerY + 26, w: W - 2 * M, size: 22 });
    return f.concat(lineFields('hab', M, L.habitY + 42, W - 2 * M, 5, 38, 22));
  }

  function fieldRects(template) {
    switch (template) {
      case 'planDay': return dailyFields();
      case 'dailyPlanner': return dailyPlannerFields();
      case 'foundationsDaily': return dailyFields();
      case 'weeklyPrayer': return weeklyPrayerFields();
      case 'weeklyFoundations': return weeklyFoundationsFields();
      case 'notesTasks': return lineFields('n', M + 32, M + 80, W - 2 * M - 32, 18, 62, 26);
      case 'teachingNotes': return lineFields('t', M, M + 154, W - 2 * M, 23, 46, 26);
      case 'sermonNotes': return lineFields('m', M, M + 214, W - 2 * M, 11, 46, 26);
      case 'gratitude': return lineFields('g', M + 30, M + 150, W - 2 * M - 30, 5, 64, 28);
      case 'lined': return lineFields('l', M, M + 48, W - 2 * M, 26, 48, 28);
      case 'dotted': return lineFields('l', M, M + 42, W - 2 * M, 28, 42, 26);
      case 'blank': return lineFields('l', M, M + 60, W - 2 * M, 22, 54, 30);
      default: return [];
    }
  }

  // A live "you are here" marker for the daily schedule, only on today's page.
  function nowMarker(page) {
    if (page.template !== 'planDay' || !page.date || !window.LJPlanner) return null;
    if (page.date !== LJPlanner.todayISO()) return null;
    const now = new Date(), hour = now.getHours() + now.getMinutes() / 60;
    if (hour < SCHED_HOURS[0] || hour > SCHED_HOURS[SCHED_HOURS.length - 1] + 1) return null;
    const L = dailyLayout();
    const y = L.schedTop + (hour - SCHED_HOURS[0]) * L.schedRowH;
    const label = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { x: M, y: y, w: L.schedRight - M, label: label };
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

  // ---- Five Foundations templates (interactive Christian planner) ----
  function dotLine(ctx, x, y, w, color) {
    ctx.save(); ctx.fillStyle = color || COLORS.rule;
    for (let xx = x; xx <= x + w; xx += 16) { ctx.beginPath(); ctx.arc(xx, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function dotRows(ctx, x, y, w, count, gap) { for (let i = 0; i < count; i++) dotLine(ctx, x, y + i * gap, w); }
  function dayHeads(ctx, x, y, w) {
    const D = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], cw = w / 7;
    ctx.save(); ctx.textAlign = 'center';
    D.forEach((d, i) => text(ctx, d, x + cw * i + cw / 2, y, `600 11px ${SANS}`, COLORS.softInk));
    ctx.textAlign = 'left'; ctx.restore();
  }
  const FOUND = ['Faith', 'Family', 'Finances', 'Fitness', 'Focus'];

  function foundationsDaily(ctx, o) { drawDaily(ctx, null); }

  function weeklyPrayer(ctx, o) {
    label(ctx, 'Prayer Journal', M, M + 36, { size: 22, color: COLORS.ink });
    label(ctx, '90 Day Prayer', M, M + 86, { size: 13, color: COLORS.ink });
    caption(ctx, 'Write one prayer to pray each day for the next 90 days.', M + 210, M + 86);
    dotRows(ctx, M, M + 116, W - 2 * M, 6, 30);
    label(ctx, 'Weekly Prayer Focus', M, M + 336, { size: 13, color: COLORS.ink });
    caption(ctx, 'Who and what will you pray for this week?', M + 250, M + 336);
    dayHeads(ctx, M, M + 360, W - 2 * M);
    ruled(ctx, M, M + 380, W - 2 * M, 9, 40);
    label(ctx, "God's Provision", M, M + 760, { size: 13, color: COLORS.ink });
    caption(ctx, 'How has God answered or worked this week?', M + 210, M + 760);
    dotRows(ctx, M, M + 790, W - 2 * M, 7, 30);
  }

  function weeklyFoundationsLayout() {
    return { progLabelY: M + 340, progY: M + 376, progGap: 40, prayerY: M + 600, habitY: M + 760 };
  }
  function weeklyFoundations(ctx, o) {
    const L = weeklyFoundationsLayout();
    label(ctx, 'Five Foundations', M, M + 36, { size: 22, color: COLORS.ink });
    label(ctx, 'Five Foundations Goals', M, M + 86, { size: 13, color: COLORS.ink });
    caption(ctx, 'Re-write your 13-week goals.', M + 250, M + 86);
    FOUND.forEach((f, i) => fieldLine(ctx, f, M, M + 124 + i * 40, W - 2 * M, 110));
    label(ctx, 'Weekly Progress', M, L.progLabelY, { size: 13, color: COLORS.ink });
    caption(ctx, 'Track progress to completing your goals.', M + 220, L.progLabelY);
    FOUND.forEach((f, i) => { const y = L.progY + i * L.progGap; text(ctx, f.toUpperCase(), M, y, `600 12px ${SANS}`, COLORS.ink); hline(ctx, M + 96, y, W - 2 * M - 96 - 34, COLORS.faint); });
    label(ctx, 'Five Foundations Prayer', M, L.prayerY, { size: 13, color: COLORS.ink });
    dotRows(ctx, M, L.prayerY + 26, W - 2 * M, 3, 30);
    label(ctx, 'Weekly Habit Tracking', M, L.habitY, { size: 13, color: COLORS.ink });
    dayHeads(ctx, M + 200, L.habitY + 24, W - 2 * M - 360);
    text(ctx, 'GOAL', W - M - 120, L.habitY + 24, `600 11px ${SANS}`, COLORS.softInk);
    text(ctx, 'RESULT', W - M - 60, L.habitY + 24, `600 11px ${SANS}`, COLORS.softInk);
    ruled(ctx, M, L.habitY + 42, W - 2 * M, 5, 38);
    checkRects('weeklyFoundations').forEach((r) => checkbox(ctx, r.x, r.y, r.size));
  }

  function teachingNotes(ctx, o) {
    setLetterSpacing(ctx, 1);
    text(ctx, 'SERMON / TEACHING / PODCAST / OTHER', M, M + 30, `600 13px ${SANS}`, COLORS.ink);
    text(ctx, 'LOCATION', W - M - 300, M + 30, `600 13px ${SANS}`, COLORS.softInk);
    setLetterSpacing(ctx, 0);
    hline(ctx, W - M - 210, M + 32, 210, COLORS.rule);
    fieldLine(ctx, 'Date', M, M + 70, 210, 48);
    fieldLine(ctx, 'Time', M + 240, M + 70, 150, 48);
    text(ctx, 'AM / PM', M + 410, M + 70, `600 12px ${SANS}`, COLORS.softInk);
    fieldLine(ctx, 'Speaker', M + 540, M + 70, W - M - (M + 540), 84);
    setLetterSpacing(ctx, 1); text(ctx, 'TITLE', M, M + 108, `600 13px ${SANS}`, COLORS.softInk); setLetterSpacing(ctx, 0);
    ctx.fillStyle = COLORS.faint; ctx.fillRect(M + 64, M + 96, W - 2 * M - 64, 16);
    ruled(ctx, M, M + 154, W - 2 * M, 23, 46);
  }

  function lined(ctx) { ruled(ctx, M, M + 48, W - 2 * M, 26, 48); }
  function dotted(ctx) {
    for (let y = M; y < H - M; y += 42) for (let x = M; x < W - M; x += 42) dot(ctx, x, y, 1.4, COLORS.rule);
  }
  function blank() { /* nothing */ }

  const DRAW = {
    cover, soap, sermonNotes, prayerList, gratitude, dailyPlanner,
    weeklyTop3, weeklySchedule, monthlyCalendar, notesTasks, lined, dotted, blank,
    planYear, planMonth, planDay, planWeek, planWeekSermon,
    foundationsDaily, weeklyPrayer, weeklyFoundations, teachingNotes
  };

  // Mix a hex color toward white by `amt` (0..1). Used for the soft paper tint.
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.round(c + (255 - c) * amt);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  // Fill the selectable paper (drawn UNDER the template design, GoodNotes-style).
  function paperFill(ctx, paperId, tintHex) {
    const P = LJData.PAPERS[paperId] || LJData.PAPERS.white;
    let base = P.color;
    if (paperId === 'tint' && tintHex) base = lighten(tintHex, 0.955);
    ctx.fillStyle = base || '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (P.pattern === 'grid') {
      ctx.save(); ctx.strokeStyle = '#e6e9ef'; ctx.lineWidth = 1;
      for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
    } else if (P.pattern === 'dots') {
      ctx.save(); ctx.fillStyle = '#d3d8e0';
      for (let y = 40; y < H; y += 40) for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else if (P.pattern === 'lines') {
      ctx.save(); ctx.strokeStyle = '#e6e9ef'; ctx.lineWidth = 1;
      for (let y = 80; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
    }
  }

  // Public: draw a template into ctx (already scaled to page units).
  function draw(ctx, type, opts) {
    opts = opts || {};
    ctx.save();
    if (type !== 'cover') paperFill(ctx, opts.paper || 'white', opts.tint);
    ctx.textAlign = 'left';
    (DRAW[type] || blank)(ctx, opts);
    ctx.restore();
  }

  return { draw, checkRects, nowMarker, fieldRects, dailyWeekdayRects };
})();
