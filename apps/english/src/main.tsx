import './utils/publicData';
import React from 'react'
import ReactDOM from 'react-dom/client'
import {LoadBoundary} from './components/LoadBoundary';
import App from './App'
import './index.css'
import {hydrateEnglish} from './utils/platformStorage'
import {hydrateAiConfig} from './utils/aiConfigStorage'

async function start() {
try { await window.studyReady; await hydrateEnglish();hydrateAiConfig().catch(()=>{});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LoadBoundary><React.Suspense fallback={<p className="platform-empty">正在载入学习页面…</p>}><App /></React.Suspense></LoadBoundary>
  </React.StrictMode>,
)

} catch { const box=document.getElementById('root')!;box.textContent='学习记录暂时无法加载，请重试。';const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>location.reload();box.append(retry); }
}
start();
