const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let child, temp, base, cookie = '';

before(async () => {
  if (process.env.TEST_BASE_URL) { base = process.env.TEST_BASE_URL; return; }
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kaoyan-dict-test-'));
  const port = 32000 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: temp, AI_API_KEY: '' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('测试服务未启动');
});

after(() => {
  child?.kill();
});

async function request(url, method = 'GET', data, extra = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}

test('数据基线审计与统一词库完整性校验', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'public/english-data/lexicon-manifest.json');
  const lexiconPath = path.join(rootDir, 'public/english-data/lexicon.json');
  const catalogPath = path.join(rootDir, 'public/english-data/catalog.json');

  assert.ok(fs.existsSync(manifestPath), 'lexicon-manifest.json 存在');
  assert.ok(fs.existsSync(lexiconPath), 'lexicon.json 存在');
  assert.ok(fs.existsSync(catalogPath), 'catalog.json 存在');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // 1. Exact counts
  assert.equal(manifest.quality.totalEntries, 6963);
  assert.equal(manifest.quality.mainEntries, 6673);
  assert.equal(manifest.quality.statsEntries, 3149);
  assert.equal(manifest.quality.intersection, 2859);
  assert.equal(manifest.quality.statsExclusive, 290);
  assert.equal(manifest.quality.mainExclusive, 3814);
  assert.equal(manifest.quality.emptyDefinitions, 0);
  assert.equal(manifest.quality.coreExamWords, 762);

  // 2. Lexicon entries integrity
  const entries = lexicon.entries;
  assert.equal(Object.keys(entries).length, 6963);
  for (const [word, entry] of Object.entries(entries)) {
    assert.ok(entry.definition_cn && entry.definition_cn.trim().length > 0, `词条 ${word} 释义不能为空`);
  }

  // 3. Catalog words count and integrity
  assert.equal(Object.keys(catalog.words).length, 6963);
  for (const [word, def] of Object.entries(catalog.words)) {
    assert.ok(def && def.trim().length > 0, `catalog.words[${word}] 释义不能为空`);
  }

  // 4. Hashed asset files existence
  const hashedLexiconPath = path.join(rootDir, 'public', manifest.lexicon.hashedPath.slice(1));
  const hashedFreqPath = path.join(rootDir, 'public', manifest.frequency.hashedPath.slice(1));
  assert.ok(fs.existsSync(hashedLexiconPath), 'hashed lexicon 资源存在');
  assert.ok(fs.existsSync(hashedFreqPath), 'hashed freq 资源存在');
});

test('6 条特殊空项有上下文说明，待审词不冒充已核验复合词', () => {
  const rootDir = path.resolve(__dirname, '..');
  const lexicon = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/english-data/lexicon.json'), 'utf8'));
  const entries = lexicon.entries;

  const expectedSpecial = [
    { word: 'auyeung', quality: 'proper_noun', contains: 'Bonnie Auyeung' },
    { word: 'hietanen', quality: 'proper_noun', contains: 'Jari Hietanen' },
    { word: 'mulcaire', quality: 'proper_noun', contains: 'Glenn Mulcaire' },
    { word: 'pavlopetri', quality: 'proper_noun', contains: '帕夫洛佩特里' },
    { word: 'tokarczuk', quality: 'proper_noun', contains: 'Olga Tokarczuk' },
    { word: 'selfievanity', quality: 'needs_review', contains: '自拍' }
  ];

  for (const spec of expectedSpecial) {
    const entry = entries[spec.word];
    assert.ok(entry, `特殊词 ${spec.word} 必须存在`);
    assert.equal(entry.quality, spec.quality, `特殊词 ${spec.word} 分类匹配`);
    assert.ok(entry.definition_cn.includes(spec.contains), `特殊词 ${spec.word} 释义必须包含 ${spec.contains}`);
    assert.equal(entry.phonetic, '', '没有可靠来源时不补造音标');
  }
});

test('290 个独有词全部可查且释义与词频表一致', () => {
  const rootDir = path.resolve(__dirname, '..');
  const statsPath = path.join(rootDir, 'apps/english/public/data/vocab_stats/vocab_stats_all.json');
  const dictPath = path.join(rootDir, 'apps/english/public/data/kaoyan1_dict.json');
  const lexiconPath = path.join(rootDir, 'public/english-data/lexicon.json');

  const rawStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));

  const rawDictKeys = new Set(Object.keys(rawDict.entries).map(w => w.trim().toLowerCase()));
  const statsExclusiveWords = rawStats.filter(s => !rawDictKeys.has(s.w.trim().toLowerCase()));

  assert.equal(statsExclusiveWords.length, 290);

  for (const statItem of statsExclusiveWords) {
    const wordKey = statItem.w.trim().toLowerCase();
    const entry = lexicon.entries[wordKey];
    assert.ok(entry, `独有词 ${wordKey} 必须注入统一词库`);
    assert.equal(entry.definition_cn, statItem.trans.trim(), `独有词 ${wordKey} 释义必须来自词频 trans`);
    assert.ok(entry.sources.includes('vocab_stats'));
  }

  // Key test targets mentioned in plan: probable, deliberate, precise, used, provided
  for (const keyWord of ['probable', 'deliberate', 'precise', 'used', 'provided']) {
    const entry = lexicon.entries[keyWord];
    assert.ok(entry, `重点独有词 ${keyWord} 必须在词典中`);
    assert.ok(entry.definition_cn.length > 0);
  }
});

