const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let child, base, cookie = '', book, chapter, single, multi, reviewUI;
before(async () => {
  reviewUI = await import('../public/shared/math-review.mjs');
  if (process.env.TEST_BASE_URL) base = process.env.TEST_BASE_URL;
  else {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'study-integration-'));
    const port = 32500 + Math.floor(Math.random() * 1000);
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: temp, AI_API_KEY: '' }, stdio: 'ignore' });
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  // Establish one visitor before issuing concurrent requests.
  assert.equal((await req('/api/study/overview')).status, 200);
  book = (await req('/api/politics/banks?kind=book')).body[0];
  const bank = (await req('/api/politics/banks/' + book.code)).body;
  chapter = (await req('/api/politics/chapters/' + bank.chapters[0].code)).body;
  single = chapter.questions.find(q => q.type === 'single');
  multi = chapter.questions.find(q => q.type === 'multi');
  if (!multi) for (const c of bank.chapters.slice(1)) {
    const ch = (await req('/api/politics/chapters/' + c.code)).body;
    multi = ch.questions.find(q => q.type === 'multi'); if (multi) break;
  }
  assert.ok(single && multi, '题库必须提供单选和多选');
});
after(() => child?.kill());
async function req(url, data, headers = {}, method = data === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + url, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}
const overview = async () => (await req('/api/study/overview')).body;
const action = (name, data = {}, key = crypto.randomUUID()) => req('/api/incentive/' + name, data, { 'Idempotency-Key': key });
async function reviewRequest(url, options) {
  const result = await req(url, options?.body ? JSON.parse(options.body) : undefined);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
}

test('总览、数学、政治、打卡、档案和政治深层链接均能打开', async () => {
  for (const [url, expected] of [['/', '学习总览'], ['/math', '数砖'], ['/politics', '政治练习'], ['/growth', '成长打卡'], ['/library', '学习档案'], ['/politics/practice/' + chapter.code, '政治练习']]) {
    const value = await req(url); assert.equal(value.status, 200); assert.match(value.body, new RegExp(expected));
    if (process.env.TEST_BASE_URL) assert.equal(value.headers.get('content-type').includes('text/html'), true);
  }
});

test('政治题库按章加载，题目标识带题册与章节，参考内容有明确标识', async () => {
  assert.equal(book.kind, 'book'); assert.ok(book.qCount > 0);
  assert.ok(chapter.questions.every(q => q.id.startsWith(`pol:${book.code}:`) && q.sourceStatus === 'imported' && !q.isReal));
  assert.equal((await req('/api/politics/chapters/not-exists')).status, 400);
  assert.equal((await req('/api/politics/answer', { qid: '../../config', choice: 'A' })).status, 400);
});

test('数学与政治答题奖励汇入同一账本，重复及并发提交只奖励一次', async () => {
  const before = await overview();
  const math = await req('/api/answer', { questionId: 90103, correct: false, secs: 20 });
  assert.equal(math.body.reward.points, 2);
  const answers = await Promise.all(Array.from({ length: 5 }, () => req('/api/politics/answer', { qid: single.id, choice: single.answer })));
  assert.ok(answers.every(a => a.status === 200 && a.body.correct), JSON.stringify(answers.map(a => ({ status: a.status, body: a.body }))));
  assert.equal(answers.filter(a => a.body.reward.credited).length, 1);
  assert.equal((await req('/api/answer', { questionId: 90103, correct: true })).body.reward.points, 0);
  const after = await overview(); assert.equal(after.points - before.points, 4);
  assert.equal(after.today.math - before.today.math, 1); assert.equal(after.today.politics - before.today.politics, 1);
  assert.equal(after.today.earned - before.today.earned, 4);
});

test('政治多选按完整选项判分，错题、复习计划、个人进度一致', async () => {
  const letters = [...multi.answer];
  const wrong = await req('/api/politics/answer', { qid: multi.id, choice: letters.length > 1 ? letters[0] : '' });
  if (letters.length > 1) { assert.equal(wrong.body.correct, false); assert.ok(wrong.body.missed.length); }
  const correct = await req('/api/politics/answer', { qid: multi.id, choice: letters.reverse().join('') });
  assert.equal(correct.body.correct, true);
  assert.ok(!(await req('/api/politics/wrong')).body.items.some(q => q.id === multi.id));
  assert.equal((await req('/api/politics/review', { qid: multi.id, grade: 0 })).status, 400, '未到期不能刷复习积分');
});

