// Cloud sync client. Bundles the whole library + every page's handwriting into
// one payload and stores/reads it under a user-chosen sync code via /api/sync.
window.LJSync = (function () {
  const CODE_KEY = 'lifejournal.synccode';
  const API = '/api/sync';

  function getCode() { return localStorage.getItem(CODE_KEY) || ''; }
  function setCode(c) { if (c) localStorage.setItem(CODE_KEY, c); else localStorage.removeItem(CODE_KEY); }

  function collectPayload() {
    const library = LJStore.loadLibrary();
    const pages = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('lifejournal.page.') === 0) pages[k] = localStorage.getItem(k);
    }
    return { v: 1, savedAt: Date.now(), library: library, pages: pages };
  }

  function applyPayload(p) {
    if (!p || !p.library) return false;
    // Replace local page data with the cloud copy.
    const remove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('lifejournal.page.') === 0) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
    Object.keys(p.pages || {}).forEach((k) => localStorage.setItem(k, p.pages[k]));
    LJStore.saveLibrary(p.library);
    return true;
  }

  async function upload(code) {
    const payload = collectPayload();
    const r = await fetch(API + '?code=' + encodeURIComponent(code), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
    const meta = await r.json();
    // rough payload size for the UI
    meta.size = JSON.stringify(payload).length;
    return meta;
  }

  async function download(code) {
    const r = await fetch(API + '?code=' + encodeURIComponent(code));
    if (r.status === 204) return { empty: true };
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
    const p = await r.json();
    applyPayload(p);
    return { empty: false, savedAt: p.savedAt };
  }

  return { getCode, setCode, upload, download };
})();
