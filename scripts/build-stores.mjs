// Builds public/stores.json: every ICA, Willys, Lidl, Coop, Hemköp and City Gross store in Sweden from
// OpenStreetMap (© OpenStreetMap contributors, ODbL). Run monthly by .github/workflows/stores.yml.
// One small query per chain: the public Overpass servers are shared and often busy, and a single
// country-wide query for all six chains is the kind that times out.
// Usage: node scripts/build-stores.mjs
import {writeFileSync} from 'node:fs';
import {CHAINS, OVERPASS, toStore} from '../src/stores.js';

const SHOP = 'supermarket|convenience|department_store|wholesale|general';
const CHAIN_NAMES = {ICA: 'ICA', Willys: 'Willys', Lidl: 'Lidl', Coop: 'Coop|Stora Coop', 'Hemköp': 'Hemköp|Hemkop', 'City Gross': 'City Gross'};
const UA = 'SwipeSupper/1.0 (monthly store list; https://github.com/mlohajner-hub/swipe-supper)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function query(names) {
  const re = `^(${names})`;
  return `[out:json][timeout:180];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(nwr["shop"~"${SHOP}"]["brand"~"${re}",i](area.se);
 nwr["shop"~"${SHOP}"]["name"~"${re}",i](area.se););
out center tags;`;
}

async function fetchChain(chain) {
  const body = 'data=' + encodeURIComponent(query(CHAIN_NAMES[chain]));
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const url of OVERPASS) {
      try {
        const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA}, body, signal: AbortSignal.timeout(200000)});
        if (r.ok) {
          const j = await r.json();
          if (j.elements?.length) { console.log(`${chain}: ${j.elements.length} elements from ${url}`); return j.elements; }
          console.log(`${chain}: ${url} answered without data${j.remark ? ` (${j.remark.slice(0, 120)})` : ''}`);
        } else console.log(`${chain}: ${url} HTTP ${r.status}`);
      } catch (e) { console.log(`${chain}: ${url} ${e.message}`); }
      await sleep(5000);
    }
    await sleep(45000 * attempt);
  }
  throw new Error(`No Overpass server answered for ${chain}; keeping the old list`);
}

const seen = new Set(), stores = [];
for (const chain of CHAINS) {
  for (const e of await fetchChain(chain)) {
    const s = toStore(e);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    stores.push({i: s.id.slice(4), c: CHAINS.indexOf(s.chain), n: s.name, a: s.address, la: +s.lat.toFixed(5), lo: +s.lon.toFixed(5)});
  }
  await sleep(10000); // be gentle with a shared, free service
}
if (stores.length < 1000) throw new Error(`Only ${stores.length} stores found; keeping the old list`);
stores.sort((a, b) => a.c - b.c || a.n.localeCompare(b.n, 'sv'));
const counts = Object.fromEntries(CHAINS.map((c, i) => [c, stores.filter(s => s.c === i).length]));
writeFileSync('public/stores.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10),
  attribution: '© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright', chains: CHAINS, stores}));
console.log(stores.length, 'stores', counts);
