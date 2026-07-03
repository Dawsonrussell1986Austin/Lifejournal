// The handwriting engine: a template background canvas + an ink canvas driven
// by Pointer Events. Supports Apple Pencil pressure, a highlighter, and a
// (whole-stroke) eraser. Strokes are stored as vectors in page coordinates so
// they render crisply at any zoom and export cleanly to PDF.
window.JournalCanvas = (function () {
  const { PAGE } = LJData;

  class JournalCanvas {
    constructor(bgCanvas, inkCanvas, wrap) {
      this.bg = bgCanvas;
      this.ink = inkCanvas;
      this.wrap = wrap;
      this.bgCtx = bgCanvas.getContext('2d');
      this.inkCtx = inkCanvas.getContext('2d');

      this.strokes = [];
      this.current = null;
      this.tool = 'pen';
      this.color = '#1f2330';
      this.baseWidth = 3;
      this.pencilOnly = false;
      this.activePointer = null;
      this.onChange = null;

      this._bindEvents();
    }

    setTemplate(type, opts) { this.templateType = type; this.templateOpts = opts; this._renderBackground(); }
    setStrokes(strokes) { this.strokes = strokes || []; this._renderInk(); }
    setTool(t) { this.tool = t; }
    setColor(c) { this.color = c; }
    setWidth(w) { this.baseWidth = w; }
    setPencilOnly(v) { this.pencilOnly = v; }

    // Fit the page to the stage WIDTH (GoodNotes-style): the sheet fills the
    // editor horizontally and scrolls vertically, capped so huge monitors
    // don't blow the page up past comfortable reading size.
    layout(stageW, stageH) {
      const scale = Math.min(stageW / PAGE.W, 1180 / PAGE.W);
      const cssW = Math.max(1, Math.floor(PAGE.W * scale));
      const cssH = Math.max(1, Math.floor(PAGE.H * scale));
      this.scaleFactor = cssW / PAGE.W; // CSS px per page unit (for the text layer)
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.wrap.style.width = cssW + 'px';
      this.wrap.style.height = cssH + 'px';
      [this.bg, this.ink].forEach((c) => {
        c.width = Math.floor(PAGE.W * dpr);
        c.height = Math.floor(PAGE.H * dpr);
      });
      this.dpr = dpr;
      this._scaleCtx(this.bgCtx);
      this._scaleCtx(this.inkCtx);
      this._renderBackground();
      this._renderInk();
    }

    _scaleCtx(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(this.dpr, this.dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    _renderBackground() {
      if (!this.templateType) return;
      this.bgCtx.clearRect(0, 0, PAGE.W, PAGE.H);
      LJTemplates.draw(this.bgCtx, this.templateType, this.templateOpts);
    }

    _renderInk() {
      this.inkCtx.clearRect(0, 0, PAGE.W, PAGE.H);
      for (const s of this.strokes) this._drawStroke(this.inkCtx, s);
    }

    _drawStroke(ctx, s) {
      const pts = s.points;
      if (!pts.length) return;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.marker ? 0.32 : 1;
      ctx.globalCompositeOperation = 'source-over';
      if (pts.length === 1) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, this._segWidth(s, pts[0].p) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        ctx.beginPath();
        ctx.lineWidth = this._segWidth(s, (a.p + b.p) / 2);
        ctx.moveTo(a.x, a.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ctx.quadraticCurveTo(a.x, a.y, mx, my);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _segWidth(s, pressure) {
      const base = s.width;
      if (s.marker) return base * 4;
      const p = pressure == null ? 0.5 : pressure;
      return base * (0.45 + 1.15 * p);
    }

    // ---- pointer handling ----
    _bindEvents() {
      const ink = this.ink;
      ink.addEventListener('pointerdown', (e) => this._down(e));
      ink.addEventListener('pointermove', (e) => this._move(e));
      ink.addEventListener('pointerup', (e) => this._up(e));
      ink.addEventListener('pointercancel', (e) => this._up(e));
      ink.addEventListener('pointerleave', (e) => this._up(e));
      ink.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _shouldIgnore(e) {
      if (this.pencilOnly && e.pointerType === 'touch') return true;
      return false;
    }

    _toPage(e) {
      const r = this.ink.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width * PAGE.W,
        y: (e.clientY - r.top) / r.height * PAGE.H,
        p: e.pressure && e.pressure > 0 ? e.pressure : (e.pointerType === 'pen' ? 0.5 : 0.5)
      };
    }

    // Map a client point to page units (used by the text layer).
    clientToPage(clientX, clientY) {
      const r = this.ink.getBoundingClientRect();
      return {
        x: (clientX - r.left) / r.width * PAGE.W,
        y: (clientY - r.top) / r.height * PAGE.H
      };
    }

    _isDrawingTool() { return this.tool === 'pen' || this.tool === 'marker' || this.tool === 'eraser'; }

    _down(e) {
      if (!this._isDrawingTool()) return; // Text tool is handled by the DOM layer
      if (this._shouldIgnore(e)) return;
      e.preventDefault();
      this.activePointer = e.pointerId;
      try { this.ink.setPointerCapture(e.pointerId); } catch (_) {}
      const pt = this._toPage(e);
      if (this.tool === 'eraser') { this._erodeAt(pt); return; }
      this.current = { color: this.color, width: this.baseWidth, marker: this.tool === 'marker', points: [pt] };
      this._drawDot(pt);
    }

    _move(e) {
      if (this.activePointer !== e.pointerId) return;
      if (this._shouldIgnore(e)) return;
      e.preventDefault();
      const events = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ev of events) {
        const pt = this._toPage(ev);
        if (this.tool === 'eraser') { this._erodeAt(pt); continue; }
        if (!this.current) continue;
        const last = this.current.points[this.current.points.length - 1];
        this.current.points.push(pt);
        this._drawSegment(last, pt);
      }
    }

    _up(e) {
      if (this.activePointer !== e.pointerId) return;
      this.activePointer = null;
      try { this.ink.releasePointerCapture(e.pointerId); } catch (_) {}
      if (this.current && this.current.points.length) {
        this.strokes.push(this.current);
        this._emitChange();
      }
      this.current = null;
    }

    _drawDot(pt) {
      const ctx = this.inkCtx;
      ctx.save();
      ctx.globalAlpha = this.tool === 'marker' ? 0.32 : 1;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this._segWidth(this.current, pt.p) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawSegment(a, b) {
      const ctx = this.inkCtx;
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = this.tool === 'marker' ? 0.32 : 1;
      ctx.lineWidth = this._segWidth(this.current, (a.p + b.p) / 2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.quadraticCurveTo(a.x, a.y, mx, my);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    _erodeAt(pt) {
      const r = 18 + this.baseWidth * 2;
      const before = this.strokes.length;
      this.strokes = this.strokes.filter((s) => !this._strokeNear(s, pt, r));
      if (this.strokes.length !== before) { this._renderInk(); this._emitChange(); }
    }

    _strokeNear(s, pt, r) {
      for (const p of s.points) {
        const dx = p.x - pt.x, dy = p.y - pt.y;
        if (dx * dx + dy * dy <= r * r) return true;
      }
      return false;
    }

    undo() {
      if (!this.strokes.length) return;
      this.strokes.pop();
      this._renderInk();
      this._emitChange();
    }

    _emitChange() { if (this.onChange) this.onChange(this.strokes); }

    // Compose template + ink into one canvas for export at a given scale.
    renderComposite(scale) {
      const out = document.createElement('canvas');
      out.width = PAGE.W * scale; out.height = PAGE.H * scale;
      const ctx = out.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE.W, PAGE.H);
      LJTemplates.draw(ctx, this.templateType, this.templateOpts);
      for (const s of this.strokes) this._drawStroke(ctx, s);
      return out;
    }
  }

  // Draw text boxes onto a canvas (for thumbnails / PDF export).
  function drawTexts(ctx, texts) {
    const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    for (const t of texts || []) {
      if (!t.text) continue;
      ctx.save();
      ctx.fillStyle = t.color || '#1f2330';
      ctx.font = `400 ${t.size}px ${SANS}`;
      ctx.textBaseline = 'top';
      const pad = t.size * 0.22;
      const lineH = t.size * 1.3;
      let y = t.y + pad;
      const maxW = t.w - pad * 2;
      String(t.text).split('\n').forEach((para) => {
        const words = para.split(' ');
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, t.x + pad, y); y += lineH; line = w;
          } else line = test;
        }
        ctx.fillText(line, t.x + pad, y); y += lineH;
      });
      ctx.restore();
    }
  }

  // Draw typed field entries onto a canvas so thumbnails / PDF export match
  // what the live field layer shows (text resting just above each line).
  function drawFields(ctx, template, fields) {
    if (!fields) return;
    const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    const rects = LJTemplates.fieldRects(template) || [];
    ctx.save();
    ctx.fillStyle = '#1f2330';
    ctx.textBaseline = 'alphabetic';
    for (const f of rects) {
      const v = fields[f.id];
      if (!v) continue;
      // Shrink the font until the entry fits its slot — reads better in a PDF
      // than fillText's horizontal glyph squeeze.
      let fs = (f.size || 26) * 0.86 - 2;
      const str = String(v), maxW = f.w - 4;
      const fam = f.serif ? 'Georgia, serif' : SANS;
      const style = (f.serif && f.italic) ? 'italic ' : '';
      ctx.font = `${style}400 ${fs}px ${fam}`;
      while (fs > 9 && ctx.measureText(str).width > maxW) {
        fs -= 1;
        ctx.font = `${style}400 ${fs}px ${fam}`;
      }
      ctx.fillText(str, f.x + 2, f.y - 5, maxW);
    }
    ctx.restore();
  }

  // Draw ✓ marks in checked boxes for thumbnails / PDF export.
  function drawChecks(ctx, template, checks) {
    if (!checks) return;
    const rects = LJTemplates.checkRects(template) || [];
    ctx.save();
    ctx.strokeStyle = '#4a5f50';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of rects) {
      if (!checks[r.id]) continue;
      if (r.kind === 'pill') {
        // filled pill with its label in white (matches the on-screen chip)
        ctx.fillStyle = '#2f4a3b';
        ctx.beginPath();
        const rr = r.h / 2;
        ctx.roundRect ? ctx.roundRect(r.x, r.y, r.w, r.h, rr) : ctx.rect(r.x, r.y, r.w, r.h);
        ctx.fill();
        ctx.save();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
        ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2 + 1);
        ctx.restore();
        continue;
      }
      const s = r.size;
      ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(r.x + s * 0.22, r.y + s * 0.55);
      ctx.lineTo(r.x + s * 0.42, r.y + s * 0.75);
      ctx.lineTo(r.x + s * 0.8, r.y + s * 0.28);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Build the draw options for a page (cover context + planner date fields).
  function templateOpts(page, journal) {
    const cv = LJData.COVERS[journal.cover] || LJData.COVERS.sage;
    return {
      title: journal.title, cover: journal.cover, tint: cv.vivid || cv.c1,
      paper: page.paper || journal.paper || 'white',
      year: page.year, month: page.month, date: page.date, weekStart: page.weekStart
    };
  }

  // Stand-alone helper to render any page (used for thumbnails / export).
  // `photoImg` (optional) is drawn into the month photo band for planMonth.
  function renderPageCanvas(page, journal, scale, photoImg) {
    // Composite renders (PDF export, thumbnails) always use the light paper
    // palette regardless of the on-screen theme — dark pages don't print.
    const prevPalette = LJData.currentPalette();
    LJData.setPalette('light');
    try {
      const out = document.createElement('canvas');
      out.width = PAGE.W * scale; out.height = PAGE.H * scale;
      const ctx = out.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE.W, PAGE.H);
      const opts = templateOpts(page, journal);
      if (photoImg) opts.photo = photoImg;
      LJTemplates.draw(ctx, page.template, opts);
      const data = LJStore.loadPageData(page.id);
      const jc = JournalCanvas.prototype;
      for (const s of data.strokes) jc._drawStroke.call({ _segWidth: jc._segWidth }, ctx, s);
      drawTexts(ctx, data.texts);
      drawFields(ctx, page.template, data.fields);
      drawChecks(ctx, page.template, data.checks);
      return out;
    } finally {
      LJData.setPalette(prevPalette);
    }
  }

  JournalCanvas.renderPageCanvas = renderPageCanvas;
  JournalCanvas.drawTexts = drawTexts;
  JournalCanvas.drawFields = drawFields;
  JournalCanvas.drawChecks = drawChecks;
  JournalCanvas.templateOpts = templateOpts;
  return JournalCanvas;
})();
