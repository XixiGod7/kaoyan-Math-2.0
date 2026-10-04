const express = require('express');
const path = require('path');

const db = require('./db');
const { getSolutionForQuestion } = require('./solutionEngine');
const aiService = require('./aiService');
const examService = require('./examService');
const growth = require('./services/growth');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(require('./services/auth-local').middleware);
app.use('/api/auth', express.json({limit:'4kb'}));
app.use('/api/english/storage', express.json({limit:'4mb'}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
require('./services/auth-local').mount(app);
app.use(require('./services/study-sync').writes);
require('./services/study-sync').mount(app);
require('./services/integration').mount(app);

// Load static datasets into memory for fast querying
const { allQuestionsList, indexAll, indexMain, realMeta, syllabus, pojueMethods, pojueGraph } = require('./datasets');
const allQuestionsMap = new Map(allQuestionsList.map(q => [String(q.id), q]));
const methodCodeMap = new Map(pojueMethods.map(m => [m.code, m]));

// Build domains map
const domainsMap = new Map();
pojueMethods.forEach(m => {
  if (!domainsMap.has(m.domain)) {
    domainsMap.set(m.domain, {
      domain: m.domain,
      domainName: m.domainName,
      count: 0
    });
  }
  domainsMap.get(m.domain).count++;
});
const domainsList = Array.from(domainsMap.values());

// -------------------------------------------------------------
// Auth & Profile Endpoints
// -------------------------------------------------------------
app.get('/api/me', (req, res) => {
  res.json(db.getProfile());
});

app.post('/api/me/beta', (req, res) => {
  if(typeof req.body.betaDsl!=='boolean')return res.status(400).json({error:'偏好设置无效'});
  const profile = db.updateProfile({ betaDsl: req.body.betaDsl });
  res.json({ ok: true, betaDsl: profile.betaDsl });
});

app.post('/api/me/nickname', (req, res) => {
  if(typeof req.body.nickname!=='string'||!req.body.nickname.trim()||req.body.nickname.length>30)return res.status(400).json({error:'昵称需为 1–30 个字符'});
  const profile = db.updateProfile({ nickname: req.body.nickname });
  res.json({ ok: true, nickname: profile.nickname });
});

app.post('/api/me/wrong-streak', (req, res) => {
  db.updateProfile({ wrongStreak: 0 });
  res.json({ ok: true });
});

app.all(['/api/login/start','/api/login/check'], (req,res) => res.status(410).json({error:'请使用顶部账号入口登录'}));

// -------------------------------------------------------------
// State & User Progress Endpoints
// -------------------------------------------------------------
app.get('/api/state', (req, res) => {
  const progress = db.getProgress();
  res.json({
    choiceToday: progress.lastActive === growth.dayKey() ? progress.todayCount || 0 : 0,
    choiceLimit: 0, // 0 means unlimited
    answers: Object.keys(progress.answered || {})
  });
});

app.get('/api/grades', (req, res) => {
  const grades = Object.entries(db.getProgress().answered || {}).map(([id, grade]) => ({ questionId: Number(id), ...grade }));
  res.json({ grades });
});

app.get('/api/health', (req, res) => res.json({ ok: true, questions: allQuestionsList.length, methods: pojueMethods.length }));

app.post('/api/answer', (req, res) => {
  const { questionId, correct, secs } = req.body;
  if (!allQuestionsMap.has(String(questionId))) return res.status(404).json({ error: '题目不存在' });
  if (typeof correct !== 'boolean') return res.status(400).json({ error: 'correct 必须为布尔值' });
  const progress = db.getProgress();
  progress.answered ||= {};
  const prior = progress.answered[String(questionId)];
  const today = growth.dayKey();
  if (progress.lastActive !== today) progress.todayCount = 0;
  progress.lastActive = today;
  if (!prior || growth.dayKey(prior.timestamp) !== today) progress.todayCount = (progress.todayCount || 0) + 1;
  progress.answered[String(questionId)] = {
    correct, attempts: (prior?.attempts || 0) + 1,
    firstCorrect: prior?.firstCorrect ?? correct,
    lastSecs: Number(secs) || 0, totalSecs: (prior?.totalSecs || 0) + (Number(secs) || 0),
    lastAt: new Date().toISOString(), timestamp: Date.now()
  };
  db.saveProgress(progress);
  if (!correct) collectWrong(questionId);
  const reward = growth.recordLearning('math', 'answer', questionId);
  res.json({ ok: true, ...progress.answered[String(questionId)], reward });
});

app.delete('/api/answer/:id/time', (req, res) => {
  const progress = db.getProgress();
  const grade = progress.answered?.[req.params.id];
  if (grade) { grade.lastSecs = 0; grade.totalSecs = 0; db.saveProgress(progress); }
  res.json({ ok: true });
});

function collectWrong(questionId) {
  const q = allQuestionsMap.get(String(questionId));
  if (!q) return;
  const list = db.getWrongBook();
  if (!list.some(item => String(item.id) === String(questionId))) {
    list.unshift({ ...q, paper: q.papers[0], createdAt: new Date().toISOString(), mastered: false });
    db.saveWrongBook(list);
  }
  enrollWrongReview(q.id);
}

function enrollWrongReview(questionId) {
  const cards = db.getReviewCards();
  if (!cards.some(c => String(c.id) === String(questionId))) {
    cards.push({ id: questionId, interval: 1, reps: 0, nextDue: Date.now() });
    db.saveReviewCards(cards);
  }
}

// -------------------------------------------------------------
// Syllabus & Question Index Endpoints
// -------------------------------------------------------------
app.get('/api/syllabus', (req, res) => {
  res.json(syllabus);
});

app.get('/api/real/meta', (req, res) => {
  res.json(realMeta);
});

app.get('/api/real/index', (req, res) => {
  const scope = req.query.scope;
  if (scope === 'all') {
    res.json(indexAll);
  } else {
    res.json(indexMain);
  }
});

app.get('/api/real/questions', (req, res) => {
  const { ids, paper, year } = req.query;
  if (ids) {
    const idList = ids.split(',').map(s => s.trim());
    const matched = [];
    for (const id of idList) {
      const q = allQuestionsMap.get(id);
      if (q) matched.push(q);
    }
    return res.json(matched);
  }

  if (paper && year) {
    const y = parseInt(year);
    const matched = allQuestionsList.filter(q => q.year === y && (q.papers || []).includes(paper));
    return res.json(matched);
  }

  res.json(allQuestionsList.slice(0, 50));
});

app.get('/api/real/questions/:id', (req, res) => {
  const q = allQuestionsMap.get(String(req.params.id));
  if (q) {
    res.json(q);
  } else {
    res.status(404).json({ error: "Question not found" });
  }
});

// -------------------------------------------------------------
// Question Solution & Stats Endpoints
// -------------------------------------------------------------
app.get('/api/questions/:id/stats', (req, res) => {
  const id = parseInt(req.params.id);
  const grade = db.getProgress().answered?.[String(id)];
  res.json({
    id, users: grade ? 1 : 0, attempts: grade?.attempts || 0,
    firstRate: grade ? (grade.firstCorrect ? 100 : 0) : null,
    firstSample: grade ? 1 : 0, submissions: grade?.attempts || 0,
    accuracy: grade ? (grade.correct ? 1 : 0) : null,
    difficulty: allQuestionsMap.get(String(id))?.difficulty || null
  });
});

app.get('/api/questions/:id/solution', (req, res) => {
  const q = allQuestionsMap.get(String(req.params.id));
  if (!q) {
    return res.status(404).json({ error: "Question not found" });
  }
  const sol = getSolutionForQuestion(q);
  res.json(sol);
});

// -------------------------------------------------------------
// Grading & Math Evaluation
// -------------------------------------------------------------
app.post('/api/math/grade', async (req, res) => {
  const { id, answer } = req.body;
  const q = allQuestionsMap.get(String(id));
  if (!q) return res.status(404).json({ error: '题目不存在' });
  if (req.body.byImage) {
    const imageId = db.readJSON('math_images', {})[id];
    if (!imageId) return res.status(400).json({error:'请先上传答案图片'});
    const result = await require('./services/assistant').reply('你是考研数学老师。先识别手写解答，再说明计算和推理问题。AI 反馈只供自评，不能冒充已核验的标准答案或正式成绩。', '题干：' + q.stem + '\n请检查图片中的解答。', '请配置支持图片的 AI 模型。', [imageId]);
    return res.json({needsSelfReview:true,feedback:result.answer,error:result.answer,mode:result.mode});
  }
  const sol = getSolutionForQuestion(q);
  if (!sol.verified) return res.json({ error: '本题尚无核验答案，暂不自动判分，请使用自评。', needsSelfReview: true });
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 2000) return res.status(400).json({ error: '请输入有效答案' });
  const isCorrect = String(answer).trim().toUpperCase() === String(sol.final_answer).trim().toUpperCase();

  // Record into progress
  const progress = db.getProgress();
  progress.answered = progress.answered || {};
  const previous = progress.answered[String(id)], today = growth.dayKey();
  if (progress.lastActive !== today) progress.todayCount = 0;
  progress.answered[String(id)] = {
    ...previous,
    answer,
    correct: isCorrect,
    firstCorrect: previous?.firstCorrect ?? isCorrect,
    attempts: (previous?.attempts || 0) + 1,
    timestamp: Date.now(),
    lastAt: new Date().toISOString()
  };
  progress.lastActive = today;
  if (!previous || growth.dayKey(previous.timestamp) !== today) progress.todayCount = (progress.todayCount || 0) + 1;
  db.saveProgress(progress);

  // If wrong, add to wrong book
  if (!isCorrect) {
    const wrongBook = db.getWrongBook();
    if (!wrongBook.some(item => String(item.id) === String(id))) {
      wrongBook.unshift({
        id: q ? q.id : id,
        year: q ? q.year : 2026,
        paper: q && q.papers ? q.papers[0] : '数学一',
        type: q ? q.type : '选择题',
        stem: q ? q.stem : '',
        options: q ? q.options : {},
        wrongAnswer: answer,
        correctAnswer: sol.final_answer,
        kps: q ? q.kps : [],
        createdAt: new Date().toISOString(),
        mastered: false
      });
      db.saveWrongBook(wrongBook);
    }
    enrollWrongReview(q.id);
  }

  res.json({
    correct: isCorrect,
    score: isCorrect ? 5 : 0,
    fullScore: 5,
    correctCount: isCorrect ? 1 : 0,
    total: 1,
    answer: sol.final_answer,
    explanation: sol.analysis_md,
    wrongIds: isCorrect ? [] : [id],
    reward: growth.recordLearning('math', 'answer', id)
  });
});

app.post('/api/math/blank-judge', (req, res) => {
  const { id, answer } = req.body;
  const q = allQuestionsMap.get(String(id));
  if (!q) return res.status(404).json({ ok: false, reason: '题目不存在' });
  const sol = getSolutionForQuestion(q);
  if (!sol.verified) return res.json({ ok: false, reason: '本题尚无核验答案，请使用自评。' });
  const isCorrect = String(answer).trim() === String(sol.final_answer).trim();

  res.json({
    ok: true,
    correct: isCorrect
  });
});

// -------------------------------------------------------------
// Methods & Graph (破题诀)
// -------------------------------------------------------------
app.get('/api/methods/domains', (req, res) => {
  res.json(domainsList);
});

app.get('/api/methods/graph', (req, res) => {
  res.json(pojueGraph);
});

app.get('/api/methods', (req, res) => {
  const domain = req.query.domain;
  if (domain) {
    return res.json(pojueMethods.filter(m => m.domain === domain));
  }
  res.json(pojueMethods);
});

app.get('/api/methods/progress', (req, res) => {
  res.json(pojueMethods);
});

app.get('/api/methods/weak', (req, res) => {
  res.json([]);
});

app.get('/api/methods/by-question', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  const result = {};
  for (const id of ids) {
    const q = allQuestionsMap.get(id);
    result[id] = (q && q.methods) ? q.methods.map(code => {
      const m = methodCodeMap.get(code);
      return { code, name: (m && m.title) ? m.title : code };
    }) : [];
  }
  res.json(result);
});

