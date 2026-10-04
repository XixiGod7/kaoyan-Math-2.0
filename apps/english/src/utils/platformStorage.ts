let cache: Record<string,string> = {}, pending: Record<string,string|null> = {}, timer: ReturnType<typeof setTimeout> | undefined, sending=false,lastFlush=0;
export async function englishApi(url:string,data?:unknown) {
  const r=await fetch('/api/english'+url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const value=await r.json();if(!r.ok && !(url==='/storage'&&value.localSaved))throw new Error(value.error || '英语记录保存失败'); return value;
}
export async function hydrateEnglish() { await window.studyReady;pending={...window.studySync?.getEnglishDraft()}; const data=await englishApi('/storage');cache={...data.items,...pending};if(Object.keys(pending).length)timer=setTimeout(flushEnglish,400); }
export async function flushEnglish() {
  if(sending || !Object.keys(pending).length)return;
  if(window.studySync?.status.conflicts.length || (!window.studySync?.status.online && window.studySync?.status.pending))return;
  sending=true;const patch=pending;pending={};
  try {await englishApi('/storage',{patch});await window.studySync?.clearEnglishDraft(patch);window.dispatchEvent(new Event('study:update'));}
  catch(e) {pending={...patch,...pending};window.dispatchEvent(new CustomEvent('study:save-error',{detail:'英语记录已在本地保存，请在顶部“保存与同步”处理待同步内容。'}));}
  finally {sending=false;lastFlush=Date.now();}
}
export const englishStorage={
  getItem:(key:string)=>cache[key] ?? null,
  snapshot:()=>({...cache}),
  setItem:(key:string,value:string)=>{cache[key]=value;pending[key]=value;window.studySync?.saveEnglish({[key]:value});clearTimeout(timer);timer=setTimeout(flushEnglish,key.startsWith('kaoyan_quiz_progress_')?Math.max(350,10000-(Date.now()-lastFlush)):350);},
  removeItem:(key:string)=>{delete cache[key];pending[key]=null;window.studySync?.saveEnglish({[key]:null});clearTimeout(timer);timer=setTimeout(flushEnglish,350);},
};
window.addEventListener('pagehide',()=>{if(Object.keys(pending).length)window.studySync?.saveEnglish(pending);});
window.addEventListener('study:sync',()=>{if(!sending&&Object.keys(pending).length&&window.studySync?.status.online&&!window.studySync?.status.pending){clearTimeout(timer);timer=setTimeout(flushEnglish,350);}});
export function recordEnglish(url:string,data:unknown) {return englishApi(url,data).then(value=>{window.dispatchEvent(new Event('study:update'));if(value.reward?.points)window.dispatchEvent(new CustomEvent('study:reward',{detail:value.reward.points}));return value;});}

declare global {interface Window {beforeStudyExport?:()=>Promise<void>;studyReady?:Promise<any>;studySync?:any;studyPosition?:{get:(key:string)=>any;set:(key:string,value:any)=>void;url:(url:string)=>void}}}
window.beforeStudyExport=async()=>{const end=Date.now()+8000;while(sending||Object.keys(pending).length){if(Date.now()>end)throw new Error('英语记录仍在保存，请稍后再导出');if(!sending)await flushEnglish();await new Promise(resolve=>setTimeout(resolve,100));}};
