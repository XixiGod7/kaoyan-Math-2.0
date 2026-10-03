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
  assert.equal((await request('/api/qa/image', 'POST', {})).status, 501);
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