// -------------------------------------------------------------
// Wrong Book (错题本)
// -------------------------------------------------------------
app.get('/api/wrong-book', (req, res) => {
  const list = db.getWrongBook();
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const active = list.filter(x => !x.mastered);
  const mastered = list.filter(x => x.mastered);

  // Group chapters
  const chapters = {};
  list.forEach(item => {
    const chap = (item.kps && item.kps[0] && item.kps[0].chapter) || '综合';
    chapters[chap] = (chapters[chap] || 0) + 1;
  });

  const start = (page - 1) * size;
  const items = list.slice(start, start + size);

  res.json({
    items: items,
    page: page,
    hasMore: start + size < list.length,
    total: list.length,
    activeCount: active.length,
    masteredCount: mastered.length,
    todayCount: list.filter(x => x.createdAt && x.createdAt.startsWith(new Date().toISOString().split('T')[0])).length,
    chapters: chapters
  });
});

app.post('/api/wrong-book/:id/collect', (req, res) => {
  const id = String(req.params.id);
  const list = db.getWrongBook();
  const q = allQuestionsMap.get(id);
  if (!list.some(x => String(x.id) === id)) {
    list.unshift({
      id: q ? q.id : id,
      year: q ? q.year : 2026,
      paper: q && q.papers ? q.papers[0] : '数学一',
      type: q ? q.type : '选择题',
      stem: q ? q.stem : '',
      options: q ? q.options : {},
      createdAt: new Date().toISOString(),
      mastered: false
    });
    db.saveWrongBook(list);
  }
  res.json({ ok: true });
});

