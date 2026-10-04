const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
let child,temp,base=process.env.TEST_BASE_URL;
before(async()=>{if(!base){temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-accounts-'));const port=19000+Math.floor(Math.random()*3000);base='http://127.0.0.1:'+port;child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:temp,AI_API_KEY:''},stdio:'ignore'});for(let n=0;n<60;n++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('测试服务未启动');}});
after(()=>{child?.kill();});
function client(){const jar=new Map();return {jar,async request(url,body,options={}){const response=await fetch(base+url,{method:body===undefined?'GET':'POST',...options,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...options.headers},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),eq=pair.indexOf('=');jar.set(pair.slice(0,eq),pair.slice(eq+1));}return {status:response.status,data:await response.json(),headers:response.headers};}};}
const username=()=> 'test_'+randomUUID().slice(0,14),password='Only-test-password-123456';
const sha=v=>createHash('sha256').update(String(v)).digest('hex');
test('账号注册合并访客学习数据，第二台设备登录读取同一记录，第三个访客隔离',async()=>{
  const first=client(),second=client(),third=client(),name=username();
  await first.request('/api/note',{questionId:90101,text:'注册前已经保存的数学笔记内容'});
  await first.request('/api/english/storage',{patch:{kaoyan_reading_progress:JSON.stringify({'2024-t1':['sentence-1']})}});
  await first.request('/api/ai/config',{apiKey:'private-test-key-never-exported',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-chat'});
  await first.request('/api/study/position',{key:'last:english',value:{url:'/english?tab=quiz&year=2024'}});
  const registered=await first.request('/api/auth/register',{username:name,password});assert.equal(registered.status,200);assert.match(registered.data.recoveryCode,/^[a-f0-9-]{53}$/);assert.equal(registered.data.token,undefined);
  assert.ok(registered.headers.getSetCookie().some(v=>v.includes('HttpOnly')&&v.includes('SameSite=Lax')));
  assert.equal((await second.request('/api/auth/login',{username:name,password})).status,200);
  const snapshot=(await second.request('/api/study/sync')).data;assert.equal(snapshot.data.user_notes['90101'].text,'注册前已经保存的数学笔记内容');assert.equal(snapshot.data.study_positions['last:english'].url,'/english?tab=quiz&year=2024');assert.equal(snapshot.scope,registered.data.scope);
  assert.equal(JSON.stringify((await third.request('/api/study/sync')).data).includes('注册前已经保存的数学笔记内容'),false);
  assert.equal((await third.request('/api/study/overview')).status,200);
  assert.equal((await second.request('/api/ai/config')).data.hasKey,true);assert.equal(JSON.stringify(snapshot).includes('private-test-key-never-exported'),false);
  assert.equal((await second.request('/api/ai/config',{baseUrl:'https://attacker.example/v1'})).status,400);
  assert.equal((await second.request('/api/ai/test',{baseUrl:'https://attacker.example/v1'})).status,400);
  const privateData=JSON.stringify(snapshot);assert.equal(privateData.includes(password),false);assert.equal(privateData.includes(registered.data.recoveryCode),false);
});
test('恢复码只使用一次，重置撤销旧设备会话，退出账号后隔离数据',async()=>{
  const a=client(),b=client(),name=username(),next='New-test-password-987654';
  const account=(await a.request('/api/auth/register',{username:name,password})).data;
  await a.request('/api/note',{questionId:90101,text:'重置之后仍应保留的账号笔记'});
  const reset=await b.request('/api/auth/recover',{username:name,password:next,recoveryCode:account.recoveryCode});assert.equal(reset.status,200);assert.notEqual(reset.data.recoveryCode,account.recoveryCode);
  assert.equal((await a.request('/api/notes')).status,401);
  assert.equal((await client().request('/api/auth/recover',{username:name,password:next,recoveryCode:account.recoveryCode})).status,401);
  assert.equal((await client().request('/api/auth/login',{username:name,password})).status,401);
  assert.equal((await client().request('/api/auth/login',{username:name,password:next})).status,200);
  await b.request('/api/auth/logout',{});assert.equal((await b.request('/api/auth/session')).data.authenticated,false);assert.equal((await b.request('/api/notes')).data.notes.length,0);
});
test('重复同步操作不重复作答或发积分，同步编号篡改被拒绝',async()=>{
  const a=client(),operation=randomUUID(),body={questionId:90101,correct:true};await a.request('/api/auth/session');
  const headers={'X-Study-Operation':operation};
  assert.equal((await a.request('/api/answer',body,{headers})).status,200);
  const replay=await a.request('/api/answer',body,{headers});assert.equal(replay.status,200);assert.equal(replay.headers.get('X-Study-Replayed'),'1');
  const grade=(await a.request('/api/grades')).data.grades.find(q=>q.questionId===90101);assert.equal(grade.attempts,1);
  assert.equal((await a.request('/api/answer',{...body,correct:false},{headers})).status,409);
  assert.equal((await a.request('/api/study/overview')).data.points,2);
});
test('两台设备的笔记冲突不会覆盖云端，显式选择后可保存',async()=>{
  const a=client();await a.request('/api/auth/session');
  await a.request('/api/note',{questionId:90101,text:'另一台设备刚刚保存的新笔记'});
  const body={questionId:90101,text:'这台设备离线时写下的笔记',_studyBase:{note:sha('')}};
  const conflict=await a.request('/api/note',body,{headers:{'X-Study-Operation':randomUUID()}});assert.equal(conflict.status,409);assert.equal(conflict.data.conflict,true);assert.equal(conflict.data.cloud,'另一台设备刚刚保存的新笔记');
  assert.equal((await a.request('/api/notes')).data.notes[0].text,conflict.data.cloud);
  delete body._studyBase;assert.equal((await a.request('/api/note',body,{headers:{'X-Study-Operation':randomUUID()}})).status,200);
  await a.request('/api/english/storage',{patch:{kaoyan_word_statuses:'{"hello":"familiar"}'}});
  assert.equal((await a.request('/api/english/storage',{patch:{kaoyan_word_statuses:'{}'},_studyBase:{keys:{kaoyan_word_statuses:sha(null)}}},{headers:{'X-Study-Operation':randomUUID()}})).status,409);
});
test('跨站写入、弱密码、旧占位登录及越权导航地址均被拒绝',async()=>{
  const a=client();assert.equal((await a.request('/api/auth/register',{username:username(),password:'123'})).status,400);
  assert.equal((await a.request('/api/note',{questionId:90101,text:'不能跨站写入'},{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await a.request('/api/login/start',{})).status,410);
  assert.equal((await a.request('/api/study/position',{key:'last:math',value:{url:'//attacker.example'}})).status,400);
  assert.equal((await a.request('/api/note',{questionId:90101,text:'旧标签页不能把资料写入新账号'},{headers:{'X-Study-Scope':'account:'+randomUUID()}})).status,401);
  assert.equal((await a.request('/api/exam-papers',{questions:[{id:90101,stem:'伪造题干',answer:'D'}]})).status,200);
  assert.equal((await a.request('/api/exam-papers',{questionIds:[90101,90101]})).status,400);
});
test('密码更换校验当前密码并撤销旧会话，登录暴力尝试受到限制',async()=>{
  const a=client(),name=username();await a.request('/api/auth/register',{username:name,password});
  assert.equal((await a.request('/api/auth/password',{password:'Another-test-password-123',currentPassword:'incorrect'})).status,401);
  assert.equal((await a.request('/api/auth/password',{password:'Another-test-password-123',currentPassword:password})).status,200);
  const isolated=client(),missing=username();let limited=false;
  for(let n=0;n<12;n++){const result=await isolated.request('/api/auth/login',{username:missing,password});if(result.status===429){limited=true;break;}assert.equal(result.status,401);}assert.equal(limited,true);
});
