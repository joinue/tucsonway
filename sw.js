/* Tucson Compass service worker
   Goal: site (HTML/CSS/JS/data) usable on weak or no signal.
   Strategy:
   - Pre-cache the app shell + data + Leaflet on install
   - Pre-cache OSM tiles for the Tucson metro (best-effort, never fails install)
   - Network-first for JSON + HTML (so updates land), cache fallback offline
   - Cache-first for CSS/JS/icons
   - Cache-first for OSM map tiles, network fallback cached opportunistically
*/
const VERSION = 'v29';
const SHELL = 'tw-shell-' + VERSION;
const RUNTIME = 'tw-runtime-' + VERSION;
const TILES = 'tw-tiles-' + VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './directory.html',
  './map.html',
  './match.html',
  './about.html',
  './resources.html',
  './css/styles.css',
  './js/app.js',
  './js/icons.js',
  './js/directory.js',
  './js/map.js',
  './js/match.js',
  './js/resources.js',
  './data/resources.json',
  './data/i18n.json',
  './data/links.json',
  './manifest.webmanifest',
  './icons/logo-icon.png',
  './icons/logo-icon-circle.png',
  './icons/logo-horizontal.png',
  './favicon/favicon.ico',
  './favicon/favicon.svg',
  './favicon/apple-touch-icon.png',
  './favicon/favicon-96x96.png',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
];

/* Tile pre-cache: the whole metro bbox at z11-z13, plus a tighter core bbox
   (every mapped service + margin) at z14 — the map's fitBounds caps at z14
   over the marker extent, so that's where z14 detail is actually seen.
   This works out to 297 tiles (~6 MB); TILE_BUDGET is a hard safety cap. */
const TILE_AREAS = [
  { zooms: [11, 12, 13], bbox: { n: 32.42, s: 32.03, w: -111.10, e: -110.75 } },
  { zooms: [14], bbox: { n: 32.36, s: 32.15, w: -111.09, e: -110.81 } },
];
const TILE_BUDGET = 400;
const TILE_BATCH = 6; // polite concurrency against tile.openstreetmap.org
const TILE_URL = 'https://tile.openstreetmap.org/';

/* Standard slippy-map (Web Mercator) lng/lat -> tile x/y */
function lngToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}
function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
  );
}

function tileUrls() {
  const urls = [];
  for (const area of TILE_AREAS) {
    for (const z of area.zooms) {
      const x0 = lngToTileX(area.bbox.w, z);
      const x1 = lngToTileX(area.bbox.e, z);
      const y0 = latToTileY(area.bbox.n, z); // y grows southward
      const y1 = latToTileY(area.bbox.s, z);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          urls.push(TILE_URL + z + '/' + x + '/' + y + '.png');
        }
      }
    }
  }
  return urls;
}

/* Best-effort tile warm-up. A failed tile is skipped — never rejects, so the
   shell install succeeds even if OSM is slow, rate-limiting, or unreachable.
   Per-fetch and overall deadlines keep a hung connection from stalling the
   install event past the browser's event time limit. */
const TILE_FETCH_TIMEOUT = 15000;
const TILE_WARMUP_DEADLINE = 210000;

async function precacheTiles() {
  const urls = tileUrls();
  if (urls.length > TILE_BUDGET) {
    console.warn('[sw] tile pre-cache skipped: ' + urls.length + ' tiles exceeds budget of ' + TILE_BUDGET);
    return;
  }
  const cache = await caches.open(TILES);
  const started = Date.now();
  let ok = 0;
  for (let i = 0; i < urls.length; i += TILE_BATCH) {
    if (Date.now() - started > TILE_WARMUP_DEADLINE) {
      console.warn('[sw] tile warm-up deadline hit after ' + ok + ' tiles; finishing install');
      break;
    }
    const batch = urls.slice(i, i + TILE_BATCH);
    await Promise.all(batch.map(async (url) => {
      try {
        const opts = 'timeout' in AbortSignal ? { signal: AbortSignal.timeout(TILE_FETCH_TIMEOUT) } : {};
        const res = await fetch(url, opts);
        if (res && res.ok) {
          await cache.put(url, res);
          ok++;
        }
      } catch (e) {
        // offline / timed out / rate-limited: skip this tile
      }
    }));
  }
  console.log('[sw] pre-cached ' + ok + '/' + urls.length + ' map tiles');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => precacheTiles().catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME && k !== TILES).map((k) => caches.delete(k))
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

  // OSM tiles: cache-first from the pre-warmed tiles cache
  if (isOsmTile(url)) {
    event.respondWith(tileCacheFirst(req));
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
    const cached = (await cache.match(req)) ||
      (await caches.match(req, { ignoreSearch: true }));
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
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    // offline: assets are requested as e.g. js/map.js?v=20 but pre-cached
    // without the cache-buster — fall back to the query-less shell entry
    const shellMatch = await caches.match(req, { ignoreSearch: true });
    if (shellMatch) return shellMatch;
    throw e;
  }
}

/* Tiles outside the pre-cached area come from the network and are cached
   opportunistically. Leaflet requests tiles via <img> (no-cors), which yields
   opaque responses we can't inspect — so re-fetch by URL (CORS, which OSM
   supports) to verify status before caching, with a passthrough last resort. */
async function tileCacheFirst(req) {
  const cache = await caches.open(TILES);
  const cached = await cache.match(req.url);
  if (cached) return cached;
  try {
    const fresh = await fetch(req.url);
    if (fresh && fresh.ok) cache.put(req.url, fresh.clone());
    return fresh;
  } catch (e) {
    return fetch(req);
  }
}
