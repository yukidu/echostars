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
  // Only show this action when the browser exposes a direct install prompt.
  // This avoids a dead/disabled menu item on unsupported devices (notably iOS Safari).
  if(installed || !promptEvent)return null;
  return <button type="button"
    title="安裝到桌面"
    aria-label="安裝到桌面"
    onClick={async()=>{const event=promptEvent;if(!event)return;promptEvent=null;publish();try{await event.prompt();await event.userChoice;}catch{}}}
    className={className||'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}>
    <Download className="w-4 h-4"/><span>安裝到桌面</span>
  </button>;
}