test('多义词与独立词性不被还原错误覆盖 (used, provided)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const lexicon = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/english-data/lexicon.json'), 'utf8'));

  const usedEntry = lexicon.entries['used'];
  assert.ok(usedEntry, 'used 具有独立词条');
  assert.ok(usedEntry.definition_cn.includes('用旧了的') || usedEntry.definition_cn.includes('习惯于'), 'used 保留形容词/惯常义');

  const providedEntry = lexicon.entries['provided'];
  assert.ok(providedEntry, 'provided 具有独立词条');
  assert.ok(providedEntry.definition_cn.includes('倘若') || providedEntry.definition_cn.includes('只要'), 'provided 保留连词义');
});

test('后端复习接口支持 290 个独有词并保持奖励契约', async () => {
  // 1. Submit review for 'probable' (one of the 290 stats-exclusive words)
  const first = await request('/api/english/review', 'POST', { word: 'probable', rating: 'good' });
  assert.equal(first.status, 200, '独有词 probable 提交复习必须成功');
  assert.equal(first.body.ok, true);
  assert.equal(first.body.reward.points, 3, '首次到期复习记 +3 积分');
  assert.ok(first.body.card.nextDue > Date.now());

  // 2. Immediate duplicate review on same word should not award points
  const second = await request('/api/english/review', 'POST', { word: 'probable', rating: 'good' });
  assert.equal(second.status, 200);
  assert.equal(second.body.reward.points, 0, '未到期重复复习不发积分');

  // 3. Case-insensitive normalization support
  const upperCaseSubmit = await request('/api/english/review', 'POST', { word: 'Probable', rating: 'good' });
  assert.equal(upperCaseSubmit.status, 200, '大小写变体支持');
  assert.equal(upperCaseSubmit.body.reward.points, 0, '别名提交不重复奖励');
  const unicodeSubmit = await request('/api/english/review', 'POST', { word: '（Ｐｒｏｂａｂｌｅ）', rating: 'good' });
  assert.equal(unicodeSubmit.status, 200);
  assert.equal(unicodeSubmit.body.reward.points, 0, '前后端使用同一 Unicode 规范化规则');

  // 4. Invalid non-dictionary word is rejected
  const invalid = await request('/api/english/review', 'POST', { word: 'definitely-not-an-english-word-xyz', rating: 'good' });
  assert.equal(invalid.status, 400, '非法词汇仍被 400 拒绝');
});

test('学习档案接口正确展示独有词的释义文本', async () => {
  const backup = {
    format: 'yanzhuan-study',
    version: 2,
    data: {
      english_state: {
        answers: {},
        cards: {
          probable: { stage: 0, nextDue: 1000 }
        },
        notes: {},
        exams: []
      }
    }
  };
  const preview = (await request('/api/study/restore', 'POST', { backup, mode: 'replace' })).body;
  assert.equal(preview.ok, true);
  await request('/api/study/restore', 'POST', {
    backup,
    mode: 'replace',
    preview: false,
    confirmation: preview.confirmation,
    revision: preview.revision
  });

  const lib = await request('/api/english/library?kind=review');
  assert.equal(lib.status, 200);
  const items = lib.body.items || [];
  const probableItem = items.find(it => it.title === 'probable');
  assert.ok(probableItem, '学习档案包含已复习的 probable');
  assert.ok(probableItem.text && probableItem.text.length > 0, '档案中 probable 的释义文本不为空');
  assert.ok(probableItem.text.includes('很可能') || probableItem.text.includes('大概'));
});

test('旧大小写复习卡保留阶段，不将未到期词作为新词奖励', async () => {
  const future = Date.now() + 86400000;
  const backup = { format: 'yanzhuan-study', version: 2, data: { english_state: {
    answers: {}, notes: {}, exams: [], cards: { ' Precise ': { stage: 5, nextDue: future, at: Date.now() } }
  } } };
  const preview = await request('/api/study/restore', 'POST', { backup, mode: 'replace' });
  assert.equal(preview.status, 200);
  const restored = await request('/api/study/restore', 'POST', { backup, mode: 'replace', preview: false, confirmation: preview.body.confirmation, revision: preview.body.revision });
  assert.equal(restored.status, 200);
  const reviewed = await request('/api/english/review', 'POST', { word: 'precise', rating: 'hard' });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.card.stage, 5);
  assert.equal(reviewed.body.reward.points, 0);
});
