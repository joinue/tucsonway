/* Tucson Compass — shared boot, i18n, language toggle, offline banner, SW registration.
   No external dependencies. No analytics. Stays small on purpose. */
(function () {
  'use strict';

  const STORAGE_LANG = 'tw.lang';
  const STORAGE_THEME = 'tw.theme';
  const DEFAULT_LANG = 'en';

  // expose a tiny namespace for the page-specific scripts
  const TW = (window.TW = window.TW || {});

  // ---------- language ----------
  function detectLang() {
    const stored = localStorage.getItem(STORAGE_LANG);
    if (stored === 'en' || stored === 'es') return stored;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return nav === 'es' ? 'es' : DEFAULT_LANG;
  }

  let currentLang = detectLang();
  let i18nData = null;

  async function loadI18n() {
    if (i18nData) return i18nData;
    const res = await fetch('data/i18n.json', { cache: 'force-cache' });
    i18nData = await res.json();
    return i18nData;
  }

  function t(key) {
    if (!i18nData) return key;
    const dict = i18nData[currentLang] || i18nData[DEFAULT_LANG];
    return (dict && dict[key]) || key;
  }
  TW.t = t;
  TW.lang = () => currentLang;

  function applyTranslations(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (value && value !== key) el.textContent = value;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      el.setAttribute('aria-label', t(key));
    });
    document.documentElement.setAttribute('lang', currentLang);
  }
  TW.applyTranslations = applyTranslations;

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('tw:langchange', { detail: { lang } }));
  }
  TW.setLang = setLang;

  function wireLangToggle() {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      setLang(currentLang === 'en' ? 'es' : 'en');
    });
  }

  // ---------- theme (light / dark) ----------
  // Stored values: 'light' | 'dark' | null (follow OS).
  // An inline <head> script applies the stored theme before paint to avoid flash.
  function getStoredTheme() {
    const v = localStorage.getItem(STORAGE_THEME);
    return v === 'light' || v === 'dark' ? v : null;
  }
  function getEffectiveTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  function syncThemeColorMeta() {
    // Keep browser chrome (Android URL bar etc.) in step with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getEffectiveTheme() === 'dark' ? '#11151e' : '#c4452a');
  }
  function updateThemeButton() {
    syncThemeColorMeta();
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const effective = getEffectiveTheme();
    // Show the icon of the theme the user would switch TO.
    const next = effective === 'dark' ? 'light' : 'dark';
    const iconName = next === 'dark' ? 'moon' : 'sun';
    btn.innerHTML = (TW.icon && TW.icon(iconName)) || '';
    const label = next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode';
    btn.setAttribute('aria-label', t(`theme_switch_to_${next}`) !== `theme_switch_to_${next}` ? t(`theme_switch_to_${next}`) : label);
    btn.setAttribute('title', btn.getAttribute('aria-label'));
  }
  TW.updateThemeButton = updateThemeButton;

  function setTheme(theme) {
    localStorage.setItem(STORAGE_THEME, theme);
    applyTheme(theme);
    updateThemeButton();
  }
  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = getEffectiveTheme();
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
    updateThemeButton();
    // If the user hasn't chosen, follow OS changes live.
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onMQ = () => { if (!getStoredTheme()) updateThemeButton(); };
    if (mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq.addListener) mq.addListener(onMQ);
  }

  // ---------- install nudge ----------
  // Captures Android/desktop Chrome's beforeinstallprompt and shows a dismissible
  // bar. Stays hidden if already in standalone mode or recently dismissed.
  const INSTALL_DISMISS_KEY = 'tw.install.dismissed';
  const INSTALL_DISMISS_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
  let deferredInstallPrompt = null;

  function recentlyDismissed() {
    const v = parseInt(localStorage.getItem(INSTALL_DISMISS_KEY) || '0', 10);
    return v && (Date.now() - v) < INSTALL_DISMISS_TTL;
  }

  function isStandalone() {
    return matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari
  }

  function buildInstallNudge() {
    if (document.getElementById('install-nudge')) return;
    const div = document.createElement('div');
    div.id = 'install-nudge';
    div.className = 'install-nudge';
    div.hidden = true;
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', 'Install app');
    div.innerHTML =
      '<div class="install-nudge__body">' +
        '<span class="install-nudge__text" data-i18n="install_prompt">' + t('install_prompt') + '</span>' +
      '</div>' +
      '<div class="install-nudge__actions">' +
        '<button type="button" id="install-nudge-install" class="install-nudge__btn install-nudge__btn--primary" data-i18n="install_action">' + t('install_action') + '</button>' +
        '<button type="button" id="install-nudge-dismiss" class="install-nudge__btn" data-i18n="install_dismiss">' + t('install_dismiss') + '</button>' +
      '</div>';
    document.body.appendChild(div);
    document.getElementById('install-nudge-install').addEventListener('click', async () => {
      if (!deferredInstallPrompt) { hideInstallNudge(); return; }
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (_) { /* ignore */ }
      deferredInstallPrompt = null;
      hideInstallNudge();
    });
    document.getElementById('install-nudge-dismiss').addEventListener('click', () => {
      try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch (_) {}
      hideInstallNudge();
    });
  }

  function showInstallNudge() {
    if (isStandalone() || recentlyDismissed()) return;
    buildInstallNudge();
    const el = document.getElementById('install-nudge');
    if (el) el.hidden = false;
  }

  function hideInstallNudge() {
    const el = document.getElementById('install-nudge');
    if (el) el.hidden = true;
  }

  function wireInstallNudge() {
    // Limit the install nudge to the About page so it doesn't interrupt
    // users seeking help on Home/Directory/Map/Match. (The PWA stays
    // installable everywhere via the browser's own menu.)
    if (document.body.dataset.page !== 'about') return;
    if (isStandalone() || recentlyDismissed()) return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallNudge();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      hideInstallNudge();
    });
  }

  // ---------- offline banner ----------
  function wireOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const sync = () => {
      banner.hidden = navigator.onLine;
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
  }

  // ---------- service worker ----------
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // localhost or https only
    const ok = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!ok) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* silent */ });
    });
  }

  // ---------- helpers used by other scripts ----------
  TW.formatPhone = function (tel) {
    // best-effort US format: (NNN) NNN-NNNN, or 1-NNN-NNN-NNNN
    const d = String(tel).replace(/\D/g, '');
    if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length === 11 && d.startsWith('1')) return '1-' + d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7);
    if (d.length === 3) return d;
    return tel;
  };

  TW.directionsUrl = function (address) {
    // device-default maps via geo: with q= fallback to google maps
    const q = encodeURIComponent(address);
    return 'https://www.google.com/maps/dir/?api=1&destination=' + q;
  };

  TW.haversine = function (a, b) {
    if (!a || !b) return Infinity;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  TW.fieldByLang = function (obj, base) {
    // e.g., fieldByLang(item, 'eligibility_notes') -> _es when lang=es
    if (!obj) return '';
    if (currentLang === 'es' && obj[base + '_es']) return obj[base + '_es'];
    return obj[base] || '';
  };

  TW.loadResources = async function () {
    /* no-cache: browser sends a conditional GET so resources.json changes
       propagate on next page load. (force-cache previously pinned a stale
       copy that ignored edits.) The service worker still serves a cached
       copy when offline via networkFirst. */
    const res = await fetch('data/resources.json', { cache: 'no-cache' });
    return res.json();
  };

  // ---------- boot ----------
  loadI18n().then(() => {
    applyTranslations();
    updateThemeButton();
    document.dispatchEvent(new CustomEvent('tw:i18nready'));
  });
  document.addEventListener('tw:langchange', updateThemeButton);

  wireLangToggle();
  wireThemeToggle();
  wireOfflineBanner();
  wireInstallNudge();
  registerSW();
})();
