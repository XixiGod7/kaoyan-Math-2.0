import {AiConfig} from '../types/ai';
let config:AiConfig={provider:'shared',apiKey:'',baseUrl:'',model:'',hasKey:false};
export async function hydrateAiConfig(){const r=await fetch('/api/ai/config');if(!r.ok)throw new Error('AI 设置读取失败');const data=await r.json();config={...data,provider:'shared',apiKey:''};}
export function loadAiConfig(){return {...config};}
export function hasConfiguredApiKey(){return Boolean(config.hasKey);}
window.addEventListener('study:ai-config',()=>{hydrateAiConfig().catch(()=>{});});
