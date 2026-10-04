const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let child, temp, base, cookie = '';
before(async () => {
  if (process.env.TEST_BASE_URL) { base = process.env.TEST_BASE_URL; return; }
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kaoyan-test-'));
  const port = 31000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: temp, AI_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('测试服务未启动');
});
after(() => {
  child?.kill();
  // Temporary test data stays isolated from the user's data directory.
});

async function request(url, method = 'GET', data, extra = {}) {
  const response = await fetch(base + url, {
    method, headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...extra },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}

test('题库、考纲、破题诀和筛选数据可用', async () => {
  const health = await request('/api/health');
  assert.equal(health.status, 200); assert.equal(health.body.questions, 2185); assert.equal(health.body.methods, 199);
  for (const url of ['/api/syllabus', '/api/real/meta', '/api/real/index?scope=all', '/api/methods/domains', '/api/methods/graph']) assert.equal((await request(url)).status, 200);
  const questions = (await request('/api/real/questions?paper=数学一&year=2026')).body;
  assert.equal(questions.length, 22); assert.ok(questions.every(q => q.year === 2026 && q.papers.includes('数学一')));
  assert.equal((await request('/api/real/questions/unknown')).status, 404);
});

test('核验答案用于判分，未核验题不伪造答案或成绩', async () => {
  const solution = (await request('/api/questions/90101/solution')).body;
  assert.equal(solution.verified, true); assert.equal(solution.final_answer, 'A');
  assert.equal((await request('/api/math/grade', 'POST', { id: 90101, answer: 'A' })).body.correct, true);
  assert.equal((await request('/api/math/grade', 'POST', { id: 90101, answer: 'B' })).body.correct, false);
  const unverified = (await request('/api/questions/90102/solution')).body;
  assert.equal(unverified.verified, false); assert.equal(unverified.final_answer, '尚未核验');
  assert.equal((await request('/api/math/grade', 'POST', { id: 90102, answer: 'A' })).body.needsSelfReview, true);
  assert.equal((await request('/api/math/grade', 'POST', { id: -1, answer: 'A' })).status, 404);
});

test('答题记录、错题本和掌握状态持久化', async () => {
  assert.equal((await request('/api/answer', 'POST', { questionId: 90102, correct: false, secs: 42 })).body.ok, true);
  const grades = (await request('/api/grades')).body.grades;
  assert.ok(grades.some(g => g.questionId === 90102 && g.totalSecs === 42));
  assert.ok((await request('/api/wrong-book')).body.items.some(q => q.id === 90102));
  await request('/api/wrong-book/90102/master', 'POST', {});
  assert.ok((await request('/api/wrong-book')).body.items.find(q => q.id === 90102).mastered);
  await request('/api/wrong-book/90102', 'DELETE');
  assert.ok(!(await request('/api/wrong-book')).body.items.some(q => q.id === 90102));
});

test('收藏、标签、星级和笔记读写一致', async () => {
  await request('/api/favorite', 'POST', { questionId: 90101, on: true });
  await request('/api/favorite/tag', 'PUT', { questionId: 90101, tag: '重点题' });
  await request('/api/favorite/star', 'PUT', { questionId: 90101, star: 3 });
  const favorites = (await request('/api/favorites')).body;
  assert.ok(favorites.ids.includes(90101)); assert.equal(favorites.tags['90101'], '重点题'); assert.equal(favorites.stars['90101'], 3);
  await request('/api/note', 'POST', { questionId: 90101, text: '隐函数求导' });
  await request('/api/note/append', 'POST', { questionId: 90101, text: '注意负号' });
  assert.equal((await request('/api/notes')).body.notes.find(n => n.questionId === 90101).text, '隐函数求导\n注意负号');
});

test('复习加入、到期、评分及移除形成闭环', async () => {
  await request('/api/review/enroll', 'POST', { questionIds: [90101] });
  assert.ok((await request('/api/review/today')).body.due.some(q => q.id === 90101));
  assert.equal((await request('/api/review/answer', 'POST', { questionId: 90101, rating: 'good' })).body.ok, true);
  assert.ok(!(await request('/api/review/today')).body.due.some(q => q.id === 90101));
  await request('/api/review/drop', 'POST', { questionId: 90101 });
});

test('组卷保存真实题目、草稿恢复、提交与历史成绩', async () => {
  const paper = (await request('/api/exam-papers', 'POST', { name: '验证试卷', questionIds: [90101, 90102] })).body.paper;
  assert.equal(paper.questions.length, 2);
  assert.equal((await request('/api/exam-papers/' + paper.id)).body.questions.length, 2);
  const payload = JSON.stringify({ questionId: 90101, answer: 'A' });
  await request('/api/exam-papers/draft', 'POST', { paperKey: paper.id, payload });
  assert.equal((await request('/api/exam-papers/draft?paperKey=' + paper.id)).body.payload, payload);
  const result = (await request('/api/exam-papers/' + paper.id + '/submit', 'POST', { answers: [{ questionId: 90101, chosen: 'A', correct: false }, { questionId: 90102, chosen: 'A', correct: true }], durationSec: 30 })).body;
  assert.equal(result.objectiveScore, 5); assert.equal(result.objectiveTotal, 5); assert.deepEqual(result.ungradedIds, [90102]);
  assert.equal((await request('/api/exam-papers/' + paper.id + '/attempt')).body.id, result.attemptId);
  assert.equal((await request('/api/exam-papers/' + paper.id + '/attempts')).body.attempts.length, 1);
  await request('/api/exam-papers/' + paper.id, 'DELETE');
  assert.equal((await request('/api/exam-papers/' + paper.id)).status, 404);
});

test('自动组卷和随机筛选遵循条件', async () => {
  const result = (await request('/api/exam-papers/random-batch?papers=数学二&type=选择题&minYear=2020&count=5&exclude=90201')).body.questions;
  assert.equal(result.length, 5); assert.ok(result.every(q => q.papers.includes('数学二') && q.type === '选择题' && q.year >= 2020 && q.id !== 90201));
  const auto = (await request('/api/exam-papers/auto', 'POST', { papers: ['数学三'], count: 4 })).body;
  assert.equal(auto.paper.questions.length, 4); assert.equal((await request('/api/exam-papers/' + auto.id)).status, 200);
  await request('/api/exam-papers/' + auto.id, 'DELETE');
});

test('AI 配置不泄露密钥，输入验证拒绝私网地址', async () => {
  await request('/api/ai/config', 'POST', { apiKey: 'test-key-DO-NOT-USE', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' });
  const cfg = (await request('/api/ai/config')).body;
  assert.equal(cfg.hasKey, true); assert.equal(cfg.apiKey, undefined);
  await request('/api/ai/config', 'POST', { model: 'updated-model' });
  assert.equal((await request('/api/ai/config')).body.hasKey, true);
  assert.equal((await request('/api/ai/config', 'POST', { baseUrl: 'http://localhost:3000' })).status, 400);
  await request('/api/ai/config', 'POST', { apiKey: '' });
});

test('内置答疑流完整结束并保存会话', async () => {
  const hint = await request('/api/why', 'POST', { questionId: 90101 });
  assert.equal(hint.body.ok, true); assert.ok(hint.body.hint.length > 50);
  const result = await request('/api/qa/ask/stream', 'POST', { questionId: 90101, content: '这类题型有什么通法？' });
  assert.match(result.headers.get('content-type'), /event-stream/);
  assert.match(result.body, /event: delta/); assert.match(result.body, /event: done/);
  const done = JSON.parse(result.body.split('event: done\ndata: ')[1].trim());
  assert.ok((await request('/api/qa/sessions')).body.items.some(s => s.id === done.sessionId));
  assert.equal((await request('/api/qa/sessions/' + done.sessionId)).body.items.length, 2);
  await request('/api/qa/sessions/' + done.sessionId, 'DELETE');
});

test('未知接口返回 JSON 错误，图片接口不假装成功', async () => {
  const missing = await request('/api/unsupported-feature');
  assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /json/);
  assert.equal((await request('/api/qa/image', 'POST', {})).status, 400);
});

test('真实图片上传、读取、移除及访客隔离，伪装图片被拒绝',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=','base64');
  const upload=async(bytes,type)=>{const form=new FormData();form.append('file',new Blob([bytes],{type}),'sample.png');const r=await fetch(base+'/api/qa/image',{method:'POST',headers:cookie?{Cookie:cookie}:{},body:form});return {status:r.status,body:await r.json()};};
  assert.equal((await upload(Buffer.from('<svg onload="alert(1)"></svg>'),'image/png')).status,400);
  const added=await upload(png,'image/png');assert.equal(added.status,200);assert.equal(added.body.ok,true);
  const r=await fetch(base+'/api/qa/image/'+added.body.id,{headers:cookie?{Cookie:cookie}:{}});assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
  if(process.env.TEST_BASE_URL)assert.equal((await fetch(base+'/api/qa/image/'+added.body.id)).status,404);
  const stream=await fetch(base+'/api/qa/ask/stream',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({imageIds:[added.body.id],content:'分析图片'})});assert.match(await stream.text(),/尚未识别图片内容/);
  assert.equal((await request('/api/qa/image/'+added.body.id,'DELETE')).body.ok,true);assert.equal((await request('/api/qa/image/'+added.body.id)).status,404);
  const large=fs.readFileSync(path.join(__dirname,'../apps/english/public/images/writing/2008.png'));assert.ok(large.length>1000000);
  const largeAdded=await upload(large,'image/png');assert.equal(largeAdded.status,200);
  const loaded=await fetch(base+'/api/qa/image/'+largeAdded.body.id,{headers:cookie?{Cookie:cookie}:{}});assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),large);await request('/api/qa/image/'+largeAdded.body.id,'DELETE');
});

