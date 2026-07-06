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
      let count, prog = 0, progLabel = '', renewable = false;
      if (j.cycle && window.LJPlanner) {
        const st = LJPlanner.cycleStatus(j.startISO);
        renewable = st.state === 'done' || (st.state === 'active' && st.week === LJPlanner.CYCLE_WEEKS);
        if (st.state === 'before') {
          count = `Starts in ${st.startsInDays} day${st.startsInDays === 1 ? '' : 's'}`;
          prog = 0; progLabel = 'Week 1 of 12';
        } else if (st.state === 'done') {
          count = 'Complete · 12 weeks'; prog = 100; progLabel = 'Day 84 of 84';
        } else {
          count = `Week ${st.week} of 12 · Day ${st.day} of 84`;
          prog = Math.round(st.day / st.total * 100); progLabel = `Day ${st.day} of 84`;
        }
      } else if (isPlanner) {
        count = `${j.pages.length} pages · Day ${doy}`;
        prog = Math.min(100, Math.round(doy / 365 * 100));
        progLabel = `Day ${doy} of 365`;
      } else {
        count = `${j.pages.length} page${j.pages.length === 1 ? '' : 's'}`;
      }
      tile.innerHTML = `<div class="jcard" style="--c1:${cv.c1};--c2:${cv.c2 || cv.c1};--band:${cv.band || 'transparent'};--prog:${prog}%">
          ${isPlanner ? '<div class="jcard-band"></div>' : ''}
          <div class="jcard-top">
            <span class="jcard-cross">✝</span>
            <span class="jcard-mono">L<em>J</em></span>
            ${isPlanner ? '<span class="jcard-continue">Continue writing →</span>' : ''}
            <button class="jcard-del" title="Delete journal">🗑</button>
          </div>
          <div class="jcard-title">${escapeHtml(j.title)}</div>
          <div class="jcard-count">${count}</div>
          ${isPlanner ? `<div class="jcard-progress"><div class="bar"><i></i></div><span class="jp-day">${progLabel}</span></div>` : ''}
          ${renewable ? '<button class="jcard-renew">Start next 12 weeks →</button>' : ''}
        </div>`;
      tile.querySelector('.jcard-del').onclick = (e) => { e.stopPropagation(); deleteJournal(j.id); };
      const renewBtn = tile.querySelector('.jcard-renew');
      if (renewBtn) renewBtn.onclick = (e) => { e.stopPropagation(); startNextCycle(j); };
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
    const startInput = $('#njStart');
    if (startInput) startInput.value = window.LJPlanner ? LJPlanner.todayISO() : '';
    updateNjRange();
    $('#newJournalModal').classList.remove('hidden');
  }

  // Live "12 weeks · start → end (months)" preview under the date picker.
  function updateNjRange() {
    const out = $('#njRange');
    if (!out || !window.LJPlanner) return;
    const s = ($('#njStart') && $('#njStart').value) || '';
    if (!s) { out.textContent = ''; return; }
    const a = LJPlanner.partsFor(s), b = LJPlanner.partsFor(LJPlanner.cycleEndISO(s));
    const months = LJPlanner.cycleMonths(s).map((m) => LJPlanner.MONTHS[m.month].slice(0, 3)).join(' · ');
    out.textContent = `12 weeks · ${a.long} → ${b.long}  (${months})`;
  }

  function createJournal() {
    const title = ($('#njTitle').value || '').trim() || 'My 12-Week Journal';
    const startISO = ($('#njStart') && $('#njStart').value) || (window.LJPlanner ? LJPlanner.todayISO() : '');
    const journal = LJPlanner.generateCycle(startISO, { title, cover: state.njCover });
    state.lib.journals.unshift(journal);
    LJStore.saveLibrary(state.lib);
    $('#newJournalModal').classList.add('hidden');
    renderShelf();
    openJournal(journal.id);
  }

  // Bump a trailing count in a title: "… Journal" → "… Journal · 2" → "· 3".
  function nextCycleTitle(t) {
    const m = (t || '').match(/^(.*·\s*)(\d+)\s*$/);
    if (m) return m[1] + (parseInt(m[2], 10) + 1);
    return (t || 'My 12-Week Journal') + ' · 2';
  }

  // Start the next 12 weeks: a fresh cycle beginning the day after this one
  // ends, same cover, with the Five Foundations goals carried forward as a
  // starting point (the method encourages re-writing them each cycle).
  function startNextCycle(journal) {
    if (!journal || !journal.cycle || !window.LJPlanner) return;
    const nextStartISO = LJPlanner.cycleDayISO(journal.startISO, LJPlanner.CYCLE_DAYS);
    const next = LJPlanner.generateCycle(nextStartISO, { title: nextCycleTitle(journal.title), cover: journal.cover });
    const oldGoals = journal.pages.find((pg) => pg.template === 'foundationsGoals');
    const newGoals = next.pages.find((pg) => pg.template === 'foundationsGoals');
    if (oldGoals && newGoals) {
      const d = LJStore.loadPageData(oldGoals.id);
      if (d.fields && Object.keys(d.fields).length) {
        LJStore.savePageData(newGoals.id, { strokes: [], texts: [], checks: {}, fields: Object.assign({}, d.fields) });
      }
    }
    state.lib.journals.unshift(next);
    LJStore.saveLibrary(state.lib);
    renderShelf();
    openJournal(next.id);
    toast('New cycle · ' + LJPlanner.partsFor(nextStartISO).long);
  }

  // ---------- End-of-cycle reflection ----------
  function showCycleDone(journal) {
    state.doneJournal = journal;
    const a = LJPlanner.partsFor(journal.startISO), b = LJPlanner.partsFor(LJPlanner.cycleEndISO(journal.startISO));
    $('#cdSub').textContent = `${a.long} – ${b.long}`;
    $('#cdMoved').value = ''; $('#cdCarry').value = '';
    $('#library').classList.add('hidden');
    $('#editor').classList.add('hidden');
    $('#morningFlow').classList.add('hidden');
    $('#cycleDone').classList.remove('hidden');
  }
  // Persist the reflection onto the cycle's last day, and mark it seen.
  function saveCycleReflection(journal) {
    const moved = ($('#cdMoved').value || '').trim(), carry = ($('#cdCarry').value || '').trim();
    if (moved || carry) {
      const days = journal.pages.filter((p) => p.template === 'planDay');
      const last = days[days.length - 1];
      if (last) {
        const d = LJStore.loadPageData(last.id); d.fields = d.fields || {};
        const lines = [];
        if (moved) lines.push('What moved: ' + moved);
        if (carry) lines.push('Carry forward: ' + carry);
        let k = 0;
        for (let i = 0; i < 12 && k < lines.length; i++) { if (!d.fields['jrn' + i]) d.fields['jrn' + i] = lines[k++]; }
        LJStore.savePageData(last.id, d);
      }
    }
    LJKV.set('lifejournal.cycledone.' + journal.id, '1');
    scheduleAutoSync();
  }

  // ---------- AI: draft a Five Foundations goal into a 12-week plan ----------
  // Split a sentence into two writing lines (near the middle, on a space).
  function splitTwo(str) {
    str = String(str || '').trim();
    if (str.length <= 58) return [str, ''];
    let cut = str.lastIndexOf(' ', Math.ceil(str.length * 0.58));
    if (cut < 20) cut = str.indexOf(' ', Math.floor(str.length * 0.45));
    if (cut < 0) cut = Math.floor(str.length / 2);
    return [str.slice(0, cut).trim(), str.slice(cut).trim()];
  }

  async function openFoundationPlan(fi) {
    const F = window.LJData && LJData.FOUNDATIONS[fi];
    if (!F) return;
    // Generating a plan is a Pro feature (matches AI Bible studies); it stays
    // unlocked until in-app purchases are configured.
    if (window.LJIAP && !(await LJIAP.isPro())) { openPaywall(); return; }
    state.planFoundation = fi;
    $('#planTitle').textContent = 'Draft your ' + F.name + ' goal';
    const onPage = state.journal && currentPage() && currentPage().template === 'foundationBlueprint';
    const cur = onPage ? [state.fields.what0, state.fields.what1].filter(Boolean).join(' ').trim() : '';
    $('#planGoal').value = cur;
    $('#planGoal').placeholder = planPlaceholder(F.key);
    $('#planStatus').textContent = '';
    $('#planGo').disabled = false;
    $('#planModal').classList.remove('hidden');
    setTimeout(() => $('#planGoal').focus(), 60);
  }

  function planPlaceholder(key) {
    return ({
      faith: 'e.g. Read the New Testament in 12 weeks',
      family: 'e.g. A weekly date night and family devotion',
      finances: 'e.g. Build a $2,000 emergency fund',
      fitness: 'e.g. Lose 20 lbs in 12 weeks',
      focus: 'e.g. Finish my certification course'
    })[key] || 'Your goal in one sentence…';
  }

  async function runFoundationPlan() {
    const fi = state.planFoundation, F = LJData.FOUNDATIONS[fi];
    const goal = ($('#planGoal').value || '').trim();
    if (!goal) { $('#planStatus').textContent = 'Type your goal first.'; return; }
    $('#planGo').disabled = true;
    $('#planStatus').textContent = 'Drafting your 12-week plan…';
    try {
      const r = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foundation: F.name, goal: goal, weeks: 12, scripture: F.verseRef })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error === 'not configured' ? 'AI isn’t configured yet — you can still fill this in by hand.' : (j.error || 'Something went wrong.'));
      applyFoundationPlan(fi, j);
      $('#planModal').classList.add('hidden');
      toast('Your ' + F.name + ' plan is ready ✦');
    } catch (e) {
      $('#planStatus').textContent = e.message;
      $('#planGo').disabled = false;
    }
  }

  // Write the AI plan: the six blueprint prompts onto the foundation's page,
  // and each week's commitment into that week's Weekly Foundations page.
  function applyFoundationPlan(fi, plan) {
    const journal = state.journal;
    const bpIdx = state.blueprintIndex[fi];
    const bp = bpIdx != null ? journal.pages[bpIdx] : null;
    if (bp) {
      const d = LJStore.loadPageData(bp.id);
      d.fields = d.fields || {};
      LJData.BLUEPRINT.forEach((p) => {
        const val = plan[p.id];
        if (!val) return;
        const two = splitTwo(val);
        d.fields[p.id + '0'] = two[0];
        if (two[1]) d.fields[p.id + '1'] = two[1]; else delete d.fields[p.id + '1'];
      });
      LJStore.savePageData(bp.id, d);
      if (currentPage() && currentPage().id === bp.id) { state.fields = d.fields; renderFieldLayer(); }
    }
    const wfPages = journal.pages.filter((p) => p.template === 'weeklyFoundations');
    (plan.weeks || []).forEach((wk, k) => {
      if (!wk || !wfPages[k]) return;
      const d = LJStore.loadPageData(wfPages[k].id);
      d.fields = d.fields || {};
      d.fields['goal' + fi] = wk;
      LJStore.savePageData(wfPages[k].id, d);
    });
    scheduleAutoSync();
  }

  // ---------- Editor ----------
  function buildPlannerIndex() {
    state.dateIndex = {}; state.monthIndex = {}; state.yearPageIndex = -1; state.goalsIndex = {}; state.weekIndex = {}; state.blueprintIndex = {};
    if (!state.journal) return;
    state.journal.pages.forEach((p, i) => {
      if (p.date) state.dateIndex[p.date] = i;
      if (p.template === 'planWeek' && p.weekStart) state.weekIndex[p.weekStart] = i;
      if (p.template === 'planMonth') state.monthIndex[p.month] = i;
      if (p.template === 'planYear' || p.template === 'planCycle') state.yearPageIndex = i;
      if (p.template === 'foundationsGoals') state.goalsIndex[p.quarter != null ? p.quarter : 'cycle'] = i;
      if (p.template === 'foundationBlueprint') {
        state.blueprintIndex[p.foundation] = i;
        if (state.goalsIndex.cycle == null) state.goalsIndex.cycle = i;   // first blueprint = Goals nav target
      }
    });
  }
  function goToGoals() {
    if (state.goalsIndex.cycle != null) return loadPage(state.goalsIndex.cycle);
    const q = Math.floor(new Date().getMonth() / 3);
    const i = state.goalsIndex[q] != null ? state.goalsIndex[q] : state.goalsIndex[0];
    if (i != null) loadPage(i);
    else toast('No goals pages in this journal — add one from ＋ Page');
  }
  function goToDate(ds) { const i = state.dateIndex[ds]; if (i != null) loadPage(i); }
  function goToWeek(ws) { const i = state.weekIndex[ws]; if (i != null) loadPage(i); else goToDate(ws); }
  function goToMonth(m) { const i = state.monthIndex[m]; if (i != null) loadPage(i); }
  function goToYear() { if (state.yearPageIndex >= 0) loadPage(state.yearPageIndex); }

  function jumpToToday() {
    const iso = LJPlanner.todayISO();
    if (state.dateIndex[iso] != null) { goToDate(iso); toast('Today · ' + LJPlanner.partsFor(iso).long); }
    else toast('Today isn’t in this journal’s year');
  }

  function openJournal(id, skipFlow) {
    const j = state.lib.journals.find((x) => x.id === id);
    if (!j) return;
    // A completed cycle greets you with the reflection moment (once).
    if (!skipFlow && j.cycle && window.LJPlanner) {
      const st = LJPlanner.cycleStatus(j.startISO);
      if (st.state === 'done' && !LJKV.get('lifejournal.cycledone.' + j.id)) { showCycleDone(j); return; }
    }
    // Opening the planner starts the daily flow if it hasn't run today.
    if (!skipFlow && j.kind === 'planner' && maybeMorningFlow(j, true)) return;
    state.journal = j;
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
    // Land on today's daily page when it's in range; otherwise a cycle journal
    // opens on its overview (its natural home), and other journals on the cover.
    const todayIdx = window.LJPlanner ? state.dateIndex[LJPlanner.todayISO()] : null;
    let landing = 0;
    if (state.journal.kind === 'planner' && todayIdx != null) landing = todayIdx;
    else if (state.journal.cycle && state.yearPageIndex >= 0) landing = state.yearPageIndex;
    loadPage(landing);
    setMode(defaultMode(), true);
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
    renderSideChips();
    renderMobileDay();
    // Always land at the top of a page you navigate to.
    const stage = $('#stage');
    if (stage) { stage.scrollTop = 0; stage.scrollLeft = 0; }
    const mob = $('#mobileDay');
    if (mob) mob.scrollTop = 0;
    if (window.LJPlanner) {
      $('#navToday').classList.toggle('active', !!page.date && page.date === LJPlanner.todayISO());
      $('#navCalendar').classList.toggle('active', page.template === 'planMonth');
      $('#navGoals').classList.toggle('active', page.template === 'foundationsGoals' || page.template === 'foundationBlueprint');
    }
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
      if (f.serif) inp.style.fontFamily = 'Georgia, serif';
      // completed Top-3 items read as done: struck through and muted
      if (state.checks[f.id]) { inp.style.textDecoration = 'line-through'; inp.style.opacity = '.55'; }
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

  // Device default: iPads (big touch screens) start in Pen mode, desktops and
  // phones start in Type mode — but whatever you last chose always wins.
  function defaultMode() {
    const saved = LJKV.get('lifejournal.mode');
    if (saved === 'draw' || saved === 'type') return saved;
    const touch = (navigator.maxTouchPoints || 0) > 0 &&
      window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const bigTouch = touch && Math.min(screen.width, screen.height) >= 700;
    return bigTouch ? 'draw' : 'type';
  }

  function setMode(mode, quiet) {
    state.mode = mode;
    LJKV.set('lifejournal.mode', mode);
    const layer = $('#typeLayer');
    const isType = mode === 'type';
    layer.classList.toggle('typing', isType);
    $('#typeModeBtn').classList.toggle('active', isType);
    renderFieldLayer();
    if (isType) {
      $('#inkCanvas').style.pointerEvents = 'none';
      $('#textLayer').classList.remove('active');
      if (!quiet) {
        const first = layer.querySelector('.lj-field');
        if (first) first.focus();
        const n = (LJTemplates.fieldRects(currentPage().template) || []).length;
        toast(n ? 'Type mode — tap a line, Enter/Tab for the next' : 'No typed fields on this page');
      }
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
    renderSideChips();
    saveCurrentDebounced();
  }
  function saveCurrentDebounced() {
    const id = currentPage().id;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => LJStore.savePageData(id, pageData()), 500);
    scheduleAutoSync();
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
    if (page.template === 'foundationsGoals') return page.quarter != null ? `Q${page.quarter + 1} · 12-Week Goals` : '12-Week Goals';
    if (page.template === 'foundationBlueprint') {
      const F = (window.LJData && LJData.FOUNDATIONS[page.foundation]);
      return (F ? F.name : 'Foundation') + ' · Blueprint';
    }
    if (page.template === 'planCycle') return '12-Week Overview';
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
      renderFieldLayer();
      renderInteractiveLayer();
      renderSideChips();
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

  // ---------- Guided morning flow (iPad / desktop) ----------
  // The daily ritual, one question at a time: yesterday check-in → thankful
  // → scripture (with a continue-reading nudge) → journal & prayer (AI
  // prompts) → time-blocking → Five Foundations check-in → reminder. Ends on
  // today's page with everything written in.
  const flow = { step: 0, steps: [], data: null };

  function nextChapterAfter(pr) {
    if (!window.LJBible || !pr) return null;
    const bi = LJBible.BOOKS.findIndex((b) => b[0] === pr.book);
    if (bi < 0) return null;
    if (pr.chapter < LJBible.BOOKS[bi][1].length) return pr.book + ' ' + (pr.chapter + 1);
    const nb = LJBible.BOOKS[bi + 1];
    return nb ? nb[0] + ' 1' : null;
  }

  // Context pulled from the planner for the check-in steps.
  function flowContext(planner, iso) {
    const p = LJPlanner.parseISO(iso);
    const todayTs = Date.UTC(p.y, p.m, p.d);
    const yIso = LJPlanner.isoFromTs(todayTs - LJPlanner.DAY_MS);
    const yp = planner.pages.find((pg) => pg.date === yIso);
    let yFields = {}, yChecks = {}, ypage = null;
    if (yp) { const d = LJStore.loadPageData(yp.id); yFields = d.fields || {}; yChecks = d.checks || {}; ypage = yp; }
    const yRef = window.LJBible ? LJBible.parseRef(yFields.scr0 || '') : null;

    // Goals for the Five Foundations, normalized to g{i}goal keys. A cycle
    // reads each foundation's WHAT from its blueprint page; a year planner
    // reads the current quarter's combined goals page.
    const q = Math.floor(p.m / 3);
    let goals = {}, gp = null;
    if (planner.cycle) {
      LJData.FOUNDATIONS.forEach((F, fi) => {
        const bp = planner.pages.find((pg) => pg.template === 'foundationBlueprint' && pg.foundation === fi);
        if (!bp) return;
        const bd = LJStore.loadPageData(bp.id).fields || {};
        const what = [bd.what0, bd.what1].filter((v) => v && v.trim()).join(' ').trim();
        if (what) goals['g' + fi + 'goal'] = what;
      });
    } else {
      gp = planner.pages.find((pg) => pg.template === 'foundationsGoals' && pg.quarter === q);
      goals = gp ? (LJStore.loadPageData(gp.id).fields || {}) : {};
    }
    // This week's commitments: the weeklyFoundations page whose 7-day span
    // contains today (works for both Sunday-based years and cycle weeks).
    const wp = planner.pages.find((pg) => {
      if (pg.template !== 'weeklyFoundations' || !pg.weekStart) return false;
      const wp0 = LJPlanner.parseISO(pg.weekStart);
      const ws0 = Date.UTC(wp0.y, wp0.m, wp0.d);
      return todayTs >= ws0 && todayTs < ws0 + 7 * LJPlanner.DAY_MS;
    });
    const weekly = wp ? (LJStore.loadPageData(wp.id).fields || {}) : {};

    return { yIso, ypage, yFields, yChecks, yRef, suggestion: yRef ? nextChapterAfter(yRef) : null, goals, goalsPage: gp, weekly };
  }

  function maybeMorningFlow(journalArg, fromJournal) {
    // Runs on every device — phones now get the same guided ritual as
    // desktop/iPad instead of the single cram-everything-in card view.
    if (!window.LJPlanner) return false;
    const planner = journalArg || state.lib.journals.find((j) => j.kind === 'planner');
    if (!planner || planner.kind !== 'planner') return false;
    const iso = LJPlanner.todayISO();
    const tp = planner.pages.find((p) => p.date === iso);
    if (!tp) return false;
    if (flow.skippedSession) return false;
    if (!fromJournal && LJKV.get('lifejournal.flow.' + iso)) return false;
    const data = LJStore.loadPageData(tp.id);
    if ((data.fields || {}).th0) return false;

    const ctx = flowContext(planner, iso);
    const cyc = planner.cycle && window.LJPlanner ? LJPlanner.cycleStatus(planner.startISO, iso) : null;
    flow.planner = planner; flow.tp = tp; flow.iso = iso; flow.ctx = ctx; flow.cyc = cyc;
    flow.fromJournal = !!fromJournal;
    // Seed each foundation's "Today I will…" from this week's commitment so
    // the daily tasks ladder up to the week's plan (editable).
    const seededSteps = SIDE_FND.map((_, i) => (cyc ? (ctx.weekly['goal' + i] || '') : ''));
    flow.data = {
      reviewChecks: Object.assign({}, ctx.yChecks),
      reviewNote: '', thank: '', tops: ['', '', ''], scr: '', journal: '', prayer: '',
      sch: {}, steps: seededSteps, remindTime: '07:00',
      cycleGoals: cyc ? LJData.FOUNDATIONS.map((F, i) => ctx.goals['g' + i + 'goal'] || '') : []
    };
    const hasYesterday = !!(ctx.ypage && (ctx.yFields.top0 || ctx.yFields.top1 || ctx.yFields.top2));
    flow.steps = [];
    // On day 1 of a cycle, the ritual opens with goal-setting.
    if (cyc && cyc.day === 1) flow.steps.push('cyclegoals');
    if (hasYesterday) flow.steps.push('review');
    flow.steps.push('thank', 'scripture', 'tops', 'journal', 'schedule', 'foundations');
    if (window.LJNotify && LJNotify.available() && !LJKV.get('lifejournal.reminder')) flow.steps.push('reminder');
    flow.step = 0;
    const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
    $('#mfGreeting').textContent = `Happy ${day}.`;
    const kicker = $('#mfKicker');
    if (kicker) {
      if (cyc && cyc.state === 'active') { kicker.textContent = `Week ${cyc.week} · Day ${cyc.day} of ${cyc.total}`; kicker.classList.remove('hidden'); }
      else kicker.classList.add('hidden');
    }
    $('#library').classList.add('hidden');
    $('#morningFlow').classList.remove('hidden');
    renderFlowStep();
    return true;
  }

  function mfLabel(text) { return el('div', 'mf-label', text); }
  function mfInputRow(getset, placeholder, cls) {
    const inp = el('input', 'mf-input' + (cls ? ' ' + cls : ''));
    inp.type = 'text';
    inp.placeholder = placeholder || '';
    inp.value = getset() || '';
    inp.addEventListener('input', () => getset(inp.value));
    return inp;
  }

  function renderFlowStep() {
    const body = $('#mfBody');
    body.innerHTML = '';
    const kind = flow.steps[flow.step];
    const d = flow.data, ctx = flow.ctx;
    $('#mfDots').innerHTML = flow.steps.map((s, i) =>
      `<span class="${i === flow.step ? 'on' : ''}"></span>`).join('');
    $('#mfNext').classList.remove('hidden');
    $('#mfNext').textContent = flow.step === flow.steps.length - 1 ? 'Open my journal →' : 'Continue →';

    if (kind === 'review') {
      body.appendChild(mfLabel('Quick check-in — how did yesterday go?'));
      ['top0', 'top1', 'top2'].forEach((id) => {
        const txt = ctx.yFields[id];
        if (!txt) return;
        const row = el('div', 'mf-review-row');
        const chk = el('button', 'm-check' + (d.reviewChecks[id] ? ' on' : ''));
        chk.onclick = () => {
          if (d.reviewChecks[id]) delete d.reviewChecks[id]; else d.reviewChecks[id] = true;
          chk.classList.toggle('on', !!d.reviewChecks[id]);
          span.classList.toggle('m-done', !!d.reviewChecks[id]);
        };
        const span = el('span', 'mf-review-txt' + (d.reviewChecks[id] ? ' m-done' : ''), escapeHtml(txt));
        row.appendChild(chk); row.appendChild(span);
        body.appendChild(row);
      });
      const note = mfInputRow((v) => (v === undefined ? d.reviewNote : (d.reviewNote = v)), 'One line — how did it go?');
      note.classList.add('mf-serifin');
      body.appendChild(note);
    } else if (kind === 'cyclegoals') {
      body.appendChild(mfLabel('First — set your Five Foundations goals for these 12 weeks.'));
      body.appendChild(el('p', 'mf-sub', 'One goal per foundation. You can refine each — and use ✦ Draft with AI — on its own page later.'));
      LJData.FOUNDATIONS.forEach((F, i) => {
        const sec = el('div', 'mf-fnd');
        sec.appendChild(el('div', 'mf-fnd-name', F.name));
        const inp = mfInputRow((v) => (v === undefined ? d.cycleGoals[i] : (d.cycleGoals[i] = v)), planPlaceholder(F.key));
        sec.appendChild(inp);
        body.appendChild(sec);
      });
    } else if (kind === 'thank') {
      const inp = mfInputRow((v) => (v === undefined ? d.thank : (d.thank = v)),
        'Let’s start with what you’re thankful for today…', 'mf-hero');
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') flowNext(); });
      body.appendChild(inp);
      setTimeout(() => inp.focus(), 60);
    } else if (kind === 'tops') {
      body.appendChild(mfLabel('What 3 things must get done today?'));
      const inputs = [];
      for (let i = 0; i < 3; i++) {
        const row = el('div', 'mf-top-row');
        row.appendChild(el('span', 'mf-num', String(i + 1)));
        const inp = mfInputRow((v) => (v === undefined ? d.tops[i] : (d.tops[i] = v)));
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { if (i < 2) inputs[i + 1].focus(); else flowNext(); }
        });
        inputs.push(inp);
        row.appendChild(inp);
        body.appendChild(row);
      }
      setTimeout(() => inputs[0].focus(), 60);
    } else if (kind === 'scripture') {
      body.appendChild(mfLabel('What scripture would you like to study?'));
      if (ctx.suggestion) {
        body.appendChild(el('p', 'mf-sub',
          `You studied ${escapeHtml(ctx.yRef.ref)} yesterday — today you’d be at ${escapeHtml(ctx.suggestion)}.`));
        const use = el('button', 'mf-chip mf-suggest-chip', `Use ${escapeHtml(ctx.suggestion)} →`);
        use.onclick = () => { d.scr = ctx.suggestion; inp.value = ctx.suggestion; dd.classList.add('hidden'); };
        body.appendChild(use);
      }
      const inp = mfInputRow((v) => (v === undefined ? d.scr : (d.scr = v)), 'Or pick any passage…');
      body.appendChild(inp);
      const dd = el('div', 'm-suggest hidden');
      const updateDD = () => {
        const items = window.LJBible ? LJBible.suggest(inp.value) : [];
        dd.innerHTML = '';
        if (!items.length || (items.length === 1 && items[0].value === inp.value)) { dd.classList.add('hidden'); return; }
        items.slice(0, 120).forEach((it) => {
          const opt = el('div', 'm-suggest-item', it.label);
          opt.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            inp.value = it.value; d.scr = it.value;
            if (it.done) { dd.classList.add('hidden'); inp.blur(); } else updateDD();
          });
          dd.appendChild(opt);
        });
        dd.classList.remove('hidden');
      };
      inp.addEventListener('focus', updateDD);
      inp.addEventListener('input', updateDD);
      inp.addEventListener('blur', () => setTimeout(() => dd.classList.add('hidden'), 200));
      body.appendChild(dd);
    } else if (kind === 'journal') {
      body.appendChild(mfLabel('Journal'));
      const jp = el('p', 'mf-sub mf-prompt-j', 'What is on your heart this morning?');
      body.appendChild(jp);
      const jta = el('textarea', 'mf-textarea');
      jta.rows = 4; jta.placeholder = 'Write freely…'; jta.value = d.journal;
      jta.addEventListener('input', () => { d.journal = jta.value; });
      body.appendChild(jta);
      body.appendChild(mfLabel('Prayer'));
      const pp = el('p', 'mf-sub mf-prompt-p', 'Lord, today I want to bring you…');
      body.appendChild(pp);
      const pta = el('textarea', 'mf-textarea');
      pta.rows = 2; pta.placeholder = 'Talk to God…'; pta.value = d.prayer;
      pta.addEventListener('input', () => { d.prayer = pta.value; });
      body.appendChild(pta);
      loadFlowPrompts(jp, pp);
    } else if (kind === 'schedule') {
      body.appendChild(mfLabel('Let’s time block your day'));
      const grid = el('div', 'mf-sched');
      const hours = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
      const evts = (calOn() && calCache[flow.iso]) || [];
      hours.forEach((h, i) => {
        const row = el('div', 'mf-sched-row');
        row.appendChild(el('span', 'm-hour', mobHourLabel(h)));
        const inp = el('input', 'mf-input mf-sched-in');
        inp.type = 'text';
        const evt = evts.find((e) => !e.allDay && Math.floor(e.startH) === h);
        if (d.sch['sch' + i] === undefined && evt) d.sch['sch' + i] = evt.title;
        inp.value = d.sch['sch' + i] || '';
        if (evt) inp.placeholder = evt.title;
        inp.addEventListener('input', () => { d.sch['sch' + i] = inp.value; });
        row.appendChild(inp);
        grid.appendChild(row);
      });
      body.appendChild(grid);
      if (calOn() && flow.iso && !calCache[flow.iso]) {
        LJCal.events(flow.iso).then((r) => {
          if (r && r.events) { calCache[flow.iso] = r.events; if (flow.steps[flow.step] === 'schedule') renderFlowStep(); }
        });
      }
    } else if (kind === 'foundations') {
      body.appendChild(mfLabel('Five Foundations — what will you do today?'));
      SIDE_FND.forEach((name, i) => {
        const sec = el('div', 'mf-fnd');
        sec.appendChild(el('div', 'mf-fnd-name', name));
        const goal = flow.ctx.goals['g' + i + 'goal'];
        const week = flow.ctx.weekly['goal' + i];
        if (goal) sec.appendChild(el('div', 'mf-fnd-goal', '12-week goal: ' + escapeHtml(goal)));
        if (week) sec.appendChild(el('div', 'mf-fnd-goal', 'This week: ' + escapeHtml(week)));
        const inp = mfInputRow((v) => (v === undefined ? d.steps[i] : (d.steps[i] = v)), 'Today I will…');
        sec.appendChild(inp);
        body.appendChild(sec);
      });
    } else if (kind === 'reminder') {
      body.appendChild(mfLabel('A gentle morning nudge?'));
      body.appendChild(el('p', 'mf-sub', 'Get a reminder each morning to check in on yesterday and set up today.'));
      const t = el('input', 'mf-time');
      t.type = 'time'; t.value = d.remindTime;
      t.addEventListener('input', () => { d.remindTime = t.value; });
      body.appendChild(t);
      const set = el('button', 'btn primary mf-big', 'Set reminder');
      set.onclick = async () => {
        const [h, m] = d.remindTime.split(':').map(Number);
        const r = await LJNotify.schedule(h || 7, m || 0);
        if (r && r.scheduled) { LJKV.set('lifejournal.reminder', d.remindTime); toast('Reminder set for ' + d.remindTime); }
        else if (r && r.granted === false) toast('Notifications are off — enable them in Settings');
        finishFlow();
      };
      const skip = el('button', 'btn mf-big', 'Not now');
      skip.onclick = finishFlow;
      const wrap = el('div', 'mf-choices');
      wrap.appendChild(set); wrap.appendChild(skip);
      body.appendChild(wrap);
      $('#mfNext').classList.add('hidden');
    }
  }

  async function loadFlowPrompts(jpEl, ppEl) {
    const iso = flow.iso;
    const cacheKey = 'lifejournal.prompts.' + iso;
    const cached = LJKV.get(cacheKey);
    if (cached) {
      try { const c = JSON.parse(cached); if (c.journal) jpEl.textContent = c.journal; if (c.prayer) ppEl.textContent = c.prayer; return; } catch (e) {}
    }
    try {
      const r = await fetch('/api/prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thankful: flow.data.thank, scripture: flow.data.scr })
      });
      if (!r.ok) return;
      const j = await r.json();
      if (j.journal) jpEl.textContent = j.journal;
      if (j.prayer) ppEl.textContent = j.prayer;
      LJKV.set(cacheKey, JSON.stringify(j));
    } catch (e) { /* static prompts stay */ }
  }

  function flowNext() {
    if (flow.step < flow.steps.length - 1) { flow.step++; renderFlowStep(); }
    else finishFlow();
  }

  function finishFlow() {
    const d = flow.data;
    // Day-1 cycle goals → each foundation's blueprint page (WHAT), without
    // clobbering a richer AI-drafted goal already on the page.
    if (d.cycleGoals && d.cycleGoals.length && flow.planner.cycle) {
      d.cycleGoals.forEach((g, i) => {
        if (!g || !g.trim()) return;
        const bp = flow.planner.pages.find((p) => p.template === 'foundationBlueprint' && p.foundation === i);
        if (!bp) return;
        const bd = LJStore.loadPageData(bp.id); bd.fields = bd.fields || {};
        const existing = [bd.fields.what0, bd.fields.what1].filter(Boolean).join(' ').trim();
        if (existing === g.trim()) return;      // unchanged from prefill
        if (!bd.fields.what0) {
          const two = splitTwo(g.trim());
          bd.fields.what0 = two[0]; if (two[1]) bd.fields.what1 = two[1];
          LJStore.savePageData(bp.id, bd);
        }
      });
    }
    // Yesterday's review: check off what got done + a reflection line.
    if (flow.ctx.ypage) {
      const y = LJStore.loadPageData(flow.ctx.ypage.id);
      y.checks = d.reviewChecks;
      if (d.reviewNote.trim()) {
        y.fields = y.fields || {};
        for (let i = 0; i < 12; i++) {
          if (!y.fields['jrn' + i]) { y.fields['jrn' + i] = 'Looking back: ' + d.reviewNote.trim(); break; }
        }
      }
      LJStore.savePageData(flow.ctx.ypage.id, y);
    }
    // Today's page.
    const data = LJStore.loadPageData(flow.tp.id);
    data.fields = data.fields || {};
    if (d.thank.trim()) data.fields.th0 = d.thank.trim();
    d.tops.forEach((t, i) => { if (t.trim()) data.fields['top' + i] = t.trim(); });
    if (d.scr.trim()) data.fields.scr0 = d.scr.trim();
    Object.keys(d.sch).forEach((k) => { if ((d.sch[k] || '').trim()) data.fields[k] = d.sch[k].trim(); });
    d.steps.forEach((s, i) => { if (s.trim()) data.fields['step' + i] = s.trim(); });
    const lines = [];
    d.journal.split('\n').forEach((l) => { if (l.trim()) lines.push(l.trim()); });
    if (d.prayer.trim()) {
      d.prayer.split('\n').forEach((l, i) => { if (l.trim()) lines.push((i === 0 ? 'Prayer — ' : '') + l.trim()); });
    }
    lines.slice(0, 12).forEach((l, i) => { data.fields['jrn' + i] = l; });
    LJStore.savePageData(flow.tp.id, data);
    LJKV.set('lifejournal.flow.' + flow.iso, '1');
    $('#morningFlow').classList.add('hidden');
    openJournal(flow.planner.id, true);
    goToDate(flow.iso);
    scheduleAutoSync();
    toast('Today is set — have a great one ✦');
  }

  // ---------- Apple Calendar on the daily schedule ----------
  const calCache = {};
  function calOn() {
    return window.LJCal && LJCal.available() && LJKV.get('lifejournal.cal') !== 'off';
  }
  function renderCalEvents(page, layer, s) {
    if (!calOn() || !page.date) return;
    if ((page.template !== 'planDay' && page.template !== 'foundationsDaily')) return;
    const paint = (evts) => {
      if (currentPage() !== page) return;
      const L = LJTemplates.dailyLayout();
      evts.filter((e) => !e.allDay && e.startH >= 5 && e.startH < 23).forEach((e) => {
        const idx = Math.min(17, Math.floor(e.startH) - 5);
        const col = L.schedCols[idx < L.schedPerCol ? 0 : 1];
        const y = L.schedTop + (idx % L.schedPerCol) * L.schedRowH;
        const d = el('div', 'lj-cal-evt',
          `<i style="background:${escapeHtml(e.color || '#5a8c6e')}"></i>${escapeHtml(e.time)} ${escapeHtml(e.title)}`);
        d.style.left = (col.x * s) + 'px';
        d.style.width = (col.w * s) + 'px';
        d.style.top = ((y - 31) * s) + 'px';
        layer.appendChild(d);
      });
    };
    if (calCache[page.date]) { paint(calCache[page.date]); return; }
    LJCal.events(page.date).then((r) => {
      if (r && r.events) { calCache[page.date] = r.events; paint(r.events); }
    });
  }

  // ---------- Apple sign-in + automatic cross-device sync ----------
  function appleCode(uid) { return 'apple-' + uid; }
  let autoSyncTimer = null;
  function scheduleAutoSync(ms) {
    if (!state.appleUser || !state.appleUser.userId) return;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(async () => {
      try {
        flushSave && state.journal && flushSave();
        const m = await LJSync.upload(appleCode(state.appleUser.userId));
        LJKV.set('lifejournal.autosync.at', String(m.savedAt || Date.now()));
      } catch (e) { /* offline is fine — next edit retries */ }
    }, ms == null ? 30000 : ms);
  }
  async function autoSyncLaunch() {
    if (!(window.LJAuth && LJAuth.available())) return;
    const st = await LJAuth.status();
    if (!st || !st.userId) return;
    state.appleUser = st;
    LJSync.setCode(appleCode(st.userId));
    try {
      const p = await LJSync.fetchRaw(appleCode(st.userId));
      const localAt = Number(LJKV.get('lifejournal.autosync.at') || 0);
      if (p && p.savedAt && p.savedAt > localAt) {
        LJSync.applyPayload(p);
        LJSync.setLastSync('download');
        LJKV.set('lifejournal.autosync.at', String(p.savedAt));
        state.lib = LJStore.loadLibrary();
      } else if (!p) {
        scheduleAutoSync(4000);      // first device: seed the cloud copy
      }
    } catch (e) { /* offline launch — keep local */ }
  }

  // ---------- Desktop sidebar (Five Foundations chips + day footer) ----------
  const SIDE_FND = ['FAITH', 'FAMILY', 'FINANCES', 'FITNESS', 'FOCUS'];
  // Progress label + percent for the current planner: cycle journals count
  // toward their 84 days; older year planners count toward 365.
  function planProgress() {
    const j = state.journal;
    if (j && j.cycle && window.LJPlanner) {
      const st = LJPlanner.cycleStatus(j.startISO);
      const prog = st.state === 'done' ? 100 : st.state === 'before' ? 0 : Math.round(st.day / st.total * 100);
      const label = st.state === 'before' ? `Starts in ${st.startsInDays} day${st.startsInDays === 1 ? '' : 's'}`
        : st.state === 'done' ? 'Complete · 12 weeks'
        : `Week ${st.week} of 12 · Day ${st.day} of 84`;
      return { prog, label };
    }
    const doy = dayOfYear(new Date());
    return { prog: Math.min(100, Math.round(doy / 365 * 100)), label: `Day ${doy} of 365` };
  }
  function renderSideChips() {
    const box = $('#sideChips');
    if (!box) return;
    box.innerHTML = '';
    const sideDay = $('#sideDay');
    if (!state.journal || state.journal.kind !== 'planner' || !window.LJPlanner) { sideDay.textContent = ''; return; }
    const iso = LJPlanner.todayISO();
    const idx = state.dateIndex[iso];
    const today = idx != null ? state.journal.pages[idx] : null;
    const onToday = today && currentPage() && currentPage().id === today.id;
    const checks = today ? (onToday ? state.checks : LJStore.loadPageData(today.id).checks) : {};
    const sideLabel = document.querySelector('.side-label');
    if (state.theme === 'ink') {
      // Ink & Glass sidebar shows the year progress bar (per the mock)
      if (sideLabel) sideLabel.textContent = 'Progress';
      const pp = planProgress();
      box.innerHTML = `<div class="side-prog"><i style="width:${pp.prog}%"></i></div>`;
      sideDay.innerHTML = pp.label;
      return;
    }
    if (sideLabel) sideLabel.textContent = 'Five Foundations';
    SIDE_FND.forEach((lab, i) => {
      const id = 'fnd' + i;
      const b = el('button', 'side-chip' + (checks[id] ? ' on' : ''), lab);
      b.onclick = () => {
        if (!today) return;
        if (onToday) {
          if (state.checks[id]) delete state.checks[id]; else state.checks[id] = true;
          recordChange();
          saveCurrentDebounced();
          renderInteractiveLayer();
        } else {
          const data = LJStore.loadPageData(today.id);
          if (data.checks[id]) delete data.checks[id]; else data.checks[id] = true;
          LJStore.savePageData(today.id, data);
        }
        renderSideChips();
      };
      box.appendChild(b);
    });
    let onPace = false;
    if (today) {
      const d = onToday ? pageData() : LJStore.loadPageData(today.id);
      onPace = (d.strokes && d.strokes.length > 0) || Object.keys(d.fields || {}).length > 0 || Object.keys(d.checks || {}).length > 0;
    }
    sideDay.innerHTML = `${planProgress().label}${onPace ? ' · <b>On pace</b>' : ''}`;
  }

  // ---------- AI Bible study ----------
  // Tiny markdown renderer for the study text (### headers, **bold**, paragraphs).
  function mdLite(text) {
    const esc = escapeHtml(String(text));
    return esc.split(/\n{2,}/).map((block) => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('###')) return '<h3>' + b.replace(/^#+\s*/, '') + '</h3>';
      return '<p>' + b.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  // The Bible Studies journal: every generated study is stored here with its
  // reference, generation date, and your own notes. Searchable from the
  // "Bible Studies" tab.
  function loadStudies() {
    try { return JSON.parse(LJKV.get('lifejournal.studies') || '[]'); } catch (e) { return []; }
  }
  function saveStudies(list) { LJKV.set('lifejournal.studies', JSON.stringify(list)); }
  function upsertStudy(ref, text) {
    const list = loadStudies();
    let e = list.find((s) => s.ref === ref);
    if (e) { e.study = text; e.created = new Date().toISOString(); }
    else { e = { id: LJData.uid(), ref, created: new Date().toISOString(), study: text, notes: '' }; list.unshift(e); }
    saveStudies(list);
    return e;
  }

  async function openStudy(ref, force) {
    const parsed = window.LJBible && LJBible.parseRef(ref);
    if (!parsed) { toast('Pick a passage first — e.g. John 3 or John 3:16'); return; }
    const existing = loadStudies().find((s) => s.ref === parsed.ref);
    if (existing && !force) { openStudies(existing.id); return; }
    // Generating new studies is a Pro feature once purchases are configured.
    if (!(await LJIAP.isPro())) { openPaywall(); return; }
    // Go straight into the Bible Studies journal; the study forms in place.
    $('#studiesModal').classList.remove('hidden');
    $('#studiesList').classList.add('hidden');
    const d = $('#studyDetail');
    d.classList.remove('hidden');
    d.innerHTML =
      '<h2 class="sd-ref">' + escapeHtml(parsed.ref) + '</h2>' +
      '<div class="sd-date">Writing your study…</div>' +
      '<p class="study-loading">Cultural &amp; historical context, how it points to the Gospel, and how to live it out — just a few seconds.</p>';
    try {
      const r = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: parsed.ref })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong.');
      const entry = upsertStudy(parsed.ref, j.study);
      renderStudyDetail(entry.id);
      toast('Saved to your Bible Studies');
    } catch (e) {
      const retry = el('button', 'btn primary', 'Try again');
      retry.onclick = () => openStudy(parsed.ref, force);
      d.innerHTML = '<h2 class="sd-ref">' + escapeHtml(parsed.ref) + '</h2><p class="sync-note">' + escapeHtml(e.message) + '</p>';
      d.appendChild(retry);
    }
  }

  // ---------- Paywall (RevenueCat via the iOS shell) ----------
  async function openPaywall() {
    const modal = $('#paywallModal'), plans = $('#paywallPlans'), status = $('#paywallStatus');
    modal.classList.remove('hidden');
    status.textContent = '';
    plans.innerHTML = '<p class="study-loading">Loading plans…</p>';
    const o = await LJIAP.offerings();
    plans.innerHTML = '';
    if (!o || !o.packages || !o.packages.length) {
      plans.innerHTML = '<p class="sync-note">Plans aren’t available right now — please try again later.</p>';
      return;
    }
    o.packages.forEach((p) => {
      const b = el('button', 'pw-plan',
        `<span class="pw-title">${escapeHtml(p.title)}</span>
         <span class="pw-price">${escapeHtml(p.price)}${p.period ? ' / ' + p.period : ''}</span>`);
      b.onclick = async () => {
        status.textContent = 'Opening App Store…';
        const r = await LJIAP.purchase(p.id);
        if (r && r.pro) {
          modal.classList.add('hidden');
          toast('Welcome to Life Journal Pro ✦');
        } else if (r && r.cancelled) {
          status.textContent = '';
        } else {
          status.textContent = (r && r.error) || 'That didn’t go through — please try again.';
        }
      };
      plans.appendChild(b);
    });
  }

  // ---------- Bible Studies journal (list + detail with notes) ----------
  function fmtStudyDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }
  function openStudies(detailId) {
    $('#studiesModal').classList.remove('hidden');
    if (detailId) renderStudyDetail(detailId);
    else renderStudiesList($('#studiesSearch').value || '');
  }
  function renderStudiesList(q) {
    $('#studiesList').classList.remove('hidden');
    $('#studyDetail').classList.add('hidden');
    const box = $('#studiesEntries');
    box.innerHTML = '';
    const needle = (q || '').trim().toLowerCase();
    const list = loadStudies().filter((s) =>
      !needle || s.ref.toLowerCase().includes(needle) ||
      (s.study || '').toLowerCase().includes(needle) ||
      (s.notes || '').toLowerCase().includes(needle));
    if (!list.length) {
      box.innerHTML = '<p class="sync-note">' + (needle ? 'No studies match that search.' :
        'No studies yet — pick a passage on a daily page and tap ✦ Study.') + '</p>';
      return;
    }
    list.forEach((s) => {
      const snip = (s.study || '').replace(/###[^\n]*/g, '').replace(/\s+/g, ' ').trim().slice(0, 110);
      const b = el('button', 'search-hit study-hit',
        `<div class="sh-ref">${escapeHtml(s.ref)}</div>
         <div class="sh-date">${fmtStudyDate(s.created)}${s.notes ? ' · has notes' : ''}</div>
         <div class="sh-snip">${escapeHtml(snip)}…</div>`);
      b.onclick = () => renderStudyDetail(s.id);
      box.appendChild(b);
    });
  }
  function renderStudyDetail(id) {
    const s = loadStudies().find((x) => x.id === id);
    if (!s) { renderStudiesList(''); return; }
    $('#studiesList').classList.add('hidden');
    const d = $('#studyDetail');
    d.classList.remove('hidden');
    d.innerHTML = '';
    const head = el('div', 'sd-head');
    const back = el('button', 'btn', '‹ All studies');
    back.onclick = () => renderStudiesList($('#studiesSearch').value || '');
    head.appendChild(back);
    const regen = el('button', 'btn', '↻ Regenerate');
    regen.onclick = () => { $('#studiesModal').classList.add('hidden'); openStudy(s.ref, true); };
    head.appendChild(regen);
    d.appendChild(head);
    d.appendChild(el('h2', 'sd-ref', escapeHtml(s.ref)));
    d.appendChild(el('div', 'sd-date', 'Generated ' + fmtStudyDate(s.created)));
    d.appendChild(el('div', 'study-body', mdLite(s.study)));
    d.appendChild(el('div', 'm-label sd-notes-label', 'My notes'));
    const ta = document.createElement('textarea');
    ta.className = 'sd-notes';
    ta.placeholder = 'What is God showing you through this passage?';
    ta.value = s.notes || '';
    ta.addEventListener('input', () => {
      const list = loadStudies();
      const e2 = list.find((x) => x.id === id);
      if (e2) { e2.notes = ta.value; saveStudies(list); }
    });
    d.appendChild(ta);
  }

  // ---------- Phone-native daily view ----------
  const MOB_HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const mobHourLabel = (h) => (h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p');
  function isPhone() { return window.matchMedia('(max-width: 640px)').matches; }
  function mobileEligible() {
    const p = state.journal && currentPage();
    return isPhone() && p && (p.template === 'planDay' || p.template === 'foundationsDaily');
  }

  function mobField(id, cls, placeholder) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'm-input' + (cls ? ' ' + cls : '');
    inp.placeholder = placeholder || '';
    inp.value = state.fields[id] || '';
    inp.addEventListener('input', () => {
      state.fields[id] = inp.value;
      recordChange('field:' + id);
      saveCurrentDebounced();
    });
    return inp;
  }

  function renderMobileDay() {
    const wrap = $('#mobileDay');
    if (!wrap) return;
    const phone = isPhone();
    const show = mobileEligible() && !state.forceCanvas;
    $('#mobileTabs').classList.toggle('hidden', !phone || !state.journal);
    wrap.classList.toggle('hidden', !show);
    $('#stage').classList.toggle('hidden', !!show);
    document.querySelector('#editor .toolbar').classList.toggle('hidden', !!show);
    $('#moreMenu').classList.add('hidden');
    if (!show) return;

    const page = currentPage();
    wrap.innerHTML = '';

    // top bar: back · wordmark · count · pencil (canvas view)
    const bar = el('div', 'm-bar');
    const back = el('button', 'm-back', '‹');
    back.onclick = backToLibrary;
    bar.appendChild(back);
    bar.appendChild(el('div', 'm-word', 'Life<em>Journal</em>'));
    const right = el('div', 'm-bar-right');
    right.appendChild(el('span', 'm-count', (state.pageIndex + 1) + '/' + state.journal.pages.length));
    const pen = el('button', 'm-pen', '✎');
    pen.title = 'Open the full page to write by hand';
    pen.onclick = () => { state.forceCanvas = true; renderMobileDay(); requestAnimationFrame(relayout); };
    right.appendChild(pen);
    bar.appendChild(right);
    wrap.appendChild(bar);

    // date header
    let parts = null;
    if (page.date && window.LJPlanner) parts = LJPlanner.partsFor(page.date);
    const doy = parts ? Math.floor((Date.UTC(parts.year, parts.month, parts.day) - Date.UTC(parts.year, 0, 0)) / 86400000) : dayOfYear(new Date());
    wrap.appendChild(el('div', 'm-kicker', parts ? `Day ${doy} · ${parts.weekdayName}` : 'Daily page'));
    wrap.appendChild(el('h1', 'm-date', parts ? parts.long : 'Foundations Daily'));

    // thankful banner
    const banner = el('div', 'm-banner');
    banner.appendChild(el('div', 'm-label m-label-red', 'Thankful for'));
    banner.appendChild(mobField('th0', 'm-serif', 'What are you thankful for?'));
    wrap.appendChild(banner);

    // top 3 card
    const top = el('div', 'm-card');
    top.appendChild(el('div', 'm-label', 'Top 3'));
    for (let i = 0; i < 3; i++) {
      const id = 'top' + i;
      const row = el('div', 'm-row');
      const chk = el('button', 'm-check' + (state.checks[id] ? ' on' : ''));
      chk.onclick = () => {
        if (state.checks[id]) delete state.checks[id]; else state.checks[id] = true;
        recordChange(); saveCurrentDebounced(); renderMobileDay(); renderSideChips();
      };
      row.appendChild(chk);
      const f = mobField(id, 'm-serif' + (state.checks[id] ? ' m-done' : ''), i === 0 ? 'Must be done today' : '');
      row.appendChild(f);
      top.appendChild(row);
    }
    wrap.appendChild(top);

    // foundations chips
    const chips = el('div', 'm-chips');
    SIDE_FND.forEach((lab, i) => {
      const id = 'fnd' + i;
      const c = el('button', 'm-chip' + (state.checks[id] ? ' on' : ''), lab);
      c.onclick = () => {
        if (state.checks[id]) delete state.checks[id]; else state.checks[id] = true;
        recordChange(); saveCurrentDebounced(); renderMobileDay(); renderSideChips();
      };
      chips.appendChild(c);
    });
    wrap.appendChild(chips);

    // schedule card — condensed: filled hours + the current hour; expandable
    const sched = el('div', 'm-card');
    const shead = el('div', 'm-label m-sched-head', 'Schedule · 5 am – 10 pm');
    const expand = el('button', 'm-expand', state.mobAllHours ? 'Filled only' : 'All hours');
    expand.onclick = () => { state.mobAllHours = !state.mobAllHours; renderMobileDay(); };
    shead.appendChild(expand);
    sched.appendChild(shead);
    const isToday = page.date && window.LJPlanner && page.date === LJPlanner.todayISO();
    const nowH = new Date().getHours();
    const dayEvents = (calOn() && page.date && calCache[page.date]) || [];
    const evtHours = {};
    dayEvents.forEach((e) => { if (!e.allDay) (evtHours[Math.floor(e.startH)] = evtHours[Math.floor(e.startH)] || []).push(e); });
    let any = false;
    MOB_HOURS.forEach((h, i) => {
      const id = 'sch' + i;
      const isNow = isToday && h === nowH;
      const evts = evtHours[h] || [];
      if (!state.mobAllHours && !state.fields[id] && !isNow && !evts.length) return;
      any = true;
      const row = el('div', 'm-row m-sched-row' + (isNow ? ' m-now' : ''));
      row.appendChild(el('span', 'm-hour', mobHourLabel(h)));
      row.appendChild(mobField(id, ''));
      if (isNow) row.appendChild(el('span', 'm-now-lab', 'Now'));
      sched.appendChild(row);
      evts.forEach((e) => sched.appendChild(el('div', 'm-evt',
        `<i style="background:${escapeHtml(e.color || '#5a8c6e')}"></i>${escapeHtml(e.time)} ${escapeHtml(e.title)}`)));
    });
    // fetch events once, then re-render with them in place
    if (calOn() && page.date && !calCache[page.date]) {
      LJCal.events(page.date).then((r) => {
        if (r && r.events && currentPage() === page) { calCache[page.date] = r.events; renderMobileDay(); }
      });
    }
    if (!any) sched.appendChild(el('p', 'm-empty', 'Nothing scheduled — tap “All hours” to plan the day.'));
    wrap.appendChild(sched);

    // scripture card
    const sc = el('div', 'm-card m-scripture');
    sc.appendChild(el('div', 'm-label m-label-green', 'Scripture'));
    const refInp = mobField('scr0', 'm-serif', 'Tap to pick a passage…');
    sc.appendChild(refInp);
    // book → chapter → verse dropdown (in-flow, scrolls inside the card)
    const dd = el('div', 'm-suggest hidden');
    const updateDD = () => {
      const items = window.LJBible ? LJBible.suggest(refInp.value) : [];
      dd.innerHTML = '';
      if (!items.length || (items.length === 1 && items[0].value === refInp.value)) { dd.classList.add('hidden'); return; }
      items.slice(0, 180).forEach((it) => {
        const d = el('div', 'm-suggest-item', it.label);
        d.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          refInp.value = it.value;
          state.fields.scr0 = it.value;
          recordChange('field:scr0');
          saveCurrentDebounced();
          if (it.done) { dd.classList.add('hidden'); refInp.blur(); } else updateDD();
        });
        dd.appendChild(d);
      });
      dd.classList.remove('hidden');
    };
    refInp.addEventListener('focus', updateDD);
    refInp.addEventListener('input', updateDD);
    refInp.addEventListener('blur', () => setTimeout(() => dd.classList.add('hidden'), 200));
    sc.appendChild(dd);
    const studyBtn = el('button', 'm-study', '✦ Create Bible Study');
    studyBtn.onclick = () => openStudy(state.fields.scr0 || '');
    sc.appendChild(studyBtn);
    sc.appendChild(mobField('scr1', 'm-serif', 'What did I read?'));
    sc.appendChild(el('div', 'm-label m-label-green', 'Observe & apply'));
    sc.appendChild(mobField('obs0', '', 'What did I learn?'));
    sc.appendChild(mobField('obs1', ''));
    sc.appendChild(el('div', 'm-label m-label-green', 'The gospel'));
    sc.appendChild(mobField('gos0', '', 'How does this point to Christ?'));
    wrap.appendChild(sc);

    // journal card — one flowing textarea backed by the jrn line fields
    const jr = el('div', 'm-card');
    jr.appendChild(el('div', 'm-label', 'Journal / notes / prayer'));
    const ta = document.createElement('textarea');
    ta.className = 'm-textarea m-serif';
    ta.rows = 6;
    ta.placeholder = 'Write freely…';
    const jrnLines = [];
    for (let i = 0; i < 12; i++) jrnLines.push(state.fields['jrn' + i] || '');
    ta.value = jrnLines.join('\n').replace(/\n+$/, '');
    ta.addEventListener('input', () => {
      const lines = ta.value.split('\n');
      for (let i = 0; i < 12; i++) state.fields['jrn' + i] = lines[i] || '';
      recordChange('field:jrn');
      saveCurrentDebounced();
    });
    jr.appendChild(ta);
    wrap.appendChild(jr);
  }

  // ---------- Search (typed entries + text boxes in this journal) ----------
  function openSearch() {
    $('#searchModal').classList.remove('hidden');
    $('#searchInput').value = '';
    $('#searchResults').innerHTML = '';
    $('#searchInput').focus();
  }
  function runSearch(qRaw) {
    const res = $('#searchResults');
    res.innerHTML = '';
    const q = qRaw.trim().toLowerCase();
    if (q.length < 2 || !state.journal) return;
    flushSave();
    const hits = [];
    state.journal.pages.forEach((p, i) => {
      const d = LJStore.loadPageData(p.id);
      const chunks = [];
      Object.values(d.fields || {}).forEach((v) => { if (v) chunks.push(String(v)); });
      (d.texts || []).forEach((t) => { if (t.text) chunks.push(t.text); });
      for (const c of chunks) {
        const pos = c.toLowerCase().indexOf(q);
        if (pos >= 0) {
          hits.push({ i, label: pageLabel(p, i), snip: c.slice(Math.max(0, pos - 30), pos + 70) });
          break;
        }
      }
    });
    hits.slice(0, 40).forEach((h) => {
      const b = el('button', 'search-hit',
        `<div class="sh-label">${escapeHtml(h.label)}</div><div class="sh-snip">…${escapeHtml(h.snip)}…</div>`);
      b.onclick = () => { $('#searchModal').classList.add('hidden'); loadPage(h.i); };
      res.appendChild(b);
    });
    if (!hits.length) res.innerHTML = '<p class="sync-note">No matches in this journal.</p>';
  }

  // ---------- Calendar links ----------
  function renderLinkLayer() {
    const layer = $('#linkLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const page = currentPage();
    if (!page) return;
    const s = (state.canvas && state.canvas.scaleFactor) || 1;
    const add = (rect, onClick, title, cls) => {
      const b = el('div', 'lj-link' + (cls ? ' ' + cls : ''));
      b.style.left = (rect.x * s) + 'px';
      b.style.top = (rect.y * s) + 'px';
      b.style.width = (rect.w * s) + 'px';
      b.style.height = (rect.h * s) + 'px';
      if (title) b.title = title;
      b.addEventListener('click', onClick);
      layer.appendChild(b);
    };

    if (page.template === 'planCycle' && page.startISO) {
      add(LJPlanner.cycleGoalsRect(), goToGoals, '12-week goals');
      LJPlanner.cycleMonthChipRects(page.startISO).forEach((mr) =>
        add(mr, () => goToMonth(mr.month), LJPlanner.MONTHS[mr.month]));
      LJPlanner.cycleWeekRects(page.startISO).forEach((wr) =>
        add(wr, () => goToWeek(wr.weekStart), 'Week ' + (wr.week + 1)));
    } else if (page.template === 'planYear') {
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
        add({ x: r.x, y: r.y, w: r.w, h: r.h }, () => goToDate(ds), ds, 'lj-wd');
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
        renderFieldLayer();   // apply/remove strikethrough on the matching field
        renderSideChips();
      };
      layer.appendChild(b);
    });

    // Apple Calendar events on the daily schedule (via the iOS shell)
    renderCalEvents(page, layer, s);

    // "Draft with AI" on a Foundation Blueprint page
    if (page.template === 'foundationBlueprint') {
      const r = LJTemplates.foundationAIRect();
      const btn = el('button', 'lj-ai-plan');
      btn.title = 'Turn a one-line goal into a full 12-week plan';
      btn.style.left = (r.x * s) + 'px';
      btn.style.top = (r.y * s) + 'px';
      btn.style.width = (r.w * s) + 'px';
      btn.style.height = (r.h * s) + 'px';
      btn.onclick = () => openFoundationPlan(page.foundation);
      layer.appendChild(btn);
    }

    // "Create Bible Study" on the scripture card of daily pages
    if (page.template === 'planDay' || page.template === 'foundationsDaily') {
      const L = LJTemplates.dailyLayout();
      const btn = el('button', 'lj-study', '✦ Study');
      btn.title = 'Create a Bible study for this passage';
      btn.style.left = ((L.card.x + L.card.w - 96) * s) + 'px';
      btn.style.top = ((L.card.y + 12) * s) + 'px';
      btn.onclick = () => openStudy(state.fields.scr0 || '');
      layer.appendChild(btn);
    }

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
  function updateAppleAuthRow() {
    const row = $('#appleAuthRow');
    if (!row) return;
    if (!(window.LJAuth && LJAuth.available())) { row.classList.add('hidden'); return; }
    row.classList.remove('hidden');
    const signedIn = state.appleUser && state.appleUser.userId;
    $('#appleSignIn').classList.toggle('hidden', !!signedIn);
    $('#appleAuthNote').textContent = signedIn
      ? `Auto-sync is on${state.appleUser.name ? ' for ' + state.appleUser.name : ''} — your journal backs up and follows you across devices.`
      : 'Sign in once and your journal syncs automatically across your iPhone, iPad, and Mac.';
  }

  function openSync() {
    updateAppleAuthRow();
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

    // Desktop sidebar + overflow tools + search
    $('#navToday').onclick = jumpToToday;
    $('#navCalendar').onclick = () => {
      const p = currentPage();
      const m = p && p.month != null ? p.month
        : (p && p.date && window.LJPlanner ? LJPlanner.parseISO(p.date).m : new Date().getMonth());
      goToMonth(m);
    };
    $('#navJournals').onclick = backToLibrary;
    $('#navSearch').onclick = openSearch;
    $('#navGoals').onclick = goToGoals;
    $('#navStudies').onclick = () => openStudies();
    $('#studiesClose').onclick = () => $('#studiesModal').classList.add('hidden');
    $('#studiesSearch').addEventListener('input', () => renderStudiesList($('#studiesSearch').value));
    $('#paywallClose').onclick = () => $('#paywallModal').classList.add('hidden');

    // Apple Calendar toggle (iOS shell only)
    $('#calBtn').onclick = async () => {
      if (!(window.LJCal && LJCal.available())) { toast('Calendar sync works inside the iPhone / iPad app'); return; }
      const st = await LJCal.status();
      if (st && st.state === 'undetermined') {
        const r = await LJCal.request();
        if (r && r.granted) { LJKV.set('lifejournal.cal', 'on'); toast('Calendar connected ✓'); loadPage(state.pageIndex); }
        else toast('Calendar access declined');
      } else if (st && st.state === 'denied') {
        toast('Enable access in Settings → Privacy → Calendars');
      } else {
        const off = LJKV.get('lifejournal.cal') === 'off';
        LJKV.set('lifejournal.cal', off ? 'on' : 'off');
        Object.keys(calCache).forEach((k) => delete calCache[k]);
        toast(off ? 'Calendar shown on daily pages' : 'Calendar hidden');
        loadPage(state.pageIndex);
      }
    };

    // Sign in with Apple → automatic sync
    $('#appleSignIn').onclick = async () => {
      const r = await LJAuth.signin();
      if (r && r.userId) {
        state.appleUser = r;
        LJSync.setCode(appleCode(r.userId));
        scheduleAutoSync(0);
        updateAppleAuthRow();
        toast('Signed in — your journal now syncs automatically');
      } else if (r && r.error) {
        $('#syncStatus').textContent = r.error;
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.appleUser) scheduleAutoSync(0);
    });

    // Morning flow
    $('#mfNext').onclick = flowNext;
    $('#mfSkip').onclick = () => {
      flow.skippedSession = true;
      if (window.LJPlanner) LJKV.set('lifejournal.flow.' + LJPlanner.todayISO(), '1');
      $('#morningFlow').classList.add('hidden');
      // If the flow was entered by tapping the journal, continue into it.
      if (flow.fromJournal && flow.planner) openJournal(flow.planner.id, true);
      else $('#library').classList.remove('hidden');
    };
    $('#paywallRestore').onclick = async () => {
      $('#paywallStatus').textContent = 'Restoring…';
      const r = await LJIAP.restore();
      if (r && r.pro) { $('#paywallModal').classList.add('hidden'); toast('Pro restored ✦'); }
      else $('#paywallStatus').textContent = (r && r.error) || 'No previous purchase found for this Apple ID.';
    };
    $('#searchClose').onclick = () => $('#searchModal').classList.add('hidden');
    $('#searchInput').addEventListener('input', () => runSearch($('#searchInput').value));
    $('#moreBtn').onclick = () => {
      const open = !$('#moreMenu').classList.contains('hidden');
      $('#moreMenu').classList.toggle('hidden', open);
      $('#moreBtn').classList.toggle('toggled', !open);
    };
    $('#stage').addEventListener('pointerdown', () => {
      $('#moreMenu').classList.add('hidden');
      $('#moreBtn').classList.remove('toggled');
    });

    // Phone tabs + card-view toggle
    document.querySelectorAll('#mobileTabs button').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.mt;
        document.querySelectorAll('#mobileTabs button').forEach((x) => x.classList.toggle('active', x === b));
        if (k === 'today') { state.forceCanvas = false; jumpToToday(); }
        else if (k === 'calendar') {
          state.forceCanvas = false;
          const p = currentPage();
          const m = p && p.month != null ? p.month
            : (p && p.date && window.LJPlanner ? LJPlanner.parseISO(p.date).m : new Date().getMonth());
          goToMonth(m);
        }
        else if (k === 'journals') backToLibrary();
        else if (k === 'studies') openStudies();
        else if (k === 'search') openSearch();
      };
    });
    $('#dayViewBtn').onclick = () => { state.forceCanvas = false; renderMobileDay(); };
    window.addEventListener('resize', renderMobileDay);
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
    if ($('#njStart')) $('#njStart').oninput = updateNjRange;
    if ($('#cdRenew')) $('#cdRenew').onclick = () => {
      const j = state.doneJournal; saveCycleReflection(j);
      $('#cycleDone').classList.add('hidden'); startNextCycle(j);
    };
    if ($('#cdView')) $('#cdView').onclick = () => {
      const j = state.doneJournal; saveCycleReflection(j);
      $('#cycleDone').classList.add('hidden'); openJournal(j.id);
    };
    if ($('#planCancel')) $('#planCancel').onclick = () => $('#planModal').classList.add('hidden');
    if ($('#planGo')) $('#planGo').onclick = runFoundationPlan;
    if ($('#planGoal')) $('#planGoal').addEventListener('keydown', (e) => { if (e.key === 'Enter') runFoundationPlan(); });

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
    // Apple-signed-in devices pull the freshest copy before the UI builds.
    await Promise.race([autoSyncLaunch(), new Promise((r) => setTimeout(r, 3500))]);
    const savedTheme = LJKV.get('lifejournal.theme') || 'paper';
    state.theme = savedTheme;
    document.body.dataset.theme = savedTheme === 'ink' ? 'ink' : '';
    LJData.setPalette(savedTheme === 'ink' ? 'dark' : 'light');
    if (savedTheme === 'ink') state.color = INK_DEFAULT;
    init();
    maybeMorningFlow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();