app.post('/api/wrong-book/:id/master', (req, res) => {
  const id = String(req.params.id);
  const list = db.getWrongBook();
  const item = list.find(x => String(x.id) === id);
  if (item) {
    item.mastered = true;
    db.saveWrongBook(list);
  }
  res.json({ ok: true });
});

app.delete('/api/wrong-book/:id', (req, res) => {
  const id = String(req.params.id);
  let list = db.getWrongBook();
  list = list.filter(x => String(x.id) !== id);
  db.saveWrongBook(list);
  res.json({ ok: true });
});

// -------------------------------------------------------------
// Favorites (收藏夹)
// -------------------------------------------------------------
app.get('/api/favorites', (req, res) => {
  res.json({ ids: db.getFavorites(), tags: db.readJSON('favorite_tags', {}), stars: db.readJSON('favorite_stars', {}) });
});

app.post('/api/favorite', (req, res) => {
  const { questionId, on } = req.body;
  let favs = db.getFavorites();
  const qid = parseInt(questionId);
  if (on) {
    if (!favs.includes(qid)) favs.push(qid);
  } else {
    favs = favs.filter(x => x !== qid);
  }
  db.saveFavorites(favs);
  res.json({ ok: true });
});

app.get('/api/favorite/tags', (req, res) => {
  res.json({ tags: ['重点题', '高频错点', '经典技巧', '考前必看'] });
});

