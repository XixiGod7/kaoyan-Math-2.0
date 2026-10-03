import{j as t}from"./index-BKBOZrcM.js";import{d as J,r as p,L as I}from"./vendor-C1PfG1cZ.js";import{T as U}from"./Tex-CY-qobdC.js";import{u as ee}from"./prereq-Bc7Z2jou.js";import{u as te}from"./kgFigures-ChCwv7-S.js";import"./katex-Dc8nsIP1.js";const oe=["数学一","数学二","数学三"],F=172,G=50,D=22,X=54,_=30,V={高等数学:{bg:"#e9f8f1",bd:"#34b187",tx:"#0a7a55"},线性代数:{bg:"#eaf0ff",bd:"#6486f0",tx:"#3556c4"},概率论与数理统计:{bg:"#fdf2e4",bd:"#e0a24f",tx:"#b1701a"}},se={bg:"#f1f2f5",bd:"#c4c9d4",tx:"#56607a"},Y=d=>d&&V[d]||se;function ne(d,w){const a=new Set(d),h=new Map,x=new Map;d.forEach(o=>{h.set(o,[]),x.set(o,[])});const f=[],m=new Set;for(const o of w){if(!a.has(o.from)||!a.has(o.to)||o.from===o.to)continue;const r=o.from+"\0"+o.to;m.has(r)||(m.add(r),f.push(o),h.get(o.from).push(o.to),x.get(o.to).push(o.from))}const z=new Map,S=new Set,H=o=>{const r=z.get(o);if(r!==void 0)return r;if(S.has(o))return 0;S.add(o);let n=0;for(const l of x.get(o)||[])n=Math.max(n,H(l)+1);return S.delete(o),z.set(o,n),n};d.forEach(H);const k=new Map;let y=0;d.forEach(o=>{const r=z.get(o);y=Math.max(y,r),k.has(r)||k.set(r,[]),k.get(r).push(o)});const j=new Map;k.forEach(o=>o.forEach((r,n)=>j.set(r,n)));const E=(o,r)=>{const n=(r.get(o)||[]).map(l=>j.get(l)).filter(l=>l!=null);return n.length?n.reduce((l,c)=>l+c,0)/n.length:j.get(o)};for(let o=0;o<4;o++){for(let r=1;r<=y;r++){const n=k.get(r);n&&(n.sort((l,c)=>E(l,x)-E(c,x)),n.forEach((l,c)=>j.set(l,c)))}for(let r=y-1;r>=0;r--){const n=k.get(r);n&&(n.sort((l,c)=>E(l,h)-E(c,h)),n.forEach((l,c)=>j.set(l,c)))}}const $=F+D;let L=0;k.forEach(o=>{L=Math.max(L,o.length*$-D)});const P=new Map;return k.forEach((o,r)=>{const n=o.length*$-D,l=_+(L-n)/2;o.forEach((c,O)=>P.set(c,{x:l+O*$,y:_+r*(G+X)}))}),{positions:P,edges:f,deps:h,width:L+_*2,height:_*2+(y+1)*(G+X)-X}}function re(d,w){const a=new Set([d]),h=[],x=[d];for(;x.length;){const f=x.pop();for(const m of w[f]||[])h.push({from:f,to:m}),a.has(m)||(a.add(m),x.push(m))}return{nodes:[...a],edges:h}}function ae(d,w){const a=new Set([d]),h=[d];for(;h.length;){const x=h.pop();for(const f of w.get(x)||[])a.has(f)||(a.add(f),h.push(f))}return a}function ie(d,w){const a=d.x+F/2,h=d.y+G,x=w.x+F/2,f=w.y,m=(h+f)/2;return`M${a},${h} C${a},${m} ${x},${m} ${x},${f}`}function ge(){const[d,w]=J(),a=d.get("kp")??"",[h,x]=p.useState({}),[f,m]=p.useState("数学一"),[z,S]=p.useState(""),[H,k]=p.useState(""),[y,j]=p.useState(1),[E,$]=p.useState(""),L=p.useRef(null),P=p.useRef(!1),o=ee(),r=te();p.useEffect(()=>{fetch("/api/syllabus").then(e=>e.ok?e.json():{}).then(e=>x(e)).catch(()=>{})},[]);const n=p.useMemo(()=>h[f]??[],[h,f]),l=p.useMemo(()=>{const e=new Map;return n.forEach(s=>e.set(s.kp,s)),e},[n]),c=p.useMemo(()=>new Set(n.map(e=>e.kp)),[n]),O=p.useMemo(()=>[...c],[c]),C=p.useMemo(()=>{const e=new Map;for(const s of n){const i=s.part+"||"+s.chapter;e.has(i)||e.set(i,{part:s.part,chapter:s.chapter,key:i,kps:[]}),e.get(i).kps.push(s.kp)}return[...e.values()]},[n]),T=p.useMemo(()=>{if(!C.length)return"";let e=C[0].key,s=-1;for(const i of C){const b=new Set(i.kps);let v=0;for(const u of i.kps)for(const W of o[u]||[])(b.has(W)||c.has(W))&&v++;v>s&&(s=v,e=i.key)}return e},[C,o,c]);p.useEffect(()=>{P.current&&C.some(e=>e.key===z)||T&&S(T)},[T,C,z]);const R=C.find(e=>e.key===z)??null,N=!!a,M=p.useMemo(()=>{if(N)return{...re(a,o),ghosts:new Set};if(!R)return{nodes:[],edges:[],ghosts:new Set};const e=new Set(R.kps),s=[...R.kps],i=new Set,b=[];for(const v of R.kps)for(const u of o[v]||[])e.has(u)?b.push({from:v,to:u}):c.has(u)&&(i.has(u)||(i.add(u),s.push(u)),b.push({from:v,to:u}));return{nodes:s,edges:b,ghosts:i}},[N,a,R,o,c]),g=p.useMemo(()=>ne(M.nodes,M.edges),[M]);p.useLayoutEffect(()=>{const e=L.current;if(!e||g.width===0)return;const s=e.clientWidth-6;j(Math.min(1,+(s/g.width).toFixed(2)))},[g]);const K=p.useMemo(()=>E&&g.positions.has(E)?ae(E,g.deps):N?new Set(M.nodes):null,[E,g,N,M.nodes]),Z=N?M.nodes.length-1:0,A=l.get(a);function q(e){if($(""),w(e?{kp:e}:{},{replace:!1}),e){const s=l.get(e);s&&S(s.part+"||"+s.chapter)}}const Q=e=>{k(e),c.has(e)&&q(e)},B=e=>(r[e]??[]).length>0;return t.jsxs("div",{className:"page learning-path",children:[t.jsxs("h2",{className:"page-title",children:["学习路径",t.jsx("small",{children:N?"从下往上越来越基础——点节点看它的前置链，点卡片去学这个考点":"点考点看「要学会它，得先掌握哪些前置」的依赖图"})]}),t.jsxs("div",{className:"lp-controls",children:[t.jsx("div",{className:"tabs",style:{marginBottom:0},children:oe.map(e=>t.jsx("button",{className:e===f?"tab on":"tab",onClick:()=>{m(e),w({}),k(""),P.current=!1,S("")},children:e},e))}),t.jsxs("div",{className:"lp-search",children:[t.jsx("input",{list:"lp-kp-options",placeholder:"🔍 搜索任意考点，直达它的前置链…",value:N?a:H,onChange:e=>Q(e.target.value)}),t.jsx("datalist",{id:"lp-kp-options",children:O.map(e=>t.jsx("option",{value:e},e))})]})]}),N?t.jsxs("div",{className:"lp-egobar",children:[t.jsx("button",{className:"lp-back",onClick:()=>q(""),children:"← 返回章节图"}),t.jsxs("div",{className:"lp-egotitle",children:[t.jsx("span",{className:"lp-egodot",style:{background:Y(A==null?void 0:A.part).bd}}),t.jsx(I,{to:`/kp?kp=${encodeURIComponent(a)}`,className:"lp-egolink",children:t.jsx(U,{children:a})}),B(a)&&t.jsx("span",{className:"lp-vbadge",title:"有几何讲解图",children:"📊"})]}),t.jsxs("span",{className:"lp-egometa",children:[Z===0?"基础考点 · 无前置依赖":`前置 ${Z} 个考点`,A&&` · ${A.chapter}`]}),t.jsx(I,{to:`/kp?kp=${encodeURIComponent(a)}`,className:"lp-study",children:"去学这个考点 ↗"})]}):t.jsx("div",{className:"lp-rail",children:C.map(e=>{const s=Y(e.part),i=e.key===z;return t.jsxs("button",{className:`lp-rail-chip${i?" on":""}`,style:i?{background:s.bg,borderColor:s.bd,color:s.tx}:void 0,onClick:()=>{P.current=!0,S(e.key)},title:e.part,children:[e.chapter,t.jsx("b",{children:e.kps.length})]},e.key)})}),t.jsxs("section",{className:"card lp-graphcard",children:[t.jsxs("div",{className:"lp-stage-tools",children:[t.jsx("span",{className:"lp-hint",children:N?M.nodes.length<=1?"这是一个基础考点，没有前置依赖，可以直接开始学。":"↓ 箭头指向「需要先掌握」的考点 · 点任意节点钻取它的前置链":"实线＝本章依赖 · 虚线节点＝来自其他章的前置 · 悬停看链 · 点节点展开完整前置"}),t.jsxs("div",{className:"lp-zoom",children:[t.jsx("button",{onClick:()=>j(e=>Math.max(.5,+(e-.1).toFixed(2))),title:"缩小",children:"−"}),t.jsxs("button",{onClick:()=>j(1),title:"重置",children:[Math.round(y*100),"%"]}),t.jsx("button",{onClick:()=>j(e=>Math.min(1.6,+(e+.1).toFixed(2))),title:"放大",children:"＋"})]})]}),t.jsx("div",{className:"lp-stage-wrap",ref:L,children:M.nodes.length===0?t.jsx("div",{className:"lp-empty",children:"选一个章节或搜索考点"}):t.jsx("div",{className:"lp-stage-outer",style:{width:g.width*y,height:g.height*y},children:t.jsxs("div",{className:"lp-stage",style:{width:g.width,height:g.height,transform:`scale(${y})`,transformOrigin:"top left"},children:[t.jsxs("svg",{className:"lp-edges",width:g.width,height:g.height,"aria-hidden":"true",children:[t.jsxs("defs",{children:[t.jsx("marker",{id:"lp-arrow",markerWidth:"9",markerHeight:"9",refX:"5.2",refY:"3",orient:"auto",children:t.jsx("path",{d:"M0,0 L6,3 L0,6 Z",fill:"#9aa4bb"})}),t.jsx("marker",{id:"lp-arrow-on",markerWidth:"9",markerHeight:"9",refX:"5.2",refY:"3",orient:"auto",children:t.jsx("path",{d:"M0,0 L6,3 L0,6 Z",fill:"var(--accent)"})})]}),g.edges.map(e=>{const s=g.positions.get(e.from),i=g.positions.get(e.to),b=K?K.has(e.from)&&K.has(e.to):!1;return t.jsx("path",{d:ie(s,i),fill:"none",className:b?"lp-edge on":"lp-edge",markerEnd:`url(#${b?"lp-arrow-on":"lp-arrow"})`},e.from+">"+e.to)})]}),M.nodes.map(e=>{const s=g.positions.get(e),i=l.get(e),b=Y(i==null?void 0:i.part),v=N&&e===a,u=M.ghosts.has(e),W=K?!K.has(e):!1;return t.jsxs("button",{className:`lp-node${v?" is-root":""}${u?" is-ghost":""}${W?" dim":""}`,style:{left:s.x,top:s.y,width:F,height:G,background:v?"#fff":b.bg,borderColor:v?"var(--accent)":b.bd,color:b.tx},onMouseEnter:()=>$(e),onMouseLeave:()=>$(""),onClick:()=>q(e),title:u&&i?`${e}（来自「${i.chapter}」）`:e,children:[u&&t.jsx("span",{className:"lp-node-ext","aria-hidden":"true",children:"↑前置章"}),t.jsx("span",{className:"lp-node-tx",children:t.jsx(U,{children:e})}),B(e)&&t.jsx("span",{className:"lp-node-v","aria-hidden":"true",children:"📊"})]},e)})]})})}),t.jsxs("div",{className:"lp-legend",children:[Object.entries(V).map(([e,s])=>t.jsxs("span",{className:"lp-leg",children:[t.jsx("i",{style:{background:s.bg,borderColor:s.bd}}),e]},e)),t.jsxs("span",{className:"lp-leg",children:[t.jsx("i",{className:"lp-leg-ghost"}),"其他章节的前置"]}),t.jsx("span",{className:"lp-leg lp-leg-v",children:"📊 有几何讲解图"})]})]}),t.jsx("style",{children:le})]})}const le=`
  .learning-path .lp-controls {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px;
  }
  .learning-path .lp-search { flex: 1; min-width: 240px; }
  .learning-path .lp-search input {
    width: 100%; border: 1px solid var(--line); border-radius: 10px;
    padding: 9px 12px; font: inherit; font-size: 13.5px; color: var(--ink); background: #fff;
  }
  .learning-path .lp-search input:focus { outline: none; border-color: var(--accent); }

  /* Chapter rail (landing) */
  .lp-rail { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 14px; }
  .lp-rail-chip {
    border: 1px solid var(--line); background: #fff; color: var(--muted);
    border-radius: 999px; padding: 6px 13px; font: inherit; font-size: 12.5px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: border-color .12s, color .12s, background .12s;
  }
  .lp-rail-chip:hover { border-color: var(--accent); color: var(--ink); }
  .lp-rail-chip.on { font-weight: 700; }
  .lp-rail-chip b { font-size: 11px; font-weight: 700; opacity: .65; font-variant-numeric: tabular-nums; }

  /* Ego header bar */
  .lp-egobar {
    display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; margin-bottom: 14px;
    background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px;
  }
  .lp-back {
    border: 1px solid var(--line); background: var(--bg); color: var(--muted);
    border-radius: 8px; padding: 6px 11px; font: inherit; font-size: 12.5px; cursor: pointer;
  }
  .lp-back:hover { color: var(--ink); border-color: var(--accent); }
  .lp-egotitle { display: flex; align-items: center; gap: 8px; }
  .lp-egodot { width: 11px; height: 11px; border-radius: 3px; flex-shrink: 0; }
  .lp-egolink { font-size: 15px; font-weight: 700; color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--accent); }
  .lp-egolink:hover { color: var(--accent); }
  .lp-egometa { color: var(--muted); font-size: 12px; }
  .lp-study {
    margin-left: auto; background: var(--accent); color: #fff; text-decoration: none;
    border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; white-space: nowrap;
  }
  .lp-study:hover { filter: brightness(1.06); }
  .lp-vbadge { font-size: 13px; }

  /* Graph card */
  .lp-graphcard { padding: 12px 12px 14px; }
  .lp-stage-tools { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; padding: 0 4px; }
  .lp-hint { color: var(--muted); font-size: 12px; flex: 1; }
  .lp-zoom { display: inline-flex; gap: 4px; flex-shrink: 0; }
  .lp-zoom button {
    border: 1px solid var(--line); background: #fff; color: var(--muted);
    border-radius: 7px; min-width: 30px; height: 28px; padding: 0 7px; cursor: pointer;
    font: inherit; font-size: 13px; font-variant-numeric: tabular-nums;
  }
  .lp-zoom button:hover { border-color: var(--accent); color: var(--ink); }

  .lp-stage-wrap {
    overflow: auto; max-height: 70vh; border-radius: 10px;
    background:
      radial-gradient(circle at 1px 1px, #e3e6ee 1px, transparent 0) 0 0 / 22px 22px,
      var(--bg);
    border: 1px solid var(--line);
  }
  .lp-stage-outer { margin: 0 auto; position: relative; }
  .lp-stage { position: relative; }
  .lp-empty { padding: 70px 20px; text-align: center; color: var(--muted); font-size: 13px; }

  .lp-edges { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 0; }
  .lp-edge { stroke: #b6bdcc; stroke-width: 1.5; transition: stroke .12s; }
  .lp-edge.on { stroke: var(--accent); stroke-width: 2; }

  .lp-node {
    position: absolute; z-index: 1; border: 1.5px solid; border-radius: 10px;
    padding: 4px 9px; font: inherit; cursor: pointer; text-align: center;
    display: flex; align-items: center; justify-content: center; gap: 4px;
    box-shadow: 0 1px 2px rgba(20,30,50,.05);
    transition: box-shadow .12s, transform .12s, opacity .12s;
  }
  .lp-node:hover { box-shadow: 0 4px 12px rgba(20,30,50,.14); transform: translateY(-1px); z-index: 2; }
  .lp-node.is-root { border-width: 2.5px; box-shadow: 0 3px 12px rgba(37,99,235,.22); }
  .lp-node.is-ghost { border-style: dashed; opacity: .9; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 6px, transparent 6px 12px); box-shadow: none; }
  .lp-node.is-ghost:hover { opacity: 1; }
  .lp-node.dim { opacity: .32; }
  .lp-node-ext {
    position: absolute; top: -8px; left: 8px; font-size: 9px; font-weight: 700;
    line-height: 1; padding: 2px 5px; border-radius: 6px;
    background: #fff; border: 1px dashed currentColor; opacity: .85;
  }
  .lp-node-tx {
    font-size: 12px; line-height: 1.22; font-weight: 600;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word;
  }
  .lp-node-tx .katex { font-size: 1em; }
  .lp-node-v { font-size: 11px; flex-shrink: 0; }

  .lp-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; padding: 0 4px; }
  .lp-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); }
  .lp-leg i { width: 13px; height: 13px; border-radius: 4px; border: 1.5px solid; display: inline-block; }
  .lp-leg-ghost { border-style: dashed !important; border-color: #9aa4bb !important; background: repeating-linear-gradient(135deg, #eef0f4 0 4px, #fff 4px 8px) !important; }

  @media (max-width: 640px) {
    .learning-path .lp-search { min-width: 100%; }
    .lp-study { margin-left: 0; }
  }
`;export{ge as default};
