// Persistence in localStorage.
//   lifejournal.library.v1     -> { journals: [ {id,title,cover,pages:[{id,template}]} ] }
//   lifejournal.page.<pageId>  -> [ stroke, ... ]
window.LJStore = (function () {
  const LIB_KEY = 'lifejournal.library.v1';
  const pageKey = (id) => 'lifejournal.page.' + id;

  const PLANNER_FLAG = 'lifejournal.planner2026.created';

  function loadLibrary() {
    let lib = null;
    try {
      const raw = localStorage.getItem(LIB_KEY);
      if (raw) lib = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    if (!lib) lib = { journals: [sampleJournal()] };

    // Seed the pre-made LifeJournal 2026 calendar once. The flag means we won't
    // recreate it if the user deletes it on purpose.
    const hasPlanner = lib.journals.some((j) => j.kind === 'planner' && j.year === 2026);
    if (!hasPlanner && !localStorage.getItem(PLANNER_FLAG) && window.LJPlanner) {
      lib.journals.unshift(LJPlanner.generate(2026));
      try { localStorage.setItem(PLANNER_FLAG, '1'); } catch (e) {}
    }
    // Bring older planners up to date (e.g. add week pages) without data loss.
    let changed = false;
    if (window.LJPlanner) lib.journals.forEach((j) => { if (LJPlanner.migrate(j)) changed = true; });
    saveLibrary(lib);
    return lib;
  }

  function saveLibrary(lib) {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (e) {}
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

  // A page's content is { strokes: [...], texts: [...] }.
  // Legacy pages were stored as a bare strokes array — handle that too.
  function loadPageData(pageId) {
    try {
      const raw = localStorage.getItem(pageKey(pageId));
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) return { strokes: v, texts: [] };
        return { strokes: v.strokes || [], texts: v.texts || [] };
      }
    } catch (e) {}
    return { strokes: [], texts: [] };
  }

  function savePageData(pageId, data) {
    try {
      localStorage.setItem(pageKey(pageId), JSON.stringify({
        strokes: data.strokes || [], texts: data.texts || []
      }));
    } catch (e) {}
  }

  function deletePage(pageId) {
    try { localStorage.removeItem(pageKey(pageId)); } catch (e) {}
  }

  return { loadLibrary, saveLibrary, sampleJournal, loadPageData, savePageData, deletePage };
})();