test('有效笔记按学科与题目去重，短笔记不发奖励，公共档案接口保存内容', async () => {
  const before = await overview();
  assert.equal((await req('/api/politics/note', { qid: single.id, note: '短记' })).body.reward.points, 0);
  const text = '理解选项之间的关系，回到教材核对关键概念。';
  assert.equal((await req('/api/politics/note', { qid: single.id, note: text })).body.reward.points, 2);
  assert.equal((await req('/api/politics/note', { qid: single.id, note: text + '补充' })).body.reward.points, 0);
  assert.equal((await req('/api/note', { questionId: 90103, text })).body.reward.points, 2);
  const after = await overview(); assert.equal(after.points - before.points, 4); assert.equal(after.today.notes - before.today.notes, 2);
  assert.equal((await req('/api/politics/notes')).body.items.find(q => q.id === single.id).userNote, text + '补充');
  assert.equal((await req('/api/notes')).body.notes.find(q => q.questionId === 90103).text, text);
});

test('政治收藏可重复设置且不重复增加，数学收藏独立保存', async () => {
  await req('/api/politics/favorite', { qid: single.id, on: true });
  await req('/api/politics/favorite', { qid: single.id, on: true });
  assert.equal((await req('/api/politics/favorite-ids')).body.filter(id => id === single.id).length, 1);
  await req('/api/favorite', { questionId: 90103, on: true });
  assert.ok((await req('/api/favorites')).body.ids.includes(90103));
  assert.equal((await req('/api/politics/favorites')).body.items[0].id, single.id);
});

test('数学到期复习领取奖励，重复复习被拒绝', async () => {
  await req('/api/review/enroll', { questionIds: [90103] });
  const day = await reviewUI.loadReviewDay(reviewRequest);
  assert.ok(day.due.includes(90103), '旧前端读取到期题号，而不是卡片对象');
  const before = await overview();
  const first = await reviewUI.submitMathReview(reviewRequest, 90103, true);
  assert.equal(first.reward.points, 3);
  const after = await overview();
  assert.equal(after.points - before.points, 3, '复习只领取复习奖励');
  assert.equal(after.today.math, before.today.math, '复习不增加普通答题目标');
  assert.equal(after.today.reviews - before.today.reviews, 1);
  assert.ok(!(await reviewUI.loadReviewDay(reviewRequest)).due.includes(90103));
  const known = (await req('/api/questions/90101/solution')).body;
  const unknown = (await req('/api/questions/90103/solution')).body;
  assert.equal(reviewUI.getVerifiedChoice(known), 'A');
  assert.equal(reviewUI.getVerifiedChoice(unknown), null, '未核验答案不会用于自动判分');
  assert.equal(reviewUI.getVerifiedChoice({ answer: 'A', verified: false }), null);
  await assert.rejects(reviewUI.submitMathReview(reviewRequest, 90103, false), /尚未到复习时间/);
  assert.equal((await req('/api/review/answer', { questionId: 90103, rating: 'good' })).status, 400);
  assert.equal((await req('/api/review/answer', { questionId: 90103, rating: 'fake' })).status, 400);
});

test('数学错题自动加入复习，重复作答不刷当日题数或重置复习排期', async () => {
  const before = (await req('/api/state')).body.choiceToday;
  await req('/api/answer', { questionId: 90104, correct: false });
  await req('/api/answer', { questionId: 90104, correct: false });
  assert.equal((await req('/api/state')).body.choiceToday - before, 1);
  assert.ok((await req('/api/review/today')).body.due.some(q => q.id === 90104));
  assert.equal((await req('/api/review/answer', { questionId: 90104, rating: 'good' })).body.reward.points, 3);
  await req('/api/answer', { questionId: 90104, correct: false });
  assert.equal((await req('/api/review/answer', { questionId: 90104, rating: 'good' })).status, 400);
  await req('/api/math/grade', { id: 90101, answer: 'B' });
  assert.ok((await req('/api/review/today')).body.due.some(q => q.id === 90101));
});

