// Persistence in localStorage.
//   lifejournal.library.v1     -> { journals: [ {id,title,cover,pages:[{id,template}]} ] }
//   lifejournal.page.<pageId>  -> [ stroke, ... ]
window.LJStore = (function () {
  const LIB_KEY = 'lifejournal.library.v1';
  const pageKey = (id) => 'lifejournal.page.' + id;

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    const lib = { journals: [sampleJournal()] };
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

  function loadStrokes(pageId) {
    try {
      const raw = localStorage.getItem(pageKey(pageId));
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function saveStrokes(pageId, strokes) {
    try { localStorage.setItem(pageKey(pageId), JSON.stringify(strokes)); } catch (e) {}
  }

  function deleteStrokes(pageId) {
    try { localStorage.removeItem(pageKey(pageId)); } catch (e) {}
  }

  return { loadLibrary, saveLibrary, sampleJournal, loadStrokes, saveStrokes, deleteStrokes };
})();
