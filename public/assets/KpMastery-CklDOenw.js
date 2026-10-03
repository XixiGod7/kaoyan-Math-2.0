import{j as e}from"./index-BKBOZrcM.js";import{r as a,L as p}from"./vendor-C1PfG1cZ.js";import{T as d}from"./Tex-CY-qobdC.js";import{i as k}from"./auth-BFNYYDaf.js";import{a as x}from"./retention-DY0XhpJB.js";import{N as f}from"./NeedLogin-BeqfaK2X.js";import"./katex-Dc8nsIP1.js";import"./noScrollChain-C96TITM-.js";const h=[{key:"attention",label:"可以再看看",hint:"正确率偏低，再练一组就稳了（不是评判）",cls:"attention"},{key:"steady",label:"基本稳住",hint:"有把握，保持手感",cls:"steady"},{key:"strong",label:"已经熟练",hint:"掌握扎实，偶尔回顾防遗忘",cls:"strong"},{key:"unfamiliar",label:"还没怎么练",hint:"样本太少，先做几道摸底",cls:"unfamiliar"}];function L(){const[i,n]=a.useState([]),[r,m]=a.useState({}),[o,c]=a.useState(!1);return a.useEffect(()=>{x().then(t=>{n(t.items),m(t.counts),c(!0)})},[]),o?k()?e.jsxs("div",{className:"page kpm",children:[e.jsx("div",{className:"card",children:e.jsxs("h2",{children:["考点掌握图",e.jsx("small",{children:"按你的真实作答，把已练过的考点分成四档——「可以再看看」的排在最前，练一组就稳"})]})}),i.length===0?e.jsxs("div",{className:"empty",children:["还没有足够作答数据。先去",e.jsx(p,{to:"/practice",children:"刷几道题"}),"再来看。"]}):h.map(t=>{const l=i.filter(s=>s.label===t.key);return l.length===0?null:e.jsxs("div",{className:"kpm-bucket",children:[e.jsxs("div",{className:`kpm-btitle ${t.cls}`,children:[t.label," ",e.jsx("span",{className:"kpm-n",children:r[t.key]??l.length}),e.jsx("span",{className:"dim kpm-hint",children:t.hint})]}),e.jsx("ul",{className:"kpm-list",children:l.map(s=>e.jsxs("li",{className:`kpm-item ${t.cls}`,children:[e.jsx(p,{to:`/practice?kp=${encodeURIComponent(s.kp)}`,className:"kpm-kp",children:e.jsx(d,{children:s.kp})}),e.jsx("span",{className:"kpm-sub",children:s.subject}),e.jsxs("span",{className:"kpm-acc",children:[s.correct,"/",s.attempts," · ",s.accuracy,"%"]}),e.jsx(p,{className:"kpm-go",to:`/practice?kp=${encodeURIComponent(s.kp)}`,children:"再练 →"})]},s.kp))})]},t.key)}),e.jsx("style",{children:u})]}):e.jsx("div",{className:"page kpm",children:e.jsx(f,{what:"考点掌握图"})}):e.jsx("div",{className:"loading",children:"加载中…"})}const u=`
.kpm h2 { display:flex; flex-direction:column; gap:4px; } .kpm h2 small { font-weight:400; color:var(--muted); font-size:13px; }
.kpm .kpm-bucket { margin-bottom:18px; }
.kpm .kpm-btitle { font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-left:10px; border-left:3px solid var(--line); }
.kpm .kpm-btitle.attention { border-color:#f59e0b; } .kpm .kpm-btitle.steady { border-color:#3b82f6; }
.kpm .kpm-btitle.strong { border-color:#16a34a; } .kpm .kpm-btitle.unfamiliar { border-color:#cbd5e1; }
.kpm .kpm-n { background:var(--line); border-radius:8px; padding:0 8px; font-size:12px; }
.kpm .kpm-hint { font-weight:400; font-size:12px; }
.kpm .kpm-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; }
.kpm .kpm-item { display:flex; align-items:center; gap:10px; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
.kpm .kpm-item.attention { border-left:3px solid #f59e0b; }
.kpm .kpm-kp { flex:1; font-size:14px; }
.kpm .kpm-sub { color:var(--muted); font-size:12px; }
.kpm .kpm-acc { font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }
.kpm .kpm-go { font-size:13px; flex:none; }
@media (max-width:640px){ .kpm .kpm-item { flex-wrap:wrap; } }
`;export{L as default};
