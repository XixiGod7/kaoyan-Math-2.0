const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('node:async_hooks');
const storageContext = new AsyncLocalStorage();

const DATA_DIR = process.env.DATA_DIR || path.join(typeof __dirname === 'string' ? __dirname : '/tmp', 'data');

function getFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJSON(name, defaultValue) {
  const sql = storageContext.getStore();
  if (sql) {
    const rows = sql.exec('SELECT value FROM documents WHERE name = ?', name).toArray();
    return rows.length ? JSON.parse(rows[0].value) : structuredClone(defaultValue);
  }
  const file = getFilePath(name);
  if (!fs.existsSync(file)) {
    saveJSON(name, defaultValue);
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`Error reading ${name}.json:`, err);
    return defaultValue;
  }
}

function saveJSON(name, data) {
  const sql = storageContext.getStore();
  if (sql) {
    sql.exec('INSERT INTO documents (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value', name, JSON.stringify(data));
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = getFilePath(name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
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
  runWithStorage: (sql, callback) => storageContext.run(sql, callback),
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
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.AI_MODEL || "deepseek-chat",
    temperature: 0.6
  }),
  saveAiConfig: (cfg) => saveJSON('ai_config', cfg),

  getQaSessions: () => readJSON('qa_sessions', []),
  saveQaSessions: (list) => saveJSON('qa_sessions', list)
};

