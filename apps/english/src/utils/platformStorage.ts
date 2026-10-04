let cache: Record<string,string> = {}, pending: Record<string,string|null> = {}, timer: ReturnType<typeof setTimeout> | undefined, sending=false;
export async function englishApi(url:string,data?:unknown) {
  const r=await fetch('/api/english'+url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const value=await r.json();if(!r.ok)throw new Error(value.error || '英语记录保存失败'); return value;
}
export async function hydrateEnglish() { const data=await englishApi('/storage');cache=data.items; }
export async function flushEnglish() {
  if(sending || !Object.keys(pending).length)return;
  sending=true;const patch=pending;pending={};
  try {await englishApi('/storage',{patch});window.dispatchEvent(new Event('study:update'));}
  catch(e) {pending={...patch,...pending};window.dispatchEvent(new CustomEvent('study:save-error',{detail:'英语记录尚未保存，请保持此页打开并重试。'}));}
  finally {sending=false;if(Object.keys(pending).length)timer=setTimeout(flushEnglish,3000);}
}
export const englishStorage={
  getItem:(key:string)=>cache[key] ?? null,
  snapshot:()=>({...cache}),
  setItem:(key:string,value:string)=>{cache[key]=value;pending[key]=value;clearTimeout(timer);timer=setTimeout(flushEnglish,350);},
  removeItem:(key:string)=>{delete cache[key];pending[key]=null;clearTimeout(timer);timer=setTimeout(flushEnglish,350);},
};
window.addEventListener('pagehide',()=>{if(Object.keys(pending).length)fetch('/api/english/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch:pending}),keepalive:true}).catch(()=>{});});
export function recordEnglish(url:string,data:unknown) {return englishApi(url,data).then(value=>{window.dispatchEvent(new Event('study:update'));if(value.reward?.points)window.dispatchEvent(new CustomEvent('study:reward',{detail:value.reward.points}));return value;});}

declare global {interface Window {beforeStudyExport?:()=>Promise<void>}}
window.beforeStudyExport=async()=>{const end=Date.now()+8000;while(sending||Object.keys(pending).length){if(Date.now()>end)throw new Error('英语记录仍在保存，请稍后再导出');if(!sending)await flushEnglish();await new Promise(resolve=>setTimeout(resolve,100));}};
