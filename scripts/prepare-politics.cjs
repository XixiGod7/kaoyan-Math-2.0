const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../apps/politics/src/data/banks');
const generated=require('./generated-directory.cjs'),destination=path.join(__dirname,'../public/politics-data'),output=generated.stage(destination);
fs.mkdirSync(output, { recursive: true });
const banks = [], chapters = {};
let questionCount = 0;
for (const filename of fs.readdirSync(source).filter(f => f.endsWith('.json')).sort()) {
  const bank = JSON.parse(fs.readFileSync(path.join(source, filename), 'utf8'));
  const bankName = bank.kind === 'exam' ? `${bank.code.replace('exam-', '')} 年政治选择题练习卷` : bank.name;
  const summaries = bank.chapters.map((chapter, ci) => {
    const code = `${bank.code}--${ci}`;
    const questions = (chapter.questions || []).map((q, qi) => ({
      ...q, originalId: q.id, id: `pol:${bank.code}:${ci}:${qi}`, chapterCode: code,
      sourceStatus: 'imported', isReal: false
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
  banks.push({ code: bank.code, name: bankName, sourceName: bank.name, kind: bank.kind, qCount: summaries.reduce((n, c) => n + c.qCount, 0), chapters: summaries });
}
const catalog = { banks, chapters, questionCount, sourceNotice: '导入题库含模板生成与整理内容，题目答案用于练习参考；年份标签不代表已核验的官方真题。' };
fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(catalog));
console.log(`政治题库：${banks.length} 个题册，${Object.keys(chapters).length} 个章节，${questionCount} 道题；独立题目标识已生成。`);

generated.publish(output,destination);
