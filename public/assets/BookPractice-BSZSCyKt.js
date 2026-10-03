import{j as e}from"./index-BKBOZrcM.js";import{c as _,r as x,L as u}from"./vendor-C1PfG1cZ.js";import{N as G}from"./NeedLogin-BeqfaK2X.js";import{u as J}from"./useUserData-Bo_S3uIY.js";import{i as L}from"./auth-BFNYYDaf.js";import{d as V,e as W,f as X}from"./App-DHANlom9.js";import{u as Z}from"./stickyPick-Bai-zNbf.js";import"./manage-C15X_mMi.js";import"./noScrollChain-C96TITM-.js";import"./SubjectSwitch-oUbusq72.js";const M=[{key:"all",label:"全部"},{key:"undone",label:"未做"},{key:"wrong",label:"做错"},{key:"fav",label:"收藏"}],ee=M.map(g=>g.key);function fe(){const{id:g}=_(),d=Number(g),[p,y]=x.useState(null),[v,R]=x.useState(null),[U,$]=x.useState(!1),[t,F]=Z("book:filter",ee,"all"),m=J();x.useEffect(()=>{L()&&(y(null),$(!1),V().then(a=>R(a.find(r=>r.id===d)??null)),W(d).then(y).catch(()=>$(!0)))},[d]);const{total:c,done:i,correct:O,favN:B,chapters:P,resumeCh:C,firstN:f,firstOk:T}=x.useMemo(()=>{var I;if(!p)return{total:0,done:0,correct:0,favN:0,chapters:[],resumeCh:"",firstN:0,firstOk:0};const a=new Map;let r=0,h=0,k=0,j="",A=0,E=0,b="",S="";const K=[...p].sort((s,l)=>s.index-l.index);for(const s of K){const l=X(s),n=a.get(l)??{ch:l,total:0,done:0,wrong:0,fav:0,avgDiff:0};n.total++,n.avgDiff+=s.difficulty;const o=m.answered[s.id];o?(n.done++,r++,o.correct?h++:n.wrong++,o.firstCorrect!=null&&(A++,o.firstCorrect&&E++),o.lastAt&&o.lastAt>S&&(S=o.lastAt,b=l)):n.firstUndone===void 0&&(n.firstUndone=s.id),m.favs.has(s.id)&&(n.fav++,k++),!o&&!j&&(j=l),a.set(l,n)}const N=[...a.values()];N.forEach(s=>s.avgDiff=s.total?s.avgDiff/s.total:0);const w=b?a.get(b):void 0,Y=w&&w.done<w.total?b:j||((I=N[0])==null?void 0:I.ch)||"";return{total:p.length,done:r,correct:h,favN:k,chapters:N,resumeCh:Y,firstN:A,firstOk:E}},[p,m.answered,m.favs]),q=a=>t==="undone"?a.total-a.done:t==="wrong"?a.wrong:t==="fav"?a.fav:a.total;if(!L())return e.jsx("div",{className:"page browse",children:e.jsx(G,{what:"巩固题"})});if(U)return e.jsx("div",{className:"page browse",children:e.jsxs("div",{className:"empty",children:["这本习题集当前不可用（未开通或已下线）。",e.jsx(u,{to:"/books",children:"← 返回习题集"})]})});if(p===null)return e.jsx("div",{className:"page browse",children:e.jsx("div",{className:"loading",children:"加载中…"})});const z=c?Math.round(i/c*100):0,Q=i?Math.round(O/i*100):0,D=f?Math.round(T/f*100):null,H=a=>`/books/${d}/ch/${encodeURIComponent(a)}${t==="all"?"":`?f=${t}`}`;return e.jsxs("div",{className:"page browse bk-dir",children:[e.jsxs("h2",{className:"page-title",children:[e.jsx(u,{to:"/books",style:{textDecoration:"none"},children:"巩固题"})," / ",(v==null?void 0:v.title)??"",e.jsxs("small",{children:[c," 题"]})]}),c===0?e.jsx("div",{className:"empty",children:"这本书还没有题目。"}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"bk-kpi",children:[e.jsxs("div",{className:"bk-k",children:[e.jsx("span",{className:"bk-kn",children:c}),e.jsx("span",{className:"bk-kl",children:"总题"})]}),e.jsxs("div",{className:"bk-k",children:[e.jsx("span",{className:"bk-kn",children:i}),e.jsx("span",{className:"bk-kl",children:"已做"})]}),e.jsxs("div",{className:"bk-k",title:"当前正确率：按你最近一次作答算，重做做对了它就会涨",children:[e.jsxs("span",{className:"bk-kn",children:[Q,"%"]}),e.jsx("span",{className:"bk-kl",children:"正确率"})]}),D!==null&&e.jsxs("div",{className:"bk-k",title:`首次正确率：只看每道题第一次做的结果，重做不影响。已统计 ${f} 道${f<i?`（另有 ${i-f} 道是本功能上线前做的，没留下首次记录，未计入）`:""}`,children:[e.jsxs("span",{className:"bk-kn",children:[D,"%"]}),e.jsx("span",{className:"bk-kl",children:"首次正确率"})]}),e.jsxs("div",{className:"bk-k",children:[e.jsx("span",{className:"bk-kn",children:B}),e.jsx("span",{className:"bk-kl",children:"收藏"})]}),e.jsxs("div",{className:"bk-kbar",children:[e.jsx("div",{className:"bk-kbar-track",children:e.jsx("i",{style:{width:`${z}%`}})}),e.jsxs("span",{className:"bk-kbar-txt",children:["已完成 ",z,"%"]})]})]}),i<c&&e.jsxs(u,{className:"bk-resume",to:`/books/${d}/ch/${encodeURIComponent(C)}`,children:["▶️ 从上次继续 · ",C]}),e.jsx("div",{className:"filters",style:{marginTop:14},children:M.map(a=>e.jsx("button",{className:`bk-chip${t===a.key?" on":""}`,onClick:()=>F(a.key),children:a.label},a.key))}),e.jsx("div",{className:"bk-chaps",children:P.map(a=>{const r=q(a),h=a.total?Math.round(a.done/a.total*100):0,k=a.done===0?"练习":a.done>=a.total?"重做":"继续";return e.jsxs(u,{to:H(a.ch),className:`bk-chap${t!=="all"&&r===0?" dim":""}`,"aria-disabled":t!=="all"&&r===0,children:[e.jsx("span",{className:"bk-chap-name",title:a.ch,children:a.ch}),e.jsx("span",{className:"bk-chap-bar",children:e.jsx("i",{style:{width:`${h}%`}})}),e.jsxs("span",{className:"bk-chap-prog",children:[a.done,"/",a.total]}),e.jsxs("span",{className:"bk-chap-diff",children:["难 ",a.avgDiff.toFixed(1)]}),e.jsxs("span",{className:"bk-chap-meta",children:[a.wrong>0&&e.jsxs("em",{className:"bk-wrong",children:["错 ",a.wrong]}),a.fav>0&&e.jsxs("em",{className:"bk-fav",children:["★ ",a.fav]})]}),e.jsx("span",{className:"bk-chap-go",children:t==="all"?`${k} →`:r>0?`${r} 题 →`:"—"})]},a.ch)})})]}),e.jsx("style",{children:ae})]})}const ae=`
  .bk-kpi { display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch; margin-bottom: 14px; }
  .bk-k { flex: 1; min-width: 84px; background: #fff; border: 1px solid var(--line); border-radius: 12px;
    padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; }
  .bk-kn { font-size: 22px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
  .bk-kl { font-size: 12px; color: var(--muted); }
  .bk-kbar { flex: 2; min-width: 200px; background: #fff; border: 1px solid var(--line); border-radius: 12px;
    padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
  .bk-kbar-track { height: 12px; background: #eef0f3; border-radius: 6px; overflow: hidden; }
  .bk-kbar-track i { display: block; height: 100%; background: var(--accent); border-radius: 6px; transition: width .3s; }
  .bk-kbar-txt { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

  .bk-resume { display: inline-block; margin-top: 4px; background: var(--accent); color: #fff;
    border-radius: 10px; padding: 9px 18px; font-weight: 700; text-decoration: none; font-size: 14px; }
  .bk-resume:hover { filter: brightness(1.05); }

  /* .bk-chip 样式已移至全局 styles.css（供 6 个页面共用，反馈 #149）；此处不再重复定义 */

  .bk-chaps { display: flex; flex-direction: column; gap: 8px; }
  /* 章名列：**别再写死宽度**（反馈 #782）。原来是 68px + nowrap 且没有 overflow，
     「特征值和特征向量」「大数定律和中心极限定理」这类长章名直接溢出到下一格，
     而进度条有背景色、画在后面 → 章名被进度条盖住，看着像掉字。
     minmax 的上限管住「第1章·基础题·选择题」这种超长分组名（它会带省略号，
     不会把整行挤扁），下限保住短章名时各行仍然对齐。 */
  .bk-chap { display: grid; grid-template-columns: minmax(68px, 12em) 1fr 60px 62px 120px 64px; align-items: center;
    gap: 12px; padding: 10px 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px;
    text-decoration: none; color: var(--ink); transition: border-color .15s, box-shadow .15s; }
  .bk-chap:hover { border-color: var(--accent); box-shadow: 0 2px 10px rgba(0,0,0,.05); }
  .bk-chap.dim { opacity: .4; pointer-events: none; }
  .bk-chap-name { font-weight: 700; font-size: 14px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  .bk-chap-bar { height: 10px; background: #eef0f3; border-radius: 6px; overflow: hidden; }
  .bk-chap-bar i { display: block; height: 100%; background: #6f8fe0; border-radius: 6px; transition: width .3s; }
  .bk-chap-prog { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .bk-chap-diff { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .bk-chap-meta { display: flex; gap: 8px; font-size: 12px; font-style: normal; }
  .bk-chap-meta em { font-style: normal; font-variant-numeric: tabular-nums; }
  .bk-wrong { color: #b4453a; }
  .bk-fav { color: #d08700; }
  .bk-chap-go { color: var(--accent); font-weight: 700; font-size: 13px; text-align: right; white-space: nowrap; }

  @media (max-width: 640px) {
    /* 窄屏同理：54px 写死会把几乎所有章名都压到进度条底下（#782 的截图就是平板宽度）。
       11em≈154px 正好装得下全库最长的章名（「微分中值定理及导数应用」），
       再窄的屏幕由 minmax 下限 + 省略号兜住，进度条至少还留得下 ~30px。 */
    .bk-chap { grid-template-columns: minmax(54px, 11em) 1fr 52px 56px; }
    .bk-chap-meta, .bk-chap-go { display: none; }
  }
`;export{fe as default};
