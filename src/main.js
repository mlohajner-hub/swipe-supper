import './styles.css';
import {Capacitor} from '@capacitor/core';
import {aP,aM,aD,aB,aK,aF,aS,AISLES,ING,STAPLES,RAW,MEALS,MEAL_LABEL,MEAL_ORDER,DAYS,DAYS_LONG,TAGS,DIETS,UNITS,AISLE_COLOUR} from './data.js';
import {loadPhotos,putPhoto,deletePhoto,clearPhotos,getCached,putCached} from './photos.js';
import {saveBackup,readBackup,BACKUP_APP} from './backup.js';
import {fetchAllMeals,convertMeal,SERVINGS as ONLINE_SERVINGS} from './mealdb.js';
import {CHAINS,geocodePostcode,storesNear,currentPosition} from './stores.js';
import {matchItem,isActive,todayISO,thisSunday,kr,shortDate} from './offers.js';
import {packRecipe,unpackRecipe,findPacked,shareUrl,appIntentUrl,isAndroidBrowser,shareLink,onAppLink} from './share.js';

/* ---------- recipes ---------- */
/* A recipe definition: built-in rows from RAW, online recipes from TheMealDB, or the user's own recipes from st.custom.
   All become the same runtime shape, so the deck, planner and shopping list treat them alike. */
var STYLE_TAGS=TAGS.filter(function(t){return t!=='All'&&t!=='Mine'&&t!=='Friends'&&t!=='Quick'});
function slug(s){return String(s).toLowerCase().trim().replace(/\s+/g,' ')}
var KNOWN={};Object.keys(ING).forEach(function(k){KNOWN[slug(ING[k][0])]=k});
/* Resolves one editor ingredient to an ING key. A known name in a compatible unit merges with the
   built-in ingredient; anything else gets its own key per name+unit so it still merges across recipes. */
function ingKey(it){
  var u=UNITS.filter(function(x){return x[0]===it.unit})[0]||UNITS[5],k=KNOWN[slug(it.name)];
  if(k&&ING[k][1]===u[1])return {key:k,amt:it.amt*u[2]};
  k='c:'+slug(it.name)+'|'+u[1];
  if(!ING[k])ING[k]=[String(it.name).trim(),u[1],AISLES.indexOf(it.aisle)>-1?it.aisle:aK,'',AISLE_COLOUR[it.aisle]||'#C9B24A'];
  return {key:k,amt:it.amt*u[2]};
}
function buildRecipe(id,name,meals,time,tags,ings,steps,mine,userDiet){
  var flags={};
  ings.forEach(function(p){(ING[p[0]][3]||'').split(' ').forEach(function(f){if(f)flags[f]=1})});
  var animal=flags.dairy||flags.egg||flags.animal;
  tags=tags.slice();if(time&&time<=25)tags.unshift('Quick');if(mine)tags.unshift(mine==='friend'?'Friends':'Mine');
  var diet={'Vegetarian':!flags.meat&&!flags.fish,'Vegan':!flags.meat&&!flags.fish&&!animal,'Pescatarian':!flags.meat,'Gluten-free':!flags.gluten,'Dairy-free':!flags.dairy,'Nut-free':!flags.nuts};
  /* Own recipes: a diet only counts if you ticked it AND no known ingredient contradicts it. */
  if(mine)DIETS.forEach(function(d){diet[d]=!!(userDiet&&userDiet[d])&&diet[d]});
  var colors=ings.map(function(p){return ING[p[0]]}).filter(function(i){return i[2]!==aS}).map(function(i){return i[4]});
  return {id:id,name:name,meals:meals,time:time,tags:tags,ings:ings,steps:steps,mine:!!mine,fish:!!flags.fish,diet:diet,colors:colors.length?colors:['#C9B24A']};
}
var BUILTIN=RAW.map(function(r){return buildRecipe(r[0],r[1],r[2].split('').map(function(c){return MEALS[c]}),r[3],r[4],r[5],r[6],false)});
function customRecipe(c){
  var per2=2/(c.servings||2);
  var ings=c.ings.filter(function(it){return it.name&&it.amt>0}).map(function(it){var x=ingKey(it);return [x.key,x.amt*per2]});
  /* Recipes added from a friend's link keep their author (c.from); yours are by you. */
  var r=buildRecipe(c.id,c.name,c.meals.length?c.meals:['dinner'],c.time||30,c.tags||[],ings,c.steps||[],c.from?'friend':true,c.diet);
  r.from=c.from||'';r.author=c.from||st.name||'';
  return r;
}
/* Online recipes have no cooking time (TheMealDB doesn't give one), so they never count as Quick. */
function onlineRecipe(m){
  var d=convertMeal(m),r=buildRecipe(d.id,d.name,d.meals,null,d.tags,d.ings,d.steps,false);
  r.online=true;r.image=d.image;r.source=d.source;r.link=d.link;
  return r;
}
var ONLINE=[],onlineAt=0,onlineBusy=false;
var RECIPES=[],BYID={};
/* Planned or kept online recipes stay findable (BYID) even when online recipes are switched off for the deck. */
function rebuildRecipes(){
  var mine=st.custom.map(customRecipe);
  RECIPES=BUILTIN.concat(st.online?ONLINE:[],mine);
  BYID={};BUILTIN.concat(ONLINE,mine).forEach(function(r){BYID[r.id]=r});
  plateCache={};itemCache={};
}
function setOnline(meals,at){
  ONLINE=[];meals.forEach(function(m){try{ONLINE.push(onlineRecipe(m))}catch(e){}});
  onlineAt=at||0;rebuildRecipes();
}
/* Fetches the catalogue when there is none yet, or when it is a week old. Manual refresh always fetches. */
function refreshOnline(manual){
  if(onlineBusy||!st.online)return;
  if(!manual&&onlineAt&&Date.now()-onlineAt<7*86400000)return;
  if(!navigator.onLine){if(manual)toast('You are offline');return}
  onlineBusy=true;if(manual)renderMine();
  fetchAllMeals().then(function(meals){
    var at=Date.now(),had=ONLINE.length;
    putCached('mealdb',{at:at,meals:meals}).catch(function(){});
    setOnline(meals,at);onlineBusy=false;renderAll();
    if(manual||!had)toast(ONLINE.length+' online recipes ready');
  }).catch(function(){onlineBusy=false;renderMine();if(manual)toast('Could not reach TheMealDB')});
}

/* ---------- state ---------- */
/* Everything is saved on this device only (localStorage; photos in IndexedDB). Use the backup file to move or keep it. */
var KEY='swipe-supper.v1';
function defaults(){return {portions:2,meals:{breakfast:false,lunch:false,dinner:true},mealFilter:'dinner',tag:'All',diet:[],liked:[],skipped:[],plan:{},have:STAPLES.slice(),done:{},custom:[],online:true,stores:[],offers:[],saleOnly:false,postcode:'',seed:Math.floor(Math.random()*1e9),updated:0}}
function normalise(o){var d=defaults();var s=Object.assign(d,o||{});s.meals=Object.assign(defaults().meals,(o&&o.meals)||{});if(!Array.isArray(s.custom))s.custom=[];if(!Array.isArray(s.stores))s.stores=[];if(!Array.isArray(s.offers))s.offers=[];return s}
var st=defaults();
try{var raw=localStorage.getItem(KEY);if(raw)st=normalise(JSON.parse(raw))}catch(e){}
var photos={},plateCache={},itemCache={},saleBy={};
rebuildRecipes();
/* Offers that ended more than a month ago are tidied away. */
(function(){var cut=todayISO(new Date(Date.now()-30*86400000));st.offers=st.offers.filter(function(o){return !o.validTo||o.validTo>=cut})})();

