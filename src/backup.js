/* Backup file: everything the app stores on this device, as one JSON file.
   In the browser it downloads; in the Android app it is written to the cache and handed to the share sheet
   (save to Drive, Files, email it to yourself...), because WebView ignores download links. */
import {Capacitor} from '@capacitor/core';

export const BACKUP_APP='swipe-supper';

export function backupName(){
  const d=new Date(),p=function(n){return String(n).padStart(2,'0')};
  return 'swipe-supper-backup-'+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'.json';
}

export async function saveBackup(data){
  const json=JSON.stringify(data),name=backupName();
  if(Capacitor.isNativePlatform()){
    const {Filesystem,Directory,Encoding}=await import('@capacitor/filesystem');
    const {Share}=await import('@capacitor/share');
    const w=await Filesystem.writeFile({path:name,data:json,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:'Swipe Supper backup',files:[w.uri],dialogTitle:'Save your backup'});
    return 'shared';
  }
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},2000);
  return 'downloaded';
}

/* Parses and sanity-checks a backup file. Throws with a readable message if it isn't one of ours. */
export function readBackup(text){
  let d;
  try{d=JSON.parse(text)}catch(e){throw new Error('That file is not a Swipe Supper backup')}
  if(!d||d.app!==BACKUP_APP||!d.state||typeof d.state!=='object')throw new Error('That file is not a Swipe Supper backup');
  if(d.photos&&typeof d.photos!=='object')d.photos={};
  return d;
}
