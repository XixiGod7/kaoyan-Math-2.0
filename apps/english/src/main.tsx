import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import {hydrateEnglish} from './utils/platformStorage'
import {hydrateAiConfig} from './utils/aiConfigStorage'

async function start() {
try { await Promise.all([hydrateEnglish(),hydrateAiConfig()]);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

} catch { const box=document.getElementById('root')!;box.textContent='学习记录暂时无法加载，请重试。';const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>location.reload();box.append(retry); }
}
start();