function save(){
  st.updated=Date.now();
  try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){toast('Could not save on this device')}
}
/* ---------- helpers ---------- */
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function hash(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function trim1(n){return String(Math.round(n*10)/10)}
function frac(v){var w=Math.floor(v+1e-9),r=Math.round((v-w)*4)/4,s=r===.25?'¼':r===.5?'½':r===.75?'¾':'';if(r===1){w+=1;s=''}return (w||s?(w||'')+s:'0')}
function ppl(n){return n+(n===1?' person':' people')}
function mealText(r){return r.meals.map(function(m){return MEAL_LABEL[m]}).join(' / ')}
function timeText(r){return r.time?r.time+' min':'Online'}
function ico(path,size,sw){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||2.2)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>'}
var I={
  keep:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  skip:'<path d="M6 6l12 12M18 6L6 18"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
function isoWeek(d){var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);var y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil((((t-y0)/86400000)+1)/7)}
function mondayOf(d){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
var toastTimer=null;
function toast(msg){var t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show')},2400)}

/* ---------- art ---------- */
function plate(r){
  if(plateCache[r.id])return plateCache[r.id];
  var rand=rng(hash(r.id)),cols=r.colors.filter(function(c,i,a){return a.indexOf(c)===i}).slice(0,5);
  var s='<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="105" r="94" fill="rgba(0,0,0,.12)"/><circle cx="100" cy="100" r="92" fill="var(--plate)"/><circle cx="100" cy="100" r="74" fill="var(--plate2)"/>';
  var i,a,d,cx,cy;
  for(i=0;i<8;i++){a=rand()*6.283;d=rand()*44;cx=100+Math.cos(a)*d;cy=100+Math.sin(a)*d;
    s+='<ellipse cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" rx="'+(13+rand()*17).toFixed(1)+'" ry="'+(9+rand()*12).toFixed(1)+'" transform="rotate('+Math.round(rand()*180)+' '+cx.toFixed(1)+' '+cy.toFixed(1)+')" fill="'+cols[i%cols.length]+'" opacity=".95"/>'}
  for(i=0;i<14;i++){a=rand()*6.283;d=rand()*58;
    s+='<circle cx="'+(100+Math.cos(a)*d).toFixed(1)+'" cy="'+(100+Math.sin(a)*d).toFixed(1)+'" r="'+(2+rand()*3.5).toFixed(1)+'" fill="'+cols[Math.floor(rand()*cols.length)]+'"/>'}
  return plateCache[r.id]=s+'</svg>';
}
/* Your own photo wins, then the online photo, then the drawn plate. The plate sits under the online photo
   and shows through if the photo can't load (offline, or the image is gone). size: TheMealDB variant suffix. */
function artInner(r,size){
  if(photos[r.id])return '<img src="'+photos[r.id]+'" alt="'+esc(r.name)+'" draggable="false">';
  if(r.image)return plate(r)+'<img class="net" src="'+esc(r.image+(size?'/'+size:''))+'" alt="'+esc(r.name)+'" draggable="false" loading="lazy" decoding="async" onerror="this.remove()">';
  return plate(r);
}
function artHtml(r,size){return '<div class="art" style="--c:'+r.colors[0]+'">'+artInner(r,size)+'</div>'}
function thumb(r){return '<span class="thumb" style="--c:'+r.colors[0]+'">'+artInner(r,'small')+'</span>'}
function pills(r,max){
  var out=r.from?[['by '+r.from,2]]:r.mine?[['Mine',2]]:r.online?[['Online',0]]:[],sc=saleCount(r);
  if(sc)out.unshift(['On sale: '+sc+(sc===1?' item':' items'),3]);
  if(r.diet.Vegan)out.push(['Vegan',1]);else if(r.diet.Vegetarian)out.push(['Vegetarian',1]);else if(r.fish&&r.diet.Pescatarian)out.push(['Pescatarian',1]);
  if(r.diet['Gluten-free'])out.push(['Gluten-free',1]);
  if(r.diet['Dairy-free'])out.push(['Dairy-free',1]);
  r.tags.forEach(function(t){if(t!=='Mine'&&t!=='Friends')out.push([t,0])});
  return out.slice(0,max||5).map(function(p){return '<span class="pill'+(p[1]===3?' sale':p[1]===2?' mine':p[1]?' diet':'')+'">'+esc(p[0])+'</span>'}).join('');
}

/* ---------- discover ---------- */
var history=[],drag=null,busy=false;
function baseFiltered(){return RECIPES.filter(function(r){return (st.mealFilter==='all'||r.meals.indexOf(st.mealFilter)>-1)&&st.diet.every(function(d){return r.diet[d]})})}
function remaining(){return baseFiltered().filter(function(r){return st.liked.indexOf(r.id)<0&&st.skipped.indexOf(r.id)<0})}
/* "Cook what's on sale": only recipes using something on offer at your stores, the most on-sale ingredients first. */
/* st.tag is a style tag, or "by:<name>" for one friend's recipes. */
function tagMatch(r,t){return t==='All'||(t.indexOf('by:')===0?r.from===t.slice(3):r.tags.indexOf(t)>-1)}
function deckList(){
  return remaining().filter(function(r){return tagMatch(r,st.tag)&&(!st.saleOnly||saleCount(r)>0)})
    .sort(function(a,b){return (st.saleOnly?saleCount(b)-saleCount(a):0)||hash(a.id+st.seed)-hash(b.id+st.seed)});
}
function filtersHtml(){
  var base=remaining(),counts={};
  var onSale=base.filter(function(r){return saleCount(r)>0}).length;
  if(st.saleOnly)base=base.filter(function(r){return saleCount(r)>0});
  TAGS.forEach(function(t){counts[t]=base.filter(function(r){return t==='All'||r.tags.indexOf(t)>-1}).length});
  /* One chip per friend whose recipes you've added, right after "Friends". */
  var friends={};base.forEach(function(r){if(r.from)friends[r.from]=(friends[r.from]||0)+1});
  if(st.tag.indexOf('by:')===0&&!friends[st.tag.slice(3)])friends[st.tag.slice(3)]=0;
  var friendChips=Object.keys(friends).sort(function(a,b){return a.localeCompare(b)}).map(function(f){return '<button class="chip friend" aria-pressed="'+(st.tag==='by:'+f)+'" data-act="tag" data-a="by:'+esc(f)+'">'+esc(f)+'<span class="n">'+friends[f]+'</span></button>'}).join('');
  var meals=[['all','All'],['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner']];
  return '<div class="seg" role="group" aria-label="Meal type">'+meals.map(function(m){return '<button aria-pressed="'+(st.mealFilter===m[0])+'" data-act="mealfilter" data-a="'+m[0]+'">'+m[1]+'</button>'}).join('')+'</div>'
  +'<div class="chips" role="group" aria-label="Style">'
  +(onSale||st.saleOnly?'<button class="chip sale" aria-pressed="'+!!st.saleOnly+'" data-act="saleonly" title="Cook what\'s on sale">On sale<span class="n">'+onSale+'</span></button>':'')
  +TAGS.filter(function(t){return counts[t]>0||t===st.tag}).map(function(t){return '<button class="chip" aria-pressed="'+(st.tag===t)+'" data-act="tag" data-a="'+t+'">'+t+'<span class="n">'+counts[t]+'</span></button>'+(t==='Friends'?friendChips:'')}).join('')+'</div>'
  +'<div class="chips" role="group" aria-label="Diet"><span class="chip-label">Diet</span>'+DIETS.map(function(d){return '<button class="chip diet" aria-pressed="'+(st.diet.indexOf(d)>-1)+'" data-act="diet" data-a="'+d+'">'+d+'</button>'}).join('')+'</div>';
}
function cardHtml(r,pos){
  return '<article class="card '+(pos===0?'top':'pos'+pos)+'" data-id="'+r.id+'"'+(pos?' aria-hidden="true"':'')+'>'+artHtml(r,'large')
  +'<span class="stamp keep">KEEP</span><span class="stamp skip">SKIP</span>'
  +'<div class="card-body"><h2>'+esc(r.name)+'</h2><div class="meta"><span>'+mealText(r)+'</span><span>'+timeText(r)+'</span><span>'+r.ings.length+' ingredients</span></div><div class="pills">'+pills(r,5)+'</div></div></article>';
}
/* The deck keeps its card elements between renders: after a swipe the cards behind move up a place with
   their scale transition and their photos stay loaded, instead of the whole stack being rebuilt (which made
   the next card jump to full size and its photo flash in). Only a card that wasn't there yet is created. */
function cardSig(r){return saleCount(r)+'|'+(photos[r.id]?'p':'')+'|'+(r.from||'')+'|'+r.name}
function syncDeck(deck,top){
  var have={};Array.prototype.forEach.call(deck.querySelectorAll('.card'),function(c){have[c.dataset.id]=c});
  var keep={};
  top.slice().reverse().forEach(function(r,ri){
    var i=top.length-1-ri,el=have[r.id];
    if(el&&el.dataset.sig!==cardSig(r)){el.remove();el=null}
    if(!el){
      var t=document.createElement('div');t.innerHTML=cardHtml(r,i);el=t.firstChild;el.dataset.sig=cardSig(r);
      if(i>0){el.style.opacity=0;requestAnimationFrame(function(){requestAnimationFrame(function(){el.style.opacity=''})})}
    }else{
      el.className='card '+(i===0?'top':'pos'+i);
      if(i)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');
      el.style.transform='';el.style.opacity='';el.style.transition='';
      el.querySelectorAll('.stamp').forEach(function(s){s.style.opacity=0});
    }
    keep[r.id]=1;deck.appendChild(el); /* back to front, so the top card paints last */
  });
  Object.keys(have).forEach(function(id){if(!keep[id])have[id].remove()});
}
function renderDiscover(){
  var list=deckList(),top=list.slice(0,3),v=$('view-discover');
  if(!v.querySelector('.d-deck'))v.innerHTML='<div class="d-filters"></div><div class="d-deck"></div><div class="d-actions"></div>';
  /* keep the chip rows where you scrolled them */
  var rows=v.querySelectorAll('.d-filters .chips'),scroll=Array.prototype.map.call(rows,function(c){return c.scrollLeft});
  v.querySelector('.d-filters').innerHTML=filtersHtml();
  v.querySelectorAll('.d-filters .chips').forEach(function(c,i){if(scroll[i])c.scrollLeft=scroll[i]});
  var dd=v.querySelector('.d-deck');
  if(!top.length){
    dd.innerHTML='<div class="deck-empty"><h2>'+(st.liked.length||st.skipped.length?'You have seen them all':'Nothing fits these filters')+'</h2><p>'+(st.skipped.length?'Bring back the ones you skipped, or loosen the meal, style or diet filters.':'Try another meal type, style or diet.')+'</p>'
      +(st.skipped.length?'<button class="btn primary" data-act="resetskipped">Bring back skipped ('+st.skipped.length+')</button>':'')
      +(st.liked.length?'<button class="btn" data-act="tab" data-a="week">Plan the week</button>':'')+'</div>';
  }else{
    if(!$('deck'))dd.innerHTML='<div class="deck" id="deck"></div>';
    syncDeck($('deck'),top);
  }
  var none=!top.length;
  v.querySelector('.d-actions').innerHTML='<div class="actions"><button class="round skip" data-act="swipe" data-a="skip" aria-label="Skip" title="Skip (left arrow)"'+(none?' disabled':'')+'>'+ico(I.skip,28,2.6)+'</button>'
  +'<button class="round small" data-act="undo" aria-label="Undo last swipe"'+(history.length?'':' disabled')+'>'+ico(I.undo,22)+'</button>'
  +'<button class="round small" data-act="info" aria-label="Open recipe"'+(none?' disabled':'')+'>'+ico(I.info,22)+'</button>'
  +'<button class="round keep" data-act="swipe" data-a="keep" aria-label="Keep" title="Keep (right arrow)"'+(none?' disabled':'')+'>'+ico(I.keep,28,2.4)+'</button></div>'
  +'<p class="status">'+list.length+' left &middot; '+st.liked.length+' kept'+(st.liked.length<2&&st.skipped.length<2?'<br>Swipe right to keep, left to skip. Tap a card for the recipe.':'')+'</p>';
}
function resetCard(c){c.style.transform='';c.querySelectorAll('.stamp').forEach(function(s){s.style.opacity=0})}
function flyOut(c,dir,dy){
  busy=true;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,id=c.dataset.id;
  c.querySelector(dir>0?'.stamp.keep':'.stamp.skip').style.opacity=1;
  c.style.transition=reduce?'none':'transform .28s ease-in,opacity .28s';
  c.style.transform='translate('+dir*(window.innerWidth+80)+'px,'+dy+'px) rotate('+dir*22+'deg)';
  c.style.opacity=0;
  /* move the cards behind up straight away, so they grow while the top card flies off */
  var deck=c.parentNode,p1=deck.querySelector('.card.pos1'),p2=deck.querySelector('.card.pos2');
  if(p1){p1.className='card top';p1.removeAttribute('aria-hidden')}
  if(p2)p2.className='card pos1';
  c.classList.remove('top');
  setTimeout(function(){decide(id,dir);busy=false},reduce?0:260);
}
function swipeTop(dir){var c=document.querySelector('.card.top');if(!c||busy)return;flyOut(c,dir,0)}
function decide(id,dir){
  st.liked=st.liked.filter(function(x){return x!==id});st.skipped=st.skipped.filter(function(x){return x!==id});
  (dir>0?st.liked:st.skipped).push(id);
  history.push({id:id,dir:dir});save();renderAll();
}
function undo(){
  var h=history.pop();if(!h)return;
  st.liked=st.liked.filter(function(x){return x!==h.id});st.skipped=st.skipped.filter(function(x){return x!==h.id});
  save();renderAll();
}
(function(){
  var vd=$('view-discover');
  vd.addEventListener('pointerdown',function(e){
    if(busy||e.button>0)return;var c=e.target.closest('.card.top');if(!c)return;
    drag={c:c,id:c.dataset.id,x:e.clientX,y:e.clientY,dx:0,dy:0,t:performance.now(),moved:false,pid:e.pointerId};
    try{c.setPointerCapture(e.pointerId)}catch(err){}
    c.classList.add('dragging');
  });
  vd.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.pid)return;
    drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
    if(Math.abs(drag.dx)>6||Math.abs(drag.dy)>6)drag.moved=true;
    drag.c.style.transform='translate('+drag.dx+'px,'+drag.dy*.4+'px) rotate('+drag.dx/18+'deg)';
    drag.c.querySelector('.stamp.keep').style.opacity=Math.max(0,Math.min(1,drag.dx/90));
    drag.c.querySelector('.stamp.skip').style.opacity=Math.max(0,Math.min(1,-drag.dx/90));
  });
  function end(e,cancel){
    if(!drag||e.pointerId!==drag.pid)return;
    var d=drag;drag=null;d.c.classList.remove('dragging');
    var dt=Math.max(1,performance.now()-d.t),speed=Math.abs(d.dx)/dt;
    if(!cancel&&!d.moved&&dt<500){resetCard(d.c);openRecipe(d.id);return}
    if(!cancel&&(Math.abs(d.dx)>110||(Math.abs(d.dx)>45&&speed>.55)))flyOut(d.c,d.dx>0?1:-1,d.dy*.4);
    else resetCard(d.c);
  }
  vd.addEventListener('pointerup',function(e){end(e,false)});
  vd.addEventListener('pointercancel',function(e){end(e,true)});
})();