app.put('/api/favorite/tag', (req, res) => {
  const tags = db.readJSON('favorite_tags', {});
  tags[String(req.body.questionId)] = String(req.body.tag || '');
  db.saveJSON('favorite_tags', tags);
  res.json({ ok: true });
});

app.put('/api/favorite/star', (req, res) => {
  const stars = db.readJSON('favorite_stars', {});
  stars[String(req.body.questionId)] = Math.min(5, Math.max(0, Number(req.body.star) || 0));
  db.saveJSON('favorite_stars', stars);
  res.json({ ok: true });
});

// -------------------------------------------------------------
// Notes (笔记墙)
// -------------------------------------------------------------
app.get('/api/notes', (req, res) => {
  const notesObj = db.getNotes();
  const list = Object.entries(notesObj).map(([k, v]) => ({
    questionId: parseInt(k),
    text: v.text || v,
    updatedAt: v.updatedAt || new Date().toISOString()
  }));
  res.json({ notes: list });
});

app.post('/api/note', (req, res) => {
  const { questionId, text } = req.body;
  if (!allQuestionsMap.has(String(questionId)) || typeof text !== 'string' || text.length > 20000) return res.status(400).json({ error: '笔记或题目无效' });
  const notes = db.getNotes();
  notes[String(questionId)] = {
    text: text,
    updatedAt: new Date().toISOString()
  };
  db.saveNotes(notes);
  res.json({ ok: true, reward: growth.recordLearning('math', 'note', questionId, { text }) });
});

app.post('/api/note/append', (req, res) => {
  const { questionId, text } = req.body;
  if (!allQuestionsMap.has(String(questionId)) || typeof text !== 'string' || text.length > 20000) return res.status(400).json({ error: '笔记或题目无效' });
  const notes = db.getNotes();
  const existing = notes[String(questionId)] ? (notes[String(questionId)].text || '') + '\n' : '';
  notes[String(questionId)] = {
    text: existing + text,
    updatedAt: new Date().toISOString()
  };
  db.saveNotes(notes);
  res.json({ ok: true, reward: growth.recordLearning('math', 'note', questionId, { text: notes[String(questionId)].text }) });
});

// -------------------------------------------------------------
// Spaced Repetition / Today Review (今日复习)
// -------------------------------------------------------------
app.get('/api/review/today', (req, res) => {
  const cards = db.getReviewCards();
  const now = Date.now();
  const due = cards.filter(c => !c.nextDue || c.nextDue <= now);
  res.json({
    due: due,
    scheduled: cards.length
  });
});

app.post('/api/review/answer', (req, res) => {
  const { questionId, rating } = req.body; // rating: 'again', 'hard', 'good', 'easy'
  if (!allQuestionsMap.has(String(questionId)) || !['again', 'hard', 'good', 'easy'].includes(rating)) return res.status(400).json({ error: '复习评分或题目无效' });
  const cards = db.getReviewCards();
  let card = cards.find(c => String(c.id) === String(questionId));
  if (!card || card.nextDue > Date.now()) return res.status(400).json({ error: '该题尚未到复习时间' });

  // Simplified interval scheduling; not a full FSRS implementation.
  if (rating === 'again') {
    card.interval = 1;
  } else if (rating === 'hard') {
    card.interval = Math.max(1, Math.round(card.interval * 1.2));
  } else if (rating === 'good') {
    card.interval = Math.max(2, Math.round(card.interval * 2.2));
  } else {
    card.interval = Math.max(4, Math.round(card.interval * 3.5));
  }
  card.reps++;
  card.nextDue = Date.now() + card.interval * 86400000;
  db.saveReviewCards(cards);

  res.json({ ok: true, interval: card.interval, reward: growth.recordLearning('math', 'review', questionId) });
});

app.post('/api/review/enroll', (req, res) => {
  const { questionIds } = req.body;
  const cards = db.getReviewCards();
  (questionIds || []).forEach(qid => {
    if (!cards.some(c => String(c.id) === String(qid))) {
      cards.push({ id: qid, interval: 1, reps: 0, nextDue: Date.now() });
    }
  });
  db.saveReviewCards(cards);
  res.json({ ok: true });
});