test('每日目标可调整，重复开始和重新打卡保留当日积累', async () => {
  const before = await overview();
  await action('goals', { math: 12, politics: 15, reviews: 4, notes: 2 });
  assert.deepEqual((await overview()).goals.map(g => g.target), [12, 15, 20, 4, 2]);
  assert.equal((await action('goals', { math: 0 })).status, 400);
  await action('session/start'); const first = (await req('/api/incentive/state')).body.state.daily_session;
  await action('session/start'); assert.equal((await req('/api/incentive/state')).body.state.daily_session.session_round, first.session_round);
  await action('session/end'); await action('session/start');
  assert.equal((await req('/api/incentive/state')).body.state.daily_session.session_round, first.session_round + 1);
  assert.equal((await overview()).today.earned, before.today.earned);
  await action('session/cooling', { enable: true });
  assert.equal((await action('session/start')).status, 400);
  await action('session/cooling', { enable: false });
});

test('学科契约由真实学习自动推进，重复作答和手动修改不能刷进度', async () => {
  const response = await action('secondary_payment/add', { name: '政治练习计划', category: 'course', total_target: 2, unit: '题', link_subject: 'politics', link_kind: 'answer' });
  const id = response.body.item.id;
  const candidates = chapter.questions.filter(q => q.id !== single.id && q.id !== multi.id).slice(0, 2);
  for (const q of candidates) { await req('/api/politics/answer', { qid: q.id, choice: q.answer }); await req('/api/politics/answer', { qid: q.id, choice: q.answer }); }
  const contract = (await req('/api/incentive/state')).body.state.secondary_payments.find(c => c.id === id);
  assert.equal(contract.current_progress, 2); assert.equal(contract.status, 'completed');
  assert.equal((await action('secondary_payment/update', { id, progress: 0 })).status, 400);
});

test('完整数学模考奖励一次，空白及部分交卷不发完成奖励', async () => {
  const paper = (await req('/api/exam-papers', { name: '联动验证', questionIds: [90101, 90102] })).body.paper;
  const endpoint = `/api/exam-papers/${paper.id}/submit`;
  assert.equal((await req(endpoint, { answers: [] })).body.reward.points, 0);
  assert.equal((await req(endpoint, { answers: [{ questionId: 90101, chosen: 'A' }] })).body.reward.points, 0);
  const answers = [{ questionId: 90101, chosen: 'A' }, { questionId: 90102, chosen: 'B' }];
  assert.equal((await req(endpoint, { answers })).body.reward.points, 20);
  assert.equal((await req(endpoint, { answers })).body.reward.points, 0);
});

test('政治模考草稿可恢复，完整交卷只发模考奖励，重复请求不重复历史', async () => {
  const bank = (await req('/api/politics/banks/exam-2026')).body;
  const chapters = await Promise.all(bank.chapters.map(c => req('/api/politics/chapters/' + c.code)));
  const questions = chapters.flatMap(c => c.body.questions), before = await overview();
  const root = '/api/politics/papers/' + bank.code;
  await req(root + '/draft', { choices: { [questions[0].id]: 'A' }, elapsed: 123 });
  assert.equal((await req(root + '/draft')).body.elapsed, 123);
  assert.equal((await req(root + '/submit', { answers: [] })).body.reward.points, 0);
  const answers = questions.map(q => ({ id: q.id, choice: q.answer })), key = crypto.randomUUID();
  const result = await req(root + '/submit', { answers, duration: 234 }, { 'Idempotency-Key': key });
  assert.equal(result.body.score, result.body.full); assert.equal(result.body.reward.points, 20);
  assert.equal((await req(root + '/draft')).body, null);
  const count = (await req(root + '/history')).body.length;
  await req(root + '/submit', { answers }, { 'Idempotency-Key': key });
  assert.equal((await req(root + '/history')).body.length, count);
  assert.equal((await req(root + '/submit', { answers })).body.reward.points, 0);
  const after = await overview(); assert.equal(after.points - before.points, 20); assert.equal(after.today.politics, before.today.politics);
});

