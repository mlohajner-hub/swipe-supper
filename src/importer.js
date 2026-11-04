/* Import a recipe from a web page you choose. Most recipe sites (Köket, Arla, ICA, Coop, BBC Good Food…)
   publish their recipes as schema.org "Recipe" data inside the page; this reads that one page, the way your
   browser would, and turns it into a draft for the recipe editor. Android app only: a web page isn't allowed
   to read other websites, the app's native HTTP is. Sites that block apps are left alone. */
import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {AISLES,aP,aM,aD,aB,aK,aF,aS} from './data.js';
import {SV,matchItem} from './offers.js';
import {dietFlags,aisleFor,ALIAS} from './mealdb.js';

export function canImport(){return Capacitor.isNativePlatform()}

async function get(url,type){
  const r=await CapacitorHttp.get({url:url,responseType:type||'text',connectTimeout:15000,readTimeout:20000,
    headers:{'Accept':type==='blob'?'image/*':'text/html,application/xhtml+xml','Accept-Language':'sv,en;q=0.8','User-Agent':navigator.userAgent}});
  if(r.status===401||r.status===403||r.status===429)throw new Error('That site doesn\'t let apps read its pages. Open it in the browser and type the recipe in instead.');
  if(r.status<200||r.status>=300)throw new Error('The page answered with error '+r.status);
  return r.data;
}

/* ---------- finding the Recipe data ---------- */
function isRecipe(o){const t=o&&o['@type'];return t==='Recipe'||(Array.isArray(t)&&t.indexOf('Recipe')>-1)}
function findRecipe(o){
  if(!o||typeof o!=='object')return null;
  if(Array.isArray(o)){for(const x of o){const r=findRecipe(x);if(r)return r}return null}
  if(isRecipe(o))return o;
  for(const k of ['@graph','mainEntity','itemListElement']){const r=findRecipe(o[k]);if(r)return r}
  return null;
}
export function recipeFromHtml(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  for(const s of doc.querySelectorAll('script')){
    if(!/ld(\+|&#x2b;|&#43;)json/i.test(s.getAttribute('type')||''))continue;
    try{const r=findRecipe(JSON.parse(s.textContent.trim()));if(r)return r}catch(e){}
  }
  return null;
}

/* ---------- small helpers ---------- */
function text(v){
  if(v==null)return '';
  if(Array.isArray(v))return v.map(text).filter(Boolean).join(', ');
  if(typeof v==='object')return text(v.name||v.text||v['@value']||'');
  const d=new DOMParser().parseFromString('<p>'+String(v)+'</p>','text/html');
  return (d.body.textContent||'').replace(/\s+/g,' ').trim();
}
function imageUrl(v){
  if(!v)return '';
  if(typeof v==='string')return v;
  if(Array.isArray(v))return imageUrl(v[v.length>2?v.length-1:0]); /* sites list sizes small to large */
  return v.url||v.contentUrl||'';
}
function steps(v){
  if(!v)return [];
  if(typeof v==='string')return text(v).split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])|\n+/).map(function(s){return s.trim()}).filter(Boolean);
  if(Array.isArray(v))return v.reduce(function(a,x){return a.concat(steps(x))},[]);
  if(v.itemListElement)return steps(v.itemListElement);
  return [text(v.text||v.name)].filter(Boolean);
}
function minutes(iso){
  const m=String(iso||'').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if(!m)return 0;
  return (+m[1]||0)*1440+(+m[2]||0)*60+(+m[3]||0);
}
function servings(v){const m=text(v).match(/\d+/);const n=m?+m[0]:0;return n>=1&&n<=12?n:4}

