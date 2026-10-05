import{j as e}from"./index-BKBOZrcM.js";import{d as B,r as n,L as I}from"./vendor-C1PfG1cZ.js";import{T as C,A as Q}from"./Tex-CY-qobdC.js";import{M as W}from"./Md-review-bcabad64d767.js";import{i as Y}from"./auth-BFNYYDaf.js";import{d as G}from"./questionSource-BbvInoxl.js";import{N as H}from"./NeedLogin-BeqfaK2X.js";import{n as J,o as K}from"./examPaper-aGZHnTPq.js";import"./katex-Dc8nsIP1.js";import"./noScrollChain-C96TITM-.js";import"./App-DHANlom9.js";import"./SubjectSwitch-oUbusq72.js";const _=["选择题","填空题","解答题"],U=["一","二","三","四","五","六"];function S(a){return a?a.includes("填空")?"填空题":/解答|大题|证明|应用|综合/.test(a)?"解答题":a.includes("选")?"选择题":"其他":"其他"}const g={选择题:[22,32,46],填空题:[26,40,56],解答题:[58,88,128],其他:[40,60,90]};function de(){const[a]=B(),o=Number(a.get("pid")||0),c=a.get("paper")||"",d=Number(a.get("year")||0),[b,m]=n.useState(""),[i,u]=n.useState([]),[z,P]=n.useState(null),[$,M]=n.useState(null),[j,E]=n.useState(!0),[h,O]=n.useState("workbook"),[x,F]=n.useState(1),[N,q]=n.useState(!1),[v,R]=n.useState({}),[y,A]=n.useState(!1);n.useEffect(()=>{let r=!0;return(async()=>{if(E(!0),o>0){const p=await J(o);if(!r)return;p&&(m(p.name),u(p.questions),P(p.fullPoints),M(p.timeLimitSec))}else if(c&&d>0){const p=await K(c,d);if(!r)return;m(`${d} 年全国硕士研究生招生考试 · ${c}`),u(p),P(p.reduce((s,t)=>s+(t.points||0),0)),M(180*60)}E(!1)})(),()=>{r=!1}},[o,c,d]),n.useEffect(()=>{if(!N||i.length===0||Object.keys(v).length>0)return;let r=!0;return A(!0),Promise.all(i.map(p=>G(p.id).then(s=>[p.id,s]))).then(p=>{r&&R(Object.fromEntries(p))}).finally(()=>{r&&A(!1)}),()=>{r=!1}},[N,i,v]);const k=n.useMemo(()=>{const r=new Map;for(const s of i){const t=S(s.type);r.has(t)||r.set(t,[]),r.get(t).push(s)}const p=new Map;return i.forEach((s,t)=>{const l=S(s.type);p.has(l)||p.set(l,t)}),[...r.entries()].sort((s,t)=>{const l=p.get(s[0]),f=p.get(t[0]);if(l!==void 0&&f!==void 0)return l-f;const w=_.indexOf(s[0]),T=_.indexOf(t[0]);return(w<0?99:w)-(T<0?99:T)})},[i]),L=n.useMemo(()=>{const r=new Map;let p=1;for(const[,s]of k)for(const t of s)r.set(t.id,p++);return r},[k]);if(!Y())return e.jsx(H,{what:"打印试卷"});const D=$?Math.round($/60):null;return e.jsxs("div",{className:`page pprint pprint-${h}`,children:[e.jsxs("div",{className:"card ppr-bar",children:[e.jsxs("div",{className:"ppr-bar-row",children:[e.jsx("label",{children:"排版"}),e.jsxs("div",{className:"pb-chips",children:[e.jsx("button",{className:`bk-chip${h==="compact"?" on":""}`,onClick:()=>O("compact"),children:"紧密 · 不留空"}),e.jsx("button",{className:`bk-chip${h==="workbook"?" on":""}`,onClick:()=>O("workbook"),children:"做题本 · 留答题区"})]})]}),h==="workbook"&&e.jsxs("div",{className:"ppr-bar-row",children:[e.jsx("label",{children:"答题区"}),e.jsxs("div",{className:"pb-chips",children:[["小","中","大"].map((r,p)=>e.jsx("button",{className:`bk-chip${x===p?" on":""}`,onClick:()=>F(p),children:r},r)),e.jsxs("span",{className:"dim ppr-hint",children:["解答题 ",g.解答题[x],"mm · 填空 ",g.填空题[x],"mm · 选择 ",g.选择题[x],"mm"]})]})]}),e.jsxs("div",{className:"ppr-bar-row",children:[e.jsx("label",{children:"附录"}),e.jsxs("label",{className:"ppr-check",children:[e.jsx("input",{type:"checkbox",checked:N,onChange:r=>q(r.target.checked)}),"答案与解析（另起一页）",y&&e.jsx("span",{className:"dim",children:" · 加载中…"})]}),e.jsxs("div",{className:"ppr-bar-actions",children:[e.jsx(I,{className:"reveal",to:"/papers",children:"返回试卷列表"}),e.jsx("button",{className:"admin-primary",onClick:()=>window.print(),disabled:j||i.length===0||y,title:j?"题目还在载入":i.length===0?"这张卷没有可打印的题":y?"答案与解析还在载入，等它拉完再打，否则附录会缺":"打开浏览器打印对话框",children:j?"载入中…":y?"答案载入中…":"打印 / 下载 PDF"})]})]}),e.jsxs("div",{className:"dim ppr-tip",children:["导出就是浏览器的",e.jsx("b",{children:"打印"}),"：点上面那个键会弹出打印对话框，把「目标打印机」选成",e.jsx("b",{children:"另存为 PDF"}),"（Edge 里叫「Microsoft Print to PDF」或「另存为 PDF」）就能存成文件。 建议纸张 A4、缩放 100%、勾选",e.jsx("b",{children:"背景图形"}),"（不勾的话答题区的方格底纹不会打出来）。"]})]}),j?e.jsx("div",{className:"card",children:"载入中…"}):i.length===0?e.jsx("div",{className:"card",children:"这张卷没有可打印的题（可能已被删除，或题目对当前账号不可见）。"}):e.jsxs("div",{className:"ppr-sheet",children:[e.jsxs("header",{className:"ppr-head",children:[e.jsx("h1",{children:b}),e.jsxs("div",{className:"ppr-meta",children:[e.jsxs("span",{children:["共 ",i.length," 题"]}),z?e.jsxs("span",{children:["满分 ",z," 分"]}):null,D?e.jsxs("span",{children:["建议用时 ",D," 分钟"]}):null]}),e.jsxs("div",{className:"ppr-fill",children:[e.jsx("span",{children:"姓名"}),e.jsx("i",{}),e.jsx("span",{children:"日期"}),e.jsx("i",{}),e.jsx("span",{children:"得分"}),e.jsx("i",{})]})]}),k.map(([r,p],s)=>e.jsxs("section",{className:"ppr-sec",children:[e.jsxs("h2",{children:[U[s]||s+1,"、",r,e.jsx("span",{className:"ppr-sec-note",children:V(r,p)})]}),p.map(t=>{var l;return e.jsxs("article",{className:"ppr-q",children:[e.jsxs("div",{className:"ppr-q-head",children:[e.jsxs("b",{children:[L.get(t.id),"．"]}),t.points?e.jsxs("em",{children:["（",t.points," 分）"]}):null]}),e.jsx("div",{className:"ppr-q-stem",children:e.jsx(C,{children:t.stem})}),Object.keys(t.options||{}).length>0&&e.jsx("ol",{className:"ppr-opts",children:Object.entries(t.options).map(([f,w])=>e.jsxs("li",{children:[e.jsxs("b",{children:["（",f,"）"]}),e.jsx(C,{children:w})]},f))}),h==="workbook"&&e.jsx("div",{className:"ppr-pad",style:{height:`${((l=g[S(t.type)])==null?void 0:l[x])??g.其他[x]}mm`}})]},t.id)})]},r)),N&&e.jsxs("section",{className:"ppr-ans",children:[e.jsx("h2",{children:"答案与解析"}),k.flatMap(([,r])=>r).map(r=>{const p=v[r.id];return e.jsxs("article",{className:"ppr-a",children:[e.jsxs("div",{className:"ppr-a-head",children:[e.jsxs("b",{children:[L.get(r.id),"．"]}),e.jsx("span",{className:"ppr-a-final",children:e.jsx(Q,{children:(p==null?void 0:p.answer)||(p==null?void 0:p.final_answer)||"（见解析）"})})]}),p!=null&&p.analysis_md?e.jsx("div",{className:"ppr-a-body",children:e.jsx(W,{children:p.analysis_md})}):e.jsx("div",{className:"ppr-a-body dim",children:"（该题暂无解析）"})]},r.id)})]})]}),e.jsx("style",{children:X})]})}function V(a,o){const c=o.length,d=o.reduce((i,u)=>i+(u.points||0),0),b=o.every(i=>i.points===o[0].points)?o[0].points:null,m=d>0?`本题共 ${c} 小题，${b?`每小题 ${b} 分，`:""}共 ${d} 分．`:`本题共 ${c} 小题．`;return a==="选择题"?`${m}在每小题给出的四个选项中，只有一项符合题目要求．`:a==="填空题"?`${m}请将答案写在横线上．`:a==="解答题"?`${m}解答应写出文字说明、证明过程或演算步骤．`:m}const X=`
/* ---------- 屏幕 ---------- */
.pprint .ppr-bar { display:flex; flex-direction:column; gap:10px; }
.pprint .ppr-bar-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.pprint .ppr-bar-row > label { min-width:44px; color:var(--muted); font-size:13px; }
.pprint .ppr-bar-actions { margin-left:auto; display:flex; gap:8px; align-items:center; }
.pprint .ppr-check { display:flex; align-items:center; gap:6px; font-size:13px; }
.pprint .ppr-hint { font-size:12px; }
.pprint .ppr-tip { font-size:12px; line-height:1.6; }

/* 卷面：屏幕上就按 A4 内容宽度预览，所见即所得 */
.pprint .ppr-sheet {
  margin:14px auto 0; max-width:178mm; background:#fff; color:#000;
  padding:10mm 8mm; border:1px solid var(--line); border-radius:6px;
  font-size:14px; line-height:1.75;
}
.pprint .ppr-head { text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:14px; }
.pprint .ppr-head h1 { font-size:19px; margin:0 0 6px; font-weight:700; }
.pprint .ppr-meta { display:flex; gap:16px; justify-content:center; font-size:12.5px; color:#333; }
.pprint .ppr-fill { display:flex; gap:10px; align-items:baseline; justify-content:flex-start; margin-top:10px; font-size:12.5px; }
.pprint .ppr-fill i { display:inline-block; flex:1; max-width:120px; border-bottom:1px solid #000; height:1em; }

.pprint .ppr-sec { margin-top:16px; }
.pprint .ppr-sec > h2 { font-size:15px; margin:0 0 8px; font-weight:700; }
.pprint .ppr-sec-note { font-weight:400; font-size:12.5px; margin-left:6px; }
.pprint .ppr-q { margin-bottom:14px; }
.pprint .ppr-q-head { display:flex; gap:6px; align-items:baseline; float:left; }
.pprint .ppr-q-head em { font-style:normal; font-size:12px; color:#444; }
.pprint .ppr-q-stem { overflow:hidden; }
.pprint .ppr-opts { list-style:none; margin:6px 0 0; padding:0; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:4px 18px; }
.pprint .ppr-opts li { display:flex; gap:4px; align-items:baseline; min-width:0; }
/* 答题/草稿区：5mm 方格底纹，既是答题区也当草稿纸用（数学要画图） */
.pprint .ppr-pad {
  margin-top:8px; border:1px dashed #bbb; border-radius:3px;
  background-image:linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px);
  background-size:5mm 5mm;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.pprint .ppr-ans { margin-top:20px; border-top:2px solid #000; padding-top:12px; }
.pprint .ppr-ans > h2 { font-size:16px; margin:0 0 10px; }
.pprint .ppr-a { margin-bottom:12px; font-size:13px; }
.pprint .ppr-a-head { display:flex; gap:8px; align-items:baseline; }
.pprint .ppr-a-final { font-weight:700; }
.pprint .ppr-a-body { margin-top:2px; }

/* 紧密模式：把所有留白压到最小 */
.pprint.pprint-compact .ppr-sheet { line-height:1.6; }
.pprint.pprint-compact .ppr-q { margin-bottom:8px; }
.pprint.pprint-compact .ppr-sec { margin-top:12px; }

/* ---------- 打印 ---------- */
@media print {
  @page { size:A4; margin:16mm 14mm; }
  /* 站内的壳（顶栏/侧栏/工具条）一概不出现在纸上。
     ⚠️ 这几条选择器是对着真实 DOM 核过的：根是 #root、顶栏是 header.topbar。
     写错了不会报错，只会印出一张空白纸或多印一条导航。 */
  body > *:not(#root), .topbar, .sidebar, .pprint .ppr-bar { display:none !important; }
  html, body { background:#fff !important; }
  /* 站壳的 .app 带 padding:0 28px 60px，不清掉会叠在 @page 边距之上，左右各多缩 28px。
     这条规则只在本页挂载期间存在（样式块随组件走），不会影响别的页面打印。 */
  .app { padding:0 !important; }
  .page.pprint { padding:0 !important; margin:0 !important; background:#fff !important; }
  .pprint .ppr-sheet {
    max-width:none; margin:0; padding:0; border:0; border-radius:0;
    background:#fff !important; color:#000 !important; font-size:10.8pt; line-height:1.7;
  }
  .pprint .ppr-sheet * { color:#000 !important; }
  /* 一道题尽量不跨页断开；段首标题不许独自留在页尾 */
  .pprint .ppr-q, .pprint .ppr-a { break-inside:avoid; page-break-inside:avoid; }
  .pprint .ppr-sec > h2 { break-after:avoid; page-break-after:avoid; }
  /* 答案与解析另起一页 */
  .pprint .ppr-ans { break-before:page; page-break-before:always; border-top:0; }
  .pprint .ppr-pad { border-color:#999; }
}
`;export{de as default};
