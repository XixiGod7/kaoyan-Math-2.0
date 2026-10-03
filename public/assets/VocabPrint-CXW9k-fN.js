import{j as e}from"./index-BKBOZrcM.js";import{d as k,r as t}from"./vendor-C1PfG1cZ.js";import{ay as y}from"./EnglishApp-DlOKin9z.js";import"./noScrollChain-C96TITM-.js";import"./SubjectSwitch-oUbusq72.js";const z=200,f=12;function q(){const[p]=k(),c=p.get("tier")||"必考词",d=p.get("unit"),a=d==null||d===""?null:Number(d),n=p.get("q")||"",[o,g]=t.useState([]),[v,b]=t.useState(!1),[j,h]=t.useState(!1),[x,w]=t.useState(!1),[m,N]=t.useState(3);t.useEffect(()=>{let s=!0;return b(!1),h(!1),(async()=>{const i=[];for(let r=0;r<f;r++){const l=await y({tier:c,unit:a,q:n||void 0,page:r,size:z});if(!s)return;if(i.push(...l.rows),i.length>=l.total||l.rows.length===0)break;r===f-1&&i.length<l.total&&h(!0)}s&&(g(i),b(!0))})(),()=>{s=!1}},[c,a,n]);const u=`${c}${a!=null?` · U${a}`:" · 全部单元"}${n?` · 搜「${n}」`:""}`;return e.jsxs("div",{className:"vbprint",children:[e.jsxs("div",{className:"vbp-toolbar no-print",children:[e.jsxs("h2",{children:["词书导出",e.jsxs("span",{className:"dim",children:[" · ",u," · ",o.length," 词"]})]}),e.jsxs("label",{children:[e.jsx("input",{type:"checkbox",checked:x,onChange:s=>w(s.target.checked)})," 带音标"]}),e.jsxs("label",{children:["栏数",e.jsxs("select",{value:m,onChange:s=>N(Number(s.target.value)),children:[e.jsx("option",{value:2,children:"2"}),e.jsx("option",{value:3,children:"3"}),e.jsx("option",{value:4,children:"4"})]})]}),e.jsx("button",{className:"admin-primary",disabled:!v,onClick:()=>window.print(),children:"打印 / 存为 PDF"})]}),!v&&e.jsx("div",{className:"rd-loading",children:"正在取词…"}),j&&e.jsxs("div",{className:"vbp-warn no-print",children:["这一档词太多，只取到前 ",o.length," 个。按单元分开打印（上面那排 U1、U2…）会更好背，也不会漏。"]}),v&&e.jsxs("div",{className:"vbp-doc",children:[e.jsxs("h1",{className:"vbp-title",children:[u,e.jsxs("span",{className:"vbp-count",children:[o.length," 词"]})]}),e.jsx("div",{className:"vbp-list",style:{columnCount:m},children:o.map(s=>e.jsxs("div",{className:"vbp-row",children:[e.jsx("b",{children:s.word}),x&&s.phon&&e.jsx("i",{className:"vbp-phon",children:s.phon}),e.jsx("span",{className:"vbp-gloss",children:s.gloss||""})]},s.word))})]}),e.jsx("style",{children:`
.vbprint { padding: 12px 0 40px; }
.vbp-toolbar { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
.vbp-toolbar h2 { margin:0; font-size:calc(16px * var(--fs, 1)); }
.vbp-toolbar label { display:flex; align-items:center; gap:5px; font-size:calc(13px * var(--fs, 1)); color:var(--muted); }
.vbp-warn { margin:0 0 12px; padding:8px 10px; border-radius:8px; background:var(--bg); color:var(--muted); font-size:calc(13px * var(--fs, 1)); }
.vbp-title { font-size:calc(18px * var(--fs, 1)); margin:0 0 10px; display:flex; align-items:baseline; gap:10px; }
.vbp-count { font-size:calc(12px * var(--fs, 1)); color:var(--muted); font-weight:400; }
.vbp-list { column-gap:22px; }
/* ⚠️ 分栏里必须禁止行内断栏，否则一个词的释义会被拦腰劈到下一栏顶上 */
.vbp-row { break-inside:avoid; -webkit-column-break-inside:avoid; page-break-inside:avoid;
  padding:2px 0; font-size:calc(12.5px * var(--fs, 1)); line-height:1.55; }
.vbp-row b { font-family:Georgia, serif; font-weight:600; margin-right:6px; }
.vbp-phon { font-style:normal; color:var(--muted); margin-right:6px; font-size:calc(11.5px * var(--fs, 1)); }
.vbp-gloss { color:var(--muted); }
@media print {
  .no-print { display:none !important; }
  /* 打印时一律走白底黑字：暗色模式下直接打会印出一整页黑（也费墨） */
  .vbprint, .vbp-doc { background:#fff !important; color:#000 !important; }
  .vbp-row, .vbp-gloss, .vbp-phon { color:#000 !important; }
  .vbp-title { font-size:15px; }
  .vbp-row { font-size:10.5px; line-height:1.4; }
}
      `})]})}export{q as default};
