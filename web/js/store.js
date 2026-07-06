// Journal/library/photo persistence. Backed by LJKV (IndexedDB + in-memory
// cache), so reads stay synchronous and writes are durable.
//   lifejournal.library.v1        -> { journals: [...] }
//   lifejournal.page.<pageId>     -> { strokes, texts }
//   lifejournal.photo.<jid>.<m>   -> data URL
window.LJStore = (function () {
  const LIB_KEY = 'lifejournal.library.v1';
  const CYCLE_FLAG = 'lifejournal.cycle.created';
  const pageKey = (id) => 'lifejournal.page.' + id;
  const photoKey = (journalId, month) => 'lifejournal.photo.' + journalId + '.' + month;

  function loadLibrary() {
    let lib = null;
    try {
      const raw = LJKV.get(LIB_KEY);
      if (raw) lib = JSON.parse(raw);
    } catch (e) { /* corrupt — rebuild below */ }
    if (!lib) lib = { journals: [sampleJournal()] };

    // Seed a starter 12-week journal (starting today) once, unless the user
    // already has a planner journal or previously deleted the seed.
    const hasPlanner = lib.journals.some((j) => j.kind === 'planner');
    if (!hasPlanner && !LJKV.get(CYCLE_FLAG) && window.LJPlanner) {
      lib.journals.unshift(LJPlanner.generateCycle(LJPlanner.todayISO(), { title: 'My 12-Week Journal', cover: 'terracotta' }));
      LJKV.set(CYCLE_FLAG, '1');
    }
    // Bring older planners up to date (e.g. add week pages) without data loss.
    if (window.LJPlanner) lib.journals.forEach((j) => LJPlanner.migrate(j));

    saveLibrary(lib);
    return lib;
  }

  function saveLibrary(lib) {
    try { LJKV.set(LIB_KEY, JSON.stringify(lib)); } catch (e) {}
  }

  function sampleJournal() {
    return {
      id: LJData.uid(),
      title: 'My Life Journal',
      cover: 'sage',
      pages: [
        { id: LJData.uid(), template: 'cover' },
        { id: LJData.uid(), template: 'soap' },
        { id: LJData.uid(), template: 'sermonNotes' },
        { id: LJData.uid(), template: 'prayerList' },
        { id: LJData.uid(), template: 'dailyPlanner' }
      ]
    };
  }

  function loadPageData(pageId) {
    try {
      const raw = LJKV.get(pageKey(pageId));
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) return { strokes: v, texts: [], checks: {}, fields: {} };
        return { strokes: v.strokes || [], texts: v.texts || [], checks: v.checks || {}, fields: v.fields || {} };
      }
    } catch (e) {}
    return { strokes: [], texts: [], checks: {}, fields: {} };
  }

  function savePageData(pageId, data) {
    LJKV.set(pageKey(pageId), JSON.stringify({
      strokes: data.strokes || [], texts: data.texts || [], checks: data.checks || {}, fields: data.fields || {}
    }));
  }

  function deletePage(pageId) { LJKV.remove(pageKey(pageId)); }

  // Per-month photos for the calendar photobook.
  function getPhoto(journalId, month) { return LJKV.get(photoKey(journalId, month)); }
  function setPhoto(journalId, month, dataURL) { return LJKV.set(photoKey(journalId, month), dataURL); }
  function removePhoto(journalId, month) { LJKV.remove(photoKey(journalId, month)); }

  return { loadLibrary, saveLibrary, sampleJournal, loadPageData, savePageData, deletePage,
           getPhoto, setPhoto, removePhoto };
})();