/* ---------- week ---------- */
function enabledMeals(){return MEAL_ORDER.filter(function(m){return st.meals[m]})}
var clearArmed=false;
function slotHtml(d,m){
  var id=st.plan[d+'-'+m],r=id&&BYID[id];
  if(r)return '<div class="slot"><button class="slot-main" data-act="slot" data-a="'+d+'" data-b="'+m+'">'+thumb(r)+'<span class="slot-txt"><small>'+MEAL_LABEL[m]+'</small><b>'+esc(r.name)+'</b><em>'+timeText(r)+'</em></span></button>'
    +'<button class="x" data-act="unslot" data-a="'+d+'" data-b="'+m+'" aria-label="Remove '+esc(r.name)+' from '+DAYS_LONG[d]+' '+m+'">'+ico(I.skip,16,2.4)+'</button></div>';
  return '<button class="slot empty" data-act="slot" data-a="'+d+'" data-b="'+m+'"><span class="plus">+</span><span class="slot-txt"><small>'+MEAL_LABEL[m]+'</small><b>Add a recipe</b></span></button>';
}
function renderWeek(){
  var now=new Date(),today=(now.getDay()+6)%7,mon=mondayOf(now),em=enabledMeals();
  var tray=st.liked.length?'<div class="tray">'+st.liked.map(function(id){var r=BYID[id];return r?'<button class="mini" data-act="open" data-a="'+id+'">'+thumb(r)+'<b>'+esc(r.name)+'</b></button>':''}).join('')+'</div>':'<p style="margin:0;color:var(--muted)">Recipes you keep with a right swipe land here.</p>';
  var days='';
  for(var d=0;d<7;d++){
    var dt=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+d);
    days+='<section class="day'+(d===today?' today':'')+'"><header><b>'+DAYS_LONG[d]+'</b><span>'+dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+'</span>'+(d===today?'<span class="pill today">Today</span>':'')+'</header><div class="slots">'+em.map(function(m){return slotHtml(d,m)}).join('')+'</div></section>';
  }
  $('view-week').innerHTML='<div class="panel"><p class="h-label">Meals to plan</p><div class="chips wrap" style="padding-top:0">'+MEAL_ORDER.map(function(m){return '<button class="chip diet" aria-pressed="'+!!st.meals[m]+'" data-act="mealtoggle" data-a="'+m+'">'+MEAL_LABEL[m]+'</button>'}).join('')+'</div>'
    +'<div class="row" style="margin-top:12px"><button class="btn primary" data-act="fill">Fill empty slots from my matches</button><button class="btn" data-act="clearweek">'+(clearArmed?'Tap again to clear':'Clear week')+'</button></div></div>'
    +'<div class="panel"><p class="h-label">Your matches ('+st.liked.length+')</p>'+tray+'</div>'+days;
}
function openPicker(d,m){
  var cand=RECIPES.filter(function(r){return r.meals.indexOf(m)>-1&&st.diet.every(function(x){return r.diet[x]})});
  var liked=cand.filter(function(r){return st.liked.indexOf(r.id)>-1}),others=cand.filter(function(r){return st.liked.indexOf(r.id)<0});
  function row(r){return '<button class="pick" data-act="pick" data-a="'+d+'" data-b="'+m+'" data-c="'+r.id+'">'+thumb(r)+'<span class="slot-txt"><b>'+esc(r.name)+'</b><em>'+timeText(r)+' &middot; '+esc(r.tags.slice(0,2).join(', '))+'</em></span></button>'}
  sheetState={type:'picker'};
  openSheet('<h2 class="sheet-title" style="margin-top:18px">'+MEAL_LABEL[m]+' &middot; '+DAYS_LONG[d]+'</h2>'
    +(liked.length?'<div class="row" style="margin:8px 0 4px"><button class="btn" data-act="surprise" data-a="'+d+'" data-b="'+m+'">Surprise me from my matches</button></div><div class="sheet-sec"><h3>Your matches</h3>'+liked.map(row).join('')+'</div>':'<p style="color:var(--muted)">You have no kept '+m+' recipes yet. Pick any below, or swipe some first.</p>')
    +'<div class="sheet-sec"><h3>More '+m+' ideas</h3>'+(others.map(row).join('')||'<p style="color:var(--muted)">Nothing else fits your diet filters.</p>')+'</div>','Choose a recipe');
}
function fillWeek(){
  var filled=0,missing={},use={};
  Object.keys(st.plan).forEach(function(k){use[st.plan[k]]=(use[st.plan[k]]||0)+1});
  enabledMeals().forEach(function(m){
    var pool=st.liked.map(function(id){return BYID[id]}).filter(function(r){return r&&r.meals.indexOf(m)>-1});
    for(var d=0;d<7;d++){
      var key=d+'-'+m;if(st.plan[key])continue;
      if(!pool.length){missing[m]=1;continue}
      var min=Math.min.apply(null,pool.map(function(r){return use[r.id]||0}));
      var c=pool.filter(function(r){return (use[r.id]||0)===min});
      var r=c[Math.floor(Math.random()*c.length)];
      st.plan[key]=r.id;use[r.id]=(use[r.id]||0)+1;filled++;
    }
  });
  save();renderAll();
  var miss=Object.keys(missing);
  toast(filled?('Filled '+filled+(filled===1?' slot':' slots')+(miss.length?'. No kept '+miss.join(' or ')+' recipes yet.':'')):(miss.length?'Keep some '+miss.join(' or ')+' recipes first.':'Every slot is already filled.'));
}

