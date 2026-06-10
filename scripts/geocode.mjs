#!/usr/bin/env node
/* Geocode resources.json entries that have an address but no lat/lng.
   Uses OpenStreetMap Nominatim. Rate-limited to 1 req/sec per Nominatim ToS.
   Run: node scripts/geocode.mjs
*/
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '..', 'data', 'resources.json');
const UA = 'TucsonCompassGeocoder/1.0 (marc@joinue.com)';
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeOnce(addr) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arr = await res.json();
  if (!arr.length) return null;
  return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
}

function cleanAddress(a) {
  // Drop suite/apt numbers that confuse Nominatim
  return a
    .replace(/,?\s*(Ste\.?|Suite|Bldg\.?|Building|Unit|Apt\.?)\s*#?\s*[\w-]+/gi, '')
    .replace(/,?\s*#\s*[\w-]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
}

async function geocode(addr) {
  let got = await geocodeOnce(addr);
  if (got) return got;
  const cleaned = cleanAddress(addr);
  if (cleaned !== addr) {
    await sleep(1100);
    got = await geocodeOnce(cleaned);
  }
  return got;
}

async function main() {
  const raw = await readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  const list = data.resources || [];

  const targets = list.filter((r) => r.address && (r.lat == null || r.lng == null));
  console.log(`Found ${targets.length} entries with address and missing coords.`);

  let hits = 0, misses = 0;
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${r.id}  …  `);
    try {
      const got = await geocode(r.address);
      if (got) {
        r.lat = +got.lat.toFixed(6);
        r.lng = +got.lng.toFixed(6);
        hits++;
        console.log(`${r.lat}, ${r.lng}`);
      } else {
        misses++;
        console.log('no match');
      }
    } catch (e) {
      misses++;
      console.log('error:', e.message);
    }
    // Nominatim usage policy: max 1 req/sec
    if (i < targets.length - 1) await sleep(1100);
  }

  await writeFile(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nDone. hits=${hits} misses=${misses}. Written to ${DATA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
