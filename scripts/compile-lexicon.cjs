const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeWord, hasWord } = require('../public/shared/lexicon.mjs');

// Only facts visible in the repository's passages; no unverified pronunciations.
const SPECIAL_CORRECTIONS = {
  auyeung: { def: '[人名] Bonnie Auyeung，原文中的神经科学家（2020 年资料）。', quality: 'proper_noun', source: 'papers/2020.json' },
  hietanen: { def: '[人名] Jari Hietanen，原文中的芬兰研究者（2020 年资料）。', quality: 'proper_noun', source: 'papers/2020.json' },
  mulcaire: { def: '[人名] Glenn Mulcaire，原文中涉及电话窃听事件的人物（2015 年资料）。', quality: 'proper_noun', source: 'papers/2015.json' },
  pavlopetri: { def: '[地名] 帕夫洛佩特里（Pavlopetri），原文所述伯罗奔尼撒半岛南部遗址的现代名称（2025 年资料）。', quality: 'proper_noun', source: 'papers/2025.json' },
  tokarczuk: { def: '[人名] Olga Tokarczuk，原文列举的作家之一（2026 年资料）。', quality: 'proper_noun', source: 'papers/2026.json' },
  selfievanity: { def: '原文连写形式 selfievanity：可按 selfie（自拍）与 vanity（虚荣）理解；分词及原卷拼写待核对（2026 年资料）。', quality: 'needs_review', source: 'papers/2026.json' }
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
const text = value => typeof value === 'string' ? value.trim() : '';
const validWord = raw => {
  const word = normalizeWord(raw);
  if (!word || !/^[a-z0-9]+(?:[-' ][a-z0-9]+)*$/.test(word) || ['constructor', 'prototype'].includes(word)) throw Error('无效词键：' + raw);
  return word;
};

function compileLexicon(options = {}) {
  const rootDir = path.resolve(__dirname, '..');
  const srcDir = path.resolve(options.srcDir || path.join(rootDir, 'apps/english/public/data'));
  const targetDir = path.resolve(options.targetDir || path.join(rootDir, 'public/english-data'));
  if (srcDir === targetDir) throw Error('词库输出目录不得覆盖原始资料目录');
  const rawDictText = fs.readFileSync(path.join(srcDir, 'kaoyan1_dict.json'), 'utf8');
  const rawStatsText = fs.readFileSync(path.join(srcDir, 'vocab_stats/vocab_stats_all.json'), 'utf8');
  const rawDict = JSON.parse(rawDictText), rawStats = JSON.parse(rawStatsText);
  if (!rawDict.entries || Array.isArray(rawDict.entries) || !Array.isArray(rawStats)) throw Error('词库源资料格式无效');
  const entries = Object.create(null), freqMap = Object.create(null);
  const mainKeys = new Set(), statsKeys = new Set(), corrections = [];
  for (const [rawWord, entry] of Object.entries(rawDict.entries)) {
    const word = validWord(rawWord);
    if (mainKeys.has(word)) throw Error('主词典存在重复规范词键：' + word);
    mainKeys.add(word);
    const correction = !text(entry.definition_cn) && hasWord(SPECIAL_CORRECTIONS, word) ? SPECIAL_CORRECTIONS[word] : null;
    if (correction) corrections.push(word);
    entries[word] = {
      headword: word, type: entry.type || 'kaoyan', phonetic: text(entry.phonetic),
      definition_cn: text(entry.definition_cn) || correction?.def || '',
      is_kaoyan_key: Boolean(entry.is_kaoyan_key), task_ids: entry.task_ids || [], sentence_ids: entry.sentence_ids || [],
      sources: correction ? ['main', 'context:' + correction.source] : ['main'],
      supplementary_cn: [], quality: correction?.quality || 'imported'
    };
  }
  for (const item of rawStats) {
    const word = validWord(item.w);
    if (statsKeys.has(word)) throw Error('词频资料存在重复规范词键：' + word);
    statsKeys.add(word);
    if (hasWord(entries, word)) {
      const entry = entries[word];
      entry.sources.push('vocab_stats');
      entry.phonetic ||= text(item.phonetic);
      if (!entry.definition_cn) { entry.definition_cn = text(item.trans); entry.quality = 'supplemented'; }
      else if (text(item.trans) && text(item.trans) !== entry.definition_cn) entry.supplementary_cn.push(text(item.trans));
    } else entries[word] = {
      headword: word, type: 'kaoyan', phonetic: text(item.phonetic), definition_cn: text(item.trans),
      is_kaoyan_key: false, task_ids: [], sentence_ids: [], sources: ['vocab_stats'], supplementary_cn: [], quality: 'supplemented'
    };
    const byYear = typeof item.byYear === 'string' ? JSON.parse(item.byYear) : item.byYear || {};
    if (!byYear || Array.isArray(byYear) || typeof byYear !== 'object' || Object.entries(byYear).some(([year, count]) => !/^\d{4}$/.test(year) || !Number.isFinite(count) || count < 0)) throw Error('词频年份数据无效：' + word);
    const { trans, phonetic, rawWord, ...frequency } = item;
    freqMap[word] = { ...frequency, w: word, byYear };
  }
  const empty = Object.entries(entries).filter(([, entry]) => !text(entry.definition_cn));
  if (empty.length) throw Error('词库仍有空释义：' + empty.map(([word]) => word).join(', '));
  const sorted = object => Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
  const unifiedDict = { version: 2, exam_type: 'kaoyan', paper: 1, total: Object.keys(entries).length, entries: sorted(entries) };
  const frequency = { version: 2, total: statsKeys.size, items: sorted(freqMap) };
  const lexiconJson = JSON.stringify(unifiedDict), freqJson = JSON.stringify(frequency);
  const lexiconHash = hash(lexiconJson), freqHash = hash(freqJson);
  const intersection = [...statsKeys].filter(word => mainKeys.has(word)).length;
  const manifest = {
    version: 2,
    lexicon: { hash: lexiconHash, path: '/english-data/lexicon.json', hashedPath: `/english-data/lexicon.${lexiconHash}.json`, entriesCount: unifiedDict.total },
    frequency: { hash: freqHash, path: '/english-data/vocab-frequency.json', hashedPath: `/english-data/vocab-frequency.${freqHash}.json`, itemsCount: statsKeys.size },
    quality: {
      totalEntries: unifiedDict.total, mainEntries: mainKeys.size, statsEntries: statsKeys.size, intersection,
      statsExclusive: statsKeys.size - intersection, mainExclusive: mainKeys.size - intersection, emptyDefinitions: 0,
      verifiedProperNouns: 0, verifiedCompounds: 0, contextProperNouns: corrections.filter(w => SPECIAL_CORRECTIONS[w].quality === 'proper_noun').length,
      pendingReview: corrections.filter(w => SPECIAL_CORRECTIONS[w].quality === 'needs_review'),
      coreExamWords: Object.values(entries).filter(e => e.is_kaoyan_key || e.sentence_ids.length || e.task_ids.length).length
    }
  };
  const qualityReport = { ...manifest, sources: { main: hash(rawDictText), vocab_stats: hash(rawStatsText) }, note: '构建只验证数据覆盖与结构，不代表完成界面或接口验收。专名说明来自仓库上下文；needs_review 项尚待原资料核验。' };
  fs.mkdirSync(targetDir, { recursive: true });
  for (const [name, content] of Object.entries({
    'lexicon.json': lexiconJson, [`lexicon.${lexiconHash}.json`]: lexiconJson,
    'vocab-frequency.json': freqJson, [`vocab-frequency.${freqHash}.json`]: freqJson,
    'lexicon-manifest.json': JSON.stringify(manifest, null, 2), 'lexicon-quality.json': JSON.stringify(qualityReport, null, 2),
    'kaoyan1_dict.json': lexiconJson
  })) fs.writeFileSync(path.join(targetDir, name), content);
  return { manifest, lexiconHash, freqHash, unifiedDict };
}
if (require.main === module) console.log('统一词库构建完成：', compileLexicon().manifest.quality);
module.exports = { compileLexicon, SPECIAL_CORRECTIONS };
