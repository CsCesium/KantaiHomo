export const GUARDS = `
(function(){
  // Global injection tag
  if (!window.__injectFlags) {
    Object.defineProperty(window, '__injectFlags', {
      value: Object.create(null), configurable: false, enumerable: false, writable: false
    });
  }
  window.__safeInject = function(name, fn){
    try {
      if (window.__injectFlags[name]) return;     // injected
      window.__injectFlags[name] = 1;
      try { fn(); } catch(e) { console.warn('[inject]', name, 'failed:', e); }
    } catch(e){ /* ignore */ }
  };
})();
`;