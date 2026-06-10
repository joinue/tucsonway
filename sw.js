/* Tucson Compass service worker
   Goal: site (HTML/CSS/JS/data) usable on weak or no signal.
   Strategy:
   - Pre-cache the app shell + data + Leaflet on install
   - Network-first for JSON + HTML (so updates land), cache fallback offline
   - Cache-first for CSS/JS/icons
   - Stale-while-revalidate for OSM map tiles
*/
const VERSION = 'v19';
const SHELL = 'tw-shell-' + VERSION;
const RUNTIME = 'tw-runtime-' + VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './directory.html',
  './map.html',
  './match.html',
  './about.html',
  './css/styles.css',
  './js/app.js',
  './js/icons.js',
  './js/directory.js',
  './js/map.js',
  './js/match.js',
  './data/resources.json',
  './data/i18n.json',
  './manifest.webmanifest',
  './icons/logo-icon.png',
  './favicon/favicon.ico',
  './favicon/favicon.svg',
  './favicon/apple-touch-icon.png',
  './favicon/favicon-96x96.png',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isHtmlOrJson(req) {
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html') || req.url.endsWith('.json') || req.url.endsWith('.webmanifest');
}
function isOsmTile(url) {
  return /tile\.openstreetmap\.org/.test(url);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;

  // OSM tiles: stale-while-revalidate (Leaflet is now in the shell)
  if (isOsmTile(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // HTML and JSON: network-first, fall back to cache
  if (isHtmlOrJson(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Default: cache-first for hashed/static assets in shell
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = (await cache.match(req)) || (await caches.match(req));
    if (cached) return cached;
    // last-ditch: serve the index for navigations
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(req, fresh.clone());
  }
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || networkPromise || fetch(req);
}