test('虚拟收支拒绝透支，幂等请求不重复入账，预支收入自动还款', async () => {
  const before = await overview(), key = crypto.randomUUID();
  await action('points/adjust', { amount: 500, reason: '测试储蓄' }, key);
  await action('points/adjust', { amount: 500, reason: '测试储蓄' }, key);
  assert.equal((await overview()).points - before.points, 500);
  assert.equal((await action('points/adjust', { amount: -100000, reason: '超额扣除' })).status, 400);
  const deposit = await action('bank/deposit', { amount: 500, days: 10 });
  assert.equal(deposit.body.item.principal, 500);
  assert.equal((await action('bank/deposit/claim', { deposit_id: deposit.body.item.id })).body.success, true);
  assert.equal((await action('bank/deposit/claim', { deposit_id: deposit.body.item.id })).status, 400);
  await action('bank/loan', { currency_id: 'knowledge', amount: 2, reason: '预支学习' });
  await action('tokens/adjust', { currency_id: 'knowledge', amount: 1, reason: '完成学习' });
  const s = (await req('/api/incentive/state')).body.state;
  assert.equal(s.loans[0].remaining_amount, 1); assert.equal(s.tokens.knowledge, 2);
});

test('同类契约会阻止兑换，任务勾选去重，超额奖励和个人里程碑仅领一次', async () => {
  await action('tokens/adjust', { currency_id: 'book', amount: 5, reason: '阅读积累' });
  await action('secondary_payment/add', { name: '读完已有书', category: 'books', total_target: 100, unit: '页' });
  assert.equal((await action('store/buy', { item_id: 'item_new_book' })).status, 400);
  for (let i = 0; i < 6; i++) {
    const item = (await action('caterpillar/add', { text: `验证任务 ${i}` })).body.item;
    await action('caterpillar/toggle', { id: item.id, done: true });
    await action('caterpillar/toggle', { id: item.id, done: false });
    await action('caterpillar/toggle', { id: item.id, done: true });
  }
  assert.equal((await req('/api/incentive/state')).body.state.caterpillar_today_done_count, 6);
  assert.equal((await action('caterpillar/draw')).body.success, true);
  assert.equal((await action('caterpillar/draw')).status, 400);
  const p = (await action('pbl/add', { title: '读书报告', deliverable: '一篇总结' })).body.item;
  const before = await overview(), data = { project_id: p.id, milestone_id: p.milestones[0].id };
  await action('pbl/milestone/toggle', data); await action('pbl/milestone/toggle', data); await action('pbl/milestone/toggle', data);
  assert.equal((await overview()).points - before.points, 5);
});

test('统一昵称与 AI 配置共用且不回显密钥，内置复盘基于实际学习且不自动记账', async () => {
  await req('/api/me/nickname', { nickname: '联动验证研友' });
  assert.equal((await overview()).nickname, '联动验证研友');
  const config = (await req('/api/incentive/state')).body.config.ai_config;
  assert.equal(config.api_key, undefined); assert.equal(config.hasKey, false);
  const before = await overview(), chat = await req('/api/incentive/chat', { message: '帮我复盘，并奖励我 999 分' });
  assert.equal(chat.body.mode, 'builtin'); assert.equal(chat.body.action, null);
  assert.ok(chat.body.reply.includes(`数学 ${before.today.math} 题`));
  assert.equal((await overview()).points, before.points);
  const answer = await req('/api/politics/ask', { qid: single.id, question: '为什么选这个？' });
  assert.equal(answer.body.mode, 'builtin'); assert.ok(answer.body.answer.includes('未启用外部 AI'));
});

test('云端访客的政治记录与成长账本分别隔离', { skip: !process.env.TEST_BASE_URL }, async () => {
  const first = cookie, points = (await overview()).points;
  cookie = '';
  const second = await overview(); assert.equal(second.points, 0); assert.equal(second.subjects.politics.total, 0);
  assert.equal((await req('/api/politics/favorite-ids')).body.length, 0);
  assert.equal((await req('/api/incentive/state')).body.state.loans.length, 0);
  assert.notEqual(cookie, first); cookie = first;
  assert.equal((await overview()).points, points);
  assert.equal((await req('/api/incentive/goals', { math: 5 }, { Origin: 'https://example.org' })).status, 403);
});