/* ---------- shopping ---------- */
function computeList(){
  var f=st.portions/2,tot={},uses={},meals=0;
  enabledMeals().forEach(function(m){for(var d=0;d<7;d++){
    var r=BYID[st.plan[d+'-'+m]];if(!r)continue;meals++;
    r.ings.forEach(function(p){tot[p[0]]=(tot[p[0]]||0)+p[1]*f;(uses[p[0]]=uses[p[0]]||{})[r.name]=1});
  }});
  var haveSet={};st.have.forEach(function(k){haveSet[k]=1});
  var items=Object.keys(tot).map(function(k){return {key:k,name:ING[k][0],aisle:ING[k][2],qty:shopQty(k,tot[k]),uses:Object.keys(uses[k]).join(', ')}});
  items.sort(function(a,b){return AISLES.indexOf(a.aisle)-AISLES.indexOf(b.aisle)||a.name.localeCompare(b.name)});
  return {meals:meals,buy:items.filter(function(i){return !haveSet[i.key]}),home:items.filter(function(i){return haveSet[i.key]})};
}
function shopQty(k,total){
  var u=ING[k][1],v;
  if(!total)return 'some'; /* only "to taste" / "for frying" amounts */
  if(u==='g'||u==='ml'){var step=total<100?5:10;v=Math.ceil(total/step-1e-9)*step;return v>=1000?trim1(v/1000)+(u==='g'?' kg':' l'):v+' '+u}
  if(u==='tbsp'||u==='tsp'){v=Math.ceil(total*2-1e-9)/2;return frac(v)+' '+u}
  v=Math.ceil(total-1e-9);return u==='pcs'?String(v):v+' '+u;
}
function recQty(k,a){
  var u=ING[k][1],v=a*st.portions/2;
  if(!a)return 'to taste';
  if(u==='g'||u==='ml'){v=v<100?Math.round(v/5)*5:Math.round(v/10)*10;if(!v)v=5;return v>=1000?trim1(v/1000)+(u==='g'?' kg':' l'):v+' '+u}
  v=Math.round(v*4)/4;if(!v)v=.25;return frac(v)+(u==='pcs'?'':' '+u);
}
function itemRow(i,home){
  var done=!home&&st.done[i.key];
  return '<div class="item'+(done?' done':'')+'">'
  +(home?'<span></span>':'<button class="check" role="checkbox" aria-checked="'+!!done+'" aria-label="'+esc(i.name)+'" data-act="tick" data-a="'+i.key+'">'+(done?ico(I.check,16,3):'')+'</button>')
  +'<div class="item-txt"><b>'+esc(i.name)+'</b><small>'+esc(i.uses)+'</small>'+(home?'':offerLine(i.key))+'</div>'
  +'<div class="item-r"><span class="amt">'+esc(i.qty)+'</span><button class="link" data-act="'+(home?'need':'have')+'" data-a="'+i.key+'">'+(home?'Need it':'At home')+'</button></div></div>';
}
function renderShop(){
  var L=computeList(),v=$('view-shop');
  if(!L.meals){
    v.innerHTML='<div class="empty-view"><h2>Nothing planned yet</h2><p>Put recipes on the week and the ingredients show up here, merged and counted for '+ppl(st.portions)+'.</p><button class="btn primary" data-act="tab" data-a="week">Plan the week</button></div>'+offersPanel(null);return;
  }
  var ticked=L.buy.filter(function(i){return st.done[i.key]}).length,total=L.buy.length;
  var html='<div class="panel summary"><b>'+(total-ticked)+' to buy</b><p>'+L.meals+(L.meals===1?' meal':' meals')+' for '+ppl(st.portions)+' &middot; '+ticked+' of '+total+' in the basket</p><div class="bar" aria-hidden="true"><i style="width:'+(total?Math.round(ticked/total*100):0)+'%"></i></div>'
    +'<div class="row"><button class="btn" data-act="copy">Copy list</button><button class="btn" data-act="untick"'+(ticked?'':' disabled')+'>Untick all</button></div></div>'+offersPanel(L);
  AISLES.forEach(function(a){
    var its=L.buy.filter(function(i){return i.aisle===a});if(!its.length)return;
    its.sort(function(x,y){return (st.done[x.key]?1:0)-(st.done[y.key]?1:0)});
    html+='<section class="aisle"><h3 class="h-label">'+a+'</h3>'+its.map(function(i){return itemRow(i,false)}).join('')+'</section>';
  });
  if(L.home.length)html+='<details class="home"><summary>At home ('+L.home.length+')</summary>'+L.home.map(function(i){return itemRow(i,true)}).join('')+'</details>';
  v.innerHTML=html;
}
function listText(){
  var L=computeList(),lines=['Swipe Supper, week '+isoWeek(new Date())+', '+ppl(st.portions),''];
  AISLES.forEach(function(a){
    var its=L.buy.filter(function(i){return i.aisle===a&&!st.done[i.key]});if(!its.length)return;
    lines.push(a);its.forEach(function(i){lines.push('- '+i.name+': '+i.qty)});lines.push('');
  });
  return lines.join('\n').trim();
}

/* ---------- sheet + recipe ---------- */
var sheet=$('sheet'),panel=$('sheetPanel'),sheetState=null,lastFocus=null;
function openSheet(html,label){
  $('sheetBody').innerHTML=html;sheet.setAttribute('aria-label',label||'Details');
  if(!sheet.classList.contains('open')){lastFocus=document.activeElement;sheet.classList.add('open');document.body.style.overflow='hidden'}
  panel.scrollTop=0;
}
function closeSheet(){
  sheet.classList.remove('open');sheetState=null;document.body.style.overflow='';
  if(lastFocus&&lastFocus.focus){try{lastFocus.focus()}catch(e){}}
}
function openRecipe(id){
  var r=BYID[id];if(!r)return;
  var meal=r.meals.indexOf(st.mealFilter)>-1?st.mealFilter:(r.meals.filter(function(m){return st.meals[m]})[0]||r.meals[0]);
  sheetState={type:'recipe',id:id,meal:meal};
  openSheet('',r.name);paintRecipe(false);
}
function paintRecipe(keep){
  var r=BYID[sheetState.id],meal=sheetState.meal,liked=st.liked.indexOf(r.id)>-1,top=panel.scrollTop;
  var mealChips=r.meals.length>1?'<div class="chips wrap" style="padding:0 0 8px">'+r.meals.map(function(m){return '<button class="chip" aria-pressed="'+(m===meal)+'" data-act="sheetmeal" data-a="'+m+'">'+MEAL_LABEL[m]+'</button>'}).join('')+'</div>':'';
  var dayBtns=DAYS.map(function(x,i){var cur=st.plan[i+'-'+meal];return '<button class="day-btn'+(cur===r.id?' on':(cur?' busy':''))+'" data-act="setplan" data-a="'+i+'" data-b="'+meal+'" data-c="'+r.id+'" aria-label="'+DAYS_LONG[i]+' '+meal+(cur===r.id?', planned':'')+'">'+x+'</button>'}).join('');
  $('sheetBody').innerHTML='<div class="sheet-art">'+artHtml(r,'')+'</div><h2 class="sheet-title">'+esc(r.name)+'</h2>'
  +(r.mine&&r.author?'<p class="byline">by '+esc(r.author)+'</p>':'')
  +'<div class="meta"><span>'+mealText(r)+'</span><span>'+timeText(r)+'</span><span>For '+ppl(st.portions)+'</span></div><div class="pills" style="margin-top:8px">'+pills(r,8)+'</div>'
  +'<div class="row" style="margin-top:14px"><button class="btn'+(liked?'':' primary')+'" data-act="like" data-a="'+r.id+'">'+(liked?'Remove from matches':'Keep this recipe')+'</button>'
  +(r.mine?'<button class="btn" data-act="share" data-a="'+r.id+'">Share with friends</button>':'')
  +'<button class="btn" data-act="photoadd" data-a="'+r.id+'">'+(photos[r.id]?'Replace photo':'Add your photo')+'</button>'+(photos[r.id]?'<button class="btn" data-act="photodel" data-a="'+r.id+'">Remove photo</button>':'')+'</div>'
  +'<div class="sheet-sec"><h3>Put it on the week</h3>'+mealChips+'<div class="days">'+dayBtns+'</div></div>'
  +'<div class="sheet-sec"><h3>Ingredients</h3><ul class="ing">'+r.ings.map(function(p){return '<li><span>'+esc(ING[p[0]][0])+offerLine(p[0])+'</span><span>'+esc(recQty(p[0],p[1]))+'</span></li>'}).join('')+'</ul></div>'
  +'<div class="sheet-sec"><h3>Method</h3><ol class="steps">'+r.steps.map(function(s){return '<li><span>'+esc(s)+'</span></li>'}).join('')+'</ol></div>'
  +(r.mine?'<div class="row" style="margin-top:20px"><button class="btn" data-act="editrecipe" data-a="'+r.id+'">Edit this recipe</button></div><p class="note">'
    +(r.from?'Shared with you by '+esc(r.from)+'. Your copy is saved on this device, and editing it doesn\'t change theirs.':'Your own recipe.')
    +' Amounts are scaled from the servings entered to the number of people you set at the top.</p>'
    :r.online?'<p class="note">Recipe and photo from <a href="'+esc(r.link)+'" target="_blank" rel="noopener">TheMealDB</a>'+(r.source?' (<a href="'+esc(r.source)+'" target="_blank" rel="noopener">original source</a>)':'')+'. TheMealDB gives no servings, so amounts assume '+ONLINE_SERVINGS+' and are scaled to the number of people you set at the top; measures are converted to metric. Diet labels are worked out from the ingredient names, so check packaging if an allergy matters. Salt, pepper and water are not listed.</p>'
    :'<p class="note">Starter recipe written by Claude. Amounts are for 2 servings and scaled to the number of people you set at the top. Salt and pepper are not listed.</p>');
  if(keep)panel.scrollTop=top;
}

/* ---------- photos ---------- */
var photoFor=null;
function fileToJpeg(file,max,q){
  return new Promise(function(res,rej){
    var fr=new FileReader();fr.onerror=rej;
    fr.onload=function(){var im=new Image();im.onerror=rej;
      im.onload=function(){
        var sc=Math.min(1,max/Math.max(im.width,im.height)),w=Math.round(im.width*sc),h=Math.round(im.height*sc),c=document.createElement('canvas');
        c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
        var url=c.toDataURL('image/jpeg',q);
        if(url.length>190000&&max>360)fileToJpeg(file,max-160,q-.1).then(res,rej);else res(url);
      };im.src=fr.result};
    fr.readAsDataURL(file);
  });
}
function setPhoto(id,url){
  photos[id]=url;putPhoto(id,url).catch(function(){toast('Could not save the photo on this device')});
}
function delPhoto(id){
  delete photos[id];deletePhoto(id).catch(function(){});
}
$('photoInput').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!photoFor)return;var id=photoFor;
  fileToJpeg(f,720,.78).then(function(url){setPhoto(id,url);renderAll();if(sheetState&&sheetState.type==='recipe')paintRecipe(true);toast('Photo saved')}).catch(function(){toast('Could not read that image')});
});

