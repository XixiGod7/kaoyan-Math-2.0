const normalizeStem = text => String(text || '').replace(/^[（(]?20\d\d年第\d+题[^）)]*[）)]/, '').replace(/[^\p{L}\p{N}]/gu, '');

function validateExamBanks(banks) {
  const exams = banks.filter(bank => bank.kind === 'exam');
  if (exams.length !== 17) throw new Error('政治真题必须完整覆盖 2010—2026 年');
  const years = new Set(), seen = new Set(), papers = [];
  for (const bank of exams) {
    const year = bank.year;
    if (!Number.isInteger(year) || year < 2010 || year > 2026 || years.has(year) || bank.code !== `exam-${year}-v2`) throw new Error(`真题年份或版本错误：${bank.code}`);
    years.add(year);
    const questions = bank.chapters.flatMap(ch => ch.questions || []), stems = new Set();
    if (questions.length !== 33 || bank.qCount !== 33 || bank.fullScore !== 50) throw new Error(`真题题量或分值错误：${year}`);
    let full = 0;
    questions.forEach((q, index) => {
      const fail = message => { throw new Error(`${year} 年第 ${index + 1} 题：${message}`); };
      if (q.number !== index + 1 || q.year !== year || q.id !== `${bank.code}-q${q.number}` || seen.has(q.id)) fail('题号或标识错误');
      seen.add(q.id);
      if (q.type !== (index < 16 ? 'single' : 'multi') || q.score !== (index < 16 ? 1 : 2)) fail('题型或分值错误');
      full += q.score;
      if (!/^[A-D]+$/.test(q.answer || '') || [...new Set(q.answer)].sort().join('') !== q.answer || (index < 16 ? q.answer.length !== 1 : q.answer.length < 2)) fail('答案不完整或无效');
      if (Object.keys(q.choices || {}).sort().join('') !== 'ABCD' || Object.values(q.choices).some(value => typeof value !== 'string' || !value.trim())) fail('选项缺失');
      if (q.figure) {
        const figure = q.figure, box = String(figure.viewBox).split(' ').map(Number);
        if (!/^\/politics-images\/[a-z0-9-]+\.(jpg|png|webp)$/.test(figure.src) || !figure.alt || !Number.isFinite(figure.width) || !Number.isFinite(figure.height) || box.length !== 4 || box.some(n => !Number.isFinite(n) || n < 0) || !box[2] || !box[3] || box[0] + box[2] > figure.width || box[1] + box[3] > figure.height) fail('原题配图无效');
      }
      if (!q.isReal || q.sourceStatus !== 'curated-real' || !Array.isArray(q.sources) || !q.sources.some(s => s.title?.includes(String(year))) || q.sources.some(s => !s.title || !/^https:\/\//.test(s.url))) fail('缺少可追溯的年份来源');
      if (typeof q.analysis !== 'string' || q.analysis.trim().length < 40 || /暂无解析|尚无详细解析|待补充|模板生成/.test(q.analysis)) fail('解析不完整');
      const stem = normalizeStem(q.stem);
      if (!stem || stems.has(stem)) fail('题干缺失或同卷重复');
      stems.add(stem);
    });
    if (full !== 50) throw new Error(`${year} 年试卷满分错误`);
    papers.push({year, stems});
  }
  for (let i = 0; i < papers.length; i++) for (const other of papers.slice(i + 1)) {
    const overlap = [...papers[i].stems].filter(stem => other.stems.has(stem)).length;
    if (overlap >= 10) throw new Error(`${papers[i].year} 与 ${other.year} 年重复 ${overlap} 道题，禁止发布年份模板`);
  }
  return {years: years.size, questions: seen.size};
}
module.exports = {validateExamBanks, normalizeStem};
