/* Tucson Way — shared boot, i18n, language toggle, offline banner, SW registration.
   No external dependencies. No analytics. Stays small on purpose. */
(function () {
  'use strict';

  const STORAGE_LANG = 'tw.lang';
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
    const res = await fetch('data/resources.json', { cache: 'force-cache' });
    return res.json();
  };

  // ---------- boot ----------
  loadI18n().then(() => {
    applyTranslations();
    document.dispatchEvent(new CustomEvent('tw:i18nready'));
  });

  wireLangToggle();
  wireOfflineBanner();
  registerSW();
})();
