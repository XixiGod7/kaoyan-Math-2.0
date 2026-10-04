const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const publicRoot = path.resolve(__dirname, '../public');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]);
}

test('前端页面、模块和样式引用的本地资源均存在', () => {
  const missing = [];
  for (const file of files(publicRoot).filter(file => /\.(?:html|css|js)$/.test(file))) {
    const content = fs.readFileSync(file, 'utf8');
    const expressions = file.endsWith('.html') ? [/\b(?:src|href)=["']([^"']+)["']/g] : file.endsWith('.css') ? [/url\(["']?([^)'"\s]+)["']?\)/g] : [/(?:\bfrom|\bimport)\s*["']([^"']+)["']/g, /\bimport\(["']([^"']+)["']\)/g, /["'](assets\/[^"']+\.(?:css|js))["']/g];
    for (const expression of expressions) for (const match of content.matchAll(expression)) {
      const ref = match[1];
      if (/^(?:https?:|data:|#)/.test(ref) || (!ref.startsWith('.') && !ref.startsWith('/') && !ref.startsWith('assets/'))) continue;
      // Extensionless links are app routes, not static file dependencies.
      if (/^\/(?:math|politics|english|growth|library)(?:\/[^.]*)?$/.test(ref.split('?')[0])) continue;
      const resolved = ref.startsWith('/') || ref.startsWith('assets/') ? path.join(publicRoot, ref) : path.resolve(path.dirname(file), ref.split('?')[0]);
      if (!fs.existsSync(resolved)) missing.push(path.relative(publicRoot, file) + ' -> ' + ref);
    }
  }
  assert.deepEqual(missing, []);
});

test('真题编号唯一，各卷的 2026 年题号完整', () => {
  const questions = require('../datasets').allQuestionsList;
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const paper of ['数学一', '数学二', '数学三']) {
    const indices = questions.filter(q => q.year === 2026 && q.papers.includes(paper)).map(q => q.indexByPaper?.[paper] || q.index).sort((a, b) => a - b);
    assert.deepEqual(indices, Array.from({ length: 22 }, (_, i) => i + 1));
  }
});

test('英语全部 17 年 153 张试卷缩略图已发布为有效 PNG',()=>{
  const papers=JSON.parse(fs.readFileSync(path.join(publicRoot,'english-data/papers_by_type.json'),'utf8'));
  const thumbs=papers.flatMap(p=>p.questions.map(q=>q.thumbnail_id));
  assert.equal(papers.length,17);assert.equal(thumbs.length,153);
  for(const id of thumbs){const bytes=fs.readFileSync(path.join(publicRoot,'english-thumbs',id+'.png'));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(bytes.length>100);}
});