/* ---------- ingredient lines ---------- */
const FRAC={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125};
const NUM_RE=/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])(?:\s*(?:-|–|till|to)\s*(\d+(?:[.,]\d+)?))?\s*/i;
function num(s){
  s=s.trim();let m;
  if((m=s.match(/^(\d+)\s+(\d+)\/(\d+)$/)))return +m[1]+m[2]/m[3];
  if((m=s.match(/^(\d+)\/(\d+)$/)))return m[1]/m[2];
  if((m=s.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔⅛])?$/)))return parseFloat(m[1].replace(',','.'))+(m[2]?FRAC[m[2]]:0);
  return FRAC[s]||0;
}
/* [pattern, editor unit, factor]. Editor units: g kg ml dl l pcs tbsp tsp. */
const UNIT=[
  [/^(kg|kilo)\b/i,'kg',1],[/^hg\b/i,'g',100],[/^(g|gr|gram)\b/i,'g',1],
  [/^(ml|milliliter)\b/i,'ml',1],[/^cl\b/i,'ml',10],[/^dl\b/i,'dl',1],[/^(l|liter|litre)\b/i,'l',1],
  [/^krm\b/i,'ml',1],[/^(msk|matsked(ar)?|tbsp|tablespoons?)\b/i,'tbsp',1],[/^(tsk|tesked(ar)?|tsp|teaspoons?)\b/i,'tsp',1],
  [/^(cups?)\b/i,'dl',2.4],[/^(oz|ounces?)\b/i,'g',28.35],[/^(lbs?|pounds?)\b/i,'g',453.6],
  [/^(st|stycken|styck|pcs|pieces?|klyftor|klyfta|cloves?|skivor|skiva|slices?|knippe|krukor?|kruka|burkar|burk|cans?|tins?|förp\.?|förpackning(ar)?|paket|påsar|påse|packs?|bunch(es)?|bitar|bit|nypa|näve|handfuls?|stjälkar|stjälk|stalks?|sticks?|blad|leaves|kvistar|kvist|sprigs?)\b\.?/i,'pcs',1]
];
/* Words that describe preparation or size rather than what to buy. */
const PREP=/\b(finely|thinly|roughly|coarsely|freshly|lightly)?\s*(chopped|sliced|diced|crushed|grated|minced|peeled|halved|quartered|shredded|torn|beaten|melted|softened|drained|rinsed|trimmed|cubed|boneless(?: and skinless)?|skinless|cut into [\w\s-]+|to serve|finhackad(e)?|hackad(e)?|grovhackad(e)?|skivad(e)?|riven|rivna|pressad(e)?|tärnad(e)?|strimlad(e)?|skalad(e)?|smält|rumsvarm|kokt(a)?|avrunnen|avrunna|i bitar|i skivor|i tärningar)\b/gi;
const SIZE=/^(small|large|medium|big|thumb-sized piece of|piece of|knob of|pinch of|bunch of|handful of|a few|few|some|liten|litet|små|stor|stort|stora|bit av)\s+/i;
const SKIP=/^(salt|peppar|svartpeppar|vitpeppar|salt och peppar|salt & peppar|salt and pepper|pepper|black pepper|vatten|water|isbitar|ice)\b/i;
const VAGUE=/efter smak|till servering|till stekning|att steka i|till garnering|to taste|to serve|for frying|garnish|optional|valfritt/i;

