// Bridges to native iOS capabilities in the shell app: Apple Calendar
// (EventKit, read-only) and Sign in with Apple. In a plain browser both
// report unavailable and the app behaves as before.
(function () {
  function makeBridge(handler) {
    const pending = {};
    function available() {
      return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[handler]);
    }
    function call(action, extra) {
      return new Promise((resolve) => {
        if (!available()) { resolve(null); return; }
        const id = Math.random().toString(36).slice(2);
        pending[id] = resolve;
        window.webkit.messageHandlers[handler].postMessage(Object.assign({ id, action }, extra || {}));
        setTimeout(() => { if (pending[id]) { pending[id](null); delete pending[id]; } }, 30000);
      });
    }
    function _resolve(id, payload) {
      const r = pending[id];
      if (r) { delete pending[id]; r(payload); }
    }
    return { available, call, _resolve };
  }

  const cal = makeBridge('ljcal');
  window.LJCal = {
    available: cal.available,
    _resolve: cal._resolve,
    status: () => cal.call('status'),
    request: () => cal.call('request'),
    events: (date) => cal.call('events', { date })
  };

  const auth = makeBridge('ljauth');
  window.LJAuth = {
    available: auth.available,
    _resolve: auth._resolve,
    status: () => auth.call('status'),
    signin: () => auth.call('signin'),
    signout: () => auth.call('signout')
  };
})();
