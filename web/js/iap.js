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

  // Unlocked when: not in the shell, shell not configured yet, or entitled.
  async function isPro() {
    if (!available()) return true;
    const s = await call('status');
    if (!s || s.configured === false) return true;
    return !!s.pro;
  }

  return {
    available, isPro, _resolve,
    status: () => call('status'),
    offerings: () => call('offerings'),
    purchase: (pkg) => call('purchase', { pkg }),
    restore: () => call('restore')
  };
})();