/* Swedish store section from the name, then the English rules used for online recipes. */
const SV_AISLE=[
  [aF,/\bfryst|frysta\b/],
  [aS,/olja|kryddor?|kanel|spiskummin|paprikapulver|chiliflakes|curry|gurkmeja|timjan, torkad|oregano|buljong|fond|vaniljsocker|bakpulver|kardemumma|muskot|lagerblad|kryddpeppar/],
  [aM,/kyckling|fläsk|nötfärs|blandfärs|nötkött|färs|bacon|korv|skinka|lamm|kalkon|biff|entrecote|karré|chorizo|salami|lax|torsk|räk|fisk|tonfisk|sill|ansjovis|musslor|kräft|krabba|sej|rödspätta|kolja|pancetta/],
  [aD,/mjölk|grädde|smör|ost\b|ost,|riven ost|yoghurt|crème|creme|fraiche|kvarg|keso|filmjölk|parmesan|mozzarella|fetaost|halloumi|mascarpone|ricotta|ägg/],
  [aB,/bröd|tortilla|pita|havregryn|müsli|bulle|baguette|ciabatta|naan/],
  [aP,/lök|vitlök|morot|morötter|potatis|tomat|gurka|paprika|sallad|spenat|svamp|champinjon|citron|lime|avokado|ingefära|chili|dill|persilja|koriander|basilika|timjan|rosmarin|mynta|gräslök|purjo|selleri|broccoli|blomkål|kål|zucchini|squash|aubergine|äpple|päron|banan|bär|rödbet|fänkål|sparris|majskolv|ruccola|melon|mango|ananas|apelsin|ärtor, färska|sockerärtor|bönor, gröna/]
];
function aisleOf(name){
  const n=name.toLowerCase();
  if(/kokosmjölk|havremjölk|sojamjölk|krossade|passerade|konserv|burk/.test(n))return aK;
  for(const a of SV_AISLE)if(a[1].test(n))return a[0];
  return aisleFor(n,dietFlags(n),'');
}
const SV_FLAGS=[
  ['meat',/kyckling|fläsk|nötfärs|blandfärs|nötkött|köttfärs|bacon|korv|skinka|lamm|kalkon|biff|entrecote|karré|chorizo|salami|köttbuljong|kycklingbuljong|kalvfond|oxfond|pancetta|kött\b/],
  ['fish',/lax|torsk|räk|fisk|tonfisk|sill|ansjovis|musslor|kräft|krabba|hummer|sej|rödspätta|kolja|kaviar|fiskbuljong/],
  ['dairy',/(?<!kokos|havre|soja|mandel|ris)mjölk|grädde|smör(?!gås)|\bost|riven ost|ost\b|yoghurt|crème|creme fraiche|kvarg|keso|parmesan|mozzarella|fetaost|halloumi|mascarpone|ricotta|filmjölk/],
  ['egg',/ägg/],
  ['gluten',/vetemjöl|grahamsmjöl|rågmjöl|dinkel|bröd|pasta|spaghetti|makaroner|lasagne|couscous|bulgur|tortilla|pita|ströbröd|kex|soja|\böl\b|korngryn|havregryn|(?<!ris)nudlar/],
  ['nuts',/mandel|valnöt|cashew|jordnöt|hasselnöt|pistage|pinjenöt|pekannöt|nötter|paranöt|macadamia/],
  ['animal',/honung/]
];
export function svFlags(name){const n=name.toLowerCase(),f=dietFlags(n).split(' ').filter(Boolean);SV_FLAGS.forEach(function(x){if(x[1].test(n)&&f.indexOf(x[0])<0)f.push(x[0])});return f}

/* One ingredient line ("2 dl grädde", "1 burk krossade tomater (400 g)", "500 g chicken thighs") -> editor row, or null. */
export function parseLine(line,known){
  let s=text(line);
  const pack=s.match(/\(\s*(?:à|a|ca\.?)?\s*(\d+)\s*g\b[^)]*\)/i); /* "1 burk krossade tomater (à 400 g)" */
  s=s.replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim().replace(/^(ca\.?|cirka|about|approx\.?|ungefär)\s+/i,'');
  if(!s||SKIP.test(s))return null;
  let amt=0,unit='pcs';
  const m=s.match(NUM_RE);
  if(m){
    amt=Math.max(num(m[1]),m[2]?parseFloat(m[2].replace(',','.')):0);s=s.slice(m[0].length);
    for(const u of UNIT){const um=s.match(u[0]);if(um){unit=u[1];amt*=u[2];s=s.slice(um[0].length).trim();break}}
    if(unit==='pcs'&&pack){amt*=+pack[1];unit='g'}
  }
  let name=s.replace(/^(of|av)\s+/i,'').split(/,\s*(?=[a-zåäö])/i)[0].split(/\s+(?:or|eller)\s+/i)[0].replace(VAGUE,'');
  for(let i=0;i<3;i++)name=name.replace(SIZE,'');
  name=name.replace(PREP,' ').replace(/\s+/g,' ').trim();
  if(!name||SKIP.test(name))return null;
  if(!amt){amt=1;if(/olja|oil/i.test(name))unit='tbsp'} /* "olja till stekning", "färsk persilja": 1 to start with, check in the editor */
  /* A Swedish name the app knows becomes its English catalogue name, so it merges with the built-in recipes. */
  const k=ALIAS[name.toLowerCase()]||matchItem(name,Object.keys(SV),null);
  const out={name:name.charAt(0).toUpperCase()+name.slice(1),amt:Math.round(amt*100)/100,unit:unit,aisle:aisleOf(name)};
  if(k&&known&&known[k]){out.name=known[k].name;out.aisle=known[k].aisle;out.key=k}
  return out;
}

