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
    njCover: 'sage'
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
    if (j) j.pages.forEach((p) => LJStore.deleteStrokes(p.id));
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
  function openJournal(id) {
    state.journal = state.lib.journals.find((x) => x.id === id);
    if (!state.journal) return;
    state.pageIndex = 0;
    $('#library').classList.add('hidden');
    $('#editor').classList.remove('hidden');
    $('#editorTitle').textContent = state.journal.title;
    if (!state.canvas) {
      state.canvas = new JournalCanvas($('#bgCanvas'), $('#inkCanvas'), $('#pageWrap'));
      state.canvas.onChange = (strokes) => scheduleSave(strokes);
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
    state.canvas.setTemplate(page.template, { title: state.journal.title, cover: state.journal.cover });
    state.canvas.setStrokes(LJStore.loadStrokes(page.id));
    updatePageMeta();
  }

  function updatePageMeta() {
    $('#pageCountBtn').textContent = `${state.pageIndex + 1} / ${state.journal.pages.length}`;
    $('#deletePageBtn').disabled = state.journal.pages.length <= 1;
  }

  function relayout() {
    const stage = $('#stage');
    state.canvas.layout(stage.clientWidth - 44, stage.clientHeight - 44);
  }

  function scheduleSave(strokes) {
    const id = currentPage().id;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => LJStore.saveStrokes(id, strokes), 500);
  }
  function flushSave() {
    if (!state.canvas || !state.journal) return;
    clearTimeout(state.saveTimer);
    LJStore.saveStrokes(currentPage().id, state.canvas.strokes);
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
    LJStore.deleteStrokes(page.id);
    state.journal.pages.splice(state.pageIndex, 1);
    LJStore.saveLibrary(state.lib);
    loadPage(Math.min(state.pageIndex, state.journal.pages.length - 1));
  }

  // ---------- Picker modal (pages overview + add-template) ----------
  function openPagesView() {
    const grid = $('#pickerGrid');
    $('#pickerTitle').textContent = 'Pages';
    grid.innerHTML = '';
    state.journal.pages.forEach((page, i) => {
      const item = el('div', 'picker-item' + (i === state.pageIndex ? ' current' : ''));
      const c = JournalCanvas.renderPageCanvas(page, state.journal, 0.3);
      c.style.width = '100%'; c.style.height = 'auto';
      item.appendChild(c);
      item.appendChild(el('div', 'p-name', `${i + 1} · ${LJData.TEMPLATES[page.template].name}`));
      item.onclick = () => { closePicker(); loadPage(i); };
      grid.appendChild(item);
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
        state.canvas.setColor(color);
        // picking a color implies the pen
        selectTool('pen');
      };
      box.appendChild(sw);
    });
  }

  function selectTool(tool) {
    document.querySelectorAll('.tb-btn.tool').forEach((b) =>
      b.classList.toggle('active', b.dataset.tool === tool));
    if (state.canvas) state.canvas.setTool(tool);
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

    $('#widthRange').oninput = (e) => state.canvas && state.canvas.setWidth(parseFloat(e.target.value));

    const pencilBtn = $('#pencilOnlyBtn');
    pencilBtn.onclick = () => {
      const on = !pencilBtn.classList.contains('toggled');
      pencilBtn.classList.toggle('toggled', on);
      state.canvas && state.canvas.setPencilOnly(on);
      toast(on ? 'Pencil only — finger/touch ignored' : 'Finger drawing enabled');
    };

    $('#exportBtn').onclick = async () => {
      flushSave();
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
