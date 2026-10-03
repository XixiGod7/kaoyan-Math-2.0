import{j as s}from"./index-BKBOZrcM.js";import{d as y,r as i}from"./vendor-C1PfG1cZ.js";import{T as m,A as N}from"./Tex-CY-qobdC.js";import{M as v}from"./Md-k3-rmIqK.js";import{i as k,j as A}from"./auth-BFNYYDaf.js";import{N as q}from"./NeedLogin-BeqfaK2X.js";import{h as z}from"./wrongBook-CXDN1XKk.js";import"./katex-Dc8nsIP1.js";import"./noScrollChain-C96TITM-.js";function B(){const[t]=y(),a=t.get("status")||"active",r=t.get("subject")||"",p=t.get("type")||"",o=t.get("cause")||"",[c,x]=i.useState([]),[d,w]=i.useState(!0),[h,j]=i.useState(!1);return i.useEffect(()=>{z({status:a,subject:r,type:p,cause:o,includeAnalysis:!0}).then(e=>{x(e),j(!0)})},[a,r,p,o]),k()?h?s.jsxs("div",{className:"wbprint",children:[s.jsxs("div",{className:"wbp-toolbar no-print",children:[s.jsxs("h2",{children:["错题本导出",s.jsxs("span",{className:"dim",children:[" · ",c.length," 题"]})]}),s.jsxs("label",{children:[s.jsx("input",{type:"checkbox",checked:d,onChange:e=>w(e.target.checked)})," 含解析"]}),s.jsx("button",{className:"admin-primary",onClick:()=>window.print(),children:"打印 / 存为 PDF"})]}),s.jsxs("div",{className:"wbp-doc",children:[s.jsxs("h1",{className:"wbp-title",children:["错题本",r&&` · ${r}`]}),c.map((e,g)=>{var b;const u=A(e.answer),l=Object.entries(e.options||{});return s.jsxs("div",{className:"wbp-q",children:[s.jsxs("div",{className:"wbp-qhead",children:[s.jsxs("b",{children:[g+1,"."]})," ",s.jsxs("span",{className:"wbp-src",children:[e.source==="book"?"巩固题":`${((b=e.papers)==null?void 0:b.join("/"))??""} ${e.year||""}`.trim()," · ",e.type]})]}),s.jsx("div",{className:"wbp-stem",children:s.jsx(m,{children:e.stem})}),l.length>0&&s.jsx("div",{className:"wbp-opts",children:l.map(([n,f])=>s.jsxs("div",{className:`wbp-opt${n===u?" correct":""}`,children:[s.jsx("b",{children:n})," ",s.jsx(m,{children:f})]},n))}),e.answer&&s.jsxs("div",{className:"wbp-ans",children:[s.jsx("b",{children:"答案："}),s.jsx(N,{children:e.answer})]}),d&&e.analysis&&s.jsxs("div",{className:"wbp-analysis",children:[s.jsx("b",{children:"解析："}),s.jsx(v,{children:e.analysis})]})]},e.id)}),s.jsx("div",{className:"wbp-foot",children:"研砖 · yanbrick.com"})]}),s.jsx("style",{children:L})]}):s.jsx("div",{className:"loading",children:"加载中…"}):s.jsx("div",{className:"page",children:s.jsx(q,{what:"错题本导出"})})}const L=`
.wbprint { max-width:820px; margin:0 auto; padding:16px; }
.wbprint .wbp-toolbar { display:flex; align-items:center; gap:16px; margin-bottom:16px; }
.wbprint .wbp-toolbar h2 { margin:0; }
.wbprint .wbp-title { font-size:20px; margin:0 0 16px; }
.wbprint .wbp-q { break-inside:avoid; page-break-inside:avoid; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #eee; }
.wbprint .wbp-qhead { font-size:13px; color:#555; margin-bottom:6px; }
.wbprint .wbp-src { color:#888; }
.wbprint .wbp-stem { line-height:1.7; }
.wbprint .wbp-opts { margin:8px 0; display:flex; flex-direction:column; gap:4px; }
.wbprint .wbp-opt.correct { background:#dcfce7; border-radius:4px; padding:1px 4px; }
.wbprint .wbp-ans { margin-top:6px; }
.wbprint .wbp-analysis { margin-top:6px; color:#333; font-size:14px; }
.wbprint .wbp-foot { text-align:center; color:#bbb; font-size:12px; margin-top:24px; }
@media print {
  .no-print { display:none !important; }
  .wbprint { max-width:100%; padding:0; }
  .wbprint .wbp-opt.correct { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { margin:1.4cm; }
}
`;export{B as default};
