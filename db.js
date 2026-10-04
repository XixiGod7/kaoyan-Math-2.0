const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const storageContext = new AsyncLocalStorage();

const DATA_DIR = process.env.DATA_DIR || path.join(typeof __dirname === 'string' ? __dirname : '/tmp', 'data');

function getFilePath(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('无效记录名称');
  const scope = storageContext.getStore()?.scope;
  return path.join(DATA_DIR, ...(scope ? ['users', scope.replace(':', '_')] : []), `${name}.json`);
}

function readJSON(name, defaultValue) {
  const sql = storageContext.getStore()?.sql;
  if (sql) {
    const rows = sql.exec('SELECT value FROM documents WHERE name = ?', name).toArray();
    if (!rows.length) return structuredClone(defaultValue);
    const value = JSON.parse(rows[0].value);
    if(value===null&&defaultValue!==null)return structuredClone(defaultValue);
    if (!value?.__mb_chunks) return value;
    let content = '';
    for (let i = 0; i < value.count; i++) {
      const part = sql.exec('SELECT value FROM documents WHERE name = ?', `${name}::${value.__mb_chunks}:${i}`).toArray()[0];
      if (!part) throw new Error('个人记录分片不完整');
      content += JSON.parse(part.value);
    }
    return JSON.parse(content);
  }
  const file = getFilePath(name);
  if (!fs.existsSync(file)) {
    return structuredClone(defaultValue);
  }
  try {
    const value=JSON.parse(fs.readFileSync(file, 'utf-8'));return value===null&&defaultValue!==null?structuredClone(defaultValue):value;
  } catch (err) {
    console.error(`Error reading ${name}.json:`, err);
    throw new Error(`学习记录 ${name} 读取失败，请从备份恢复`);
  }
}

function saveJSON(name, data) {
  const sql = storageContext.getStore()?.sql;
  if (sql) {
    const content = JSON.stringify(data), old = sql.exec('SELECT value FROM documents WHERE name = ?', name).toArray()[0];
    const oldValue = old ? JSON.parse(old.value) : null;
    const write = (key, value) => sql.exec('INSERT INTO documents (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value', key, value);
    if (content.length > 128000) {
      const version = randomUUID(), count = Math.ceil(content.length / 128000);
      // Publish the new manifest only after all immutable pieces have been written.
      // Each piece stays below SQLite Durable Objects' per-row size limit.
      for (let i = 0; i < count; i++) write(`${name}::${version}:${i}`, JSON.stringify(content.slice(i * 128000, (i + 1) * 128000)));
      write(name, JSON.stringify({ __mb_chunks: version, count }));
    } else write(name, content);
    if (oldValue?.__mb_chunks) for (let i = 0; i < oldValue.count; i++) sql.exec('DELETE FROM documents WHERE name = ?', `${name}::${oldValue.__mb_chunks}:${i}`);
    return;
  }
  const file = getFilePath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data), 'utf-8');
  fs.renameSync(temporary, file);
}

// Initial datasets
const initialFeedback = [
  { id: "fb-1", title: "希望增加更多二重积分极坐标转换技巧", votes: 42, tag: "内容建议", status: "已收录", createdAt: "2026-08-15" },
  { id: "fb-2", title: "矩阵对角化破题诀非常受用！建议线代增加几何直观图", votes: 89, tag: "点赞", status: "进行中", createdAt: "2026-08-20" },
  { id: "fb-3", title: "公式手册可以增加常用泰勒展开的高阶项系数表", votes: 56, tag: "功能优化", status: "已上线", createdAt: "2026-09-01" },
  { id: "fb-4", title: "概率论二维随机变量边缘分布和条件分布希望增加速记口诀", votes: 31, tag: "内容建议", status: "已收录", createdAt: "2026-09-05" }
];

const initialProfile = {
  id: "local_user_1",
  nickname: "研友",
  avatar: "",
  bio: "一战成硕，高分上岸！",
  examTrack: "math1",
  betaDsl: true,
  wrongStreak: 0,
  permissions: ["all"]
};

module.exports = {
  runWithStorage: (sql, callback, assets, identity) => storageContext.run({ sql, assets, identity }, callback),
  runAsUser: (identity, callback) => storageContext.run({ identity, scope: identity.scope }, callback),
  identity: () => storageContext.getStore()?.identity,
  hasSql: () => Boolean(storageContext.getStore()?.sql),
  dataDir: DATA_DIR,
  getAssets: () => storageContext.getStore()?.assets,
  readJSON,
  saveJSON,
  getProfile: () => readJSON('user_profile', initialProfile),
  updateProfile: (data) => {
    const p = { ...readJSON('user_profile', initialProfile), ...data };
    saveJSON('user_profile', p);
    return p;
  },

  getWrongBook: () => readJSON('user_wrong_book', []),
  saveWrongBook: (list) => saveJSON('user_wrong_book', list),

  getFavorites: () => readJSON('user_favorites', []),
  saveFavorites: (list) => saveJSON('user_favorites', list),

  getNotes: () => readJSON('user_notes', {}),
  saveNotes: (obj) => saveJSON('user_notes', obj),

  getReviewCards: () => readJSON('user_review', []),
  saveReviewCards: (list) => saveJSON('user_review', list),

  getProgress: () => readJSON('user_progress', {
    answered: {}, // id -> { answer, correct, timestamp }
    streak: 0,
    lastActive: new Date().toISOString().split('T')[0],
    todayCount: 0,
    kpScores: {}
  }),
  saveProgress: (obj) => saveJSON('user_progress', obj),

  getFeedback: () => readJSON('feedback_board', initialFeedback),
  saveFeedback: (list) => saveJSON('feedback_board', list),

  getSolutions: () => readJSON('solutions', {}),
  saveSolutions: (obj) => saveJSON('solutions', obj),

  getExamPapers: () => readJSON('user_exam_papers', []),
  saveExamPapers: (list) => saveJSON('user_exam_papers', list),

  getPaperAttempts: () => readJSON('user_paper_attempts', {}),
  savePaperAttempts: (obj) => saveJSON('user_paper_attempts', obj),

  getAiConfig: () => readJSON('ai_config', {
    apiKey: storageContext.getStore()?.sql ? '' : (process.env.AI_API_KEY || ""),
    baseUrl: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.AI_MODEL || "deepseek-chat",
    temperature: 0.6
  }),
  saveAiConfig: (cfg) => saveJSON('ai_config', cfg),

  getQaSessions: () => readJSON('qa_sessions', []),
  saveQaSessions: (list) => saveJSON('qa_sessions', list)
};