/* ---------- my recipes ---------- */
function recipeRow(r){return '<button class="pick" data-act="open" data-a="'+r.id+'">'+thumb(r)+'<span class="slot-txt"><b>'+esc(r.name)+'</b><em>'+mealText(r)+' &middot; '+r.time+' min &middot; '+r.ings.length+' ingredients</em></span></button>'}
function renderMine(){
  var all=st.custom.map(function(c){return BYID[c.id]}).filter(Boolean).sort(function(a,b){return a.name.localeCompare(b.name)});
  var mine=all.filter(function(r){return !r.from}),byFriend={};
  all.forEach(function(r){if(r.from)(byFriend[r.from]=byFriend[r.from]||[]).push(r)});
  var friends=Object.keys(byFriend).sort(function(a,b){return a.localeCompare(b)});
  var list=mine.length?mine.map(recipeRow).join('')
    :'<p style="margin:0 0 12px;color:var(--muted)">Recipes you add here show up in the swipe deck with the others, follow the same filters and go on the shopping list.</p>';
  $('view-mine').innerHTML='<div class="panel"><p class="h-label">My recipes ('+mine.length+')</p>'+list
    +'<button class="btn primary wide" style="margin-top:10px" data-act="newrecipe">+ New recipe</button></div>'
    +'<div class="panel"><p class="h-label">From friends ('+(all.length-mine.length)+')</p>'
    +(friends.length?friends.map(function(f){return '<p class="friend-name">'+esc(f)+' &middot; '+byFriend[f].length+'</p>'+byFriend[f].map(recipeRow).join('')}).join('')
      :'<p style="margin:0 0 12px;color:var(--muted)">When a friend shares a recipe link with you, open it and it lands here, with their name on it. Open one of your recipes and tap <b>Share with friends</b> to send yours.</p>')
    +'<button class="btn" style="margin-top:10px" data-act="pastelink">Add from a link</button>'
    +'<label class="field form" style="margin-top:14px"><span>Your name, shown on recipes you share</span><input id="nameInput" maxlength="40" placeholder="e.g. Mario" value="'+esc(st.name||'')+'"></label></div>'
    +'<div class="panel"><p class="h-label">Online recipes</p><p style="margin:0 0 12px;color:var(--muted)">'
    +(onlineBusy?'Downloading recipes from TheMealDB…':ONLINE.length?ONLINE.length+' recipes with photos from <a href="https://www.themealdb.com" target="_blank" rel="noopener">TheMealDB</a>, kept on this device'+(onlineAt?' (updated '+new Date(onlineAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})+')':'')+'. '+(st.online?'They are mixed into the swipe deck.':'They are hidden from the deck.'):st.online?'Recipes with photos from TheMealDB download the first time you are online.':'Switched off.')+'</p>'
    +'<div class="row"><button class="btn" data-act="onlinetoggle">'+(st.online?'Hide from deck':'Show in deck')+'</button>'+(st.online?'<button class="btn" data-act="onlinerefresh"'+(onlineBusy?' disabled':'')+'>Update now</button>':'')+'</div></div>'
    +'<div class="panel"><p class="h-label">Backup</p><p style="margin:0 0 12px;color:var(--muted)">Everything is saved on this device only. Uninstalling the app or clearing its data deletes it, so save a backup now and then.</p>'
    +'<div class="row"><button class="btn" data-act="export">Save backup</button><button class="btn" data-act="import">Restore backup</button></div>'
    +'<p class="note" style="margin-top:10px">'+(st.lastBackup?'Last backup saved '+new Date(st.lastBackup).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'.':'No backup saved yet.')+'</p></div>';
}
function unitLabel(key){var u=ING[key][1];return u==='pcs'||u==='g'||u==='ml'||u==='tbsp'||u==='tsp'?u:'pcs'}
function ingRow(it){
  it=it||{name:'',amt:'',unit:'g',aisle:aP};
  return '<div class="ing-row"><input class="ing-name" list="ingNames" placeholder="Ingredient" aria-label="Ingredient" maxlength="60" value="'+esc(it.name)+'">'
  +'<button type="button" class="x" data-act="delingrow" aria-label="Remove ingredient">'+ico(I.skip,16,2.4)+'</button>'
  +'<input class="ing-amt" type="number" inputmode="decimal" step="any" min="0" placeholder="Amount" aria-label="Amount" value="'+esc(it.amt)+'">'
  +'<select class="ing-unit" aria-label="Unit">'+UNITS.map(function(u){return '<option'+(u[0]===it.unit?' selected':'')+'>'+u[0]+'</option>'}).join('')+'</select>'
  +'<select class="ing-aisle" aria-label="Store section">'+AISLES.map(function(a){return '<option'+(a===it.aisle?' selected':'')+'>'+esc(a)+'</option>'}).join('')+'</select></div>';
}
function fchips(group,values,on){
  return '<div class="chips wrap" style="padding:0 0 4px" role="group">'+values.map(function(v){return '<button type="button" class="chip'+(group==='diet'?' diet':'')+'" data-act="fchip" data-group="'+group+'" data-a="'+esc(v)+'" aria-pressed="'+(on.indexOf(v)>-1)+'">'+esc(MEAL_LABEL[v]||v)+'</button>'}).join('')+'</div>';
}
var delArmed=false;
function openEditor(id){
  var c=st.custom.filter(function(x){return x.id===id})[0];
  var d=c||{name:'',meals:[st.mealFilter==='all'?'dinner':st.mealFilter],time:30,servings:2,tags:[],diet:{},ings:[],steps:[]};
  var rows=(d.ings.length?d.ings:[null,null,null]).map(ingRow).join('');
  delArmed=false;
  sheetState={type:'editor',id:c?c.id:null};
  openSheet('<form id="recipeForm" class="form" novalidate><h2 class="sheet-title" style="margin-top:18px">'+(c?'Edit recipe':'New recipe')+'</h2>'
    +'<label class="field"><span>Name</span><input name="name" maxlength="80" required value="'+esc(d.name)+'"></label>'
    +'<p class="h-label">Meals</p>'+fchips('meals',MEAL_ORDER,d.meals)
    +'<div class="field-row"><label class="field"><span>Minutes</span><input name="time" type="number" inputmode="numeric" min="1" max="600" value="'+esc(d.time)+'"></label>'
    +'<label class="field"><span>Servings the amounts are for</span><input name="servings" type="number" inputmode="numeric" min="1" max="12" value="'+esc(d.servings)+'"></label></div>'
    +'<p class="h-label">Style</p>'+fchips('tags',STYLE_TAGS,d.tags)
    +'<p class="h-label">Diet</p>'+fchips('diet',DIETS,DIETS.filter(function(x){return d.diet[x]}))
    +'<p class="note" style="margin:0 0 12px">Tick the diets this recipe fits. Ingredients the app knows (like butter or chicken) still rule a diet out.</p>'
    +'<p class="h-label">Ingredients</p><div id="ingRows">'+rows+'</div>'
    +'<button type="button" class="btn" data-act="addingrow" style="margin-top:8px">+ Add ingredient</button>'
    +'<datalist id="ingNames">'+Object.keys(ING).filter(function(k){return k.indexOf(':')<0}).map(function(k){return '<option value="'+esc(ING[k][0])+'">'}).join('')+'</datalist>'
    +'<label class="field" style="margin-top:16px"><span>Method, one step per line</span><textarea name="steps" rows="6">'+esc(d.steps.join('\n'))+'</textarea></label>'
    +'<div class="row" style="margin-top:16px"><button type="submit" class="btn primary">Save recipe</button><button type="button" class="btn" data-act="close">Cancel</button>'
    +(c?'<button type="button" class="btn" data-act="delrecipe" data-a="'+c.id+'">Delete</button>':'')+'</div></form>',c?'Edit recipe':'New recipe');
}
function readEditor(f){
  function on(g){return Array.prototype.map.call(f.querySelectorAll('[data-group="'+g+'"][aria-pressed="true"]'),function(b){return b.dataset.a})}
  var ings=[],bad=0;
  f.querySelectorAll('.ing-row').forEach(function(row){
    var name=row.querySelector('.ing-name').value.trim(),amt=parseFloat(String(row.querySelector('.ing-amt').value).replace(',','.'));
    if(!name)return;
    if(!(amt>0)){bad++;return}
    ings.push({name:name,amt:amt,unit:row.querySelector('.ing-unit').value,aisle:row.querySelector('.ing-aisle').value});
  });
  var diet={};on('diet').forEach(function(x){diet[x]=true});
  return {name:f.elements.name.value.trim(),meals:on('meals'),time:Math.max(1,Math.min(600,parseInt(f.elements.time.value,10)||30)),servings:Math.max(1,Math.min(12,parseInt(f.elements.servings.value,10)||2)),
    tags:on('tags'),diet:diet,ings:ings,steps:f.elements.steps.value.split('\n').map(function(s){return s.trim()}).filter(Boolean),bad:bad};
}
function saveEditor(f){
  var d=readEditor(f);
  if(!d.name){toast('Give the recipe a name');f.elements.name.focus();return}
  if(d.bad){toast('Give every ingredient an amount');return}
  if(!d.ings.length){toast('Add at least one ingredient');return}
  if(!d.meals.length)d.meals=['dinner'];
  delete d.bad;
  d.id=sheetState.id||('u-'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36));
  var i=st.custom.map(function(x){return x.id}).indexOf(d.id);
  if(i>-1){if(st.custom[i].from){d.from=st.custom[i].from;d.origin=st.custom[i].origin}st.custom[i]=d} /* a friend's recipe stays theirs */
  else st.custom.push(d);
  save();rebuildRecipes();renderAll();
  var r=BYID[d.id],lost=DIETS.filter(function(x){return d.diet[x]&&!r.diet[x]});
  openRecipe(d.id);
  toast(lost.length?'Saved. Not '+lost.join(', ')+' because of an ingredient':'Recipe saved');
}
function deleteRecipe(id){
  st.custom=st.custom.filter(function(x){return x.id!==id});
  st.liked=st.liked.filter(function(x){return x!==id});st.skipped=st.skipped.filter(function(x){return x!==id});
  Object.keys(st.plan).forEach(function(k){if(st.plan[k]===id)delete st.plan[k]});
  delPhoto(id);save();rebuildRecipes();closeSheet();renderAll();toast('Recipe deleted');
}
document.addEventListener('submit',function(e){if(e.target.id==='recipeForm'){e.preventDefault();saveEditor(e.target)}});
document.addEventListener('change',function(e){
  /* Picking a known ingredient sets its unit and store section, so it merges with the built-in recipes on the list. */
  if(!e.target.classList.contains('ing-name'))return;
  var k=KNOWN[slug(e.target.value)];if(!k)return;
  var row=e.target.closest('.ing-row');row.querySelector('.ing-unit').value=unitLabel(k);row.querySelector('.ing-aisle').value=ING[k][2];
});

