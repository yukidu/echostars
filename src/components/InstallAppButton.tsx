import React, { useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
interface InstallEvent extends Event { prompt():Promise<void>; userChoice:Promise<{outcome:string}>; }
let promptEvent: InstallEvent | null = null;
let installed = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?:boolean}).standalone === true);
let revision=0;
const listeners=new Set<()=>void>();
const publish=()=>{revision++;listeners.forEach(fn=>fn());};
if(typeof window!=='undefined') {
  window.addEventListener('beforeinstallprompt', event=>{event.preventDefault();promptEvent=event as InstallEvent;publish();});
  window.addEventListener('appinstalled',()=>{installed=true;promptEvent=null;publish();});
}
export function InstallAppButton({className=''}:{compact?:boolean;className?:string}) {
  useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>revision,()=>0);
  if(installed)return null;
  return <button type="button" disabled={!promptEvent}
    title={promptEvent?'安裝到桌面':'此瀏覽器請從分享或選單選擇「加入主畫面／安裝」'}
    onClick={async()=>{const event=promptEvent;if(!event)return;promptEvent=null;publish();try{await event.prompt();await event.userChoice;}catch{}}}
    className={className||'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50'}>
    <Download className="w-4 h-4"/><span>安裝到桌面</span>
  </button>;
}