test('英语草稿与备份持久化，不发积分；禁止密钥写入学习备份',async()=>{
  const before=(await request('/api/study/overview')).body.points;
  const patch={kaoyan_word_statuses:JSON.stringify({scientist:'unfamiliar'}),kaoyan_quiz_progress_2026:JSON.stringify({year:'2026',answers:{21:'C'}}),kaoyan_essay_2026_B:'My handwritten practice essay.',kaoyan_trans_2026:JSON.stringify({46:'科学知识帮助人们理解世界。'})};
  assert.equal((await request('/api/english/storage','POST',{patch})).status,200);
  assert.equal((await request('/api/english/storage')).body.items.kaoyan_word_statuses,patch.kaoyan_word_statuses);
  assert.equal((await request('/api/study/overview')).body.points,before);
  assert.equal((await request('/api/english/storage','POST',{patch:{kaoyan_ai_config:'{}'}})).status,400);
  if(process.env.TEST_BASE_URL){const other=await fetch(base+'/api/english/storage');assert.deepEqual((await other.json()).items,{});}
});

test('英语练习与精读共用题目标识，奖励去重，笔记进入统一档案',async()=>{
  const submit={year:'2026',passKey:'2026-t1',answers:{21:'C'}};
  const first=await request('/api/english/submit','POST',submit);assert.equal(first.body.reward.points,2);assert.equal(first.body.fullPaper,false);
  assert.equal((await request('/api/english/submit','POST',{year:'2026',answers:{21:'C'}})).body.reward.points,0);
  assert.equal((await request('/api/english/submit','POST',{year:'2025',answers:{21:'A'}})).body.reward.points,2);
  const catalog=await(await fetch(base+'/english-data/catalog.json')).json();const legacyId=Object.keys(catalog.passages['2025-t1'])[0];
  const legacy=await request('/api/english/submit','POST',{year:'2025',passKey:'2025-t1',answers:{[legacyId]:'A'}});assert.equal(legacy.status,200);assert.equal(legacy.body.reward.points,0);
  assert.equal((await request('/api/english/submit','POST',{year:'2026',passKey:'2026-t1',answers:{26:'A'}})).status,400);
  assert.equal((await request('/api/english/note','POST',{sourceId:'2026:21',text:'短笔记'})).body.reward.points,0);
  assert.equal((await request('/api/english/note','POST',{sourceId:'2026:21',text:'通过时间对比定位作者在第一段表达的驯化先后顺序。'})).body.reward.points,2);
  assert.equal((await request('/api/english/library?kind=notes')).body.total,1);
  assert.equal((await request('/api/incentive/goals','POST',{english:35})).status,200);assert.equal((await request('/api/study/overview')).body.goals.find(g=>g.key==='english').target,35);
});