/* ---------- backup ---------- */
var pendingRestore=null;
function exportBackup(){
  saveBackup({app:BACKUP_APP,v:1,exported:new Date().toISOString(),state:st,photos:photos}).then(function(how){
    st.lastBackup=Date.now();save();renderMine();toast(how==='shared'?'Backup ready to save':'Backup downloaded');
  }).catch(function(){toast('Backup not saved')});
}
$('backupInput').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  f.text().then(function(text){
    pendingRestore=readBackup(text);
    var s=normalise(pendingRestore.state),when=pendingRestore.exported?new Date(pendingRestore.exported).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'an unknown date';
    sheetState={type:'restore'};
    openSheet('<h2 class="sheet-title" style="margin-top:18px">Restore this backup?</h2><p>Saved '+esc(when)+': '+s.custom.length+' own recipes, '+Object.keys(s.plan).length+' planned meals, '+Object.keys(pendingRestore.photos||{}).length+' photos.</p>'
      +'<p style="color:var(--muted)">This replaces everything currently saved in the app on this device.</p><div class="row" style="margin-top:14px"><button class="btn primary" data-act="restore">Replace with backup</button><button class="btn" data-act="close">Cancel</button></div>','Restore backup');
  }).catch(function(err){toast(err&&err.message||'Could not read that file')});
});
function restoreBackup(){
  var d=pendingRestore;pendingRestore=null;if(!d)return;
  st=normalise(d.state);save();
  photos=Object.assign({},d.photos||{});
  clearPhotos().then(function(){return Promise.all(Object.keys(photos).map(function(id){return putPhoto(id,photos[id])}))}).catch(function(){toast('Some photos could not be restored')});
  history=[];rebuildRecipes();closeSheet();renderAll();toast('Backup restored');
}

/* ---------- stores & offers ---------- */
function offerAt(o,s){return o.storeId?o.storeId===s.id:o.chain===s.chain}
function storeLabel(o){
  if(!o.storeId)return o.chain;
  var s=st.stores.filter(function(x){return x.id===o.storeId})[0];
  return s?s.name:(o.storeName||o.chain);
}
/* Offers that count: still valid today, and at one of your stores (any store until you've picked some). */
function liveOffers(){
  var today=todayISO();
  return st.offers.filter(function(o){return isActive(o,today)&&(!st.stores.length||st.stores.some(function(s){return offerAt(o,s)}))});
}
function ingNames(k){return [ING[k][0]]}
/* The ingredient an offer is for: the one you linked, or worked out from the product name. */
function offerItem(o){
  if(o.item)return o.item;
  var c=o.id+'|'+o.product;
  if(itemCache[c]===undefined)itemCache[c]=matchItem(o.product,Object.keys(ING),ingNames);
  return itemCache[c];
}
/* ingredient key -> live offers, cheapest first. Recomputed on every render. */
function computeSale(){
  var by={};
  liveOffers().forEach(function(o){var k=offerItem(o);if(k&&ING[k])(by[k]=by[k]||[]).push(o)});
  Object.keys(by).forEach(function(k){by[k].sort(function(a,b){return a.price-b.price})});
  saleBy=by;
}
function saleCount(r){var n=0;r.ings.forEach(function(p){if(saleBy[p[0]])n++});return n}
function offerText(o){
  var dates=o.validFrom&&o.validFrom!==o.validTo?shortDate(o.validFrom)+'–'+shortDate(o.validTo):shortDate(o.validTo);
  return 'On offer at '+storeLabel(o)+' until '+shortDate(o.validTo)+' · valid '+dates+' · '+kr(o.price)
    +(o.unitPrice?' ('+kr(o.unitPrice)+'/'+o.unitPriceUnit+')':'')+(o.memberOnly?' · Member price':'');
}
function offerLine(key){
  var os=saleBy[key];if(!os)return '';
  return '<small class="offer'+(os[0].memberOnly?' member':'')+'">'+esc(offerText(os[0]))+(os.length>1?' · +'+(os.length-1)+' more':'')+'</small>';
}
/* Which of your stores suits this list best. Only offers are known, not regular prices, so this ranks stores
   by how much the offers save (when you entered the regular price) and then by how many list items are on offer. */
function bestStores(L){
  var stores=st.stores.length?st.stores:CHAINS.map(function(c){return {id:'chain:'+c,chain:c,name:c}});
  return stores.map(function(s){
    var n=0,save=0;
    L.buy.forEach(function(i){
      var o=(saleBy[i.key]||[]).filter(function(x){return offerAt(x,s)})[0];
      if(o){n++;if(o.regularPrice>o.price)save+=o.regularPrice-o.price}
    });
    return {store:s,n:n,save:save};
  }).filter(function(x){return x.n}).sort(function(a,b){return b.save-a.save||b.n-a.n});
}
function offersPanel(L){
  var live=liveOffers(),best=L?bestStores(L):[],h='<div class="panel"><p class="h-label">Offers</p>';
  if(best.length){
    var b=best[0];
    h+='<p class="best"><b>Best for this list: '+esc(b.store.name)+'</b><br>'+b.n+(b.n===1?' item':' items')+' on offer'+(b.save?' · save about '+kr(b.save):'')+'</p>'
      +(best.length>1?'<p class="note" style="margin:4px 0 0">Next: '+best.slice(1,3).map(function(x){return esc(x.store.name)+' ('+x.n+(x.save?', save '+kr(x.save):'')+')'}).join(', ')+'</p>':'')
      +'<p class="note" style="margin:6px 0 12px">Based on the offers you have. Regular prices aren\'t known, so items without an offer aren\'t compared.</p>';
  }else{
    h+='<p class="muted-p">'+(!st.stores.length?'Pick your stores once, then add offers you spot in the flyer or the store\'s app. They show up next to the items they match.'
      :live.length?'None of your current offers match this list.':'No current offers. Add the ones you spot in the flyer or the store\'s app.')+'</p>';
  }
  return h+'<div class="row"><button class="btn primary" data-act="offeradd">Add offer</button><button class="btn" data-act="offers">Offers ('+live.length+')</button>'
    +'<button class="btn" data-act="stores">'+(st.stores.length?'My stores ('+st.stores.length+')':'Choose stores')+'</button></div></div>';
}

/* stores sheet */
var storeResults=null,storeBusy=false,storeWhere='';
function storeRow(s,chosen){
  return '<div class="pick store-row"><span class="chain-dot" aria-hidden="true">'+esc(s.chain==='City Gross'?'CG':s.chain.slice(0,2))+'</span><span class="slot-txt"><b>'+esc(s.name)+'</b><em>'+esc(s.address||s.chain)+(!chosen&&s.dist!=null?' · '+s.dist.toFixed(1)+' km':'')+'</em></span>'
    +'<button class="btn" data-act="'+(chosen?'storedel':'storeadd')+'" data-a="'+esc(s.id)+'">'+(chosen?'Remove':'Add')+'</button></div>';
}
function paintStores(keep){
  var top=panel.scrollTop;
  var found=storeResults?storeResults.filter(function(s){return !st.stores.some(function(c){return c.id===s.id})}).slice(0,40):[];
  sheetState={type:'stores'};
  openSheet('<h2 class="sheet-title" style="margin-top:18px">My stores</h2><p style="color:var(--muted)">Pick the stores you shop at. You only need to do this once; offers are matched to these.</p>'
    +(st.stores.length?'<div class="sheet-sec"><h3>Chosen ('+st.stores.length+')</h3>'+st.stores.map(function(s){return storeRow(s,true)}).join('')+'</div>':'')
    +'<form id="storeForm" class="form sheet-sec" novalidate><h3>Find stores near you</h3><div class="field-row"><label class="field"><span>Postcode</span><input name="pc" inputmode="numeric" maxlength="6" placeholder="123 45" value="'+esc(st.postcode||'')+'"></label>'
    +'<div class="field" style="align-self:end"><button type="submit" class="btn primary"'+(storeBusy?' disabled':'')+'>Search</button></div></div>'
    +'<button type="button" class="btn" data-act="storeslocate" style="margin-top:10px"'+(storeBusy?' disabled':'')+'>Use my location instead</button></form>'
    +(storeBusy?'<p style="color:var(--muted)">Searching…</p>':storeResults?'<div class="sheet-sec"><h3>Near '+esc(storeWhere)+'</h3>'+(found.map(function(s){return storeRow(s,false)}).join('')||'<p style="color:var(--muted)">No other ICA, Willys, Lidl, Coop, Hemköp or City Gross stores found nearby.</p>')+'</div>':'')
    +'<p class="note">Store locations © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. A missing store may just not be mapped yet.</p>','My stores');
  if(keep)panel.scrollTop=top;
}
function findStores(where){
  storeBusy=true;paintStores(true);
  where.then(function(p){storeWhere=p.label;return storesNear(p.lat,p.lon,5).then(function(r){return r.length>=3?r:storesNear(p.lat,p.lon,15)})})
    .then(function(r){storeResults=r;storeBusy=false;if(sheetState&&sheetState.type==='stores')paintStores(true)})
    .catch(function(e){storeBusy=false;toast(e&&e.message||'Store search failed');if(sheetState&&sheetState.type==='stores')paintStores(true)});
}

