const fs = require('node:fs');
const path = require('node:path');
const {validateExamBanks} = require('./politics-data-validation.cjs');
const source = path.join(__dirname, '../apps/politics/src/data/banks');
const sourceBanks = fs.readdirSync(source).filter(f => f.endsWith('.json')).sort().map(filename => JSON.parse(fs.readFileSync(path.join(source, filename), 'utf8')));
validateExamBanks(sourceBanks);
const generated=require('./generated-directory.cjs'),destination=path.join(__dirname,'../public/politics-data'),output=generated.stage(destination);
fs.mkdirSync(output, { recursive: true });
const banks = [], chapters = {}, archivedChapters = {}, replacements = {};
let questionCount = 0;
for (const bank of sourceBanks) {
  const bankName = bank.name;
  const summaries = bank.chapters.map((chapter, ci) => {
    const code = `${bank.code}--${ci}`;
    const questions = (chapter.questions || []).map((q, qi) => ({
      ...q, originalId: q.id, id: `pol:${bank.code}:${ci}:${qi}`, chapterCode: code,
      sourceStatus: bank.kind === 'exam' ? 'curated-real' : 'imported', isReal: bank.kind === 'exam'
    }));
    for (const q of questions) {
      if (!/^[A-D]+$/.test(q.answer || '') || !['single', 'multi'].includes(q.type)) throw new Error(`无效题目 ${q.id}`);
      if (q.type === 'single' && q.answer.length !== 1) throw new Error(`单选题答案无效 ${q.id}`);
    }
    const result = { code, name: chapter.name, subject: chapter.subject, bankCode: bank.code, bankName, questions };
    fs.writeFileSync(path.join(output, `${code}.json`), JSON.stringify(result));
    const summary = { code, name: chapter.name, subject: chapter.subject, qCount: questions.length, bankCode: bank.code };
    chapters[code] = summary;
    questionCount += questions.length;
    return summary;
  });
  banks.push({code: bank.code, name: bankName, kind: bank.kind, year: bank.year, version: bank.version, fullScore: bank.fullScore, sources: bank.sources, qCount: summaries.reduce((n, c) => n + c.qCount, 0), chapters: summaries});
  if (bank.kind === 'exam') replacements[`exam-${bank.year}`] = bank.code;
}
// Preserve old IDs for saved notes and exports, outside the active paper catalog.
const legacy = JSON.parse(fs.readFileSync(path.join(source, '../legacy-exam-template.json'), 'utf8'));
for (let year = 2010; year <= 2026; year++) {
  const bankCode = `exam-${year}`, code = `${bankCode}--0`, bankName = `${year} 年旧模板记录（已归档）`;
  const questions = legacy.questions.map((q, i) => ({...q, id: `pol:${bankCode}:0:${i}`, chapterCode: code, stem: `（原 ${year} 年第 ${i + 1} 题·旧模板）${q.stem}`, sourceStatus: 'archived-template', isReal: false, archived: true}));
  archivedChapters[code] = {code, name: legacy.name, subject: '综合', bankCode, bankName, qCount: questions.length, archived: true};
  fs.writeFileSync(path.join(output, `${code}.json`), JSON.stringify({...archivedChapters[code], questions}));
}
const catalog = {banks, chapters, archivedChapters, replacements, questionCount};
fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(catalog));
console.log(`政治题库：${banks.length} 个题册，${questionCount} 道题；17 套历年真题已通过完整性及跨年份查重。`);

generated.publish(output,destination);