test('英语单项练习不冒充整卷，完整模考仅一次 +20 且不逐题奖励',async()=>{
  const partial=await request('/api/english/submit','POST',{year:'2024',answers:{1:'A',2:'B'}});assert.equal(partial.body.fullPaper,false);assert.equal(partial.body.reward.points,4);
  const c=await (await fetch(base+'/english-data/catalog.json')).json(),answers={};for(const id of c.papers['2023']){const q=c.questions[id];answers[q.number]=q.objective?(q.options[0] || 'A'):'完成主观作答内容';}
  const full=await request('/api/english/submit','POST',{year:'2023',answers});assert.equal(full.body.fullPaper,true);assert.equal(full.body.reward.points,20);
  assert.equal((await request('/api/english/submit','POST',{year:'2023',answers})).body.reward.points,0);
});

test('英语到期词汇复习联动，提前重复复习不重复奖励',async()=>{
  const first=await request('/api/english/review','POST',{word:'scientist',rating:'good'});assert.equal(first.body.reward.points,3);assert.ok(first.body.card.nextDue>Date.now());
  assert.equal((await request('/api/english/review','POST',{word:'scientist',rating:'good'})).body.reward.points,0);
  assert.equal((await request('/api/english/review','POST',{word:'not-a-real-dictionary-word',rating:'good'})).status,400);
});

