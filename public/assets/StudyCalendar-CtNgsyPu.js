import{j as e}from"./index-BKBOZrcM.js";import{r as i}from"./vendor-C1PfG1cZ.js";import{b6 as C,b7 as M}from"./EnglishApp-DlOKin9z.js";import"./noScrollChain-C96TITM-.js";import"./SubjectSwitch-oUbusq72.js";function N(t){return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`}function E(t){return t<=0?0:t<3?1:t<6?2:t<10?3:4}function Y({onClose:t}){const[n,D]=i.useState(null),[f,g]=i.useState(!1),[r,$]=i.useState(null),[s,b]=i.useState(null),[j,w]=i.useState(!1);i.useEffect(()=>{C(365).then(l=>{l?D(l):g(!0)}).catch(()=>g(!0))},[]),i.useEffect(()=>{if(!r){b(null);return}let l=!0;return w(!0),M(r).then(a=>{l&&b(a)}).finally(()=>{l&&w(!1)}),()=>{l=!1}},[r]);const p=i.useMemo(()=>{if(!n)return{weeks:0,cells:[],months:[]};const l=new Map;for(const o of n.days)l.set(o.d,o);const a=new Date(n.endDate+"T00:00:00"),c=new Date(a);for(c.setDate(a.getDate()-364);c.getDay()!==0;)c.setDate(c.getDate()-1);const x=new Date(a);for(;x.getDay()!==6;)x.setDate(x.getDate()+1);const y=[],v=[],d=new Date(c);let k=-1,h=0;const S=N(a);for(;d<=x;){const o=N(d),u=l.get(o)||null;if(y.push({date:o,day:u,level:E((u==null?void 0:u.total)??0),weekday:d.getDay(),weekIdx:h,future:o>S}),d.getDay()===0){const m=d.getMonth();m!==k&&(v.push({weekIdx:h,label:`${m+1}月`}),k=m),h++}d.setDate(d.getDate()+1)}return{weeks:h,cells:y,months:v}},[n]),z=l=>{if(l.future)return l.date;const a=l.day;if(!a)return`${l.date}　没有记录`;const c=[a.reads?`精读 ${a.reads}`:"",a.answers?`做题 ${a.answers}`:"",a.reviews?`复习 ${a.reviews}`:"",a.sections?`自测 ${a.sections}`:""].filter(Boolean);return`${l.date}　${c.join(" · ")}`};return e.jsxs("div",{className:"cal-mask",onClick:t,children:[e.jsxs("div",{className:"cal-modal",onClick:l=>l.stopPropagation(),children:[e.jsxs("div",{className:"cal-head",children:[e.jsx("b",{children:"学习日历"}),e.jsx("span",{className:"cal-sub",children:"每格一天 · 颜色越深当天做得越多"}),e.jsx("button",{className:"cal-x",onClick:t,"aria-label":"关闭",children:"✕"})]}),f&&e.jsx("div",{className:"cal-empty",children:"日历加载失败，稍后再试。"}),!f&&!n&&e.jsx("div",{className:"cal-empty",children:"加载中…"}),n&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"cal-kpi",children:[e.jsxs("span",{children:["🔥 连续 ",e.jsx("b",{children:n.streak})," 天"]}),e.jsxs("span",{children:["这一年学过 ",e.jsx("b",{children:n.activeDays})," 天"]}),e.jsxs("span",{children:["累计 ",e.jsx("b",{children:n.total})," 次"]}),e.jsxs("span",{children:["单日最多 ",e.jsx("b",{children:n.best})," 次"]})]}),e.jsx("div",{className:"cal-scroll",children:e.jsxs("div",{className:"cal-inner",children:[e.jsx("div",{className:"cal-months",style:{width:(p.weeks+1)*14},children:p.months.map(l=>e.jsx("span",{className:"cal-mlabel",style:{left:l.weekIdx*14},children:l.label},l.weekIdx))}),e.jsxs("div",{className:"cal-body",children:[e.jsxs("div",{className:"cal-wd",children:[e.jsx("span",{children:"一"}),e.jsx("span",{children:"三"}),e.jsx("span",{children:"五"})]}),e.jsx("div",{className:"cal-grid",style:{gridTemplateColumns:`repeat(${p.weeks+1}, 12px)`},children:p.cells.map(l=>e.jsx("button",{type:"button",className:`cal-cell lvl-${l.level}${l.future?" future":""}${r===l.date?" on":""}`,style:{gridColumn:l.weekIdx+1,gridRow:l.weekday+1},title:z(l),disabled:l.future,onClick:()=>$(r===l.date?null:l.date)},l.date))})]})]})}),e.jsxs("div",{className:"cal-legend",children:[e.jsx("span",{children:"少"}),[0,1,2,3,4].map(l=>e.jsx("span",{className:`cal-cell lvl-${l}`},l)),e.jsx("span",{children:"多"})]}),r&&e.jsxs("div",{className:"cal-detail",children:[e.jsx("div",{className:"cal-dhead",children:r}),j&&e.jsx("div",{className:"dim",children:"读取中…"}),!j&&s&&(s.reads.length===0&&!s.answers&&!s.reviews&&s.sections.length===0?e.jsx("div",{className:"dim",children:"这天没有记录。"}):e.jsxs("ul",{className:"cal-dlist",children:[s.reads.length>0&&e.jsxs("li",{children:[e.jsxs("b",{children:["精读 ",s.reads.length," 篇"]}),e.jsxs("span",{className:"dim",children:["　",s.reads.map(l=>`${l.exam==="en2"?"英二":"英一"} ${l.passKey}`).join("、")]})]}),s.answers>0&&e.jsxs("li",{children:[e.jsxs("b",{children:["做题 ",s.answers," 道"]}),e.jsxs("span",{className:"dim",children:["　对 ",s.correct," 道（",Math.round(s.correct/s.answers*100),"%）"]})]}),s.reviews>0&&e.jsx("li",{children:e.jsxs("b",{children:["词句复习 ",s.reviews," 次"]})}),s.sections.map((l,a)=>e.jsxs("li",{children:[e.jsx("b",{children:"自测"}),e.jsxs("span",{className:"dim",children:["　",l.exam==="en2"?"英二":"英一"," ",l.secYear," ",l.secType," · ",(l.score2x/2).toFixed(1)," 分"]})]},a))]}))]})]})]}),e.jsx("style",{children:I})]})}const I=`
.cal-mask { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:1000;
  display:flex; align-items:center; justify-content:center; padding:16px; }
.cal-modal { background:#fff; border-radius:14px; padding:18px 20px 16px; width:min(880px,100%);
  max-height:88vh; overflow:auto; box-shadow:0 12px 40px rgba(15,23,42,.24); }
.cal-head { display:flex; align-items:baseline; gap:10px; margin-bottom:12px; }
.cal-head b { font-size:17px; }
.cal-sub { color:#64748b; font-size:12px; }
.cal-x { margin-left:auto; border:none; background:none; font-size:16px; color:#94a3b8; cursor:pointer; line-height:1; }
.cal-x:hover { color:#0f172a; }
.cal-kpi { display:flex; flex-wrap:wrap; gap:14px; font-size:13px; color:#475569; margin-bottom:14px; }
.cal-kpi b { color:#0f172a; }
/* 一年 53 列在手机上放不下，横滑而不是压缩格子（压小了点不准） */
.cal-scroll { overflow-x:auto; padding-bottom:6px; }
.cal-inner { display:inline-block; min-width:max-content; }
.cal-months { position:relative; height:16px; margin-left:22px; font-size:10px; color:#94a3b8; }
.cal-mlabel { position:absolute; white-space:nowrap; }
.cal-body { display:flex; gap:4px; }
.cal-wd { display:grid; grid-template-rows:repeat(7,12px); gap:2px; font-size:9px; color:#94a3b8;
  align-content:start; }
/* 只标一三五：七个全标挤成一团 */
.cal-wd span:nth-child(1) { grid-row:2; } .cal-wd span:nth-child(2) { grid-row:4; }
.cal-wd span:nth-child(3) { grid-row:6; }
.cal-grid { display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,12px); gap:2px; }
.cal-cell { width:12px; height:12px; border-radius:2px; border:none; padding:0; cursor:pointer;
  background:#ebedf0; }
.cal-cell.lvl-1 { background:#c6e48b; } .cal-cell.lvl-2 { background:#7bc96f; }
.cal-cell.lvl-3 { background:#239a3b; } .cal-cell.lvl-4 { background:#196127; }
.cal-cell.future { visibility:hidden; }
.cal-cell.on { outline:2px solid #2563eb; outline-offset:1px; }
.cal-cell:not(.future):hover { outline:1px solid #94a3b8; outline-offset:1px; }
.cal-legend { display:flex; align-items:center; gap:4px; justify-content:flex-end;
  font-size:10px; color:#94a3b8; margin-top:10px; }
.cal-legend .cal-cell { width:10px; height:10px; cursor:default; }
.cal-detail { margin-top:14px; border-top:1px solid #e2e8f0; padding-top:12px; }
.cal-dhead { font-weight:600; margin-bottom:6px; }
.cal-dlist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; font-size:13px; }
.cal-detail .dim { color:#64748b; font-size:13px; }
.cal-empty { color:#64748b; padding:20px 0; }
`;export{Y as default};
