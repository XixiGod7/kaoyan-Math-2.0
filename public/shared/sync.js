(() => {
  const rawFetch=window.fetch.bind(window), listeners=()=>window.dispatchEvent(new Event('study:sync'));
  let database, identity, scope, online=true, pending=[], local={}, positions={}, snapshot=null, busy=false, chain=Promise.resolve(), restoring=false;
  const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const open=new Promise((resolve,reject)=>{const request=indexedDB.open('question-bank-study',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onsuccess=()=>{database=request.result;resolve();};request.onerror=()=>reject(new Error('本地保存不可用，请允许浏览器保存网站数据'));});
  const read=key=>new Promise((resolve,reject)=>{const request=database.transaction('records').objectStore('records').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const write=(key,value)=>new Promise((resolve,reject)=>{const transaction=database.transaction('records','readwrite');transaction.objectStore('records').put(value,key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
  const save=()=>write(scope,{pending,local,positions,snapshot,at:Date.now()});
  const allowed=url=>/^\/api\/(?:answer(?:\/[^/]+\/time)?|math\/grade|note(?:\/append)?|favorite(?:\/(?:tag|star))?|wrong-book\/[^/]+(?:\/(?:collect|master))?|review\/(?:answer|enroll|drop)|exam-papers(?:\/.*)?|politics\/(?:answer|note|favorite|review|papers\/[^/]+\/(?:draft|submit))|english\/(?:storage|note|submit|review|practice)|incentive\/actions|me\/(?:nickname|beta)|study\/position)$/.test(url);
  const privateGet=url=>url.startsWith('/api/')&&!/^\/api\/(?:auth|ai|images|qa|why|health|study\/sync)(?:[/?]|$)/.test(url);
  function notify() { listeners(); }
  function applyMutation(operation,localOnly=false) {
    if(!snapshot?.data)return;
    const body=operation.body,path=operation.path,d=localOnly?structuredClone(snapshot.data):snapshot.data;
    if(path==='/api/english/storage'){if(localOnly)d.english_storage={...window.studySync.getEnglish()};d.english_storage||={};for(const [key,value] of Object.entries(body.patch||{}))if(value===null)delete d.english_storage[key];else d.english_storage[key]=value;local['/api/english/storage']={items:d.english_storage};}
    if(path==='/api/english/note'){d.english_state||={notes:{}};d.english_state.notes||={};d.english_state.notes[body.sourceId]={text:body.text};local['/api/english/note?sourceId='+encodeURIComponent(body.sourceId)]={text:body.text};}
    if(path==='/api/note'){d.user_notes||={};d.user_notes[body.questionId]={text:body.text};}
    if(path==='/api/politics/note'){d.politics_state||={notes:{}};d.politics_state.notes||={};d.politics_state.notes[body.qid]=body.note;}
  }
  async function bases(path,body) {
    const d=snapshot?.data;if(!d)return;
    if(path==='/api/note')body._studyBase={note:local['base:math:'+body.questionId]??await sha(d.user_notes?.[body.questionId]?.text??d.user_notes?.[body.questionId]??'')};
    if(path==='/api/politics/note')body._studyBase={note:local['base:politics:'+body.qid]??await sha(d.politics_state?.notes?.[body.qid]||'')};
    if(path==='/api/english/note')body._studyBase={note:local['base:english:'+body.sourceId]??await sha(d.english_state?.notes?.[body.sourceId]?.text||'')};
    if(path==='/api/english/storage'){const keys={};for(const key of Object.keys(body.patch||{}))keys[key]=await sha(d.english_storage?.[key]??null);body._studyBase={keys};}
  }
  async function takeSnapshot() {
    try {const response=await rawFetch('/api/study/sync',{headers:{'X-Study-Scope':scope}});if(!response.ok){if(response.status===401){identity.expired=true;notify();}return;}const data=await response.json();if(data.scope!==scope)return;snapshot=data;for(const [key,value] of Object.entries(data.data.study_positions||{}))if(!positions[key]||positions[key].at<value.at)positions[key]=value;for(const operation of pending)applyMutation(operation,true);await save();}catch{}
  }
  async function send(operation) {
    const headers=new Headers(operation.headers);headers.delete('Authorization');headers.delete('Cookie');headers.set('Content-Type','application/json');headers.set('X-Study-Operation',operation.id);headers.set('X-Study-Scope',scope);
    let response;
    try {response=await rawFetch(operation.path,{method:operation.method,headers,body:JSON.stringify(operation.body)});online=true;}
    catch {online=false;notify();throw new Error('已保存在本地，恢复联网后会自动同步');}
    if(response.ok){pending=pending.filter(item=>item.id!==operation.id);const value=await response.clone().json().catch(()=>({}));if(value.mergedPatch)operation.body.patch={...operation.body.patch,...value.mergedPatch};applyMutation(operation);const body=operation.body;if(operation.path==='/api/note')local['base:math:'+body.questionId]=await sha(body.text);if(operation.path==='/api/politics/note')local['base:politics:'+body.qid]=await sha(body.note.trim());if(operation.path==='/api/english/note')local['base:english:'+body.sourceId]=await sha(body.text.trim());await save();notify();return response;}
    const value=await response.clone().json().catch(()=>({error:'保存失败'}));
    if(response.status===409&&value.conflict){operation.conflict=value;await save();notify();}
    else if(response.status===401){identity.expired=true;notify();}
    else if(response.status<500){operation.error=value.error||'同步失败';await save();notify();}
    return response;
  }
  function serial(callback){const result=chain.then(callback,callback);chain=result.catch(()=>{});return result;}
  async function drain(){await window.studyReady;if(busy||identity.expired)return;busy=true;notify();try{await serial(async()=>{for(const operation of [...pending]){if(operation.conflict||operation.error)break;const response=await send(operation);if(!response.ok)break;}if(!pending.length)await takeSnapshot();});}catch{}finally{busy=false;notify();}}
  window.studyReady=(async()=>{
    await open;
    try {const response=await rawFetch('/api/auth/session');if(!response.ok)throw Error();identity=await response.json();scope=identity.scope;const previousScope=localStorage.getItem('mb_last_scope');if(identity.expired&&previousScope?.startsWith('account:')){scope=previousScope;identity={...identity,authenticated:true,scope};}localStorage.setItem('mb_last_scope',scope);}
    catch {online=false;scope=localStorage.getItem('mb_last_scope');identity={authenticated:scope?.startsWith('account:'),scope,offline:true};if(!scope)throw new Error('首次使用需要联网加载学习资料');}
    const previous=await read(scope);if(previous){({pending=[],local={},positions={},snapshot=null}=previous);}
    try{const saved=JSON.parse(localStorage.getItem('mb_positions:'+scope)||'{}');for(const [key,value] of Object.entries(saved))if(!positions[key]||positions[key].at<value.at){positions[key]=value;dirty.add(key);}}catch{}
    await takeSnapshot();
    window.dispatchEvent(new Event('study:identity'));
    setTimeout(drain,0);return identity;
  })();
  window.studyReady.catch(e=>{setTimeout(()=>window.platformToast?.(e.message),1000);});
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/auth/'))return rawFetch(input,options);
    await window.studyReady;
    const path=url.pathname+url.search,method=(options.method||input.method||'GET').toUpperCase();const scopedHeaders=new Headers(options.headers||(input instanceof Request?input.headers:undefined));scopedHeaders.set('X-Study-Scope',scope);options={...options,headers:scopedHeaders};
    if(method==='GET'){
      try {const response=await rawFetch(input,options);online=true;if(response.ok&&privateGet(path)&&response.headers.get('Content-Type')?.includes('json')){const value=await response.clone().json();local[path]=value;if(url.pathname==="/api/english/note")local["base:english:"+url.searchParams.get("sourceId")]=await sha(value.text||"");if(url.pathname==="/api/notes")for(const note of value.notes||[])local["base:math:"+note.questionId]=await sha(note.text||"");if(/^\/api\/politics\/chapters\/[^/]+$/.test(url.pathname))for(const note of value.questions||[])local["base:politics:"+note.id]=await sha(note.userNote||"");if(Object.keys(local).length>250)delete local[Object.keys(local)[0]];await save();}return response;}
      catch(e){online=false;notify();if(Object.hasOwn(local,path))return new Response(JSON.stringify(local[path]),{headers:{'Content-Type':'application/json','X-Study-Local':'1'}});throw e;}
    }
    if(identity.expired)return new Response(JSON.stringify({error:'登录已过期或账号已切换，请先重新登录'}),{status:401,headers:{'Content-Type':'application/json'}});
    if(!allowed(url.pathname)||typeof options.body!=='string')return rawFetch(input,options);
    return serial(async()=>{
      if(identity.expired)return new Response(JSON.stringify({error:'登录已过期，请先重新登录'}),{status:401,headers:{'Content-Type':'application/json'}});
      const body=JSON.parse(options.body),safeHeaders=new Headers(options.headers);safeHeaders.delete('Authorization');safeHeaders.delete('Cookie');const operation={id:crypto.randomUUID(),path,method,headers:Object.fromEntries(safeHeaders.entries()),body,at:Date.now()};
      await bases(url.pathname,body);
      if(pending.length>=100 || JSON.stringify(pending).length+options.body.length>20000000)throw new Error('本地待同步记录较多，请先同步或导出备份');
      pending.push(operation);await save();
      if(pending.some(item=>item!==operation&&(item.conflict||item.error))){notify();return new Response(JSON.stringify({error:'内容已保存在本地，请先处理待同步记录'}),{status:409,headers:{'Content-Type':'application/json'}});}
      try {const response=await send(operation);if(response.ok){clearTimeout(window.studySnapshotTimer);window.studySnapshotTimer=setTimeout(()=>serial(takeSnapshot),1000);}return response;}
      catch(e){applyMutation(operation,true);await save();return new Response(JSON.stringify({error:e.message,localSaved:true}),{status:503,headers:{'Content-Type':'application/json'}});}
    });
  };
  window.studySync={
    get identity(){return identity;},get status(){return {online,pending:pending.length,busy,conflicts:pending.filter(o=>o.conflict||o.error)};},
    get snapshot(){return snapshot;},getEnglish:()=>local['/api/english/storage']?.items||snapshot?.data?.english_storage||{},getEnglishDraft:()=>local['english:pending']||{},
    saveEnglish:async patch=>{await window.studyReady;local['english:pending']={...local['english:pending'],...patch};local['/api/english/storage']={items:{...window.studySync.getEnglish(),...patch}};await save();},
    clearEnglishDraft:async patch=>{for(const [key,value] of Object.entries(patch))if(local['english:pending']?.[key]===value)delete local['english:pending'][key];await save();},
    flush:drain,
    async changeAccount(action,body){const renewing=identity.expired&&['login','recover'].includes(action);if(!renewing){await window.beforeStudyExport?.();await drain();if(pending.length)throw new Error('还有待同步记录，请先处理后切换账号；也可以导出本地备份');}else await save();const response=await rawFetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(value.error);return value;},
    async resolve(id,useLocal){const operation=pending.find(o=>o.id===id);if(!operation)return;if(!useLocal){pending=pending.filter(o=>o!==operation);await save();await takeSnapshot();}else{delete operation.body._studyBase;delete operation.conflict;delete operation.error;await save();}notify();await drain();},
    async export(){await window.studyReady;const blob=new Blob([JSON.stringify({format:'question-bank-local',version:1,scope,exportedAt:new Date().toISOString(),snapshot,pending,positions},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='真题库-本地学习备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  };
  // Position keys belong to the current account; explicit deep links take precedence.
  let positionTimer,cloudTimer;const dirty=new Set();
  window.studyPosition={get:key=>positions[key],set(key,value){if(!scope)return;positions[key]={...value,at:Date.now()};dirty.add(key);clearTimeout(positionTimer);positionTimer=setTimeout(save,150);clearTimeout(cloudTimer);cloudTimer=setTimeout(flushPositions,1200);},url(url){const current=new URL(url,location.href);history.replaceState(history.state,'',current.pathname+current.search);remember();}};
  async function flushPositions(){if(!online||pending.some(o=>o.conflict||o.error))return;for(const key of [...dirty]){dirty.delete(key);try{await window.fetch('/api/study/position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:positions[key]})});}catch{dirty.add(key);}}}
  const subject=()=>location.pathname.match(/^\/(math|politics|english|growth|library)(?:\/|$)/)?.[1];
  function remember(){if(!scope||restoring||!subject())return;window.studyPosition.set('last:'+subject(),{url:location.pathname+location.search});}
  for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{const result=original(...args);remember();setTimeout(restoreScroll,80);return result;};}
  window.addEventListener('popstate',remember);
  document.addEventListener('click',event=>{const anchor=event.target.closest('a[href]');if(!anchor||anchor.closest('dialog')||event.ctrlKey||event.metaKey)return;const url=new URL(anchor.href);if(url.origin!==location.origin)return;const root=url.pathname.match(/^\/(math|politics|english|growth|library)\/?$/)?.[1];if(root&&!url.search&&anchor.closest('.platform-header')&&positions['last:'+root]?.url){event.preventDefault();location.assign(positions['last:'+root].url);}},true);
  let scrollTimer;const scrollKey=()=>('scroll:'+location.pathname+location.search).slice(0,180);
  document.addEventListener('scroll',event=>{if(restoring||!scope)return;clearTimeout(scrollTimer);const target=event.target;scrollTimer=setTimeout(()=>{const elements=[...document.querySelectorAll('main,[class*="overflow"],.english-paper-workspace')].filter(el=>el.scrollTop>0||el.scrollLeft>0).slice(0,12);window.studyPosition.set(scrollKey(),{x:scrollX,y:scrollY,elements:elements.map(el=>({tag:el.tagName,classes:el.className,x:el.scrollLeft,y:el.scrollTop}))});},250);},true);
  let lastRestored='',restoreTimer;
  function restoreScroll(){const key=scrollKey();if(lastRestored===key)return;const value=positions[key];lastRestored=key;if(!value)return;restoring=true;let count=0;clearInterval(restoreTimer);restoreTimer=setInterval(()=>{scrollTo(value.x||0,value.y||0);for(const item of value.elements||[]){const el=[...document.querySelectorAll(item.tag)].find(el=>el.className===item.classes);if(el){el.scrollTop=item.y;el.scrollLeft=item.x;}}if(++count>=10){clearInterval(restoreTimer);restoring=false;}},250);}
  document.addEventListener('pointerdown',()=>{clearInterval(restoreTimer);restoring=false;},true);
  window.studyReady.then(()=>{
    const root=subject(),last=root&&positions['last:'+root]?.url;
    if(last&&location.pathname==='/'+root&&!location.search&&last!==location.pathname){location.replace(last);return;}
    if(new URLSearchParams(location.search).has('home')){window.studyPosition.set('last:'+root,{url:'/'+root});}
    remember();setTimeout(restoreScroll,100);
  });
  window.addEventListener('online',()=>{online=true;drain().then(flushPositions);});window.addEventListener('offline',()=>{online=false;notify();});
  const persistPositions=()=>{if(!scope)return;try{localStorage.setItem('mb_positions:'+scope,JSON.stringify(positions));}catch{}save().catch(()=>{});};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persistPositions();});
  window.addEventListener('pagehide',()=>{persistPositions();let total=0;for(const key of [...dirty].sort((a,b)=>positions[b].at-positions[a].at).slice(0,12)){const body=JSON.stringify({key,value:positions[key]});total+=new TextEncoder().encode(body).length;if(total>50000)break;rawFetch('/api/study/position',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Scope':scope},body,keepalive:true}).catch(()=>{});}});
  setInterval(()=>{if(!document.hidden&&online)drain();},60000);
})();
