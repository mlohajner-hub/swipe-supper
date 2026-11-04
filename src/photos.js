/* Recipe photos live in IndexedDB: localStorage caps out at ~5 MB, which is only a couple of dozen photos.
   Photos are kept as JPEG data URLs keyed by recipe id. */
const DB='swipe-supper',STORE='photos',OLD_PREFIX='ss.p.';
let dbp=null;
function open(){
  if(dbp)return dbp;
  dbp=new Promise(function(res,rej){
    const rq=indexedDB.open(DB,1);
    rq.onupgradeneeded=function(){rq.result.createObjectStore(STORE)};
    rq.onsuccess=function(){res(rq.result)};
    rq.onerror=function(){rej(rq.error)};
  });
  return dbp;
}
function tx(mode,fn){
  return open().then(function(db){return new Promise(function(res,rej){
    const t=db.transaction(STORE,mode),out=fn(t.objectStore(STORE));
    t.oncomplete=function(){res(out&&'result' in out?out.result:undefined)};
    t.onerror=t.onabort=function(){rej(t.error)};
  })});
}
export function putPhoto(id,url){return tx('readwrite',function(s){return s.put(url,id)})}
export function deletePhoto(id){return tx('readwrite',function(s){return s.delete(id)})}
export function clearPhotos(){return tx('readwrite',function(s){return s.clear()})}

/* All photos as {id: dataUrl}. Moves any photos saved by the old single-file version out of localStorage first. */
export function loadPhotos(){
  const old={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(OLD_PREFIX)===0)old[k.slice(OLD_PREFIX.length)]=localStorage.getItem(k)}}catch(e){}
  const ids=Object.keys(old);
  const migrate=ids.length?tx('readwrite',function(s){ids.forEach(function(id){s.put(old[id],id)})}).then(function(){ids.forEach(function(id){try{localStorage.removeItem(OLD_PREFIX+id)}catch(e){}})}):Promise.resolve();
  return migrate.then(function(){return open()}).then(function(db){return new Promise(function(res,rej){
    const out={},t=db.transaction(STORE,'readonly'),c=t.objectStore(STORE).openCursor();
    c.onsuccess=function(){const cur=c.result;if(cur){out[cur.key]=cur.value;cur.continue()}};
    t.oncomplete=function(){res(out)};
    t.onerror=function(){rej(t.error)};
  })}).catch(function(){return old});
}
