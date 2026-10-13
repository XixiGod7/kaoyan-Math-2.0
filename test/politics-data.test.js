const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {validateExamBanks, normalizeStem} = require('../scripts/politics-data-validation.cjs');
const {stats, isArchivedId, validatedChoices} = require('../services/politics');
const directory = path.join(__dirname, '../apps/politics/src/data/banks');
const exams = fs.readdirSync(directory).filter(file => /^exam-\d{4}\.json$/.test(file)).map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')));
const question = (year, number) => exams.find(bank => bank.year === year).chapters[0].questions[number - 1];

test('政治 17 个年份完整、561 道题各有答案解析与年份来源，分值为 16+34', () => {
  assert.deepEqual(validateExamBanks(exams), {years: 17, questions: 561});
  assert.equal(new Set(exams.flatMap(bank => bank.chapters[0].questions.map(q => normalizeStem(q.stem)))).size, 561);
  for (const bank of exams) {
    assert.equal(bank.chapters[0].questions.filter(q => q.type === 'single').length, 16);
    assert.equal(bank.chapters[0].questions.filter(q => q.type === 'multi').length, 17);
    assert.ok(bank.chapters[0].questions.every(q => q.analysisOrigin?.kind));
  }
});

test('构建校验拦截改年份套用整卷模板，题号和来源标签无法绕过', () => {
  const broken = structuredClone(exams), source = broken[0].chapters[0].questions;
  broken[1].chapters[0].questions.forEach((q, i) => {q.stem = `（${broken[1].year}年第${i + 1}题·单选）${source[i].stem}`;});
  assert.throws(() => validateExamBanks(broken), /重复.*禁止发布年份模板/);
});

test('缺题、选项缺失、空解析、少选答案及错误年份均阻止发布', () => {
  for (const mutate of [b => b[0].chapters[0].questions.pop(), b => delete b[0].chapters[0].questions[0].choices.D, b => b[0].chapters[0].questions[0].analysis = '', b => b[0].chapters[0].questions[16].answer = 'A', b => b[0].chapters[0].questions[0].year = 2026]) {
    const broken = structuredClone(exams); mutate(broken); assert.throws(() => validateExamBanks(broken));
  }
});

test('近期卷的文字截断及漏答案已校正，答案始终对应当前选项', () => {
  const illustration = question(2012, 4).figure;
  assert.ok(illustration?.viewBox);
  assert.ok(fs.existsSync(path.join(__dirname, '../public', illustration.src)));
  assert.match(question(2025, 5).stem, /反对本本主义/);
  assert.equal(question(2025, 9).answer, 'A');
  assert.match(question(2025, 9).choices.A, /社会保障/);
  assert.equal(question(2025, 16).answer, 'D');
  assert.match(question(2025, 16).stem, /首次提出/);
  assert.equal(question(2025, 20).answer, 'ABD');
  assert.equal(question(2025, 21).answer, 'BCD');
  assert.equal(question(2025, 27).answer, 'AD');
  assert.equal(question(2025, 30).answer, 'ACD');
  assert.match(question(2025, 30).choices.D, /优先考虑法律规范的适用/);
  assert.equal(question(2026, 3).answer, 'C');
  assert.equal(question(2026, 18).answer, 'AD');
  assert.equal(question(2026, 22).answer, 'ACD');
  assert.equal(question(2026, 26).answer, 'ABC');
  assert.match(question(2026, 8).choices.C, /事后处置.*事前预防/);
  assert.match(question(2022, 18).analysis, /人工智能.*材料研究/);
});

test('旧模板记录不计新真题总数、首答正确率、错题或到期复习', () => {
  const old = {id: 'pol:exam-2025:0:0', bankCode: 'exam-2025', chapterCode: 'exam-2025--0', subject: '马原', correct: false, firstCorrect: true, nextReviewAt: 0, timestamp: 1};
  const current = {...old, id: 'pol:exam-2025-v2:0:0', bankCode: 'exam-2025-v2', chapterCode: 'exam-2025-v2--0', firstCorrect: false};
  assert.ok(isArchivedId(old.id)); assert.ok(!isArchivedId(current.id));
  const state = {answers: {[old.id]: old, [current.id]: current}, favorites: [old.id], notes: {[old.id]: '旧笔记'}};
  const summary = stats(state);
  assert.deepEqual([summary.total, summary.correct, summary.wrong, summary.due], [1, 0, 1, 1]);
  assert.equal(state.notes[old.id], '旧笔记');
});

test('试卷草稿和交卷拒绝旧模板 ID、其他试卷 ID 和多选单选混用', () => {
  const qs = [{id: 'pol:exam-2025-v2:0:0', type: 'single'}, {id: 'pol:exam-2025-v2:0:16', type: 'multi'}];
  assert.deepEqual(validatedChoices({[qs[0].id]: 'a', [qs[1].id]: 'dba'}, qs), {[qs[0].id]: 'A', [qs[1].id]: 'ABD'});
  for (const value of [[], {'pol:exam-2025:0:0': 'A'}, {'pol:exam-2026-v2:0:0': 'A'}, {[qs[0].id]: 'AB'}, {[qs[0].id]: '<script>'}, {[qs[0].id]: null}]) assert.throws(() => validatedChoices(value, qs));
});
