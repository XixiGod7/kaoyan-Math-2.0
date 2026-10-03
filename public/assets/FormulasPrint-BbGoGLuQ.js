import{j as e}from"./index-BKBOZrcM.js";import{d as b,r as l}from"./vendor-C1PfG1cZ.js";import{T as n}from"./Tex-CY-qobdC.js";import{u as j}from"./formulas-DCcmkE-d.js";import"./katex-Dc8nsIP1.js";const g=["高等数学","线性代数","概率论与数理统计"],u=["数学一","数学二","数学三"];function P(){const r=j(),[d,f]=b(),a=d.get("paper")||"",[x,m]=l.useState(!0),o=s=>f(s?{paper:s}:{},{replace:!0}),c=l.useMemo(()=>g.map(s=>({part:s,chaps:r.chapters.filter(p=>p.part===s&&(!a||p.papers.includes(a))).map(p=>({chapter:p.chapter,ents:p.entries.filter(t=>!a||!t.papers||t.papers.includes(a))})).filter(p=>p.ents.length>0)})).filter(s=>s.chaps.length>0),[r,a]),h=c.reduce((s,p)=>s+p.chaps.reduce((t,i)=>t+i.ents.length,0),0);return r.chapters.length?e.jsxs("div",{className:"fxprint",children:[e.jsxs("div",{className:"fxp-toolbar no-print",children:[e.jsxs("h2",{children:["公式手册 · 打印卡",e.jsxs("span",{className:"dim",children:[" · ",h," 条"]})]}),e.jsxs("div",{className:"fxp-papers",children:[e.jsx("button",{className:`bk-chip${a===""?" on":""}`,onClick:()=>o(""),children:"全部卷"}),u.map(s=>e.jsx("button",{className:`bk-chip${a===s?" on":""}`,onClick:()=>o(s),children:s},s))]}),e.jsxs("label",{children:[e.jsx("input",{type:"checkbox",checked:x,onChange:s=>m(s.target.checked)})," 含注解"]}),e.jsx("button",{className:"admin-primary",onClick:()=>window.print(),children:"打印 / 存为 PDF"}),e.jsxs("span",{className:"dim fxp-tip",children:["在打印对话框里把「目标打印机」选成 ",e.jsx("b",{children:"另存为 PDF"})," 即可导出。建议 A4、缩放 100%、勾选背景图形。"]})]}),e.jsxs("div",{className:"fxp-doc",children:[e.jsxs("h1",{className:"fxp-title",children:["考研数学公式手册",a&&` · ${a}`]}),c.map(s=>e.jsxs("section",{className:"fxp-part",children:[e.jsx("h2",{className:"fxp-parth",children:s.part}),s.chaps.map(p=>e.jsxs("div",{className:"fxp-chap",children:[e.jsx("h3",{className:"fxp-chaph",children:p.chapter}),e.jsx("div",{className:"fxp-cards",children:p.ents.map((t,i)=>e.jsxs("div",{className:"fxp-card",children:[e.jsx("div",{className:"fxp-t",children:e.jsx(n,{children:t.title})}),e.jsx("div",{className:"fxp-x",children:e.jsx(n,{children:`$$${t.latex}$$`})}),x&&t.note&&e.jsx("div",{className:"fxp-n",children:e.jsx(n,{children:t.note})})]},i))})]},p.chapter))]},s.part)),e.jsx("div",{className:"fxp-foot",children:"研砖 · yanbrick.com"})]}),e.jsx("style",{children:N})]}):e.jsx("div",{className:"loading",children:"加载中…"})}const N=`
.fxprint { max-width: 980px; margin: 0 auto; padding: 16px; }
.fxprint .fxp-toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.fxprint .fxp-toolbar h2 { margin: 0; }
.fxprint .fxp-papers { display: flex; gap: 6px; }
.fxprint .fxp-tip { flex-basis: 100%; font-size: 12px; }
.fxprint .fxp-title { font-size: 20px; margin: 0 0 14px; }
.fxprint .fxp-parth { font-size: 16px; margin: 18px 0 8px; border-bottom: 2px solid #333; padding-bottom: 3px; }
.fxprint .fxp-chaph { font-size: 14px; margin: 12px 0 6px; color: #444; }
/* 两栏：公式是速查用的，单列排浪费大半张纸 */
.fxprint .fxp-cards { column-count: 2; column-gap: 18px; }
/* ⚠️ 一条公式被腰斩在两页/两栏之间，这张卡就废了 */
.fxprint .fxp-card { break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid;
  margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
.fxprint .fxp-t { font-size: 13px; color: #333; margin-bottom: 2px; }
.fxprint .fxp-x { font-size: 13px; overflow-x: auto; }
.fxprint .fxp-n { font-size: 12px; color: #666; margin-top: 2px; }
.fxprint .fxp-foot { text-align: center; color: #bbb; font-size: 12px; margin-top: 22px; }
@media print {
  .no-print { display: none !important; }
  .fxprint { max-width: 100%; padding: 0; }
  /* 章标题不许落在页尾（下面紧跟的公式会被推到下一页，标题就成了孤儿） */
  .fxprint .fxp-parth, .fxprint .fxp-chaph { break-after: avoid; page-break-after: avoid; }
  @page { margin: 1.2cm; }
}
`;export{P as default};
