/* Sharing your own recipes with friends by link, no accounts and no server: the whole recipe travels inside
   the link (compressed), e.g. https://mlohajner-hub.github.io/swipe-supper/#r=z…  Opening it shows "Add this
   recipe?" in the web app, and from there the Android app can be opened with the same recipe
   (swipesupper://import?r=…). Photos don't fit in a link and stay on your phone. */
import {Capacitor} from '@capacitor/core';
import {UNITS,AISLES,DIETS,MEAL_ORDER} from './data.js';

export const WEB_URL='https://mlohajner-hub.github.io/swipe-supper/';
const APP_ID='se.swipesupper.app';

function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out}
async function pipe(bytes,stream){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())}

/* Own recipe (st.custom entry) + author -> the text after "r=". 'z' = deflate-compressed JSON, 'j' = plain JSON. */
export async function packRecipe(c,author){
  const o={v:1,id:c.origin||c.id,a:c.from||author||'',n:c.name,m:c.meals,t:c.time,s:c.servings,g:c.tags,d:DIETS.filter(function(x){return c.diet&&c.diet[x]}),
    i:c.ings.map(function(it){return [it.name,it.amt,it.unit,it.aisle]}),p:c.steps};
  const bytes=new TextEncoder().encode(JSON.stringify(o));
  if(typeof CompressionStream==='function'){try{return 'z'+b64u(await pipe(bytes,new CompressionStream('deflate-raw')))}catch(e){}}
  return 'j'+b64u(bytes);
}

/* Anything that might contain a share link (a URL, a pasted message) -> the packed part, or ''. */
export function findPacked(text){const m=String(text||'').match(/[#?&]r=([zj][A-Za-z0-9_-]+)/);return m?m[1]:''}

/* Packed text -> a clean st.custom-style recipe. The link comes from someone else, so every field is checked
   and trimmed to sane sizes; anything unexpected is dropped rather than trusted. Throws if it isn't a recipe. */
export async function unpackRecipe(packed){
  let o;
  try{
    const bytes=unb64u(packed.slice(1));
    const text=packed[0]==='z'?new TextDecoder().decode(await pipe(bytes,new DecompressionStream('deflate-raw'))):new TextDecoder().decode(bytes);
    o=JSON.parse(text);
  }catch(e){throw new Error('That link doesn\'t contain a recipe')}
  const str=function(v,max){return typeof v==='string'?v.trim().slice(0,max):''};
  const num=function(v,lo,hi,def){v=+v;return isFinite(v)&&v>=lo&&v<=hi?v:def};
  const units=UNITS.map(function(u){return u[0]});
  const name=str(o&&o.n,80);
  if(!o||o.v!==1||!name||!Array.isArray(o.i))throw new Error('That link doesn\'t contain a recipe');
  const ings=o.i.slice(0,60).map(function(x){
    return Array.isArray(x)?{name:str(x[0],60),amt:num(x[1],0,100000,0),unit:units.indexOf(x[2])>-1?x[2]:'pcs',aisle:AISLES.indexOf(x[3])>-1?x[3]:AISLES[4]}:null;
  }).filter(function(it){return it&&it.name&&it.amt>0});
  if(!ings.length)throw new Error('That recipe has no ingredients');
  const diet={};(Array.isArray(o.d)?o.d:[]).forEach(function(x){if(DIETS.indexOf(x)>-1)diet[x]=true});
  return {
    origin:str(o.a,40)+'/'+str(o.id,40),from:str(o.a,40)||'A friend',name:name,
    meals:(Array.isArray(o.m)?o.m:[]).filter(function(m){return MEAL_ORDER.indexOf(m)>-1}),
    time:num(o.t,1,600,30),servings:num(o.s,1,12,2),
    tags:(Array.isArray(o.g)?o.g:[]).map(function(t){return str(t,30)}).filter(Boolean).slice(0,6),
    diet:diet,ings:ings,steps:(Array.isArray(o.p)?o.p:[]).map(function(s){return str(s,600)}).filter(Boolean).slice(0,40)
  };
}

export function shareUrl(packed){return WEB_URL+'#r='+packed}
/* Link that opens the installed Android app from the browser; falls back to staying on the web page. */
export function appIntentUrl(packed){return 'intent://import?r='+packed+'#Intent;scheme=swipesupper;package='+APP_ID+';end'}
export function isAndroidBrowser(){return !Capacitor.isNativePlatform()&&/Android/i.test(navigator.userAgent)}

export async function shareLink(title,text,url){
  if(Capacitor.isNativePlatform()){
    const {Share}=await import('@capacitor/share');
    await Share.share({title:title,text:text,url:url,dialogTitle:'Share recipe'});return 'shared';
  }
  if(navigator.share){await navigator.share({title:title,text:text,url:url});return 'shared'}
  await navigator.clipboard.writeText(text+' '+url);return 'copied';
}

/* Links that arrive in the Android app: at cold start and while it's running. */
export async function onAppLink(cb){
  if(!Capacitor.isNativePlatform())return;
  const {App}=await import('@capacitor/app');
  App.addListener('appUrlOpen',function(e){const p=findPacked(e.url);if(p)cb(p)});
  const launch=await App.getLaunchUrl();
  if(launch&&launch.url){const p=findPacked(launch.url);if(p)cb(p)}
}
