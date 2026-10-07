const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { compileLexicon } = require('../scripts/compile-lexicon.cjs');
function fixture(t, entries, stats) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexicon-build-'));
  t.after(() => {
    const absolute = path.resolve(root);
    if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith('lexicon-build-')) throw Error('Unsafe test cleanup');
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  const srcDir = path.join(root, 'source'), targetDir = path.join(root, 'output');
  fs.mkdirSync(path.join(srcDir, 'vocab_stats'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'kaoyan1_dict.json'), JSON.stringify({ entries }));
  fs.writeFileSync(path.join(srcDir, 'vocab_stats/vocab_stats_all.json'), JSON.stringify(stats));
  return { srcDir, targetDir };
}
test('编译器不覆盖源文件，空主释义可由词频补足，重复构建稳定', t => {
  const options = fixture(t, { example: { definition_cn: '', task_ids: [3] } }, [{ w: 'example', trans: '例子', byYear: '{"2020":1}', rank: 1, n: 1 }]);
  const sourceBefore = fs.readFileSync(path.join(options.srcDir, 'kaoyan1_dict.json'), 'utf8');
  const first = compileLexicon(options);
  const second = compileLexicon(options);
  assert.equal(first.lexiconHash, second.lexiconHash);
  assert.equal(first.freqHash, second.freqHash);
  assert.equal(first.unifiedDict.entries.example.definition_cn, '例子');
  assert.deepEqual(first.unifiedDict.entries.example.task_ids, [3]);
  assert.equal(fs.readFileSync(path.join(options.srcDir, 'kaoyan1_dict.json'), 'utf8'), sourceBefore);
  assert.throws(() => compileLexicon({ ...options, targetDir: options.srcDir }), /不得覆盖/);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(options.targetDir, 'lexicon.json'))).digest('hex').slice(0, 12);
  assert.equal(first.lexiconHash, digest);
  assert.equal(fs.readFileSync(path.join(options.targetDir, 'lexicon.json'), 'utf8'), fs.readFileSync(path.join(options.targetDir, 'kaoyan1_dict.json'), 'utf8'));
});
test('编译器拒绝重复规范词键、危险键和损坏的词频年份', t => {
  const entry = { definition_cn: '示例' };
  assert.throws(() => compileLexicon(fixture(t, { Example: entry, example: entry }, [])), /重复/);
  assert.throws(() => compileLexicon(fixture(t, { constructor: entry }, [])), /无效词键/);
  assert.throws(() => compileLexicon(fixture(t, { example: entry }, [{ w: 'example', trans: '例子', byYear: 'not-json' }])));
});
