export const sessionSnippet = `
window.__safeInject('sessionPersist', () => {
  const KV_KEY = 'dmm.cookie.backup.v1';

  const DMM_HINTS = [
    { name: 'ckcy',  value: '1',       domain: '.dmm.com',      path: '/' },
    { name: 'cklg',  value: 'welcome', domain: '.dmm.com',      path: '/' },
    { name: 'ckcy',  value: '1',       domain: 'osapi.dmm.com', path: '/' },
  ];

  const onDmm = /(^|\\.)dmm\\.com$/.test(location.hostname) || /osapi\\.dmm\\.com$/.test(location.hostname);

  function setCookie(c, maxDays = 365) {
    try {
      const d = new Date(); d.setDate(d.getDate() + maxDays);
      document.cookie = \`\${c.name}=\${c.value};expires=\${d.toUTCString()};domain=\${c.domain};path=\${c.path};SameSite=Lax\`;
    } catch {}
  }

  async function kvGetRaw(key, def='') {
    try {
      if (window.hmos?.postAsync) {
        const r = await window.hmos.postAsync(JSON.stringify({ op: 'kv.get', key, def }));
        const j = JSON.parse(r || '{}');
        return typeof j.value === 'string' ? j.value : def;
      }
    } catch {}
    try { const v = localStorage.getItem(key); return v ?? def; } catch { return def; }
  }

  async function kvSetRaw(key, val) {
    try {
      if (window.hmos?.postAsync) {
        await window.hmos.postAsync(JSON.stringify({ op: 'kv.set', key, value: String(val) }));
        return;
      }
    } catch {}
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  function parseCookieDict() {
    const dict = {};
    (document.cookie || '').split(';').map(s => s.trim()).forEach(pair => {
      const i = pair.indexOf('=');
      if (i > 0) dict[pair.slice(0, i)] = pair.slice(i + 1);
    });
    return dict;
  }

  async function backupReadableCookies() {
    const dict = parseCookieDict();
    try { await kvSetRaw(KV_KEY, JSON.stringify(dict)); } catch {}
  }

  async function restoreReadableCookiesIfMissing() {
    const raw = document.cookie || '';
    const need = !( /ckcy=1/.test(raw) && /cklg=welcome/.test(raw) );
    if (!need) return;

    const bak = await kvGetRaw(KV_KEY, '');
    if (!bak) return;
    try {
      const dict = JSON.parse(bak);
      const targets = ['.dmm.com', 'osapi.dmm.com', location.hostname];
      for (const [name, value] of Object.entries(dict)) {
        for (const domain of targets) {
          setCookie({ name, value, domain, path: '/' });
        }
      }
    } catch {}
  }

  (async () => {
    if (onDmm) {
      // 1) 恢复兜底
      await restoreReadableCookiesIfMissing();
      // 2) 写入放行/地域提示类 cookie
      DMM_HINTS.forEach(setCookie);
      // 3) 页面退出时备份
      window.addEventListener('pagehide', backupReadableCookies);
      window.addEventListener('beforeunload', backupReadableCookies);
    }
  })();
});
`;