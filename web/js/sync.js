// Cloud sync client. Bundles the whole library + every page's handwriting,
// text and photos into one payload, stored/read under a sync code via /api/sync.
window.LJSync = (function () {
  const CODE_KEY = 'lifejournal.synccode';
  const LAST_KEY = 'lifejournal.lastsync';
  const API = '/api/sync';
  // The serverless body limit is ~4.5 MB; stop short of it with a clear error.
  const MAX_BYTES = 4_300_000;

  function isSyncableKey(k) {
    return k && (k.indexOf('lifejournal.page.') === 0 ||
                 k.indexOf('lifejournal.photo.') === 0 ||
                 k === 'lifejournal.studies');
  }

  function getCode() { return LJKV.get(CODE_KEY) || ''; }
  function setCode(c) { if (c) LJKV.set(CODE_KEY, c); else LJKV.remove(CODE_KEY); }

  function getLastSync() {
    try { return JSON.parse(LJKV.get(LAST_KEY) || 'null'); } catch (e) { return null; }
  }
  function setLastSync(kind) { LJKV.set(LAST_KEY, JSON.stringify({ kind: kind, when: Date.now() })); }

  function collectPayload() {
    const library = LJStore.loadLibrary();
    const pages = {};
    LJKV.keys().forEach((k) => { if (isSyncableKey(k)) pages[k] = LJKV.get(k); });
    return { v: 1, savedAt: Date.now(), library: library, pages: pages };
  }

  function applyPayload(p) {
    if (!p || !p.library) return false;
    LJKV.keys().forEach((k) => { if (isSyncableKey(k)) LJKV.remove(k); });
    Object.keys(p.pages || {}).forEach((k) => LJKV.set(k, p.pages[k]));
    LJStore.saveLibrary(p.library);
    return true;
  }

  async function upload(code) {
    const payload = collectPayload();
    const body = JSON.stringify(payload);
    if (body.length > MAX_BYTES) {
      throw new Error(`This journal is ${(body.length / 1048576).toFixed(1)} MB — too large to sync in one piece (limit ~4 MB). Tip: keep big photos to a few, or export to PDF instead.`);
    }
    const r = await fetch(API + '?code=' + encodeURIComponent(code), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
    const meta = await r.json();
    meta.size = body.length;
    setLastSync('upload');
    return meta;
  }

  async function download(code) {
    const r = await fetch(API + '?code=' + encodeURIComponent(code));
    if (r.status === 204) return { empty: true };
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
    const p = await r.json();
    applyPayload(p);
    setLastSync('download');
    return { empty: false, savedAt: p.savedAt };
  }

  // Fetch the cloud payload without applying it (for launch-time comparison).
  async function fetchRaw(code) {
    const r = await fetch(API + '?code=' + encodeURIComponent(code));
    if (r.status === 204) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  return { getCode, setCode, getLastSync, upload, download, fetchRaw, applyPayload, setLastSync };
})();
