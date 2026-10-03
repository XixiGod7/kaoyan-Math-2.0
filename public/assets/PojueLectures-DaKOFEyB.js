import{j as e}from"./index-BKBOZrcM.js";import{r as t,L as l}from"./vendor-C1PfG1cZ.js";import{T as x}from"./Tex-CY-qobdC.js";import{i as y}from"./pojue-index-VMBfDHrC.js";import"./katex-Dc8nsIP1.js";const i=y.entries,u=a=>`/pojue/jiangyi/${encodeURIComponent(a)}`,h=[{pre:"GS",label:"高等数学"},{pre:"XD",label:"线性代数"},{pre:"GL",label:"概率统计"}],f=196;function z(){const[a,d]=t.useState(""),c=t.useMemo(()=>{const o=a.trim().toLowerCase();return o?i.filter(p=>p.title.toLowerCase().includes(o)||p.oneLiner.toLowerCase().includes(o)||p.search.some(r=>r.toLowerCase().includes(o))):i},[a]),j=t.useMemo(()=>h.map(o=>{const p=c.filter(s=>s.domain.startsWith(o.pre)),r=[];for(const s of p){let n=r.find(m=>m.domain===s.domain);n||r.push(n={domain:s.domain,domainName:s.domainName,entries:[]}),n.entries.push(s)}return{...o,doms:r}}).filter(o=>o.doms.length>0),[c]);return e.jsxs("div",{className:"page pojue-jy",children:[e.jsxs("div",{className:"pjy-hero",children:[e.jsx("h1",{children:"破题诀讲义"}),e.jsx("p",{children:"每一招一篇：什么时候用、怎么做、边界与易错——讲完直接进真题练。"}),e.jsxs("p",{className:"pjy-progress",children:["已写 ",e.jsx("b",{children:i.length})," 招 / 全谱 ",f," 招，按真题频次分批补齐。 全部招法与真题清单见 ",e.jsx(l,{to:"/pojue",children:"破题诀总览"}),"。"]})]}),i.length>3&&e.jsx("input",{className:"pjy-search",type:"search",placeholder:"搜招法名 / 关键词，如「等价」「渐近线」",value:a,onChange:o=>d(o.target.value)}),j.map(o=>e.jsxs("section",{className:"pjy-subject",children:[e.jsx("h2",{children:o.label}),o.doms.map(p=>e.jsxs("div",{className:"card pjy-domain",children:[e.jsx("div",{className:"pjy-dname",children:p.domainName}),p.entries.map(r=>e.jsxs(l,{className:"pjy-item",to:u(r.title),children:[e.jsx("span",{className:"pjy-title",children:r.title}),e.jsx("span",{className:"pjy-liner",children:e.jsx(x,{children:r.oneLiner})}),e.jsx("span",{className:"pjy-go",children:"读讲义 →"})]},r.code))]},p.domain))]},o.pre)),j.length===0&&e.jsxs("div",{className:"card dim pjy-empty",children:[a?`没搜到「${a}」相关的讲义——可能还没写到，全部招法在`:"讲义还在陆续上线，全部招法在",e.jsx(l,{to:"/pojue",children:" 破题诀总览"}),"。"]}),e.jsx("style",{children:g})]})}const g=`
.pojue-jy { max-width: 780px; margin: 0 auto; }
.pojue-jy .pjy-hero { background: linear-gradient(135deg, var(--c-2563eb-b), var(--c-1d4ed8-b));
  color: var(--c-ffffff-f); border-radius: 16px; padding: 26px 26px 20px; margin-bottom: 14px; }
.pojue-jy .pjy-hero h1 { margin: 0 0 8px; font-size: calc(24px * var(--fs, 1)); font-weight: 800; letter-spacing: -0.5px; }
.pojue-jy .pjy-hero p { margin: 0 0 6px; opacity: .92; font-size: calc(14px * var(--fs, 1)); }
.pojue-jy .pjy-progress { font-size: calc(12px * var(--fs, 1)) !important; opacity: .8 !important; }
.pojue-jy .pjy-progress a { color: inherit; }
.pojue-jy .pjy-search { width: 100%; box-sizing: border-box; border: 1px solid var(--line);
  border-radius: 10px; padding: 9px 14px; font-size: calc(14px * var(--fs, 1));
  background: var(--card); color: var(--ink); margin-bottom: 14px; }
.pojue-jy .pjy-search:focus { outline: none; border-color: var(--accent); }
.pojue-jy .pjy-subject h2 { font-size: calc(15px * var(--fs, 1)); margin: 16px 2px 8px; }
.pojue-jy .pjy-domain { padding: 4px 16px; margin-bottom: 10px; }
.pojue-jy .pjy-dname { font-size: 12px; color: var(--muted); padding: 10px 0 6px; }
.pojue-jy .pjy-item { display: flex; align-items: baseline; gap: 10px; padding: 10px 0;
  border-top: 1px solid var(--line); text-decoration: none; color: inherit; }
.pojue-jy .pjy-title { flex: none; font-weight: 600; }
.pojue-jy .pjy-item:hover .pjy-title { color: var(--accent); }
.pojue-jy .pjy-liner { flex: 1; color: var(--muted); font-size: calc(13px * var(--fs, 1));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pojue-jy .pjy-go { flex: none; font-size: 12px; color: var(--accent); }
.pojue-jy .pjy-empty { padding: 16px; }
@media (max-width: 640px) {
  .pojue-jy .pjy-hero { padding: 20px 18px 14px; }
  .pojue-jy .pjy-item { flex-wrap: wrap; }
  .pojue-jy .pjy-liner { flex-basis: 100%; white-space: normal; }
}
`;export{z as default,u as lectureUrl};
