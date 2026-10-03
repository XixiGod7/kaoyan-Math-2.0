import{j as e,_ as o}from"./index-BKBOZrcM.js";import{c as y,r as j,L as a}from"./vendor-C1PfG1cZ.js";import{i as v,a as E}from"./auth-BFNYYDaf.js";import{M as L}from"./Md-k3-rmIqK.js";import{T as N}from"./Tex-CY-qobdC.js";import{N as D}from"./NeedLogin-BeqfaK2X.js";import{i as T}from"./pojue-index-VMBfDHrC.js";import"./noScrollChain-C96TITM-.js";import"./katex-Dc8nsIP1.js";const I=T.entries,O=Object.assign({"../generated/pojue/GL01.json":()=>o(()=>import("./GL01-ClMkxdvW.js"),[]),"../generated/pojue/GL02.json":()=>o(()=>import("./GL02-DQXbKKQ6.js"),[]),"../generated/pojue/GL03.json":()=>o(()=>import("./GL03-BlYjMoI6.js"),[]),"../generated/pojue/GL04.json":()=>o(()=>import("./GL04-CNuGABYU.js"),[]),"../generated/pojue/GL05.json":()=>o(()=>import("./GL05-D2jCaSss.js"),[]),"../generated/pojue/GL06.json":()=>o(()=>import("./GL06-D96bIPFB.js"),[]),"../generated/pojue/GL07.json":()=>o(()=>import("./GL07-_pR4fl5_.js"),[]),"../generated/pojue/GS01.json":()=>o(()=>import("./GS01-emsh59TX.js"),[]),"../generated/pojue/GS02.json":()=>o(()=>import("./GS02-DTsvinxo.js"),[]),"../generated/pojue/GS03.json":()=>o(()=>import("./GS03-BsbVTkU6.js"),[]),"../generated/pojue/GS04.json":()=>o(()=>import("./GS04-DjdkPmAj.js"),[]),"../generated/pojue/GS05.json":()=>o(()=>import("./GS05-MKDTKjyn.js"),[]),"../generated/pojue/GS06.json":()=>o(()=>import("./GS06-CHcmjGvz.js"),[]),"../generated/pojue/GS07.json":()=>o(()=>import("./GS07-D4SeFSmh.js"),[]),"../generated/pojue/GS08.json":()=>o(()=>import("./GS08-tbEyrZsI.js"),[]),"../generated/pojue/GS09.json":()=>o(()=>import("./GS09-q7lVT284.js"),[]),"../generated/pojue/GS10.json":()=>o(()=>import("./GS10-CyfUWzUm.js"),[]),"../generated/pojue/GS11.json":()=>o(()=>import("./GS11-DgiVoejP.js"),[]),"../generated/pojue/XD01.json":()=>o(()=>import("./XD01-CevkIK0m.js"),[]),"../generated/pojue/XD02.json":()=>o(()=>import("./XD02-B9_5jekb.js"),[]),"../generated/pojue/XD03.json":()=>o(()=>import("./XD03-CMEJUNcw.js"),[]),"../generated/pojue/XD04.json":()=>o(()=>import("./XD04-CojG7Tyc.js"),[]),"../generated/pojue/XD05.json":()=>o(()=>import("./XD05-D90hTwJk.js"),[]),"../generated/pojue/XD06.json":()=>o(()=>import("./XD06-C1DtKzrA.js"),[])});function P(p){return p.split(/^## /m).filter(t=>t.trim()).map(t=>{const s=t.indexOf(`
`);return s<0?{title:t.trim(),body:""}:{title:t.slice(0,s).trim(),body:t.slice(s+1).trim()}})}function X(){const{code:p=""}=y(),t=I.find(r=>r.title===p||r.code===p),[s,_]=j.useState(""),[g,f]=j.useState(""),[i,d]=j.useState("idle");if(j.useEffect(()=>{if(!t)return;let r=!0;const c=t.code,u=O[`../generated/pojue/${t.domain}.json`];return u&&u().then(n=>{var m;r&&_(((m=n.entries.find(b=>b.code===c))==null?void 0:m.summaryMd)??"")}),v()&&(d("loading"),E(`/api/pojue/${c}`).then(n=>n.ok?n.json():null).then(n=>{r&&(n!=null&&n.fullMd?(f(n.fullMd),d("ok")):d("miss"))}).catch(()=>r&&d("miss"))),()=>{r=!1}},[p,t]),!t)return e.jsxs("div",{className:"page pojue-entry",children:[e.jsxs("div",{className:"card dim",children:["这一招的讲义还没写好（按真题频次分批铺）。",e.jsx("div",{style:{marginTop:8},children:e.jsx(a,{to:"/pojue/jiangyi",children:"← 看已有的讲义"})})]}),e.jsx("style",{children:x})]});const h=P(i==="ok"?g:s),l=`/pojue?m=${t.code}`;return e.jsxs("div",{className:"page pojue-entry",children:[e.jsxs("div",{className:"pje-hero",children:[e.jsxs("div",{className:"pje-crumb",children:[e.jsx(a,{to:"/pojue/jiangyi",children:"破题诀讲义"}),e.jsx("span",{className:"pje-sep",children:"/"}),t.domainName,e.jsx("span",{className:"pje-code",children:t.code}),t.status==="draft"&&e.jsx("span",{className:"pje-draft",children:"草稿"})]}),e.jsx("h1",{children:t.title}),e.jsxs("p",{className:"pje-liner",children:[e.jsx("span",{className:"pje-liner-tag",children:"诀"}),e.jsx(N,{children:t.oneLiner})]}),e.jsxs("div",{className:"pje-hero-cta",children:[e.jsx(a,{className:"pje-btn solid",to:l,children:"去练这招 →"}),e.jsx("span",{className:"pje-btn-note",children:"范题 · 按难度分段连刷 · 验收"})]})]}),h.map((r,c)=>e.jsxs("section",{className:"card pje-sec",children:[e.jsxs("div",{className:"pje-sec-head",children:[e.jsx("span",{className:"pje-sec-no",children:String(c+1).padStart(2,"0")}),e.jsx("h3",{children:r.title})]}),e.jsx("div",{className:"pje-sec-body",children:e.jsx(L,{children:r.body})})]},r.title)),i==="loading"&&e.jsx("div",{className:"card pje-sec dim",children:"完整讲义加载中…"}),i==="miss"&&e.jsx("div",{className:"card pje-sec dim",children:"完整讲义暂不可用，稍后再试。"}),i==="idle"&&e.jsxs("div",{className:"card pje-sec pje-gate",children:[e.jsxs("div",{className:"pje-sec-head",children:[e.jsx("span",{className:"pje-sec-no",children:"02"}),e.jsx("h3",{children:"怎么做"}),e.jsx("span",{className:"pje-sep-dot",children:"·"}),e.jsx("span",{className:"pje-sec-no",children:"03"}),e.jsx("h3",{children:"边界与易错"})]}),e.jsx("p",{className:"dim",children:"往下还有两节：这一招的步骤与等价表、最高发的错误和判据、与相邻招法的分界。"}),e.jsx(D,{what:"完整讲义"})]}),i==="ok"&&e.jsxs("div",{className:"pje-foot",children:[e.jsx(a,{className:"pje-btn solid",to:l,children:"去练这招 →"}),e.jsx(a,{className:"pje-btn ghost",to:"/pojue/jiangyi",children:"更多讲义"})]}),e.jsx("style",{children:x})]})}const x=`
.pojue-entry { max-width: 780px; margin: 0 auto; }

/* hero：与首页同一套蓝渐变 token。白字写死——它在蓝底上，不跟主题走 */
.pojue-entry .pje-hero { background: linear-gradient(135deg, var(--c-2563eb-b), var(--c-1d4ed8-b));
  color: var(--c-ffffff-f); border-radius: 16px; padding: 26px 26px 22px; margin-bottom: 16px; }
.pojue-entry .pje-crumb { font-size: 12px; opacity: .85; margin-bottom: 10px;
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.pojue-entry .pje-crumb a { color: inherit; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.4); }
.pojue-entry .pje-crumb a:hover { border-bottom-color: currentColor; }
.pojue-entry .pje-sep { opacity: .5; }
.pojue-entry .pje-code { font-size: 11px; border: 1px solid rgba(255,255,255,.4);
  border-radius: 99px; padding: 1px 8px; }
.pojue-entry .pje-draft { font-size: 11px; background: rgba(255,255,255,.2);
  border-radius: 99px; padding: 1px 8px; }
.pojue-entry .pje-hero h1 { margin: 0 0 12px; font-size: calc(26px * var(--fs, 1));
  font-weight: 800; letter-spacing: -0.5px; }
.pojue-entry .pje-liner { display: flex; align-items: baseline; gap: 10px; margin: 0 0 16px;
  font-size: calc(15px * var(--fs, 1)); line-height: 1.6; }
.pojue-entry .pje-liner-tag { flex: none; font-size: 12px; font-weight: 700;
  border: 1px solid rgba(255,255,255,.55); border-radius: 6px; padding: 1px 7px; }
.pojue-entry .pje-hero-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pojue-entry .pje-btn { display: inline-block; border-radius: 10px; padding: 8px 16px;
  font-size: calc(14px * var(--fs, 1)); text-decoration: none; }
.pojue-entry .pje-hero .pje-btn.solid { background: var(--c-ffffff); color: var(--c-2563eb); font-weight: 600; }
.pojue-entry .pje-btn-note { font-size: 12px; opacity: .8; }

/* 小节卡：编号 + 竖线是层级，不是装饰 */
.pojue-entry .pje-sec { padding: 16px 20px 14px; margin-bottom: 12px; }
.pojue-entry .pje-sec-head { display: flex; align-items: baseline; gap: 8px;
  padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--line); }
.pojue-entry .pje-sec-no { font-size: 12px; font-weight: 700; color: var(--accent);
  font-variant-numeric: tabular-nums; }
.pojue-entry .pje-sec-head h3 { margin: 0; font-size: calc(16px * var(--fs, 1)); font-weight: 700; }
.pojue-entry .pje-sep-dot { color: var(--muted); }
.pojue-entry .pje-sec-body { line-height: 1.95; font-size: calc(15px * var(--fs, 1)); }
/* 公式档位与题干同层：全站基准 1.12em（styles.css 的 katex sizing），
   阅读重点区（题干/讲义正文）统一再抬到 1.18em——讲义是逐行读公式的页。 */
.pojue-entry .pje-sec-body .katex { font-size: 1.18em; }

/* 等价表：讲义的核心工具，行距与斑马纹让它像张能查的表。
   表格与 display 公式可能超宽：在自己容器里横滚，别让整页出横条 */
.pojue-entry .pje-sec-body .md-tbl { display: block; overflow-x: auto; width: 100%;
  border-collapse: collapse; margin: 10px 0; }
.pojue-entry .pje-sec-body .md-tbl th { text-align: left; font-weight: 600; color: var(--muted);
  font-size: 12px; padding: 6px 32px 6px 14px; border: 0; border-bottom: 1px solid var(--line); background: none; }
.pojue-entry .pje-sec-body .md-tbl td { padding: 9px 32px 9px 14px; border: 0; border-bottom: 1px solid var(--line); }
.pojue-entry .pje-sec-body .md-tbl tbody tr:nth-child(odd) { background: var(--bg); }
.pojue-entry .pje-sec-body .md-tbl tbody tr:last-child td { border-bottom: 0; }

/* 登录闸：说清门后有什么，再给门 */
.pojue-entry .pje-gate .need-login { padding: 10px 0 4px; }

.pojue-entry .pje-foot { display: flex; gap: 10px; margin: 4px 0 24px; flex-wrap: wrap; }
.pojue-entry .pje-foot .pje-btn.solid { background: var(--accent-fill); color: var(--c-ffffff-f); font-weight: 600; }
.pojue-entry .pje-foot .pje-btn.ghost { border: 1px solid var(--line); color: var(--muted); background: var(--card); }
.pojue-entry .pje-foot .pje-btn.ghost:hover { border-color: var(--accent); color: var(--accent); }

@media (max-width: 640px) {
  .pojue-entry .pje-hero { padding: 20px 18px 16px; border-radius: 14px; }
  .pojue-entry .pje-hero h1 { font-size: calc(22px * var(--fs, 1)); }
  .pojue-entry .pje-sec { padding: 14px 14px 12px; }
  .pojue-entry .pje-sec-body .md-tbl th, .pojue-entry .pje-sec-body .md-tbl td { padding: 6px 8px; }
}
`;export{X as default};