app.post('/api/review/drop', (req, res) => {
  const { questionId } = req.body;
  let cards = db.getReviewCards();
  cards = cards.filter(c => String(c.id) !== String(questionId));
  db.saveReviewCards(cards);
  res.json({ ok: true });
});

app.get('/api/review/exam-forecast', (req, res) => {
  const grades = Object.values(db.getProgress().answered || {});
  res.json({
    masteredCount: grades.filter(grade => grade.correct).length,
    retentionRate: grades.length ? grades.filter(grade => grade.correct).length / grades.length : null,
    forecastScore: null
  });
});

// -------------------------------------------------------------
// Papers route alias
// -------------------------------------------------------------
app.get('/api/papers', (req, res) => {
  res.json(db.getExamPapers());
});

// -------------------------------------------------------------
// Feedback Board (反馈广场)
// -------------------------------------------------------------
app.get('/api/feedback/board', (req, res) => {
  const list = db.getFeedback();
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const start = (page - 1) * size;
  res.json({
    items: list.slice(start, start + size),
    total: list.length,
    page: page,
    size: size
  });
});

app.post('/api/feedback/board', (req, res) => {
  const { title, tag, content, subject } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 120 || (content && (typeof content !== 'string' || content.length > 3000))) return res.status(400).json({ error: '反馈内容无效' });
  const list = db.getFeedback();
  const item = {
    id: 'fb-' + Date.now(),
    title: title || '新功能建议',
    content: content || '', subject: subject || 'math',
    votes: 1,
    tag: tag || '建议',
    status: '已收录',
    createdAt: new Date().toISOString().split('T')[0]
  };
  list.unshift(item);
  db.saveFeedback(list);
  res.json({ ok: true, item });
});

app.post('/api/feedback/:id/vote', handleVote);
app.post('/api/feedback/board/:id/vote', handleVote);

function handleVote(req, res) {
  const id = req.params.id;
  const list = db.getFeedback();
  const item = list.find(x => x.id === id);
  if (item) {
    item.votes = (item.votes || 0) + 1;
    db.saveFeedback(list);
    return res.json({ ok: true, votes: item.votes });
  }
  res.json({ ok: true });
}

// -------------------------------------------------------------
// AI Math Assistant & Tutoring Endpoints
// -------------------------------------------------------------

// 讲讲思路 (Prompt Hint popover)
app.post('/api/why', async (req, res) => {
  try {
    const { questionId } = req.body;
    const q = allQuestionsMap.get(String(questionId));
    if (!q) {
      return res.json({ ok: false, error: "未找到该题目" });
    }
    const sol = getSolutionForQuestion(q);
    const result = await aiService.getWhyHint(q, sol, req.body.imageIds || []);
    res.json(result);
  } catch (err) {
    console.error('Error in /api/why:', err);
    res.json({ ok: false, error: "获取思路提示失败，请稍后重试" });
  }
});

// 追问 / 答疑流式交互 (SSE Stream)
app.post('/api/qa/ask/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { content, sessionId, questionId, imageIds } = req.body;
  const anchorQ = questionId ? allQuestionsMap.get(String(questionId)) : null;

  aiService.streamChat({
    content: content || '请讲讲这道题的突破口和思路',
    sessionId,
    questionId,
    anchorQuestion: anchorQ,
    imageIds,
    onDelta: (text) => {
      res.write(`event: delta\ndata: ${JSON.stringify({ t: text })}\n\n`);
    },
    onDone: (data) => {
      res.write(`event: done\ndata: ${JSON.stringify(data)}\n\n`);
      res.end();
    },
    onError: (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
      res.end();
    }
  });
});

// 答疑历史会话列表
app.get('/api/qa/sessions', (req, res) => {
  const list = db.getQaSessions();
  res.json({
    items: list.map(s => ({
      id: s.id,
      title: s.title,
      questionId: s.questionId,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt
    }))
  });
});

// 单个会话消息记录
app.get('/api/qa/sessions/:id', (req, res) => {
  const list = db.getQaSessions();
  const s = list.find(x => x.id === req.params.id);
  if (s) {
    res.json({ items: s.messages || [] });
  } else {
    res.json({ items: [] });
  }
});

// 删除答疑会话
app.delete('/api/qa/sessions/:id', (req, res) => {
  let list = db.getQaSessions();
  list = list.filter(x => x.id !== req.params.id);
  db.saveQaSessions(list);
  res.json({ ok: true });
});

// 图片与讲解图相关支持接口
require('./services/images').mount(app, id => allQuestionsMap.get(String(id)));
require('./services/ai-routes').mount(app);

app.post('/api/qa/figure', (req, res) => {
  res.json({ none: true });
});

app.post('/api/qa/figure/:id/valid', (req, res) => {
  res.json({ ok: true });
});

