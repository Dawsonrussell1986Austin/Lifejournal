// Durable key/value storage backed by IndexedDB (large quota), with a
// synchronous in-memory cache so the rest of the app can stay synchronous.
//
// Why: the app used localStorage, which Safari caps near ~5 MB and which fails
// SILENTLY when full — losing handwriting/photos with no warning. IndexedDB has
// a far larger quota, and write failures here are surfaced via setOnError().
//
// On first run we import any existing `lifejournal*` localStorage keys so
// nobody loses data already saved in the old store.
window.LJKV = (function () {
  const DB = 'lifejournal', STORE = 'kv', VERSION = 1;
  const mem = new Map();
  let db = null;
  let onError = null;

  function open() {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB, VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function store(mode) { return db.transaction(STORE, mode).objectStore(STORE); }

  async function init() {
    try { db = await open(); } catch (e) { db = null; }

    if (db) {
      await new Promise((resolve) => {
        let req;
        try { req = store('readonly').openCursor(); } catch (e) { resolve(); return; }
        req.onsuccess = () => {
          const c = req.result;
          if (c) { mem.set(c.key, c.value); c.continue(); } else resolve();
        };
        req.onerror = () => resolve();
      });
    }

    // First run (or IDB unavailable): seed the cache from legacy localStorage.
    if (mem.size === 0) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('lifejournal') === 0) {
            const v = localStorage.getItem(k);
            mem.set(k, v);
            putIDB(k, v);
          }
        }
      } catch (e) { /* localStorage blocked — start empty */ }
    }
  }

  function putIDB(k, v) {
    if (!db) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const r = store('readwrite').put(v, k);
        r.onsuccess = () => resolve(true);
        r.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  function get(k) { return mem.has(k) ? mem.get(k) : null; }

  // Returns true if it was cached. Durability (IDB) happens async; if both IDB
  // and the localStorage fallback fail, onError is fired so the UI can react.
  function set(k, v) {
    mem.set(k, v);
    putIDB(k, v).then((ok) => {
      if (ok) return;
      try { localStorage.setItem(k, v); }
      catch (e) { if (onError) onError('Could not save — device storage is full.'); }
    });
    return true;
  }

  function remove(k) {
    mem.delete(k);
    if (db) { try { store('readwrite').delete(k); } catch (e) {} }
    try { localStorage.removeItem(k); } catch (e) {}
  }

  function keys() { return Array.from(mem.keys()); }

  // Rough size of everything stored (bytes), for the sync UI.
  function totalBytes() {
    let n = 0;
    mem.forEach((v, k) => { n += (k.length + (v ? v.length : 0)); });
    return n;
  }

  return { init, get, set, remove, keys, totalBytes, setOnError: (f) => { onError = f; } };
})();