test('同义替换与词组默写联动成长，导入记录不会替代实际提交',async()=>{
  const c=await(await fetch(base+'/english-data/catalog.json')).json(),id=Object.keys(c.practice).find(k=>k.startsWith('paraphrase:'));
  const result=await request('/api/english/practice','POST',{id,answer:c.practice[id].answer});assert.equal(result.body.reward.points,2);assert.equal(result.body.correct,true);
  assert.equal((await request('/api/english/practice','POST',{id,answer:c.practice[id].answer})).body.reward.points,0);
  assert.equal((await request('/api/english/practice','POST',{id:'paraphrase:made-up',answer:'A'})).status,400);
});

test('旧精读参考答案与试卷一致，缺题资料按已载入试卷完整度判定',async()=>{
  const c=await(await fetch(base+'/english-data/catalog.json')).json(),reading=await(await fetch(base+'/english-data/reading/questions/2010-t1.json')).json();
  assert.equal(reading[0].answer,c.questions['2010:21'].answer);
  const answers={};for(const id of c.papers['2011']){const q=c.questions[id];answers[q.number]=q.objective?q.options[0]:'完成所载入题目的主观作答';}
  const value=await request('/api/english/submit','POST',{year:'2011',answers});assert.equal(value.body.paperQuestions,51);assert.equal(value.body.sourceIncomplete,true);assert.equal(value.body.fullPaper,true);assert.equal(value.body.reward.points,20);
});

test('Cloudflare 访客身份隔离与跨站保护', { skip: !process.env.TEST_BASE_URL }, async () => {
  const firstCookie = cookie;
  await request('/api/me/nickname', 'POST', { nickname: '验证访客甲' });
  cookie = '';
  assert.notEqual((await request('/api/me')).body.nickname, '验证访客甲');
  assert.notEqual(cookie, firstCookie);
  cookie = firstCookie;
  assert.equal((await request('/api/me')).body.nickname, '验证访客甲');
  assert.equal((await request('/api/me/nickname', 'POST', { nickname: '跨站请求' }, { Origin: 'https://example.net' })).status, 403);
});

test('全站进度导出包含学习模块且排除密钥和图片存储', async () => {
  const note='导出验收：逐题梳理英文长难句的主干和修饰关系。';
  assert.equal((await request('/api/english/note','POST',{sourceId:'2024:27',text:note})).status,200);
  const result=await request('/api/study/export');
  assert.equal(result.status,200);assert.equal(result.body.format,'yanzhuan-study');
  assert.equal(result.body.data.english_state.notes['2024:27'].text,note);
  if(process.env.TEST_BASE_URL){const other=await (await fetch(base+'/api/study/export')).json();assert.ok(!other.data.english_state?.notes?.['2024:27']);}
  for(const key of ['user_progress','user_notes','politics_state','english_storage','growth_state'])assert.ok(Object.hasOwn(result.body.data,key));
  assert.ok(!Object.hasOwn(result.body.data,'ai_config'));assert.ok(!Object.hasOwn(result.body.data,'ai_images'));
  assert.match(result.headers.get('cache-control'),/no-store/);
});
