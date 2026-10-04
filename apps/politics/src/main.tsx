import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

import './styles/index.css';
import './styles/politics.css';
import './styles/subject-switch.css';
import './styles/wishpool.css';
import './styles/custom.css';

(async()=>{await (window as any).studyReady;ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);})().catch(()=>{document.getElementById('root')!.textContent='学习记录暂时无法加载，请联网后重试';});