// AI配置查询与保存
app.get('/api/ai/config', (req, res) => {
  const cfg = db.getAiConfig();
  res.json({
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    visionModel: cfg.visionModel || '',
    enableThinking: cfg.enableThinking !== false,
    hasKey: Boolean(cfg.apiKey && cfg.apiKey.trim().length > 0)
  });
});

app.post('/api/ai/config', (req, res) => {
  const { apiKey, baseUrl, model, visionModel, enableThinking } = req.body;
  if ([apiKey, baseUrl, model, visionModel].some(value => value !== undefined && typeof value !== 'string')) {
    return res.status(400).json({ ok: false, error: '配置字段必须为文字' });
  }
  if (baseUrl !== undefined && !validAiUrl(baseUrl)) return res.status(400).json({ ok: false, error: '请填写公网 HTTPS API 地址' });
  const current = db.getAiConfig();
  if(current.apiKey&&baseUrl&&new URL(baseUrl).hostname!==new URL(current.baseUrl).hostname&&!apiKey?.trim())return res.status(400).json({ok:false,error:'切换接口域名时，请同时填写该接口的密钥，避免旧密钥被发送到新地址'});
  if (apiKey !== undefined) current.apiKey = apiKey.trim();
  if (baseUrl !== undefined) current.baseUrl = baseUrl.trim();
  if (model !== undefined) current.model = model.trim();
  if (visionModel !== undefined) current.visionModel = visionModel.trim();
  if (enableThinking !== undefined) current.enableThinking = Boolean(enableThinking);
  db.saveAiConfig(current);
  res.json({ ok: true, message: 'AI配置已更新' });
});

// 测试大模型 API 连通性
app.post('/api/ai/test', async (req, res) => {
  const { apiKey, baseUrl, model } = req.body;
  if([apiKey,baseUrl,model].some(value=>value!==undefined&&typeof value!=='string'))return res.status(400).json({error:'配置字段必须为文字'});
  const cfg = db.getAiConfig();
  const key = (apiKey !== undefined && apiKey !== '') ? apiKey.trim() : cfg.apiKey;
  const url = (baseUrl !== undefined && baseUrl !== '') ? baseUrl.trim() : cfg.baseUrl;
  const mod = (model !== undefined && model !== '') ? model.trim() : cfg.model;
  if (!validAiUrl(url)) return res.status(400).json({ ok: false, error: '请填写公网 HTTPS API 地址' });
  if(key&&new URL(url).hostname!==new URL(cfg.baseUrl).hostname&&!apiKey?.trim())return res.status(400).json({ok:false,error:'测试新接口时，请填写该接口的密钥'});

  if (!key || !key.trim()) {
    return res.json({ ok: false, error: '请先填写 API Key（密钥）' });
  }

  try {
    const fetchRes = await fetch(require('./services/ai-client').endpoint(url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: mod || 'deepseek-chat',
        messages: [{ role: 'user', content: '测试连接，请回复：OK' }],
        max_tokens: 1024,
        ...(new URL(url).hostname === 'token.sensenova.cn' ? { reasoning_effort: 'none' } : {})
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.json({ ok: false, error: `API 返回 HTTP ${fetchRes.status}，请检查密钥、模型与余额` });
    }

    const data = await fetchRes.json();
    const reply = data.choices?.[0]?.message?.content || 'OK';
    return res.json({ ok: true, message: `连接成功！模型回复：${reply.trim()}` });
  } catch (err) {
    return res.json({ ok: false, error: `网络请求失败: ${err.message}` });
  }
});

function validAiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) &&
      !/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname) &&
      !/^\d+(?:\.\d+){3}$/.test(url.hostname) && !/\.(?:local|internal)$/i.test(url.hostname);
  } catch { return false; }
}

// -------------------------------------------------------------
// Exam Papers & Mock Exam Endpoints (组卷模考)
// -------------------------------------------------------------
const defaultPapers = [
  { id: "mock-1", name: "2026年考研数学一真题全真模拟卷", subject: "数学一", year: 2026, timeLimitSec: 10800, timed: true, fullPoints: 150, questionCount: 22, createdAt: "2026-09-01" },
  { id: "mock-2", name: "2026年考研数学二真题全真模拟卷", subject: "数学二", year: 2026, timeLimitSec: 10800, timed: true, fullPoints: 150, questionCount: 22, createdAt: "2026-09-02" },
  { id: "mock-3", name: "2026年考研数学三真题全真模拟卷", subject: "数学三", year: 2026, timeLimitSec: 10800, timed: true, fullPoints: 150, questionCount: 22, createdAt: "2026-09-03" },
  { id: "mock-4", name: "近五年高频考点极限定积分专项强化卷", subject: "数学一", year: 2025, timeLimitSec: 5400, timed: true, fullPoints: 80, questionCount: 12, createdAt: "2026-09-04" }
];

app.get('/api/exam-papers', (req, res) => {
  const userPapers = db.getExamPapers();
  res.json({ papers: [...defaultPapers, ...userPapers] });
});

