// Builds public/stores.json: every ICA, Willys, Lidl, Coop, Hemköp and City Gross store in Sweden from
// OpenStreetMap (© OpenStreetMap contributors, ODbL). Run monthly by .github/workflows/stores.yml.
// Usage: node scripts/build-stores.mjs
import {writeFileSync} from 'node:fs';
import {CHAINS, OVERPASS, NAME_RE, toStore} from '../src/stores.js';

const SHOP = 'supermarket|convenience|department_store|wholesale|general';
const query = `[out:json][timeout:300];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(nwr["shop"~"${SHOP}"]["brand"~"${NAME_RE}",i](area.se);
 nwr["shop"~"${SHOP}"]["name"~"${NAME_RE}",i](area.se););
out center tags;`;
const UA = 'SwipeSupper/1.0 (monthly store list; https://github.com/mlohajner-hub/swipe-supper)';

async function fetchElements() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of OVERPASS) {
      try {
        const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA},
          body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(330000)});
        if (r.ok) { const j = await r.json(); if (j.elements?.length) { console.log(`${url}: ${j.elements.length} elements`); return j.elements; } }
        console.log(`${url}: HTTP ${r.status}`);
      } catch (e) { console.log(`${url}: ${e.message}`); }
    }
    await new Promise(r => setTimeout(r, 60000 * attempt));
  }
  throw new Error('No Overpass server answered');
}

const seen = new Set(), stores = [];
for (const e of await fetchElements()) {
  const s = toStore(e);
  if (!s || seen.has(s.id)) continue;
  seen.add(s.id);
  stores.push({i: s.id.slice(4), c: CHAINS.indexOf(s.chain), n: s.name, a: s.address, la: +s.lat.toFixed(5), lo: +s.lon.toFixed(5)});
}
if (stores.length < 1000) throw new Error(`Only ${stores.length} stores found; keeping the old list`);
stores.sort((a, b) => a.c - b.c || a.n.localeCompare(b.n, 'sv'));
const counts = Object.fromEntries(CHAINS.map((c, i) => [c, stores.filter(s => s.c === i).length]));
writeFileSync('public/stores.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10),
  attribution: '© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright', chains: CHAINS, stores}));
console.log(stores.length, 'stores', counts);
