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
    lib: null,            // set during bootstrap, after storage is ready
    journal: null,
    pageIndex: 0,
    canvas: null,
    saveTimer: null,
    njCover: 'sage',
    texts: [],            // text boxes on the current page
    checks: {},           // tapped checkbox state on the current page
    body: '',             // flowing typed note on the current page
    mode: 'draw',         // 'draw' | 'type'
    tool: 'pen',
    color: LJData.SWATCH_COLORS[0],
    selectedTextId: null
  };

  // ---------- Library ----------
  // Rotating verse for the greeting, picked by day of year.
  const GREET_VERSES = [
    '“Your word is a lamp to my feet.” — Ps 119:105',
    '“This is the day the Lord has made.” — Ps 118:24',
    '“His mercies are new every morning.” — Lam 3:23',
    '“Be still, and know that I am God.” — Ps 46:10',
    '“Trust in the Lord with all your heart.” — Prov 3:5'
  ];
  function dayOfYear(d) {
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  }
  function renderGreeting() {
    const now = new Date();
    const doy = dayOfYear(now);
    const verse = GREET_VERSES[doy % GREET_VERSES.length];
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (state.theme === 'ink') {
      // Ink & Glass leads with the date, like the mock.
      $('#greeting').textContent = dateStr;
      $('#greetSub').textContent = `Day ${doy} · ${verse}`;
    } else {
      const h = now.getHours();
      const word = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
      $('#greeting').textContent = `Good ${word}.`;
      $('#greetSub').textContent = `${dateStr} · ${verse}`;
    }
    $('#shelfDay').innerHTML = `Day <b>${doy}</b> of ${(now.getFullYear() % 4 === 0) ? 366 : 365}`;
  }

  function renderShelf() {
    renderGreeting();
    const shelf = $('#shelf');
    shelf.innerHTML = '';

    const doy = dayOfYear(new Date());
    state.lib.journals.forEach((j) => {
      const cv = LJData.COVERS[j.cover] || LJData.COVERS.sage;
      const tile = el('div', 'journal-tile');
      const isPlanner = j.kind === 'planner';
      const count = isPlanner
        ? `${j.pages.length} pages · Day ${doy}`
        : `${j.pages.length} page${j.pages.length === 1 ? '' : 's'}`;
      const prog = Math.min(100, Math.round(doy / 365 * 100));
      tile.innerHTML = `<div class="jcard" style="--c1:${cv.c1};--c2:${cv.c2 || cv.c1};--band:${cv.band || 'transparent'};--prog:${prog}%">
          ${isPlanner ? '<div class="jcard-band"></div>' : ''}
          <div class="jcard-top">
            <span class="jcard-cross">✝</span>
            <span class="jcard-mono">L<em>J</em></span>
            <button class="jcard-del" title="Delete journal">🗑</button>
          </div>
          <div class="jcard-title">${escapeHtml(j.title)}</div>
          <div class="jcard-count">${count}</div>
          ${isPlanner ? '<div class="jcard-progress"><div class="bar"><i></i></div></div>' : ''}
        </div>`;
      tile.querySelector('.jcard-del').onclick = (e) => { e.stopPropagation(); deleteJournal(j.id); };
      tile.onclick = () => openJournal(j.id);
      shelf.appendChild(tile);
    });

    const add = el('div', 'journal-tile');
    add.innerHTML = `<div class="jcard new-card">
        <div class="jcard-icon plus-icon">+</div>
        <div class="jcard-title">Begin a new journal</div>
      </div>`;
    add.onclick = openNewJournal;
    shelf.appendChild(add);
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

  function jumpToToday() {
    const iso = LJPlanner.todayISO();
    if (state.dateIndex[iso] != null) { goToDate(iso); toast('Today · ' + LJPlanner.partsFor(iso).long); }
    else toast('Today isn’t in this journal’s year');
  }

  function openJournal(id) {
    state.journal = state.lib.journals.find((x) => x.id === id);
    if (!state.journal) return;
    buildPlannerIndex();
    state.pageIndex = 0;
    $('#library').classList.add('hidden');
    $('#editor').classList.remove('hidden');
    $('#editorTitle').textContent = state.journal.title;
    $('#todayBtn').style.display = state.journal.kind === 'planner' ? '' : 'none';
    if (!state.canvas) {
      state.canvas = new JournalCanvas($('#bgCanvas'), $('#inkCanvas'), $('#pageWrap'));
      state.canvas.onChange = () => { recordChange(); saveCurrentDebounced(); };
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
    state.checks = data.checks || {};
    state.fields = data.fields || {};
    state.selectedTextId = null;
    state.undoStack = [];
    state.lastUndoTag = null;
    state.prevSnap = snapPage();
    renderFieldLayer();
    renderTextLayer();
    renderLinkLayer();
    renderPhotoLayer();
    renderInteractiveLayer();
    updatePageMeta();
  }

  // ---- Auto-flow: when a prose line fills up, overflow wraps to the next ----
  // Rows where each line is its own item (schedule hours, task lists, habit
  // rows…) must NOT spill into the next line.
  const NO_FLOW = new Set(['sch', 'day', 'd', 'hab', 'reqt', 'anst', 'top', 'step', 'pri', 'tsk', 'goal', 'prog']);
  const fieldMeasurer = document.createElement('canvas').getContext('2d');
  function fieldGroup(id) { return String(id).replace(/\d+$/, ''); }

  // If fields[idx] overflows its width, move whole words onto the next line
  // of the same group (cascading down). Returns nothing; moves the caret to
  // follow the text when the user was typing at the overflow point.
  function flowField(layer, fields, idx) {
    const f = fields[idx];
    const next = fields[idx + 1];
    if (!next || fieldGroup(next.id) !== fieldGroup(f.id) || NO_FLOW.has(fieldGroup(f.id))) return;
    const inp = layer.querySelector('.lj-field[data-idx="' + idx + '"]');
    if (!inp) return;
    const st = getComputedStyle(inp);
    fieldMeasurer.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    const maxW = inp.clientWidth - 6;
    const val = inp.value;
    if (fieldMeasurer.measureText(val).width <= maxW) return;
    // largest fitting prefix, preferring a word boundary
    let cut = val.length;
    while (cut > 1 && fieldMeasurer.measureText(val.slice(0, cut)).width > maxW) cut--;
    let br = val.lastIndexOf(' ', cut);
    if (br <= 0) br = cut;
    const keep = val.slice(0, br).replace(/\s+$/, '');
    const overflow = val.slice(br).replace(/^\s+/, '');
    if (!overflow) return;
    const caret = inp.selectionStart;
    inp.value = keep;
    state.fields[f.id] = keep;
    const nextInp = layer.querySelector('.lj-field[data-idx="' + (idx + 1) + '"]');
    const existing = state.fields[next.id] || '';
    const merged = overflow + (existing ? ' ' + existing : '');
    state.fields[next.id] = merged;
    if (nextInp) nextInp.value = merged;
    flowField(layer, fields, idx + 1);
    // follow the caret onto the next line if it sat inside the moved text
    if (caret > keep.length && nextInp && document.activeElement === inp) {
      const pos = Math.min(Math.max(0, caret - (br + 1)), nextInp.value.length);
      nextInp.focus();
      nextInp.setSelectionRange(pos, pos);
    }
  }

  // ---- Scripture autocomplete: book → chapter → verse dropdown ----
  const sug = { box: null, items: [], sel: -1, inp: null, field: null };
  function hideSuggest() {
    if (sug.box) sug.box.remove();
    sug.box = null; sug.items = []; sug.sel = -1; sug.inp = null; sug.field = null;
  }
  function updateSuggest(inp, f) {
    const items = window.LJBible ? LJBible.suggest(inp.value) : [];
    hideSuggest();
    // Don't re-open once the exact current value is the only completion.
    if (!items.length || (items.length === 1 && items[0].value === inp.value)) return;
    sug.inp = inp; sug.field = f; sug.items = items; sug.sel = 0;
    sug.box = el('div', 'lj-suggest');
    items.forEach((it, i) => {
      const d = el('div', 'lj-suggest-item' + (i === 0 ? ' sel' : ''), it.label);
      d.addEventListener('pointerdown', (e) => { e.preventDefault(); acceptSuggest(i); });
      sug.box.appendChild(d);
    });
    sug.box.style.left = inp.style.left;
    sug.box.style.top = (parseFloat(inp.style.top) + parseFloat(inp.style.height) + 2) + 'px';
    $('#typeLayer').appendChild(sug.box);
  }
  function moveSuggest(delta) {
    if (!sug.box) return;
    sug.sel = (sug.sel + delta + sug.items.length) % sug.items.length;
    [...sug.box.children].forEach((c, i) => c.classList.toggle('sel', i === sug.sel));
    sug.box.children[sug.sel].scrollIntoView({ block: 'nearest' });
  }
  function acceptSuggest(i) {
    const it = sug.items[i == null ? sug.sel : i];
    const inp = sug.inp, f = sug.field;
    if (!it || !inp) return;
    inp.value = it.value;
    state.fields[f.id] = it.value;
    recordChange('field:' + f.id);
    saveCurrentDebounced();
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    if (it.done) hideSuggest(); else updateSuggest(inp, f);
  }

  // Render the typed fields for the current page. Inputs are editable only in
  // type mode; in draw mode they show their text read-only beneath the ink.
  function renderFieldLayer() {
    const layer = $('#typeLayer');
    if (!layer) return;
    hideSuggest();
    layer.innerHTML = '';
    const page = currentPage();
    if (!page || !state.canvas) return;
    const s = state.canvas.scaleFactor || 1;
    const fields = LJTemplates.fieldRects(page.template) || [];
    const isType = state.mode === 'type';
    fields.forEach((f, idx) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'lj-field';
      inp.value = state.fields[f.id] || '';
      inp.readOnly = !isType;
      inp.dataset.idx = idx;
      const size = f.size || 26;
      const fs = (size * 0.86 - 2) * s;   // 2pt smaller than the writing line height
      if (f.serif) { inp.style.fontFamily = 'Georgia, serif'; inp.style.fontStyle = 'italic'; }
      inp.style.left = (f.x * s) + 'px';
      inp.style.width = (f.w * s) + 'px';
      inp.style.fontSize = fs + 'px';
      inp.style.height = (fs * 1.2) + 'px';
      inp.style.lineHeight = (fs * 1.2) + 'px';
      // box bottom rests on the writing line, so the text sits just above it
      inp.style.top = (f.y * s - fs * 1.2) + 'px';
      inp.addEventListener('input', () => {
        state.fields[f.id] = inp.value;
        flowField(layer, fields, idx);
        recordChange('field:' + f.id);
        saveCurrentDebounced();
        if (f.bible) updateSuggest(inp, f);
      });
      if (f.bible) {
        // Registered before the nav handler so Enter accepts the suggestion
        // instead of jumping to the next field while the dropdown is open.
        inp.addEventListener('keydown', (e) => {
          if (!sug.box || sug.inp !== inp) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggest(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(-1); }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); acceptSuggest(); }
          else if (e.key === 'Escape') { hideSuggest(); }
        });
        inp.addEventListener('focus', () => updateSuggest(inp, f));
        inp.addEventListener('blur', () => setTimeout(() => { if (sug.inp === inp) hideSuggest(); }, 150));
      }
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const next = layer.querySelector('.lj-field[data-idx="' + (idx + (e.shiftKey ? -1 : 1)) + '"]');
          if (next) next.focus();
        }
      });
      layer.appendChild(inp);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    const layer = $('#typeLayer');
    const isType = mode === 'type';
    layer.classList.toggle('typing', isType);
    $('#typeModeBtn').classList.toggle('active', isType);
    renderFieldLayer();
    if (isType) {
      $('#inkCanvas').style.pointerEvents = 'none';
      $('#textLayer').classList.remove('active');
      const first = layer.querySelector('.lj-field');
      if (first) first.focus();
      const n = (LJTemplates.fieldRects(currentPage().template) || []).length;
      toast(n ? 'Type mode — tap a line, Enter/Tab for the next' : 'No typed fields on this page');
    } else {
      $('#inkCanvas').style.pointerEvents = (state.tool === 'text') ? 'none' : 'auto';
    }
  }

  function updatePageMeta() {
    $('#pageCountBtn').textContent = `${state.pageIndex + 1} / ${state.journal.pages.length}`;
    $('#deletePageBtn').disabled = state.journal.pages.length <= 1;
  }

  function relayout() {
    const stage = $('#stage');
    state.canvas.layout(stage.clientWidth - 44, stage.clientHeight - 44);
    renderFieldLayer();
    renderTextLayer(); // reposition text boxes for the new scale
    renderLinkLayer(); // reposition calendar links
    renderPhotoLayer(); // reposition the month photo
    renderInteractiveLayer(); // reposition checks + now marker
  }

  function pageData() {
    return { strokes: state.canvas ? state.canvas.strokes : [], texts: state.texts, checks: state.checks, fields: state.fields };
  }

  // ---------- Unified undo (ink, typing, checks, text boxes) ----------
  // The stack holds page snapshots taken BEFORE each change. Continuous edits
  // that share a tag (e.g. typing in one field) collapse into a single step.
  function snapPage() { return JSON.parse(JSON.stringify(pageData())); }
  function recordChange(tag) {
    if (!tag || tag !== state.lastUndoTag) {
      state.undoStack.push(state.prevSnap);
      if (state.undoStack.length > 60) state.undoStack.shift();
    }
    state.prevSnap = snapPage();
    state.lastUndoTag = tag || null;
  }
  function undoAction() {
    if (!state.undoStack || !state.undoStack.length) { toast('Nothing to undo'); return; }
    const s = state.undoStack.pop();
    state.canvas.setStrokes(s.strokes);
    state.texts = s.texts;
    state.checks = s.checks;
    state.fields = s.fields;
    state.prevSnap = JSON.parse(JSON.stringify(s));
    state.lastUndoTag = null;
    renderFieldLayer();
    renderTextLayer();
    renderInteractiveLayer();
    saveCurrentDebounced();
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
    buildPlannerIndex();
    loadPage(state.pageIndex + 1);
  }

  function deletePage() {
    if (state.journal.pages.length <= 1) return;
    if (!confirm('Delete this page? Handwriting on it will be removed.')) return;
    const page = currentPage();
    LJStore.deletePage(page.id);
    state.journal.pages.splice(state.pageIndex, 1);
    LJStore.saveLibrary(state.lib);
    buildPlannerIndex();
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
    if (page.template === 'planWeek' && page.weekStart) {
      const p = LJPlanner.partsFor(page.weekStart);
      return `Week of ${p.shortMonthDay}`;
    }
    if (page.template === 'weeklyFoundations' && page.weekStart) {
      const p = LJPlanner.partsFor(page.weekStart);
      return `Foundations · wk ${p.shortMonthDay}`;
    }
    if (page.template === 'weeklyPrayer' && page.weekStart) {
      const p = LJPlanner.partsFor(page.weekStart);
      return `Prayer · wk ${p.shortMonthDay}`;
    }
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

  // ---------- Theme ----------
  const INK_DEFAULT = '#e8ecf2';   // default pen color for the dark theme
  function themedSwatches() {
    const base = LJData.SWATCH_COLORS.slice();
    if (state.theme === 'ink') base[0] = INK_DEFAULT;
    return base;
  }
  function applyTheme(t) {
    state.theme = t;
    document.body.dataset.theme = t === 'ink' ? 'ink' : '';
    LJData.setPalette(t === 'ink' ? 'dark' : 'light');
    LJKV.set('lifejournal.theme', t);
    // swap the default pen color when it still matches the old theme's default
    if (t === 'ink' && state.color === LJData.SWATCH_COLORS[0]) state.color = INK_DEFAULT;
    if (t !== 'ink' && state.color === INK_DEFAULT) state.color = LJData.SWATCH_COLORS[0];
    if (state.canvas) state.canvas.setColor(state.color);
    buildSwatches();
    // re-draw the page background with the themed palette
    if (state.journal && state.canvas) {
      const page = currentPage();
      state.canvas.setTemplate(page.template, JournalCanvas.templateOpts(page, state.journal));
    }
  }
  function toggleTheme() {
    applyTheme(state.theme === 'ink' ? 'paper' : 'ink');
    if (!$('#library').classList.contains('hidden')) renderShelf();
    toast(state.theme === 'ink' ? 'Ink & Glass' : 'Quiet Paper');
  }

  // ---------- Tools ----------
  function buildSwatches() {
    const box = $('#swatches');
    box.innerHTML = '';
    themedSwatches().forEach((color) => {
      const sw = el('div', 'swatch' + (color === state.color ? ' active' : ''));
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
    if (state.mode === 'type') setMode('draw');
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
    } else if (page.template === 'planWeek' && page.weekStart) {
      const p = LJPlanner.parseISO(page.weekStart);
      add(LJPlanner.headerBackRect(), () => goToMonth(p.m), 'Back to month');
      LJPlanner.weekDayRects(page.weekStart).forEach((r) => add(r, () => goToDate(r.date), r.date));
    } else if (page.template === 'planDay' && page.date) {
      const p = LJPlanner.parseISO(page.date);
      add(LJPlanner.headerBackRect(), () => goToMonth(p.m), 'Back to month');
      // S M T W T F S markers → jump to that weekday in this week
      const base = Date.UTC(p.y, p.m, p.d);
      const sunday = base - new Date(base).getUTCDay() * LJPlanner.DAY_MS;
      LJTemplates.dailyWeekdayRects().forEach((r) => {
        const ds = LJPlanner.isoFromTs(sunday + r.wd * LJPlanner.DAY_MS);
        add({ x: r.x, y: r.y, w: r.w, h: r.h }, () => goToDate(ds), ds);
      });
    } else if (page.template === 'planWeekSermon' && page.weekStart) {
      const p = LJPlanner.parseISO(page.weekStart);
      add(LJPlanner.headerBackRect(), () => goToMonth(p.m), 'Back to month');
    }
  }

  // ---------- Interactive layer: tappable checks + live time marker ----------
  function renderInteractiveLayer() {
    const layer = $('#interactiveLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const page = currentPage();
    if (!page) return;
    const s = (state.canvas && state.canvas.scaleFactor) || 1;

    (LJTemplates.checkRects(page.template) || []).forEach((r) => {
      const pill = r.kind === 'pill';
      const b = el('button', 'lj-check' + (pill ? ' pill' : '') + (state.checks[r.id] ? ' checked' : ''));
      b.style.left = (r.x * s) + 'px';
      b.style.top = (r.y * s) + 'px';
      b.style.width = ((pill ? r.w : r.size) * s) + 'px';
      b.style.height = ((pill ? r.h : r.size) * s) + 'px';
      b.style.fontSize = ((pill ? 10 : r.size) * s) + 'px';
      if (pill) b.textContent = r.label;
      b.onclick = () => {
        if (state.checks[r.id]) { delete state.checks[r.id]; b.classList.remove('checked'); }
        else { state.checks[r.id] = true; b.classList.add('checked'); }
        recordChange();
        saveCurrentDebounced();
      };
      layer.appendChild(b);
    });

    const nm = LJTemplates.nowMarker(page);
    if (nm) {
      const line = el('div', 'lj-now');
      line.style.left = (nm.x * s) + 'px';
      line.style.top = (nm.y * s) + 'px';
      line.style.width = (nm.w * s) + 'px';
      line.appendChild(el('span', 'lj-now-lab', 'Now · ' + nm.label));
      layer.appendChild(line);
    }
  }

  // ---------- Paper picker ----------
  function lightenHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.round(c + (255 - c) * amt);
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function openPaper() {
    const grid = $('#paperGrid');
    grid.innerHTML = '';
    const page = currentPage();
    const cur = (page && page.paper) || state.journal.paper || 'white';
    const all = $('#paperAll');
    if (all) all.checked = false;
    const cv = LJData.COVERS[state.journal.cover] || {};
    LJData.PAPER_ORDER.forEach((id) => {
      const P = LJData.PAPERS[id];
      const sw = el('div', 'paper-swatch' + (id === cur ? ' active' : ''));
      const chip = el('div', 'paper-chip');
      if (id === 'tint') chip.style.background = lightenHex(cv.vivid || cv.c1 || '#8aa6a0', 0.9);
      else if (P.pattern === 'grid') { chip.style.background = '#fff'; chip.style.backgroundImage = 'linear-gradient(#e6e9ef 1px,transparent 1px),linear-gradient(90deg,#e6e9ef 1px,transparent 1px)'; chip.style.backgroundSize = '12px 12px'; }
      else if (P.pattern === 'dots') { chip.style.background = '#fff'; chip.style.backgroundImage = 'radial-gradient(#d3d8e0 1.3px, transparent 1.4px)'; chip.style.backgroundSize = '12px 12px'; }
      else if (P.pattern === 'lines') { chip.style.background = 'repeating-linear-gradient(#fff,#fff 11px,#e6e9ef 11px,#e6e9ef 12px)'; }
      else chip.style.background = P.color;
      sw.appendChild(chip);
      sw.appendChild(el('div', 'p-label', P.name));
      sw.onclick = () => ($('#paperAll') && $('#paperAll').checked) ? setPaperAll(id) : setPaper(id);
      grid.appendChild(sw);
    });
    $('#paperModal').classList.remove('hidden');
  }
  function setPaper(id) {
    const page = currentPage();
    if (!page) return;
    page.paper = id;                       // page is a reference inside state.lib
    LJStore.saveLibrary(state.lib);
    state.canvas.setTemplate(page.template, JournalCanvas.templateOpts(page, state.journal));
    $('#paperModal').classList.add('hidden');
  }
  // Make this the journal-wide default and clear every per-page override so all
  // existing and future pages share it.
  function setPaperAll(id) {
    state.journal.paper = id;
    (state.journal.pages || []).forEach((p) => { delete p.paper; });
    LJStore.saveLibrary(state.lib);
    const page = currentPage();
    if (page) state.canvas.setTemplate(page.template, JournalCanvas.templateOpts(page, state.journal));
    $('#paperModal').classList.add('hidden');
  }

  // ---------- Month photobook ----------
  function renderPhotoLayer() {
    const layer = $('#photoLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const page = currentPage();
    if (!page || page.template !== 'planMonth') return;
    const s = (state.canvas && state.canvas.scaleFactor) || 1;
    const pb = LJPlanner.monthPhotoRect();
    const userSrc = LJStore.getPhoto(state.journal.id, page.month);

    const img = el('img', 'lj-photo');
    img.style.left = (pb.x * s) + 'px';
    img.style.top = (pb.y * s) + 'px';
    img.style.width = (pb.w * s) + 'px';
    img.style.height = (pb.h * s) + 'px';
    img.src = userSrc || LJPlanner.defaultPhotoURL(page.month);
    img.onerror = () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = LJPlanner.fallbackPhotoURL(page.month); } };
    layer.appendChild(img);

    const change = el('button', 'lj-photo-btn', '📷 Change photo');
    change.style.left = (pb.x * s + 14) + 'px';
    change.style.top = ((pb.y + pb.h) * s - 46) + 'px';
    change.onclick = () => { state.pendingPhotoMonth = page.month; $('#photoInput').click(); };
    layer.appendChild(change);

    if (userSrc) {
      const reset = el('button', 'lj-photo-btn', '↺ Reset');
      reset.style.left = (pb.x * s + pb.w * s - 104) + 'px';
      reset.style.top = ((pb.y + pb.h) * s - 46) + 'px';
      reset.onclick = () => { LJStore.removePhoto(state.journal.id, page.month); renderPhotoLayer(); maybeSyncPhotoNote(); };
      layer.appendChild(reset);
    }
  }

  function maybeSyncPhotoNote() {}

  function downscaleImage(file, maxW, cb) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
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

    box.addEventListener('input', () => { t.text = box.innerText; recordChange('text:' + t.id); saveCurrentDebounced(); });
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
        if (t.x !== ox || t.y !== oy) recordChange();
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
    recordChange();
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
    recordChange();
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

  // ---------- Cloud sync ----------
  function openSync() {
    $('#syncCode').value = LJSync.getCode();
    const last = LJSync.getLastSync();
    if (last) {
      const ago = timeAgo(last.when);
      setSyncStatus(`Last ${last.kind === 'upload' ? 'uploaded' : 'downloaded'} ${ago}.`, false);
    } else {
      setSyncStatus('', false);
    }
    $('#syncModal').classList.remove('hidden');
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }
  function setSyncStatus(msg, isErr) {
    const s = $('#syncStatus');
    s.textContent = msg;
    s.classList.toggle('err', !!isErr);
  }
  function fmtKB(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  async function doSync(kind) {
    const code = $('#syncCode').value.trim();
    if (code.length < 6) { setSyncStatus('Please enter a sync code of at least 6 characters.', true); return; }
    LJSync.setCode(code);
    $('#syncUpload').disabled = $('#syncDownload').disabled = true;
    try {
      if (kind === 'upload') {
        setSyncStatus('Uploading…', false);
        const r = await LJSync.upload(code);
        setSyncStatus(`Uploaded ✓  (${fmtKB(r.size)}). Use this code on another device to pull it down.`, false);
      } else {
        if (!confirm('Download will REPLACE the journals on this device with the cloud copy for this code. This cannot be undone. Continue?')) {
          $('#syncUpload').disabled = $('#syncDownload').disabled = false;
          return;
        }
        setSyncStatus('Downloading…', false);
        const r = await LJSync.download(code);
        if (r.empty) {
          setSyncStatus('No cloud data found for that code yet. Upload from a device first.', true);
        } else {
          // Refresh in place (no reload) so we read the just-written data.
          state.lib = LJStore.loadLibrary();
          state.journal = null;
          renderShelf();
          setSyncStatus('Downloaded ✓  Your journals are now on this device.', false);
        }
      }
    } catch (e) {
      setSyncStatus('Sync failed: ' + e.message, true);
    } finally {
      $('#syncUpload').disabled = $('#syncDownload').disabled = false;
    }
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
    $('#syncBtn').onclick = openSync;
    $('#syncClose').onclick = () => $('#syncModal').classList.add('hidden');
    $('#syncUpload').onclick = () => doSync('upload');
    $('#syncDownload').onclick = () => doSync('download');
    $('#dockNew').onclick = openNewJournal;
    $('#dockSync').onclick = openSync;
    $('#dockHome').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#dockTheme').onclick = toggleTheme;
    $('#themeBtn').onclick = toggleTheme;
    $('#photoInput').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      downscaleImage(f, 1400, (durl) => {
        if (!durl) { toast('Could not read that image'); return; }
        if (!LJStore.setPhoto(state.journal.id, state.pendingPhotoMonth, durl)) {
          toast('Photo too large for local storage'); return;
        }
        renderPhotoLayer();
        toast('Photo updated ✓');
      });
    };
    $('#njCancel').onclick = () => $('#newJournalModal').classList.add('hidden');
    $('#njCreate').onclick = createJournal;

    $('#backBtn').onclick = backToLibrary;
    $('#prevPageBtn').onclick = () => loadPage(state.pageIndex - 1);
    $('#nextPageBtn').onclick = () => loadPage(state.pageIndex + 1);
    $('#pageCountBtn').onclick = openPagesView;
    $('#todayBtn').onclick = jumpToToday;
    $('#addPageBtn').onclick = openTemplatePicker;
    $('#deletePageBtn').onclick = deletePage;
    $('#pickerClose').onclick = closePicker;
    $('#undoBtn').onclick = undoAction;

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

    $('#typeModeBtn').onclick = () => setMode(state.mode === 'type' ? 'draw' : 'type');
    $('#paperBtn').onclick = openPaper;
    $('#paperClose').onclick = () => $('#paperModal').classList.add('hidden');

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

    // Keep the live "now" marker current while the editor is open.
    setInterval(() => {
      if (!$('#editor').classList.contains('hidden')) renderInteractiveLayer();
    }, 30000);
    window.addEventListener('beforeunload', flushSave);

    // Close modals on backdrop click.
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    });
  }

  async function bootstrap() {
    LJKV.setOnError((msg) => toast(msg));
    await LJKV.init();              // open IndexedDB (+ migrate old localStorage)
    state.lib = LJStore.loadLibrary();
    const savedTheme = LJKV.get('lifejournal.theme') || 'paper';
    state.theme = savedTheme;
    document.body.dataset.theme = savedTheme === 'ink' ? 'ink' : '';
    LJData.setPalette(savedTheme === 'ink' ? 'dark' : 'light');
    if (savedTheme === 'ink') state.color = INK_DEFAULT;
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();
