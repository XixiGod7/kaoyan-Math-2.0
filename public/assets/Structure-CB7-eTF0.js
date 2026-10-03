import{j as s}from"./index-BKBOZrcM.js";import{r as o}from"./vendor-C1PfG1cZ.js";import{u as $,E as A}from"./examTrack-Chj1JLZH.js";import{p as d,P as g}from"./part-nLuLwz0Z.js";import{l as B}from"./questionSource-BbvInoxl.js";import"./auth-BFNYYDaf.js";import"./noScrollChain-C96TITM-.js";import"./App-DHANlom9.js";import"./SubjectSwitch-oUbusq72.js";const m=a=>a==="解答题"||a==="证明题";function C(a,r){const i=a>=2023;return m(r)?i?11.7:10.4:i?5:4}function M(a){const r=a.kps.find(i=>i.rel==="主")??a.kps[0];return r?r.part:"其他"}const P=["高等数学","线性代数","概率论与数理统计","其他"],u={calc:"#34b187",linalg:"#6486f0",prob:"#e0a24f",other:"#9aa4bb"};function I(){var y;const[a,r]=o.useState([]),[i,n]=o.useState(null),[c,S]=$();o.useEffect(()=>{B().then(r),fetch("/data/trends.json").then(t=>t.json()).then(n).catch(()=>{})},[]);const l=o.useMemo(()=>a.filter(t=>t.papers.includes(c)),[a,c]),j=o.useMemo(()=>{const t=new Map;for(const e of l){const x=M(e),p=t.get(x)??{q:0,pts:0,big:0,small:0};p.q+=1,p.pts+=C(e.year,e.type),m(e.type)?p.big+=1:p.small+=1,t.set(x,p)}return P.filter(e=>t.has(e)).map(e=>({part:e,...t.get(e)}))},[l]),b=j.reduce((t,e)=>t+e.pts,0)||1,E=l.length||1,v=o.useMemo(()=>w(l.filter(t=>m(t.type))),[l]),N=o.useMemo(()=>w(l.filter(t=>!m(t.type))),[l]),f=l.filter(t=>m(t.type)).length,k=l.length-f,h=o.useMemo(()=>{var t;return((t=i==null?void 0:i.papers[c])==null?void 0:t.methods)??[]},[i,c]),T=((y=h[0])==null?void 0:y[1])??1,q=l.length?l.reduce((t,e)=>t+e.difficulty,0)/l.length:0;return s.jsxs("div",{className:"page structure",children:[s.jsxs("div",{className:"tabs",children:[A.map(t=>s.jsx("button",{className:t===c?"tab on":"tab",onClick:()=>S(t),children:t},t)),s.jsx("span",{className:"years-hint",children:"近 18 年（2009–2026）· 分值按题型近似 · 看卷面怎么组题"})]}),s.jsxs("div",{className:"st-kpi",children:[s.jsxs("div",{className:"kpi",children:[s.jsx("span",{className:"kn",children:l.length}),s.jsx("span",{className:"kl",children:"真题数"})]}),s.jsxs("div",{className:"kpi",children:[s.jsx("span",{className:"kn",children:f}),s.jsxs("span",{className:"kl",children:["大题",s.jsx("em",{children:"解答/证明"})]})]}),s.jsxs("div",{className:"kpi",children:[s.jsx("span",{className:"kn",children:k}),s.jsxs("span",{className:"kl",children:["小题",s.jsx("em",{children:"选择/填空"})]})]}),s.jsxs("div",{className:"kpi",children:[s.jsx("span",{className:"kn",children:q.toFixed(1)}),s.jsxs("span",{className:"kl",children:["平均难度",s.jsx("em",{children:"1–5"})]})]})]}),s.jsxs("section",{className:"card",children:[s.jsxs("h2",{children:["板块分值分布",s.jsx("small",{children:"按占比折算到 150 分满分 · 时间该往分值多的地方投"})]}),s.jsx("div",{className:"st-parts",children:j.map(t=>{const e=d(t.part),x=Math.round(t.pts/b*100),p=Math.round(t.q/E*100),R=Math.round(t.pts/b*150);return s.jsxs("div",{className:"st-part-row",children:[s.jsx("span",{className:"st-part-name",style:{color:u[e]},children:g[e]}),s.jsx("div",{className:"st-part-bars",children:s.jsxs("div",{className:"st-bar-line",children:[s.jsx("i",{className:"st-bar pts",style:{width:`${x}%`,background:u[e]}}),s.jsxs("b",{children:["≈",R," 分",s.jsxs("em",{children:["占 ",x,"%"]})]})]})}),s.jsxs("span",{className:"st-part-detail",children:[t.big," 大 · ",t.small," 小 · 题数占 ",p,"%"]})]},t.part)})})]}),s.jsxs("section",{className:"card",children:[s.jsxs("h2",{children:["大题落在哪、选填考什么",s.jsx("small",{children:"解答题与选填的板块构成完全不同"})]}),s.jsxs("div",{className:"st-split",children:[s.jsxs("div",{className:"st-split-col",children:[s.jsxs("div",{className:"st-split-head",children:["大题（解答/证明）",s.jsxs("b",{children:[f," 题"]})]}),s.jsx(z,{shares:v}),s.jsx("ul",{className:"st-split-legend",children:v.map(t=>s.jsxs("li",{children:[s.jsx("i",{style:{background:u[d(t.part)]}}),g[d(t.part)],s.jsxs("b",{children:[t.pct,"%"]})]},t.part))})]}),s.jsxs("div",{className:"st-split-col",children:[s.jsxs("div",{className:"st-split-head",children:["小题（选择/填空）",s.jsxs("b",{children:[k," 题"]})]}),s.jsx(z,{shares:N}),s.jsx("ul",{className:"st-split-legend",children:N.map(t=>s.jsxs("li",{children:[s.jsx("i",{style:{background:u[d(t.part)]}}),g[d(t.part)],s.jsxs("b",{children:[t.pct,"%"]})]},t.part))})]})]})]}),s.jsxs("section",{className:"card",children:[s.jsxs("h2",{children:["高频解题方法 / 题型 Top ",h.length,s.jsx("small",{children:"近 18 年反复出现的解题套路——练熟这些＝押中题型"})]}),s.jsxs("div",{className:"st-methods",children:[h.map(([t,e])=>s.jsxs("div",{className:"st-method",title:`${t}：${e} 次`,children:[s.jsx("span",{className:"st-method-bar",style:{width:`${Math.max(6,e/T*100)}%`}}),s.jsx("span",{className:"st-method-name",children:t}),s.jsx("b",{className:"st-method-c",children:e})]},t)),h.length===0&&s.jsx("p",{className:"miss-note",children:"加载中…"})]})]}),s.jsx("style",{children:Q})]})}function w(a){const r=new Map;for(const n of a){const c=M(n);r.set(c,(r.get(c)??0)+1)}const i=a.length||1;return P.filter(n=>r.has(n)).map(n=>({part:n,pct:Math.round(r.get(n)/i*100)}))}function z({shares:a}){return s.jsx("div",{className:"st-stack",children:a.map(r=>s.jsx("span",{className:"st-stack-seg",style:{flexGrow:r.pct,background:u[d(r.part)]},title:`${r.part} ${r.pct}%`},r.part))})}const Q=`
  .structure .st-kpi { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
  .structure .st-kpi .kpi {
    flex: 1; min-width: 100px; background: #fff; border: 1px solid var(--line);
    border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
  }
  .structure .kn { font-size: 24px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
  .structure .kn i { font-size: 14px; font-weight: 700; }
  .structure .kl { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; }
  .structure .kl em { font-size: 10.5px; opacity: .7; font-style: normal; }

  .structure .st-parts { display: flex; flex-direction: column; gap: 12px; }
  .structure .st-part-row { display: flex; align-items: center; gap: 12px; }
  .structure .st-part-name { flex: 0 0 76px; font-size: 13px; font-weight: 700; }
  .structure .st-part-bars { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .structure .st-bar-line { display: flex; align-items: center; gap: 8px; }
  .structure .st-bar { height: 13px; border-radius: 4px; min-width: 3px; transition: width .3s; }
  .structure .st-bar.qn { height: 9px; }
  .structure .st-bar-line b { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ink); display: flex; align-items: baseline; gap: 4px; }
  .structure .st-bar-line em { font-size: 10px; color: var(--muted); font-style: normal; }
  .structure .st-part-detail { flex: 0 0 auto; font-size: 11.5px; color: var(--muted); }

  .structure .st-split { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .structure .st-split-head { font-size: 13px; font-weight: 700; margin-bottom: 8px; display: flex; justify-content: space-between; }
  .structure .st-split-head b { color: var(--muted); font-weight: 600; }
  .structure .st-stack { display: flex; height: 26px; border-radius: 7px; overflow: hidden; background: var(--bg); }
  .structure .st-stack-seg { min-width: 2px; transition: flex-grow .3s; }
  .structure .st-split-legend { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .structure .st-split-legend li { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
  .structure .st-split-legend i { width: 11px; height: 11px; border-radius: 3px; }
  .structure .st-split-legend b { color: var(--ink); font-variant-numeric: tabular-nums; }

  .structure .st-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
  .structure .st-method { position: relative; display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 7px; overflow: hidden; }
  .structure .st-method-bar { position: absolute; left: 0; top: 0; bottom: 0; background: #eaf0ff; z-index: 0; border-radius: 7px; }
  .structure .st-method-name { position: relative; z-index: 1; font-size: 12.5px; color: var(--ink); flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .structure .st-method-c { position: relative; z-index: 1; font-size: 12px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }

  @media (max-width: 720px) {
    .structure .st-split { grid-template-columns: 1fr; }
    .structure .st-methods { grid-template-columns: 1fr; }
    .structure .st-part-detail { display: none; }
  }
`;export{I as default};