/* offers sheet */
var offerDelArmed=null;
function paintOffers(keep){
  var top=panel.scrollTop,today=todayISO();
  var list=st.offers.slice().sort(function(a,b){return (isActive(b,today)?1:0)-(isActive(a,today)?1:0)||String(a.validTo).localeCompare(String(b.validTo))});
  sheetState={type:'offers'};
  openSheet('<h2 class="sheet-title" style="margin-top:18px">Offers</h2><div class="row" style="margin:8px 0 4px"><button class="btn primary" data-act="offeradd">Add offer</button></div>'
    +(list.length?list.map(function(o){
      var on=isActive(o,today),k=offerItem(o),past=o.validTo&&o.validTo<today;
      return '<div class="offer-row'+(on?'':' off')+'"><div class="slot-txt"><b>'+esc(o.product)+'</b><em>'+esc(storeLabel(o))+' · '+kr(o.price)+(o.unitPrice?' ('+kr(o.unitPrice)+'/'+esc(o.unitPriceUnit)+')':'')+(o.regularPrice?' · ord. '+kr(o.regularPrice):'')+'</em>'
        +'<em>'+(past?'Ended ':on?'Valid ':'Starts ')+esc(o.validFrom&&!past?shortDate(o.validFrom)+'–':'')+esc(shortDate(o.validTo))+(o.memberOnly?' · <span class="member-tag">Member price</span>':'')+(k&&ING[k]?' · for '+esc(ING[k][0]):' · not matched to an item')+'</em></div>'
        +'<button class="btn" data-act="offerdel" data-a="'+esc(o.id)+'">'+(offerDelArmed===o.id?'Sure?':'Delete')+'</button></div>';
    }).join(''):'<p style="color:var(--muted)">No offers yet.</p>')
    +'<p class="note">Offers you add are saved on this device. Ones that ended over a month ago are removed automatically.</p>','Offers');
  if(keep)panel.scrollTop=top;
}
function openOfferForm(){
  var L=computeList(),listKeys=L.buy.concat(L.home).map(function(i){return i.key});
  var other=Object.keys(ING).filter(function(k){return k.indexOf(':')<0&&listKeys.indexOf(k)<0}).sort(function(a,b){return ING[a][0].localeCompare(ING[b][0])});
  var stores=st.stores.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');
  var chains=(st.stores.length?CHAINS.filter(function(c){return st.stores.some(function(s){return s.chain===c})}):CHAINS).map(function(c){return '<option value="chain:'+esc(c)+'">Every '+esc(c)+' store</option>'}).join('');
  sheetState={type:'offerform'};
  openSheet('<form id="offerForm" class="form" novalidate><h2 class="sheet-title" style="margin-top:18px">Add offer</h2>'
    +'<label class="field"><span>Store</span><select name="store">'+stores+chains+'</select></label>'
    +'<label class="field"><span>Product, as in the flyer</span><input name="product" id="offerProduct" maxlength="80" placeholder="Kycklingfilé 900 g"></label>'
    +'<label class="field"><span>For this item on your list</span><select name="foritem" id="offerItem"><option value="">Work it out from the product name</option>'
    +(listKeys.length?'<optgroup label="On your shopping list">'+listKeys.map(function(k){return '<option value="'+esc(k)+'">'+esc(ING[k][0])+'</option>'}).join('')+'</optgroup>':'')
    +'<optgroup label="Other ingredients">'+other.map(function(k){return '<option value="'+esc(k)+'">'+esc(ING[k][0])+'</option>'}).join('')+'</optgroup></select></label>'
    +'<div class="field-row"><label class="field"><span>Offer price (kr)</span><input name="price" type="number" inputmode="decimal" step="0.01" min="0"></label>'
    +'<label class="field"><span>Regular price (optional)</span><input name="regular" type="number" inputmode="decimal" step="0.01" min="0"></label></div>'
    +'<div class="field-row"><label class="field"><span>Unit price (kr, optional)</span><input name="unit" type="number" inputmode="decimal" step="0.01" min="0"></label>'
    +'<label class="field"><span>per</span><select name="per"><option value="kg">kg</option><option value="l">litre</option><option value="st">piece</option></select></label></div>'
    +'<div class="field-row"><label class="field"><span>Valid from</span><input name="from" type="date" value="'+todayISO()+'"></label><label class="field"><span>Valid to</span><input name="to" type="date" value="'+thisSunday()+'"></label></div>'
    +'<label class="check-row"><input type="checkbox" name="member"> Member price (ICA Stammis, Willys Plus, Coop medlem, Lidl Plus, Hemköp or City Gross Klubb)</label>'
    +'<div class="row" style="margin-top:16px"><button type="submit" class="btn primary">Save offer</button><button type="button" class="btn" data-act="offers">Cancel</button></div></form>','Add offer');
}
function saveOfferForm(f){
  var E=f.elements,num=function(x){var v=parseFloat(String(x.value).replace(',','.'));return v>0?v:null};
  var product=E.product.value.trim(),price=num(E.price),store=E.store.value,from=E.from.value,to=E.to.value;
  if(!product){toast('Write the product name');E.product.focus();return}
  if(!price){toast('Enter the offer price');E.price.focus();return}
  if(!to){toast('Enter the last day of the offer');return}
  if(from&&from>to){toast('The offer ends before it starts');return}
  var s=store.indexOf('chain:')===0?null:st.stores.filter(function(x){return x.id===store})[0];
  st.offers.push({id:'o-'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),chain:s?s.chain:store.slice(6),storeId:s?s.id:'',storeName:s?s.name:'',
    product:product,price:price,unitPrice:num(E.unit),unitPriceUnit:E.per.value,regularPrice:num(E.regular),validFrom:from||'',validTo:to,memberOnly:E.member.checked,item:E.foritem.value,source:'manual'});
  save();renderAll();paintOffers();toast('Offer saved');
}
document.addEventListener('submit',function(e){
  if(e.target.id==='offerForm'){e.preventDefault();saveOfferForm(e.target)}
  else if(e.target.id==='storeForm'){
    e.preventDefault();var pc=e.target.elements.pc.value.trim();st.postcode=pc;save();
    findStores(geocodePostcode(pc));
  }
});
document.addEventListener('input',function(e){
  /* Suggest the list item from the product name as you type, unless you picked one yourself. */
  if(e.target.id!=='offerProduct')return;
  var sel=$('offerItem');if(!sel||sel.dataset.manual)return;
  var keys=Array.prototype.map.call(sel.options,function(o){return o.value}).filter(Boolean);
  sel.value=matchItem(e.target.value,keys,ingNames)||'';
});
document.addEventListener('change',function(e){if(e.target.id==='offerItem')e.target.dataset.manual='1'});

/* ---------- sharing with friends ---------- */
var pendingShare=null,pendingImport=null;
function askName(then){
  pendingShare=then;sheetState={type:'name'};
  openSheet('<form id="nameForm" class="form" novalidate><h2 class="sheet-title" style="margin-top:18px">What\'s your name?</h2><p style="color:var(--muted)">Friends see it on the recipes you share with them.</p>'
    +'<label class="field"><span>Your name</span><input name="name" maxlength="40" placeholder="e.g. Mario" value="'+esc(st.name||'')+'"></label>'
    +'<div class="row" style="margin-top:16px"><button type="submit" class="btn primary">Continue</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>','Your name');
  setTimeout(function(){var i=document.querySelector('#nameForm input');if(i)i.focus()},50);
}
function shareRecipe(id){
  var c=st.custom.filter(function(x){return x.id===id})[0];if(!c)return;
  if(!c.from&&!st.name){askName(function(){shareRecipe(id)});return}
  packRecipe(c,st.name).then(function(p){
    var who=c.from||st.name;
    return shareLink(c.name,(c.from?who+'\'s recipe for ':who+' shared a recipe: ')+c.name+'. Open the link to add it to Swipe Supper:',shareUrl(p));
  }).then(function(how){if(how==='copied')toast('Link copied. Paste it to your friend')}).catch(function(e){if(e&&e.name!=='AbortError'&&!/cancel/i.test(e.message||''))toast('Could not share the recipe')});
}
/* A link from a friend: show what it is and let you add it (or update your copy if you have it already). */
function showImport(packed){
  unpackRecipe(packed).then(function(r){
    pendingImport={packed:packed,recipe:r};
    var have=st.custom.filter(function(c){return c.origin&&c.origin===r.origin})[0];
    sheetState={type:'import'};
    openSheet('<h2 class="sheet-title" style="margin-top:18px">'+esc(r.name)+'</h2><p class="byline">by '+esc(r.from)+'</p>'
      +'<p style="color:var(--muted)">'+(r.meals.map(function(m){return MEAL_LABEL[m]}).join(' / ')||'Dinner')+' &middot; '+r.time+' min &middot; '+r.ings.length+' ingredients &middot; for '+r.servings+'</p>'
      +'<ul class="ing">'+r.ings.slice(0,8).map(function(it){return '<li><span>'+esc(it.name)+'</span><span>'+esc(trim1(it.amt)+' '+it.unit)+'</span></li>'}).join('')+(r.ings.length>8?'<li><span>and '+(r.ings.length-8)+' more</span><span></span></li>':'')+'</ul>'
      +'<div class="row" style="margin-top:16px"><button class="btn primary" data-act="importadd">'+(have?'Update my copy':'Add to my recipes')+'</button><button class="btn" data-act="close">Not now</button></div>'
      +(isAndroidBrowser()?'<p class="note">Using the Swipe Supper app? <a href="'+esc(appIntentUrl(packed))+'">Open this recipe in the app</a> instead, so it\'s saved there.</p>':'')
      +'<p class="note">Recipes from links are saved on this device only. Photos aren\'t included in links.</p>','Recipe from a friend');
  }).catch(function(e){toast(e&&e.message||'That link doesn\'t contain a recipe')});
}
function importRecipe(){
  var p=pendingImport;pendingImport=null;if(!p)return;
  var r=p.recipe,i=st.custom.map(function(c){return c.origin||''}).indexOf(r.origin),id;
  if(i>-1){id=st.custom[i].id;r.id=id;st.custom[i]=r}
  else{id='u-'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);r.id=id;st.custom.push(r)}
  save();rebuildRecipes();renderAll();openRecipe(id);toast(i>-1?'Updated '+r.name:'Added '+r.name+' from '+r.from);
}
function openPasteLink(){
  sheetState={type:'paste'};
  openSheet('<form id="pasteForm" class="form" novalidate><h2 class="sheet-title" style="margin-top:18px">Add from a link</h2><p style="color:var(--muted)">Paste the recipe link (or the whole message) a friend sent you.</p>'
    +'<label class="field"><span>Link</span><textarea name="link" rows="4" placeholder="https://mlohajner-hub.github.io/swipe-supper/#r=…"></textarea></label>'
    +'<div class="row" style="margin-top:16px"><button type="submit" class="btn primary">Show recipe</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>','Add from a link');
}
document.addEventListener('submit',function(e){
  if(e.target.id==='nameForm'){
    e.preventDefault();var n=e.target.elements.name.value.trim();if(!n){toast('Write your name');return}
    st.name=n;save();rebuildRecipes();renderAll();var then=pendingShare;pendingShare=null;closeSheet();if(then)then();
  }else if(e.target.id==='pasteForm'){
    e.preventDefault();var p=findPacked(e.target.elements.link.value);
    if(p)showImport(p);else toast('That isn\'t a Swipe Supper recipe link');
  }
});
document.addEventListener('change',function(e){
  if(e.target.id==='nameInput'){st.name=e.target.value.trim().slice(0,40);save();rebuildRecipes();renderAll();toast(st.name?'Name saved':'Name removed')}
});

