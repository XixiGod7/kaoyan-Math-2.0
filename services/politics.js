const { randomUUID } = require('node:crypto');
const db = require('../db');
const growth = require('./growth');
const { readContent } = require('./content');
const catalog = () => readContent('politics-data/catalog.json');
const getState = () => db.readJSON('politics_state', { answers: {}, notes: {}, favorites: [], history: {}, drafts: {}, requests: {} });
const save = state => db.saveJSON('politics_state', state);
const normal = value => [...new Set(String(value || '').toUpperCase())].filter(c => 'ABCD'.includes(c)).sort().join('');
async function chapter(code) {
  if (!(await catalog()).chapters[code]) throw new Error('章节不存在');
  return readContent(`politics-data/${code}.json`);
}
async function question(id) {
  const match = /^pol:([a-z0-9-]+):(\d+):(\d+)$/.exec(String(id));
  if (!match) throw new Error('题目标识无效');
  const ch = await chapter(`${match[1]}--${Number(match[2])}`);
  const q = ch.questions[Number(match[3])];
  if (!q || q.id !== id) throw new Error('题目不存在');
  return { q, ch };
}
function decorate(q, state) {
  const a = state.answers[q.id];
  return { ...q, myChoice: a?.myChoice, attempts: a?.attempts || 0, userNote: state.notes[q.id] || '', correct: a?.correct };
}
function updateAnswer(state, q, ch, choice, allowEmpty = false) {
  if (!allowEmpty && (!choice || (q.type === 'single' && choice.length !== 1))) throw new Error('请选择有效答案');
  const correct = choice === normal(q.answer), previous = state.answers[q.id];
  const record = { id: q.id, chapterCode: ch.code, bankCode: ch.bankCode, subject: q.subject, type: q.type,
    choice, myChoice: choice, correct, firstCorrect: previous?.firstCorrect ?? correct, timestamp: Date.now(),
    attempts: (previous?.attempts || 0) + 1, reviewInterval: correct ? 2 : 0.5, nextReviewAt: Date.now() + (correct ? 2 : 0.5) * 86400000 };
  state.answers[q.id] = record;
  return record;
}
function result(q, a, state) {
  return { ...a, ok: true, answer: normal(q.answer), analysis: q.analysis || '', userNote: state.notes[q.id] || '',
    missed: [...normal(q.answer)].filter(c => !a.myChoice.includes(c)).join(''), extra: [...a.myChoice].filter(c => !normal(q.answer).includes(c)).join('') };
}
function summarize(answers){const subjects=new Map(),banks=new Map(),chapters=new Map();let correct=0,wrong=0,due=0;const now=Date.now();for(const a of answers){if(a.firstCorrect)correct++;if(!a.correct)wrong++;if(a.nextReviewAt<=now)due++;for(const [map,key]of [[subjects,a.subject],[banks,a.bankCode],[chapters,a.chapterCode]]){const item=map.get(key)||{done:0,correct:0,multiDone:0,multiCorrect:0};item.done++;if(a.firstCorrect)item.correct++;if(a.type==='multi'){item.multiDone++;if(a.firstCorrect)item.multiCorrect++;}if(!item.recent||a.timestamp>item.recent.timestamp)item.recent=a;map.set(key,item);}}return {correct,wrong,due,subjects,banks,chapters};}
function stats(state=getState()){const answers=Object.values(state.answers),summary=summarize(answers);return {total:answers.length,correct:summary.correct,wrong:summary.wrong,due:summary.due,favorites:state.favorites.length,bySubject:['马原','毛中特','新思想','史纲','思修','时政'].map(subject=>({subject,...(summary.subjects.get(subject)||{done:0,correct:0,multiDone:0,multiCorrect:0}),recent:undefined}))};}
function mount(app) {
  const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status||400).json({ ok: false, error: e.message, message: e.message }); } };
  app.get('/api/politics/banks', wrap(async (req, res) => {
    const cat = await catalog(), state = getState(),summary=summarize(Object.values(state.answers));
    res.json(cat.banks.filter(b => !req.query.kind || b.kind === req.query.kind).sort((a, b) => b.code.localeCompare(a.code)).map(b => {
      const item=summary.banks.get(b.code)||{done:0,correct:0},recent=item.recent;
      return { ...b, chapters: undefined, done:item.done,correct:item.correct,
        lastAt: recent ? new Date(recent.timestamp).toISOString() : undefined, resumeCode: recent?.chapterCode, resumeName: cat.chapters[recent?.chapterCode]?.name };
    }));
  }));
  app.get('/api/politics/banks/:code', wrap(async (req, res) => {
    const bank = (await catalog()).banks.find(b => b.code === req.params.code);
    if (!bank) return res.status(404).json(null);
    const state = getState(),summary=summarize(Object.values(state.answers));
    res.json({ ...bank, chapters: bank.chapters.map(ch => {
      const item=summary.chapters.get(ch.code)||{done:0,correct:0};
      return {...ch,done:item.done,correct:item.correct};
    }) });
  }));
  app.get('/api/politics/chapters/:code', wrap(async (req, res) => {
    const ch = await chapter(req.params.code), state = getState();
    res.json({ ...ch, questions: ch.questions.map(q => decorate(q, state)) });
  }));
  app.get('/api/politics/chapters/:code/answers', wrap(async (req, res) => {
    const ch = await chapter(req.params.code), state = getState();
    res.json(ch.questions.filter(q => state.answers[q.id]).map(q => result(q, state.answers[q.id], state)));
  }));
  app.post('/api/politics/answer', wrap(async (req, res) => {
    const { q, ch } = await question(req.body.qid), choice = normal(req.body.choice), state = getState();
    const a = updateAnswer(state, q, ch, choice); save(state);
    const reward = growth.recordLearning('politics', 'answer', q.id, { href: `/politics/practice/${ch.code}` });
    res.json({ ...result(q, a, state), reward });
  }));
  app.post('/api/politics/note', wrap(async (req, res) => {
    const { q, ch } = await question(req.body.qid);
    if (typeof req.body.note !== 'string' || req.body.note.length > 20000) throw new Error('笔记内容无效或过长');
    const state = getState();
    state.notes[q.id] = req.body.note.trim(); save(state);
    const reward = growth.recordLearning('politics', 'note', q.id, { text: req.body.note, href: `/politics/practice/${ch.code}` });
    res.json({ ok: true, reward });
  }));
  app.get('/api/politics/favorite-ids', (req, res) => res.json(getState().favorites));
  app.post('/api/politics/favorite', wrap(async (req, res) => {
    const { q } = await question(req.body.qid);
    if (typeof req.body.on !== 'boolean') throw new Error('收藏状态无效');
    const state = getState(); state.favorites = state.favorites.filter(id => id !== q.id);
    if (req.body.on) state.favorites.unshift(q.id);
    save(state); res.json({ ok: true, on: req.body.on });
  }));
  for (const kind of ['wrong', 'favorites', 'review', 'notes']) app.get(`/api/politics/${kind}`, wrap(async (req, res) => {
    const state = getState();
    let ids = kind === 'favorites' ? state.favorites : kind === 'notes' ? Object.keys(state.notes).filter(id => state.notes[id]) : Object.values(state.answers)
      .filter(a => (kind === 'wrong' ? !a.correct : a.nextReviewAt <= Date.now()) && (!req.query.subject || a.subject === req.query.subject))
      .sort((a, b) => b.timestamp - a.timestamp).map(a => a.id);
    const page = Math.max(0, Number(req.query.page) || 0), size = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const items = await Promise.all(ids.slice(page * size, (page + 1) * size).map(async id => decorate((await question(id)).q, state)));
    res.json({ total: ids.length, items, page, size });
  }));
  app.post('/api/politics/review', wrap(async (req, res) => {
    const { q, ch } = await question(req.body.qid), grade = req.body.grade;
    if (![0, 1, 2].includes(grade)) throw new Error('复习评分无效');
    const state = getState(), record = state.answers[q.id];
    if (!record || record.nextReviewAt > Date.now()) throw new Error('该题尚未到复习时间');
    record.reviewInterval = grade === 0 ? Math.max(1, record.reviewInterval * 2.5) : grade === 1 ? 1 : 0.5;
    record.nextReviewAt = Date.now() + record.reviewInterval * 86400000;
    if (grade === 2) record.correct = false;
    save(state);
    const reward = growth.recordLearning('politics', 'review', q.id, { href: `/politics/practice/${ch.code}` });
    res.json({ ok: true, reward });
  }));
  app.get('/api/politics/stats', (req, res) => res.json(stats()));
  app.get('/api/politics/papers/:code/history', (req, res) => res.json(getState().history[req.params.code] || []));
  app.get('/api/politics/papers/:code/draft', (req, res) => res.json(getState().drafts[req.params.code] || null));
  app.post('/api/politics/papers/:code/draft', wrap(async (req, res) => {
    if (!(await catalog()).banks.some(b => b.code === req.params.code)) throw new Error('试卷不存在');
    if (!req.body.choices || typeof req.body.choices !== 'object' || JSON.stringify(req.body).length > 50000) throw new Error('草稿无效');
    const state = getState(); state.drafts[req.params.code] = { choices: req.body.choices, elapsed: require('./validation').finite(req.body.elapsed??0) };
    save(state); res.json({ ok: true });
  }));
  app.post('/api/politics/papers/:code/submit', wrap(async (req, res) => {
    const bank = (await catalog()).banks.find(b => b.code === req.params.code);
    if (!bank || bank.kind !== 'exam') throw new Error('试卷不存在');
    const chapters = await Promise.all(bank.chapters.map(c => chapter(c.code)));
    const state = getState(), requestId = String(req.get('Idempotency-Key') || '');
    const hash=require('./auth-core').digest(JSON.stringify([bank.code,req.body]));if(requestId&&state.requests[requestId]){if(state.requests[requestId].hash!==hash)return res.status(409).json({error:'重复请求标识不匹配'});return res.json(state.requests[requestId].value);}
    const submitted = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answers = new Map(submitted.map(a => [a.id, normal(a.choice)]));
    const detail = []; let full = 0, score = 0;
    for (const ch of chapters) for (const q of ch.questions) {
      const choice = answers.get(q.id) || '', a = updateAnswer(state, q, ch, choice, true), points = q.type === 'multi' ? 2 : 1;
      full += points; if (a.correct) score += points;
      detail.push({ id: q.id, correct: a.correct, answer: normal(q.answer), picked: choice });
    }
    const complete = detail.length > 0 && detail.every(d => d.picked);
    const value = { ok: true, score, full, detail, complete, takenAt: new Date().toISOString(), id: randomUUID() };
    state.history[bank.code] = [{ score, full, takenAt: value.takenAt, duration: require('./validation').finite(req.body.duration??0) }, ...(state.history[bank.code] || [])].slice(0, 100);
    delete state.drafts[bank.code];
    if (requestId) state.requests[requestId] = {hash,value};
    for (const key of Object.keys(state.requests).slice(0, -20)) delete state.requests[key];
    save(state);
    // Paper actions earn one completion reward; they do not also mint question rewards.
    const reward = complete ? growth.recordLearning('politics', 'exam', bank.code, { href: `/politics/paper/${bank.code}` }) : { credited: false, points: 0 };
    res.json({ ...value, reward });
  }));
  app.post('/api/politics/ask', wrap(async (req, res) => {
    const { q } = await question(req.body.qid);
    if (typeof req.body.question !== 'string' || !req.body.question.trim() || req.body.question.length > 4000) throw new Error('请输入有效问题');
    const answer = await require('./assistant').reply('你是考研政治学习助手。解释概念和选项，题库答案未独立核验，不确定时明确说明。',
      `题目：${q.stem}\n选项：${JSON.stringify(q.choices)}\n题库参考答案：${q.answer}\n题库解析：${q.analysis || ''}\n用户问题：${req.body.question}`,
      `【题库参考解析，未启用外部 AI】\n参考答案：${q.answer}\n${q.analysis || '该题尚无详细解析，请结合教材核对。'}\n\n可以在顶部统一 AI 设置中配置个人模型，以获得针对问题的回复。`, req.body.imageIds || []);
    res.json({ ok: true, ...answer });
  }));
}
module.exports = { mount, getState, stats, question, chapter, catalog };
