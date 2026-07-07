// Life Journal service worker — makes the app shell work offline so the
// on-device journal (IndexedDB) is reachable without a network. Strategy:
//   • /api/*  and non-GET      → network only (never cached)
//   • navigations (the HTML)   → network-first, fall back to cached shell
//   • same-origin static assets→ cache-first, populated at runtime
//
// Versioned per release so a new deploy replaces the old cache on activate.
const CACHE = 'lifejournal-v49';
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs; let the network handle everything else
  // (API calls, cloud sync, cross-origin photos) untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: prefer fresh HTML when online, fall back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || caches.match(req)))
    );
    return;
  }

  // Static assets (versioned js/css/vendor, images): cache-first, then network.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