/* ---------- the whole recipe ---------- */
const CUISINE=[[/ital/i,'Italian'],[/mexi/i,'Mexican'],[/asia|thai|kines|chin|japan|indi|korea|vietnam/i,'Asian'],[/svensk|nordisk|swed|nordic|scandi/i,'Nordic'],[/grek|greek|medelhav|mediterr|span|turk|libanes|leban|marock|moroc/i,'Mediterranean']];
/* known: {ingredientKey: {name, aisle, flags}} from the app's catalogue. Returns a draft for the editor. */
export function toDraft(r,url,known){
  const ings=[],flags={};
  (r.recipeIngredient||r.ingredients||[]).forEach(function(l){
    const it=parseLine(l,known);if(!it)return;
    (it.key&&known[it.key]?known[it.key].flags.split(' '):svFlags(it.name)).forEach(function(f){if(f)flags[f]=1});
    delete it.key;ings.push(it);
  });
  const cat=(text(r.recipeCategory)+' '+text(r.keywords)).toLowerCase(),name=text(r.name);
  const meals=/frukost|breakfast|brunch/.test(cat)?['breakfast']:/lunch|sallad|salad|soppa|soup/.test(cat+' '+name.toLowerCase())?['lunch','dinner']:['dinner'];
  const tags=[],cuisine=text(r.recipeCuisine)+' '+cat;
  CUISINE.forEach(function(c){if(c[0].test(cuisine)&&tags.indexOf(c[1])<0)tags.push(c[1])});
  if(/soppa|soup/i.test(name))tags.push('Soup');
  const animal=flags.dairy||flags.egg||flags.animal;
  const diet={'Vegetarian':!flags.meat&&!flags.fish,'Vegan':!flags.meat&&!flags.fish&&!animal,'Pescatarian':!flags.meat,'Gluten-free':!flags.gluten,'Dairy-free':!flags.dairy,'Nut-free':!flags.nuts};
  const time=minutes(r.totalTime)||minutes(r.cookTime)+minutes(r.prepTime)||30;
  return {name:name.slice(0,80),meals:meals,time:Math.min(600,time),servings:servings(r.recipeYield),tags:tags,diet:diet,
    ings:ings.slice(0,60),steps:steps(r.recipeInstructions).slice(0,40).map(function(s){return s.slice(0,600)}),
    source:url,image:imageUrl(r.image)};
}

export async function importFromUrl(url,known){
  if(!/^https?:\/\//i.test(url))throw new Error('Paste the full link, starting with https://');
  const html=await get(url,'text');
  const r=recipeFromHtml(typeof html==='string'?html:'');
  if(!r)throw new Error('Couldn\'t find a recipe on that page. Try the recipe\'s own page, not a list or search page.');
  const d=toDraft(r,url,known);
  if(!d.name||!d.ings.length)throw new Error('That page\'s recipe has no ingredient list the app can read.');
  return d;
}

/* The recipe's photo as a resized JPEG data URL (kept on the phone like your own photos), or ''. */
export async function fetchPhoto(url){
  if(!url)return '';
  try{
    const b64=await get(url,'blob');
    const src='data:image/jpeg;base64,'+String(b64).replace(/^data:[^,]*,/,'');
    return await new Promise(function(res){
      const im=new Image();
      im.onload=function(){const sc=Math.min(1,720/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};
      im.onerror=function(){res('')};im.src=src;
    });
  }catch(e){return ''}
}
