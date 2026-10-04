const { randomUUID } = require('node:crypto');
const db = require('./db');
const { allQuestionsList } = require('./datasets');
const { getSolutionForQuestion } = require('./solutionEngine');
const byId = new Map(allQuestionsList.map(q => [String(q.id), q]));

function filterQuestions(params = {}) {
  let pool = allQuestionsList;
  const list = value => Array.isArray(value) ? value.map(String) : String(value || '').split(',').filter(Boolean);
  const papers = list(params.papers);
  const exclude = new Set(list(params.exclude));
  const methods = list(params.methodCodes || params.methods);
  const domains = list(params.methodDomains);
  pool = pool.filter(q => !exclude.has(String(q.id)) &&
    (!papers.length || q.papers.some(p => papers.includes(p))) &&
    (!params.type || q.type === params.type) &&
    (!params.year || q.year === Number(params.year)) &&
    (!params.minYear || q.year >= Number(params.minYear)) &&
    (!params.maxYear || q.year <= Number(params.maxYear)) &&
    (!params.minDiff || q.difficulty >= Number(params.minDiff)) &&
    (!params.maxDiff || q.difficulty <= Number(params.maxDiff)) &&
    (!params.subject || q.kps.some(k => k.part === params.subject)) &&
    (!params.kw || q.stem.includes(String(params.kw))) &&
    (!methods.length || q.methods.some(m => methods.includes(m))) &&
    (!domains.length || q.methods.some(m => domains.includes(m.split('-')[0]))));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(100, Math.max(1, Number(params.count) || 10)));
}

function createPaper(payload) {
  const questions = (payload.questionIds?.length ? payload.questionIds.map(id => byId.get(String(id))) : payload.questions || []).filter(Boolean);
  if (!questions.length) throw new Error('请至少选择一道题');
  const paper = {
    id: 'ep_' + randomUUID(), name: String(payload.name || '自选模拟卷'),
    questions, questionIds: questions.map(q => q.id), questionCount: questions.length,
    fullPoints: Number(payload.fullPoints) || questions.reduce((sum, q) => sum + (q.type === '选择题' || q.type === '填空题' ? 5 : 10), 0),
    timed: payload.timed ?? Boolean(payload.timeLimitSec),
    timeLimitSec: Number(payload.timeLimitSec) || 10800, createdAt: new Date().toISOString()
  };
  db.saveExamPapers([paper, ...db.getExamPapers()]);
  return paper;
}

function submitPaper(key, questions, payload) {
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  let objectiveScore = 0, objectiveTotal = 0;
  const ungradedIds = [];
  const assessed = questions.map(q => {
    const supplied = answers.find(a => String(a.questionId) === String(q.id)) || { questionId: q.id };
    const solution = getSolutionForQuestion(q);
    const objective = q.type === '选择题' || q.type === '填空题';
    if (!objective || !solution.verified) {
      if (objective) ungradedIds.push(q.id);
      return { ...supplied, questionId: q.id, correct: null };
    }
    objectiveTotal += 5;
    const answer = supplied.chosen ?? supplied.answerText ?? '';
    const correct = String(answer).trim().toUpperCase() === solution.final_answer.trim().toUpperCase();
    if (correct) objectiveScore += 5;
    return { ...supplied, questionId: q.id, correct };
  });
  const attempt = {
    id: 'attempt_' + randomUUID(), key, answers: assessed,
    durationSec: Math.max(0, Number(payload.durationSec) || 0),
    objectiveScore, objectiveTotal, ungradedIds,
    submittedAt: new Date().toISOString(), createdAt: new Date().toISOString()
  };
  const attempts = db.getPaperAttempts();
  attempts[key] = [attempt, ...(attempts[key] || [])];
  db.savePaperAttempts(attempts);
  const complete = questions.length > 0 && assessed.every(a => String(a.chosen ?? a.answerText ?? '').trim());
  const reward = complete ? require('./services/growth').recordLearning('math', 'exam', key) : { credited: false, points: 0 };
  return { ok: true, attemptId: attempt.id, ...attempt, complete, reward };
}

module.exports = { filterQuestions, createPaper, submitPaper };
