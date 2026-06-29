// Main UI: library shelf, editor wiring, page navigation, modals.
(function () {
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  const state = {
    lib: LJStore.loadLibrary(),
    journal: null,
    pageIndex: 0,
    canvas: null,
    saveTimer: null,
    njCover: 'sage',
    texts: [],            // text boxes on the current page
    tool: 'pen',
    color: LJData.SWATCH_COLORS[0],
    selectedTextId: null
  };

  // ---------- Library ----------
  function renderShelf() {
    const shelf = $('#shelf');
    shelf.innerHTML = '';

    const add = el('div', 'journal-tile new-tile');
    add.innerHTML = `<div class="cover"><div class="plus">+</div><div class="lbl">New Journal</div></div><div class="tile-meta">&nbsp;</div>`;
    add.onclick = openNewJournal;
    shelf.appendChild(add);

    state.lib.journals.forEach((j) => {
      const tile = el('div', 'journal-tile');
      const cv = LJData.COVERS[j.cover] || LJData.COVERS.sage;
      const cover = el('div', 'cover');
      cover.style.background = `linear-gradient(135deg, ${cv.c1}, ${cv.c2})`;
      cover.style.color = cv.foil;
      cover.innerHTML = `<div class="c-cross">✝</div><div class="c-title">${escapeHtml(j.title)}</div><div class="c-rule"></div>`;
      tile.appendChild(cover);
      const meta = el('div', 'tile-meta');
      meta.innerHTML = `<span>${j.pages.length} page${j.pages.length === 1 ? '' : 's'}</span>`;
      const del = el('button', 'tile-del', '🗑');
      del.title = 'Delete journal';
      del.onclick = (e) => { e.stopPropagation(); deleteJournal(j.id); };
      meta.appendChild(del);
      tile.appendChild(meta);
      tile.onclick = () => openJournal(j.id);
      shelf.appendChild(tile);
    });
  }

  function deleteJournal(id) {
    if (!confirm('Delete this journal and all of its pages?')) return;
    const j = state.lib.journals.find((x) => x.id === id);
    if (j) j.pages.forEach((p) => LJStore.deletePage(p.id));
    state.lib.journals = state.lib.journals.filter((x) => x.id !== id);
    LJStore.saveLibrary(state.lib);
    renderShelf();
  }

  // ---------- New journal modal ----------
  function openNewJournal() {
    $('#njTitle').value = '';
    state.njCover = 'sage';
    const grid = $('#njCovers');
    grid.innerHTML = '';
    Object.keys(LJData.COVERS).forEach((key) => {
      const cv = LJData.COVERS[key];
      const sw = el('div', 'cover-swatch' + (key === state.njCover ? ' active' : ''));
      sw.style.background = `linear-gradient(135deg, ${cv.c1}, ${cv.c2})`;
      sw.innerHTML = `<span>${cv.name}</span>`;
      sw.onclick = () => {
        state.njCover = key;
        grid.querySelectorAll('.cover-swatch').forEach((n) => n.classList.remove('active'));
        sw.classList.add('active');
      };
      grid.appendChild(sw);
    });
    const sel = $('#njTemplate');
    sel.innerHTML = '';
    LJData.INSERTABLE.forEach((t) => {
      const o = el('option');
      o.value = t; o.textContent = LJData.TEMPLATES[t].name;
      sel.appendChild(o);
    });
    sel.value = 'soap';
    $('#newJournalModal').classList.remove('hidden');
  }

  function createJournal() {
    const title = ($('#njTitle').value || '').trim() || 'Untitled Journal';
    const first = $('#njTemplate').value;
    const journal = {
      id: LJData.uid(), title, cover: state.njCover,
      pages: [{ id: LJData.uid(), template: 'cover' }]
    };
    if (first && first !== 'cover') journal.pages.push({ id: LJData.uid(), template: first });
    state.lib.journals.unshift(journal);
    LJStore.saveLibrary(state.lib);
    $('#newJournalModal').classList.add('hidden');
    renderShelf();
    openJournal(journal.id);
  }

  // ---------- Editor ----------
  function buildPlannerIndex() {
    state.dateIndex = {}; state.monthIndex = {}; state.yearPageIndex = -1;
    if (!state.journal) return;
    state.journal.pages.forEach((p, i) => {
      if (p.date) state.dateIndex[p.date] = i;
      if (p.template === 'planMonth') state.monthIndex[p.month] = i;
      if (p.template === 'planYear') state.yearPageIndex = i;
    });
  }
  function goToDate(ds) { const i = state.dateIndex[ds]; if (i != null) loadPage(i); }
  function goToMonth(m) { const i = state.monthIndex[m]; if (i != null) loadPage(i); }
  function goToYear() { if (state.yearPageIndex >= 0) loadPage(state.yearPageIndex); }

  function openJournal(id) {
    state.journal = state.lib.journals.find((x) => x.id === id);
    if (!state.journal) return;
    buildPlannerIndex();
    state.pageIndex = 0;
    $('#library').classList.add('hidden');
    $('#editor').classList.remove('hidden');
    $('#editorTitle').textContent = state.journal.title;
    if (!state.canvas) {
      state.canvas = new JournalCanvas($('#bgCanvas'), $('#inkCanvas'), $('#pageWrap'));
      state.canvas.onChange = () => saveCurrentDebounced();
    }
    loadPage(0);
    requestAnimationFrame(relayout);
  }

  function backToLibrary() {
    flushSave();
    $('#editor').classList.add('hidden');
    $('#library').classList.remove('hidden');
    renderShelf();
  }

  function currentPage() { return state.journal.pages[state.pageIndex]; }

  function loadPage(i) {
    flushSave();
    state.pageIndex = Math.max(0, Math.min(i, state.journal.pages.length - 1));
    const page = currentPage();
    const data = LJStore.loadPageData(page.id);
    state.canvas.setTemplate(page.template, JournalCanvas.templateOpts(page, state.journal));
    state.canvas.setStrokes(data.strokes);
    state.texts = data.texts || [];
    state.selectedTextId = null;
    renderTextLayer();
    renderLinkLayer();
    updatePageMeta();
  }

  function updatePageMeta() {
    $('#pageCountBtn').textContent = `${state.pageIndex + 1} / ${state.journal.pages.length}`;
    $('#deletePageBtn').disabled = state.journal.pages.length <= 1;
  }

  function relayout() {
    const stage = $('#stage');
    state.canvas.layout(stage.clientWidth - 44, stage.clientHeight - 44);
    renderTextLayer(); // reposition text boxes for the new scale
    renderLinkLayer(); // reposition calendar links
  }

  function pageData() {
    return { strokes: state.canvas ? state.canvas.strokes : [], texts: state.texts };
  }
  function saveCurrentDebounced() {
    const id = currentPage().id;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => LJStore.savePageData(id, pageData()), 500);
  }
  function flushSave() {
    if (!state.canvas || !state.journal) return;
    clearTimeout(state.saveTimer);
    LJStore.savePageData(currentPage().id, pageData());
  }

  function addPage(template) {
    const page = { id: LJData.uid(), template };
    state.journal.pages.splice(state.pageIndex + 1, 0, page);
    LJStore.saveLibrary(state.lib);
    loadPage(state.pageIndex + 1);
  }

  function deletePage() {
    if (state.journal.pages.length <= 1) return;
    if (!confirm('Delete this page? Handwriting on it will be removed.')) return;
    const page = currentPage();
    LJStore.deletePage(page.id);
    state.journal.pages.splice(state.pageIndex, 1);
    LJStore.saveLibrary(state.lib);
    loadPage(Math.min(state.pageIndex, state.journal.pages.length - 1));
  }

  // ---------- Picker modal (pages overview + add-template) ----------
  function pageLabel(page, i) {
    if (page.template === 'planDay' && page.date) {
      const p = LJPlanner.partsFor(page.date);
      return `${p.shortMonthDay} · ${p.weekdayName.slice(0, 3)}`;
    }
    if (page.template === 'planMonth') return `${LJPlanner.MONTHS[page.month]} ${page.year}`;
    if (page.template === 'planYear') return `${page.year} Overview`;
    if (page.template === 'planWeekSermon' && page.weekStart) {
      const p = LJPlanner.partsFor(page.weekStart);
      return `Sermon · wk ${p.shortMonthDay}`;
    }
    return `${i + 1} · ${(LJData.TEMPLATES[page.template] || {}).name || 'Page'}`;
  }

  function openPagesView() {
    const grid = $('#pickerGrid');
    $('#pickerTitle').textContent = `Pages (${state.journal.pages.length})`;
    grid.innerHTML = '';

    // Lazy-render thumbnails so large planners (hundreds of pages) stay smooth.
    const ratio = LJData.PAGE.H / LJData.PAGE.W;
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const item = en.target;
        const idx = Number(item.dataset.index);
        const page = state.journal.pages[idx];
        const c = JournalCanvas.renderPageCanvas(page, state.journal, 0.26);
        c.style.width = '100%'; c.style.height = 'auto';
        item.insertBefore(c, item.firstChild);
        const ph = item.querySelector('.thumb-ph');
        if (ph) ph.remove();
        obs.unobserve(item);
      });
    }, { root: grid, rootMargin: '300px' });

    state.journal.pages.forEach((page, i) => {
      const item = el('div', 'picker-item' + (i === state.pageIndex ? ' current' : ''));
      item.dataset.index = i;
      const ph = el('div', 'thumb-ph');
      ph.style.paddingBottom = (ratio * 100) + '%';
      item.appendChild(ph);
      item.appendChild(el('div', 'p-name', pageLabel(page, i)));
      item.onclick = () => { closePicker(); loadPage(i); };
      grid.appendChild(item);
      io.observe(item);
    });
    $('#pickerModal').classList.remove('hidden');
  }

  function openTemplatePicker() {
    const grid = $('#pickerGrid');
    $('#pickerTitle').textContent = 'Add a Page';
    grid.innerHTML = '';
    LJData.INSERTABLE.forEach((t) => {
      const item = el('div', 'picker-item');
      const fake = { id: 'preview-' + t, template: t };
      const c = JournalCanvas.renderPageCanvas(fake, state.journal, 0.22);
      c.style.width = '100%'; c.style.height = 'auto';
      item.appendChild(c);
      item.appendChild(el('div', 'p-name', LJData.TEMPLATES[t].name));
      item.appendChild(el('div', 'p-sub', LJData.TEMPLATES[t].sub));
      item.onclick = () => { closePicker(); addPage(t); };
      grid.appendChild(item);
    });
    $('#pickerModal').classList.remove('hidden');
  }

  function closePicker() { $('#pickerModal').classList.add('hidden'); }

  // ---------- Tools ----------
  function buildSwatches() {
    const box = $('#swatches');
    box.innerHTML = '';
    LJData.SWATCH_COLORS.forEach((color, i) => {
      const sw = el('div', 'swatch' + (i === 0 ? ' active' : ''));
      sw.style.background = color;
      sw.onclick = () => {
        box.querySelectorAll('.swatch').forEach((n) => n.classList.remove('active'));
        sw.classList.add('active');
        state.color = color;
        state.canvas.setColor(color);
        if (state.tool === 'text' && state.selectedTextId) {
          // recolor the selected text box without switching tools
          const t = state.texts.find((x) => x.id === state.selectedTextId);
          if (t) {
            t.color = color;
            const b = document.querySelector(`#textLayer [data-id="${t.id}"] .lj-textbox`);
            if (b) b.style.color = color;
            saveCurrentDebounced();
          }
        } else if (state.tool !== 'text') {
          // picking a color implies the pen
          selectTool('pen');
        }
      };
      box.appendChild(sw);
    });
  }

  function selectTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.tb-btn.tool').forEach((b) =>
      b.classList.toggle('active', b.dataset.tool === tool));
    if (state.canvas) state.canvas.setTool(tool);
    const isText = tool === 'text';
    const layer = $('#textLayer');
    if (layer) layer.classList.toggle('active', isText);
    $('#inkCanvas').style.pointerEvents = isText ? 'none' : 'auto';
    if (isText) toast('Text tool — tap the page to type'); else deselectText();
  }

  // ---------- Calendar links ----------
  function renderLinkLayer() {
    const layer = $('#linkLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const page = currentPage();
    if (!page) return;
    const s = (state.canvas && state.canvas.scaleFactor) || 1;
    const add = (rect, onClick, title) => {
      const b = el('div', 'lj-link');
      b.style.left = (rect.x * s) + 'px';
      b.style.top = (rect.y * s) + 'px';
      b.style.width = (rect.w * s) + 'px';
      b.style.height = (rect.h * s) + 'px';
      if (title) b.title = title;
      b.addEventListener('click', onClick);
      layer.appendChild(b);
    };

    if (page.template === 'planYear') {
      LJPlanner.yearMonthRects().forEach((mr) =>
        add(mr, () => goToMonth(mr.month), LJPlanner.MONTHS[mr.month]));
    } else if (page.template === 'planMonth') {
      add(LJPlanner.monthTitleRect(), goToYear, 'Year overview');
      LJPlanner.monthCellRects(page.year, page.month).forEach((c) => {
        if (c.date) add(c, () => goToDate(c.date), c.date);
      });
    } else if (page.template === 'planDay' && page.date) {
      const p = LJPlanner.parseISO(page.date);
      add(LJPlanner.headerBackRect(), () => goToMonth(p.m), 'Back to month');
    } else if (page.template === 'planWeekSermon' && page.weekStart) {
      const p = LJPlanner.parseISO(page.weekStart);
      add(LJPlanner.headerBackRect(), () => goToMonth(p.m), 'Back to month');
    }
  }

  // ---------- Text boxes ----------
  function textSize(v) { return Math.round(18 + v * 3.4); }

  function renderTextLayer() {
    const layer = $('#textLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const s = (state.canvas && state.canvas.scaleFactor) || 1;
    state.texts.forEach((t) => layer.appendChild(buildTextBox(t, s)));
  }

  function buildTextBox(t, s) {
    const wrap = el('div', 'lj-textbox-wrap' + (t.id === state.selectedTextId ? ' selected' : ''));
    wrap.style.left = (t.x * s) + 'px';
    wrap.style.top = (t.y * s) + 'px';
    wrap.style.width = (t.w * s) + 'px';
    wrap.dataset.id = t.id;

    const tools = el('div', 'lj-tb-tools');
    const move = el('button', 'lj-tb-btn lj-tb-move', '✥'); move.title = 'Drag to move';
    const del = el('button', 'lj-tb-btn', '🗑'); del.title = 'Delete';
    tools.appendChild(move); tools.appendChild(del);

    const box = el('div', 'lj-textbox');
    box.contentEditable = 'true';
    box.setAttribute('data-placeholder', 'Type…');
    box.style.fontSize = (t.size * s) + 'px';
    box.style.color = t.color || '#1f2330';
    box.textContent = t.text || '';

    box.addEventListener('input', () => { t.text = box.innerText; saveCurrentDebounced(); });
    box.addEventListener('focus', () => selectText(t.id));
    box.addEventListener('blur', () => {
      t.text = box.innerText;
      if (!t.text.trim()) removeText(t.id);
      else saveCurrentDebounced();
    });
    // Don't let clicks on an existing box bubble up and create a new one.
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); removeText(t.id); });
    attachMove(move, wrap, t);

    wrap.appendChild(tools);
    wrap.appendChild(box);
    return wrap;
  }

  function attachMove(handle, wrap, t) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      selectText(t.id);
      const s = (state.canvas && state.canvas.scaleFactor) || 1;
      const startX = e.clientX, startY = e.clientY, ox = t.x, oy = t.y;
      const mv = (ev) => {
        t.x = Math.max(0, ox + (ev.clientX - startX) / s);
        t.y = Math.max(0, oy + (ev.clientY - startY) / s);
        wrap.style.left = (t.x * s) + 'px';
        wrap.style.top = (t.y * s) + 'px';
      };
      const up = () => {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
        saveCurrentDebounced();
      };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });
  }

  function createTextBox(px, py) {
    const t = {
      id: LJData.uid(),
      x: Math.max(0, Math.min(px, LJData.PAGE.W - 380)),
      y: Math.max(0, py),
      w: 380,
      size: textSize(parseFloat($('#widthRange').value)),
      color: state.color,
      text: ''
    };
    state.texts.push(t);
    renderTextLayer();
    const box = document.querySelector(`#textLayer [data-id="${t.id}"] .lj-textbox`);
    if (box) { selectText(t.id); box.focus(); }
  }

  function selectText(id) {
    state.selectedTextId = id;
    document.querySelectorAll('#textLayer .lj-textbox-wrap').forEach((w) =>
      w.classList.toggle('selected', w.dataset.id === id));
  }
  function deselectText() {
    state.selectedTextId = null;
    document.querySelectorAll('#textLayer .lj-textbox-wrap.selected')
      .forEach((w) => w.classList.remove('selected'));
  }
  function removeText(id) {
    state.texts = state.texts.filter((t) => t.id !== id);
    if (state.selectedTextId === id) state.selectedTextId = null;
    renderTextLayer();
    saveCurrentDebounced();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Wiring ----------
  function init() {
    renderShelf();
    buildSwatches();

    $('#newJournalBtn').onclick = openNewJournal;
    $('#njCancel').onclick = () => $('#newJournalModal').classList.add('hidden');
    $('#njCreate').onclick = createJournal;

    $('#backBtn').onclick = backToLibrary;
    $('#prevPageBtn').onclick = () => loadPage(state.pageIndex - 1);
    $('#nextPageBtn').onclick = () => loadPage(state.pageIndex + 1);
    $('#pageCountBtn').onclick = openPagesView;
    $('#addPageBtn').onclick = openTemplatePicker;
    $('#deletePageBtn').onclick = deletePage;
    $('#pickerClose').onclick = closePicker;
    $('#undoBtn').onclick = () => state.canvas && state.canvas.undo();

    document.querySelectorAll('.tb-btn.tool').forEach((b) => {
      b.onclick = () => selectTool(b.dataset.tool);
    });

    $('#widthRange').oninput = (e) => {
      const v = parseFloat(e.target.value);
      if (state.canvas) state.canvas.setWidth(v);
      if (state.tool === 'text' && state.selectedTextId) {
        const t = state.texts.find((x) => x.id === state.selectedTextId);
        if (t) {
          t.size = textSize(v);
          const b = document.querySelector(`#textLayer [data-id="${t.id}"] .lj-textbox`);
          const s = (state.canvas && state.canvas.scaleFactor) || 1;
          if (b) b.style.fontSize = (t.size * s) + 'px';
          saveCurrentDebounced();
        }
      }
    };

    // Text tool: tap an empty spot on the page to start a new text box.
    // Use 'click' (end of the tap) so the same gesture's mouseup doesn't blur
    // and discard the freshly-created empty box before the user can type.
    $('#textLayer').addEventListener('click', (e) => {
      if (state.tool !== 'text' || e.target.id !== 'textLayer') return;
      const p = state.canvas.clientToPage(e.clientX, e.clientY);
      createTextBox(p.x - 10, p.y - 10);
    });

    const pencilBtn = $('#pencilOnlyBtn');
    pencilBtn.onclick = () => {
      const on = !pencilBtn.classList.contains('toggled');
      pencilBtn.classList.toggle('toggled', on);
      state.canvas && state.canvas.setPencilOnly(on);
      toast(on ? 'Pencil only — finger/touch ignored' : 'Finger drawing enabled');
    };

    $('#exportBtn').onclick = async () => {
      flushSave();
      const n = state.journal.pages.length;
      if (n > 60 && !confirm(`This journal has ${n} pages. Building one PDF may take a while and produce a large file. Continue?`)) return;
      toast('Building PDF…');
      try { await LJPDF.exportJournal(state.journal); }
      catch (err) { toast('PDF export failed — ' + err.message); }
    };

    window.addEventListener('resize', () => {
      if (!$('#editor').classList.contains('hidden') && state.canvas) relayout();
    });
    window.addEventListener('beforeunload', flushSave);

    // Close modals on backdrop click.
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