app.post('/api/exam-papers', (req, res) => {
  try {
    const paper = examService.createPaper(req.body);
    res.json({ ok: true, id: paper.id, paper });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.get('/api/exam-papers/real-exam-years', (req, res) => {
  const years = [];
  for (let y = 2026; y >= 2009; y--) years.push(y);
  res.json({ years });
});

app.get('/api/exam-papers/real-exam', (req, res) => {
  const paper = req.query.paper || '数学一';
  const year = Number(req.query.year) || 2026;
  const qs = allQuestionsList.filter(q => q.year === year && q.papers && q.papers.includes(paper));
  res.json({ questions: qs });
});

app.post('/api/exam-papers/real-exam/submit', (req, res) => {
  const { paper, year } = req.body;
  const questions = allQuestionsList.filter(q => q.year === Number(year) && q.papers.includes(paper));
  if (!questions.length) return res.status(404).json({ ok: false, error: '试卷不存在' });
  res.json(examService.submitPaper(`real:${paper}:${year}`, questions, req.body));
});

app.get('/api/exam-papers/real-exam/attempts', (req, res) => {
  const prefix = `real:${req.query.paper}:`;
  res.json({ attempts: Object.entries(db.getPaperAttempts()).filter(([key]) => key.startsWith(prefix)).flatMap(([, values]) => values) });
});

app.get('/api/exam-papers/real-exam/attempt', (req, res) => {
  res.json(db.getPaperAttempts()[`real:${req.query.paper}:${req.query.year}`]?.[0] || null);
});

app.get('/api/exam-papers/book-options', (req, res) => {
  res.json({ books: [], insider: false, granted: false, graded: 0, qualified: 0, ratio: 0, needQualified: 10, needRatio: 0.7 });
});

app.get('/api/exam-papers/book-sections', (req, res) => {
  res.json({ books: {} });
});

app.get('/api/exam-papers/blueprint', (req, res) => {
  const questions = allQuestionsList.filter(q => q.year === 2026 && q.papers.includes(req.query.paper || '数学一'));
  const types = [...new Set(questions.map(q => q.type))].map(type => ({ type, count: questions.filter(q => q.type === type).length }));
  res.json({ types });
});

app.get('/api/exam-papers/random-batch', (req, res) => {
  res.json({ questions: examService.filterQuestions(req.query) });
});

app.get('/api/exam-papers/weak-batch', (req, res) => {
  const count = Number(req.query.count) || 15;
  res.json({ questions: allQuestionsList.slice(0, count), fromWrong: 0, fromWeakChapter: 0, fromRandom: count });
});

app.get('/api/exam-papers/similar', (req, res) => {
  const qid = req.query.questionId;
  const count = parseInt(req.query.count) || 3;
  const papersParam = req.query.papers;
  const excludeParam = req.query.exclude;

  const targetQ = allQuestionsMap.get(String(qid));
  if (!targetQ) {
    return res.json({ questions: [], shared: {} });
  }

  const excludeIds = new Set((excludeParam || '').split(',').map(s => s.trim()).filter(Boolean));
  excludeIds.add(String(qid));

  const targetMethods = targetQ.methods || [];
  const targetKps = (targetQ.kps || []).map(k => k.kp || k.chapter);
  const targetDomain = targetMethods.length > 0 ? targetMethods[0].split('-')[0] : '';
  const papersFilter = papersParam ? papersParam.split(',').filter(Boolean) : [];

  // Score candidate questions
  const scored = [];
  for (const q of allQuestionsList) {
    const sid = String(q.id);
    if (excludeIds.has(sid)) continue;

    const qMethods = q.methods || [];
    const sharedMethods = qMethods.filter(m => targetMethods.includes(m));

    const qKps = (q.kps || []).map(k => k.kp || k.chapter);
    const sharedKps = qKps.filter(k => targetKps.includes(k));

    const qDomain = qMethods.length > 0 ? qMethods[0].split('-')[0] : '';
    const domainMatch = Boolean(targetDomain && qDomain === targetDomain);

    let score = 0;
    if (sharedMethods.length > 0) score += sharedMethods.length * 100;
    if (domainMatch) score += 30;
    if (sharedKps.length > 0) score += sharedKps.length * 20;
    if (q.type === targetQ.type) score += 5;

    if (papersFilter.length > 0 && q.papers && q.papers.some(p => papersFilter.includes(p))) {
      score += 10;
    }

    if (score > 0) {
      scored.push({
        q,
        score,
        sharedMethods: sharedMethods.length > 0 ? sharedMethods : (targetMethods.length > 0 ? [targetMethods[0]] : [])
      });
    }
  }

  // Fallback if not enough scored candidates
  if (scored.length < count) {
    for (const q of allQuestionsList) {
      const sid = String(q.id);
      if (excludeIds.has(sid) || scored.some(item => String(item.q.id) === sid)) continue;
      scored.push({
        q,
        score: 1,
        sharedMethods: targetMethods.length > 0 ? [targetMethods[0]] : []
      });
      if (scored.length >= count * 2) break;
    }
  }

  // Sort with slight randomization for variety on "换一批"
  scored.sort((a, b) => (b.score - a.score) || (Math.random() - 0.5));

  const picked = scored.slice(0, count);
  const questions = picked.map(item => {
    const qCopy = { ...item.q };
    qCopy.bookNo = `${qCopy.year || ''} ${(qCopy.papers && qCopy.papers[0]) || ''} 第${qCopy.index || qCopy.id}题`.trim();
    return qCopy;
  });

  const shared = {};
  picked.forEach(item => {
    shared[String(item.q.id)] = item.sharedMethods;
  });

  res.json({
    questions,
    shared
  });
});

app.post('/api/exam-papers/auto', (req, res) => {
  try {
    const questions = examService.filterQuestions(req.body);
    const paper = examService.createPaper({ ...req.body, questions });
    res.json({ ok: true, id: paper.id, paper });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.get('/api/exam-papers/draft', (req, res) => {
  res.json({ payload: db.readJSON('exam_drafts', {})[req.query.paperKey || 'default'] || null });
});

app.post('/api/exam-papers/draft', (req, res) => {
  const drafts = db.readJSON('exam_drafts', {});
  drafts[req.body.paperKey || 'default'] = req.body.payload ?? null;
  db.saveJSON('exam_drafts', drafts);
  res.json({ ok: true });
});

app.delete('/api/exam-papers/draft', (req, res) => {
  const drafts = db.readJSON('exam_drafts', {});
  delete drafts[req.query.paperKey || 'default'];
  db.saveJSON('exam_drafts', drafts);
  res.json({ ok: true });
});

app.get('/api/exam-papers/:id', (req, res) => {
  const papers = db.getExamPapers();
  const p = [...papers, ...defaultPapers.map(paper => ({ ...paper, questions: allQuestionsList.filter(q => q.year === paper.year && q.papers.includes(paper.subject)) }))].find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Paper not found' });
  res.json(p);
});

app.put('/api/exam-papers/:id', (req, res) => {
  const papers = db.getExamPapers();
  const p = papers.find(x => x.id === req.params.id);
  if (p && req.body.name) p.name = req.body.name;
  db.saveExamPapers(papers);
  res.json({ ok: true });
});

app.delete('/api/exam-papers/:id', (req, res) => {
  let papers = db.getExamPapers();
  papers = papers.filter(x => x.id !== req.params.id);
  db.saveExamPapers(papers);
  res.json({ ok: true });
});

app.post('/api/exam-papers/:id/submit', (req, res) => {
  const paper = db.getExamPapers().find(p => p.id === req.params.id) || defaultPapers.find(p => p.id === req.params.id);
  if (!paper) return res.status(404).json({ ok: false, error: '试卷不存在' });
  const questions = paper.questions || allQuestionsList.filter(q => q.year === paper.year && q.papers.includes(paper.subject));
  res.json(examService.submitPaper(paper.id, questions, req.body));
});

app.get('/api/exam-papers/:id/attempt', (req, res) => {
  res.json(db.getPaperAttempts()[req.params.id]?.[0] || null);
});

app.get('/api/exam-papers/:id/attempts', (req, res) => {
  res.json({ attempts: db.getPaperAttempts()[req.params.id] || [] });
});

// -------------------------------------------------------------
// Static Files & SPA Fallback
// -------------------------------------------------------------
if (require.main === module) app.get(['/', '/library', '/english', '/english/{*rest}', '/politics', '/politics/{*rest}', '/growth', '/growth/{*rest}'], (req, res, next) => {
  if (path.extname(req.path)) return next();
  const file = req.path.startsWith('/english') ? 'english-app/index.html' : req.path.startsWith('/politics') ? 'politics-app/index.html' : req.path.startsWith('/growth') ? 'growth/index.html' : req.path === '/library' ? 'hub/library.html' : 'hub/index.html';
  res.sendFile(path.join(__dirname, 'public', file));
});
if (require.main === module) app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  etag: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Route fallback: all other requests route to public/index.html
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: '此功能接口尚未实现' });
  if (path.extname(req.path)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error,req,res,next)=>{if(res.headersSent)return next(error);const status=error.type==='entity.too.large'?413:error.status===400?400:500;res.status(status).json({error:status===413?'内容超过保存大小限制':status===400?'请求内容无法读取，请重新提交':'服务暂时无法完成保存，请稍后重试'});});

if (require.main === module) app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(` 数砖 · 考研数学真题分析平台已成功启动！`);
  console.log(` 本地访问地址: http://localhost:${PORT}`);
  console.log(` 免登录模式: 已启用（全功能直接开放无阻断）`);
  console.log(`=======================================================`);
});

module.exports = app;