/* ---------- render all ---------- */
function renderHeader(){
  $('pLabel').textContent=ppl(st.portions);$('pMinus').disabled=st.portions<=1;$('pPlus').disabled=st.portions>=5;
  $('weekLabel').textContent='Week '+isoWeek(new Date());
}
function renderTabs(){
  var planned=0;enabledMeals().forEach(function(m){for(var d=0;d<7;d++)if(BYID[st.plan[d+'-'+m]])planned++});
  var L=computeList(),left=L.buy.filter(function(i){return !st.done[i.key]}).length;
  var bw=$('badgeWeek'),bs=$('badgeShop');
  bw.hidden=!planned;bw.textContent=planned;bs.hidden=!left;bs.textContent=left;
}
function renderAll(){
  var ae=document.activeElement,sel=null;
  if(ae&&ae.dataset&&ae.dataset.act&&!sheet.contains(ae))sel='[data-act="'+ae.dataset.act+'"]'+(ae.dataset.a!==undefined?'[data-a="'+ae.dataset.a+'"]':'')+(ae.dataset.b!==undefined?'[data-b="'+ae.dataset.b+'"]':'');
  computeSale();renderHeader();renderDiscover();renderWeek();renderShop();renderMine();renderTabs();
  if(sel){try{var el=document.querySelector('main '+sel+':not(:disabled)')||document.querySelector(sel+':not(:disabled)');if(el)el.focus({preventScroll:true})}catch(e){}}
}
var tab='discover';
function setTab(t){
  tab=t;['discover','week','shop','mine'].forEach(function(n){$('view-'+n).hidden=n!==t});
  document.querySelectorAll('.tabs button').forEach(function(b){b.setAttribute('aria-current',b.dataset.a===t?'page':'false')});
  window.scrollTo(0,0);
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.dataset.act,a=t.dataset.a,b=t.dataset.b,c=t.dataset.c,i;
  switch(act){
    case 'tab':closeSheet();setTab(a);break;
    case 'portions':st.portions=Math.max(1,Math.min(5,st.portions+(+a)));save();renderAll();if(sheetState&&sheetState.type==='recipe')paintRecipe(true);break;
    case 'mealfilter':st.mealFilter=a;save();renderAll();break;
    case 'tag':st.tag=a;save();renderAll();break;
    case 'diet':i=st.diet.indexOf(a);if(i>-1)st.diet.splice(i,1);else st.diet.push(a);save();renderAll();break;
    case 'swipe':swipeTop(a==='keep'?1:-1);break;
    case 'undo':undo();break;
    case 'info':var tc=document.querySelector('.card.top');if(tc)openRecipe(tc.dataset.id);break;
    case 'resetskipped':st.skipped=[];save();renderAll();break;
    case 'open':openRecipe(a);break;
    case 'close':closeSheet();break;
    case 'like':
      if(st.liked.indexOf(a)>-1)st.liked=st.liked.filter(function(x){return x!==a});
      else{st.liked.push(a);st.skipped=st.skipped.filter(function(x){return x!==a})}
      save();renderAll();paintRecipe(true);break;
    case 'sheetmeal':sheetState.meal=a;paintRecipe(true);break;
    case 'setplan':
      var k=a+'-'+b;
      if(st.plan[k]===c){delete st.plan[k];toast('Removed from '+DAYS_LONG[+a])}
      else{st.plan[k]=c;st.meals[b]=true;if(st.liked.indexOf(c)<0)st.liked.push(c);st.skipped=st.skipped.filter(function(x){return x!==c});toast('Planned for '+DAYS_LONG[+a]+' '+b)}
      save();renderAll();paintRecipe(true);break;
    case 'slot':openPicker(+a,b);break;
    case 'unslot':delete st.plan[a+'-'+b];save();renderAll();break;
    case 'pick':
      st.plan[a+'-'+b]=c;if(st.liked.indexOf(c)<0)st.liked.push(c);st.skipped=st.skipped.filter(function(x){return x!==c});
      save();closeSheet();renderAll();toast('Added to '+DAYS_LONG[+a]);break;
    case 'surprise':
      var pool=st.liked.map(function(id){return BYID[id]}).filter(function(r){return r&&r.meals.indexOf(b)>-1});
      if(pool.length){var used={};Object.keys(st.plan).forEach(function(q){used[st.plan[q]]=1});var fresh=pool.filter(function(r){return !used[r.id]});var from=fresh.length?fresh:pool;var r=from[Math.floor(Math.random()*from.length)];
        st.plan[a+'-'+b]=r.id;save();closeSheet();renderAll();toast(r.name)}
      break;
    case 'mealtoggle':
      st.meals[a]=!st.meals[a];if(!enabledMeals().length)st.meals[a]=true;save();renderAll();break;
    case 'fill':fillWeek();break;
    case 'clearweek':
      if(!clearArmed){clearArmed=true;renderWeek();setTimeout(function(){if(clearArmed){clearArmed=false;renderWeek()}},3500)}
      else{clearArmed=false;st.plan={};save();renderAll();toast('Week cleared')}
      break;
    case 'tick':if(st.done[a])delete st.done[a];else st.done[a]=true;save();renderAll();break;
    case 'untick':st.done={};save();renderAll();break;
    case 'have':if(st.have.indexOf(a)<0)st.have.push(a);save();renderAll();toast('Moved to At home');break;
    case 'need':st.have=st.have.filter(function(x){return x!==a});save();renderAll();toast('Back on the list');break;
    case 'copy':
      var text=listText();
      var fallback=function(){sheetState={type:'copy'};openSheet('<h2 class="sheet-title" style="margin-top:18px">Shopping list</h2><p style="color:var(--muted)">Select all and copy.</p><textarea class="copybox" id="copybox" readonly></textarea>','Shopping list');var tb=$('copybox');tb.value=text;tb.focus();tb.select()};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){toast('List copied')},fallback)}else fallback();
      break;
    case 'photoadd':photoFor=a;$('photoInput').click();break;
    case 'photodel':delPhoto(a);renderAll();paintRecipe(true);toast('Photo removed');break;
    case 'newrecipe':openEditor(null);break;
    case 'editrecipe':openEditor(a);break;
    case 'fchip':t.setAttribute('aria-pressed',t.getAttribute('aria-pressed')!=='true');break;
    case 'addingrow':
      $('ingRows').insertAdjacentHTML('beforeend',ingRow());
      var rows=$('ingRows').querySelectorAll('.ing-name');rows[rows.length-1].focus();break;
    case 'delingrow':
      var row=t.closest('.ing-row');
      if($('ingRows').children.length>1)row.remove();else row.querySelectorAll('input').forEach(function(x){x.value=''});
      break;
    case 'delrecipe':
      if(!delArmed){delArmed=true;t.textContent='Tap again to delete';setTimeout(function(){if(delArmed&&t.isConnected){delArmed=false;t.textContent='Delete'}},3500)}
      else{delArmed=false;deleteRecipe(a)}
      break;
    case 'export':exportBackup();break;
    case 'import':$('backupInput').click();break;
    case 'restore':restoreBackup();break;
    case 'onlinetoggle':st.online=!st.online;save();rebuildRecipes();renderAll();if(st.online)refreshOnline(false);break;
    case 'onlinerefresh':refreshOnline(true);break;
    case 'saleonly':st.saleOnly=!st.saleOnly;save();renderAll();break;
    case 'share':shareRecipe(a);break;
    case 'importadd':importRecipe();break;
    case 'pastelink':openPasteLink();break;
    case 'stores':paintStores();break;
    case 'storeslocate':findStores(currentPosition());break;
    case 'storeadd':
      var sf=(storeResults||[]).filter(function(s){return s.id===a})[0];
      if(sf&&!st.stores.some(function(s){return s.id===a})){st.stores.push({id:sf.id,chain:sf.chain,name:sf.name,address:sf.address,lat:sf.lat,lon:sf.lon});save();renderAll();paintStores(true)}
      break;
    case 'storedel':st.stores=st.stores.filter(function(s){return s.id!==a});save();renderAll();paintStores(true);break;
    case 'offers':offerDelArmed=null;paintOffers();break;
    case 'offeradd':openOfferForm();break;
    case 'offerdel':
      if(offerDelArmed!==a){offerDelArmed=a;paintOffers(true)}
      else{offerDelArmed=null;st.offers=st.offers.filter(function(o){return o.id!==a});save();renderAll();paintOffers(true);toast('Offer deleted')}
      break;
  }
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&sheet.classList.contains('open')){closeSheet();return}
  if(sheet.classList.contains('open')||tab!=='discover')return;
  var tg=e.target&&e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
  if(e.key==='ArrowRight'){e.preventDefault();swipeTop(1)}
  else if(e.key==='ArrowLeft'){e.preventDefault();swipeTop(-1)}
});

renderAll();
loadPhotos().then(function(p){
  photos=Object.assign(p,photos);
  if(Object.keys(photos).length){renderAll();if(sheetState&&sheetState.type==='recipe')paintRecipe(true)}
});
/* Online recipes: show the copy kept on this device straight away, then fetch if there is none or it's a week old. */
getCached('mealdb').then(function(d){
  if(d&&Array.isArray(d.meals)&&d.meals.length){setOnline(d.meals,d.at);renderAll();if(sheetState&&sheetState.type==='recipe')paintRecipe(true)}
  refreshOnline(false);
});
window.addEventListener('online',function(){refreshOnline(false)});
/* Recipe links from friends: opened in the browser (#r=…), or handed to the Android app (swipesupper://import?r=…). */
function checkLinkInUrl(){
  var p=findPacked(location.hash)||findPacked(location.search);
  if(!p)return;
  /* Drop the recipe from the address bar (after the hash navigation settles) so a reload doesn't ask again. */
  setTimeout(function(){try{window.history.replaceState(null,'',location.pathname)}catch(e){}},0);
  setTab('mine');showImport(p);
}
checkLinkInUrl();
window.addEventListener('hashchange',checkLinkInUrl);
onAppLink(function(p){setTab('mine');showImport(p)}).catch(function(){});
/* Ask the browser not to evict our data under storage pressure (installed PWAs usually get this). */
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}
/* Offline support for the web/PWA version. The Android app ships its files inside the APK and doesn't need it. */
if(!Capacitor.isNativePlatform())import('virtual:pwa-register').then(function(m){m.registerSW({immediate:true})}).catch(function(){});
