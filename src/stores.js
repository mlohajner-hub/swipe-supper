/* Finding your stores, once, by postcode or location. Store locations come from OpenStreetMap
   (© OpenStreetMap contributors, ODbL). The app ships with a list of every store of the six chains in Sweden
   (public/stores.json, rebuilt monthly by GitHub Actions), so picking stores needs no live store search.
   Nominatim turns a postcode into a point; live Overpass is only a fallback if the list is missing. */
export const CHAINS=['ICA','Willys','Lidl','Coop','Hemköp','City Gross'];
const CHAIN_RE=[['City Gross',/city\s*gross/i],['Hemköp',/hemk[oö]p/i],['Willys',/willys/i],['Lidl',/\blidl\b/i],['ICA',/\bica\b/i],['Coop',/\bcoop\b/i]];
export const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
export const NAME_RE='^(ICA|Willys|Lidl|Coop|Stora Coop|Hemköp|City Gross)';

function timedFetch(url,opts,ms){
  const c=new AbortController(),t=setTimeout(function(){c.abort()},ms);
  return fetch(url,Object.assign({},opts,{signal:c.signal})).finally(function(){clearTimeout(t)});
}
/* One OpenStreetMap element -> a store, or null if it isn't one of the six chains. */
export function toStore(e){
  const t=e.tags||{},chain=chainOf(t),la=e.lat!=null?e.lat:e.center&&e.center.lat,lo=e.lon!=null?e.lon:e.center&&e.center.lon;
  if(!chain||la==null)return null;
  const street=[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' '),city=t['addr:city']||t['addr:place']||'';
  return {id:'osm:'+e.type+'/'+e.id,chain:chain,name:t.name||chain,address:[street,city].filter(Boolean).join(', '),lat:la,lon:lo};
}
let listP=null;
function storeList(){
  if(!listP)listP=timedFetch('stores.json',{},15000).then(function(r){return r.ok?r.json():null}).then(function(j){
    return j&&Array.isArray(j.stores)&&j.stores.length?j.stores.map(function(s){return {id:'osm:'+s.i,chain:j.chains[s.c],name:s.n,address:s.a,lat:s.la,lon:s.lo}}):null;
  }).catch(function(){return null});
  return listP;
}

export function chainOf(tags){
  const s=[tags.brand,tags.name,tags.operator].filter(Boolean).join(' ');
  for(const c of CHAIN_RE)if(c[1].test(s))return c[0];
  return null;
}
function km(a,b,c,d){
  const r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);
  return 12742*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y));
}

/* Swedish postcode ("123 45" or "12345") -> {lat, lon, label}. */
export async function geocodePostcode(pc){
  const code=String(pc).replace(/\s+/g,'');
  if(!/^\d{5}$/.test(code))throw new Error('Enter a five-digit postcode');
  const r=await timedFetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=se&postalcode='+code,{headers:{'Accept-Language':'sv,en'}},15000)
    .catch(function(){throw new Error('The postcode lookup is not answering right now')});
  if(!r.ok)throw new Error('The postcode lookup is not answering right now');
  const j=await r.json();
  if(!j.length)throw new Error('Could not find postcode '+code.slice(0,3)+' '+code.slice(3));
  return {lat:+j[0].lat,lon:+j[0].lon,label:code.slice(0,3)+' '+code.slice(3),city:townOf(j[0].address)};
}
/* The town a postcode or position belongs to, for stores whose OpenStreetMap address has none. */
function townOf(a){a=a||{};return (a.city||a.town||a.village||a.municipality||'').replace(/ kommun$/,'')}
async function townAt(lat,lon){
  try{
    const r=await timedFetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat='+lat+'&lon='+lon,{headers:{'Accept-Language':'sv,en'}},15000);
    return r.ok?townOf((await r.json()).address):'';
  }catch(e){return ''}
}

/* Supermarkets of the six chains within radius km, nearest first. */
export async function storesNear(lat,lon,radiusKm){
  let all=await storeList();
  if(!all)all=await overpassNear(lat,lon,radiusKm);
  return all.map(function(s){return Object.assign({},s,{dist:km(lat,lon,s.lat,s.lon)})})
    .filter(function(s){return s.dist<=radiusKm}).sort(function(a,b){return a.dist-b.dist});
}
async function overpassNear(lat,lon,radiusKm){
  const m=Math.round(radiusKm*1000),a='(around:'+m+','+lat+','+lon+')';
  const q='[out:json][timeout:25];(nwr["shop"]["brand"~"'+NAME_RE+'",i]'+a+';nwr["shop"]["name"~"'+NAME_RE+'",i]'+a+';);out center tags 300;';
  let j=null;
  for(const url of OVERPASS){
    try{const r=await timedFetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)},20000);if(r.ok){j=await r.json();break}}catch(e){}
  }
  if(!j)throw new Error('The store search is not answering right now. Try again later.');
  const seen={};
  return j.elements.map(toStore).filter(function(s){if(!s||seen[s.id])return false;seen[s.id]=1;return true});
}

export function currentPosition(){
  return new Promise(function(res,rej){
    if(!navigator.geolocation)return rej(new Error('Location is not available on this device'));
    navigator.geolocation.getCurrentPosition(function(p){
        const lat=p.coords.latitude,lon=p.coords.longitude;
        townAt(lat,lon).then(function(city){res({lat:lat,lon:lon,label:city||'your location',city:city})});
      },
      function(){rej(new Error('Location permission was not given'))},{enableHighAccuracy:false,timeout:15000,maximumAge:600000});
  });
}
