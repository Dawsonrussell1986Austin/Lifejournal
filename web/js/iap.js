// Bridge to RevenueCat in the iOS shell. In a plain browser (or before
// RevenueCat is configured in the shell) everything stays unlocked, so the
// web app keeps working during development and beta.
window.LJIAP = (function () {
  const pending = {};

  function available() {
    return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ljiap);
  }

  function call(action, extra) {
    return new Promise((resolve) => {
      if (!available()) { resolve(null); return; }
      const id = Math.random().toString(36).slice(2);
      pending[id] = resolve;
      window.webkit.messageHandlers.ljiap.postMessage(Object.assign({ id, action }, extra || {}));
      // Never hang the UI on a lost message.
      setTimeout(() => { if (pending[id]) { pending[id](null); delete pending[id]; } }, 20000);
    });
  }

  function _resolve(id, payload) {
    const r = pending[id];
    if (r) { delete pending[id]; r(payload); }
  }

  // Remember the last entitlement the shell actually confirmed, so a dropped
  // or timed-out status message doesn't silently unlock Pro (revenue leak) —
  // we fall back to what we last knew for sure instead.
  const CACHE_KEY = 'lifejournal.pro.cache';
  function cachedPro() { try { return localStorage.getItem(CACHE_KEY) === '1'; } catch (e) { return false; } }
  function setCachedPro(v) { try { localStorage.setItem(CACHE_KEY, v ? '1' : '0'); } catch (e) {} }

  // Unlocked when: not in the shell, or the shell isn't configured yet (dev/
  // beta). Inside a configured shell, entitlement comes from StoreKit; if that
  // status can't be reached we fall back to the last confirmed state.
  async function isPro() {
    if (!available()) return true;
    const s = await call('status');
    if (!s) return cachedPro();            // lost/timed-out message → last known-good
    if (s.configured === false) return true;
    const pro = !!s.pro;
    setCachedPro(pro);                      // confirmed by StoreKit — remember it
    return pro;
  }

  return {
    available, isPro, _resolve,
    status: () => call('status'),
    offerings: () => call('offerings'),
    purchase: (pkg) => call('purchase', { pkg }),
    restore: () => call('restore')
  };
})();
