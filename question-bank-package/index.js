/**
 * 考研数学题库 Node.js 独立检索与管理工具包
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 惰性加载与内存索引
let allQuestions = null;
let allQuestionsMap = null;
let indexMain = null;
let indexAll = null;
let meta = null;
let syllabus = null;
let pojueMethods = null;
let pojueGraph = null;

function ensureLoaded() {
  if (!allQuestions) {
    allQuestions = loadJSON('all_questions.json');
    allQuestionsMap = new Map(allQuestions.map(q => [String(q.id), q]));
    indexMain = loadJSON('index-main.json');
    indexAll = loadJSON('index-all.json');
    meta = loadJSON('meta.json');
    syllabus = loadJSON('syllabus.json');
    pojueMethods = loadJSON('pojue-methods.json');
    pojueGraph = loadJSON('pojue-graph.json');
  }
}

/**
 * 获取全量题目 (2,185 题)
 */
function getAllQuestions() {
  ensureLoaded();
  return allQuestions;
}

/**
 * 获取主线真题 (2009-2026，共 912 题)
 */
function getMainQuestions() {
  ensureLoaded();
  return indexMain;
}

/**
 * 根据 ID 获取单道题目
 * @param {number|string} id 题号如 90101
 */
function getQuestionById(id) {
  ensureLoaded();
  return allQuestionsMap.get(String(id)) || null;
}

/**
 * 多条件组合筛选题目
 * @param {Object} filter
 * @param {string} [filter.paper] 卷种：数学一 / 数学二 / 数学三
 * @param {number} [filter.year] 年份：1987 ~ 2026
 * @param {string} [filter.type] 题型：选择题 / 填空题 / 解答题 / 证明题
 * @param {number} [filter.difficulty] 难度：1 ~ 5
 * @param {string} [filter.kp] 考点关键字
 * @param {string} [filter.method] 解题招法编码或关键字
 * @param {string} [filter.keyword] 题干内容关键字搜索
 * @param {number} [filter.limit] 返回条数
 * @param {number} [filter.offset=0] 偏移量
 */
function queryQuestions(filter = {}) {
  ensureLoaded();
  let results = allQuestions;

  if (filter.paper) {
    results = results.filter(q => q.papers && q.papers.includes(filter.paper));
  }
  if (filter.year) {
    results = results.filter(q => q.year === Number(filter.year));
  }
  if (filter.type) {
    results = results.filter(q => q.type === filter.type);
  }
  if (filter.difficulty) {
    results = results.filter(q => (q.difficulty === Number(filter.difficulty) || q.difficultyEst === Number(filter.difficulty)));
  }
  if (filter.kp) {
    results = results.filter(q => q.kps && q.kps.some(k => (typeof k === 'string' ? k : k.kp).includes(filter.kp)));
  }
  if (filter.method) {
    results = results.filter(q => q.methods && q.methods.some(m => m.includes(filter.method)));
  }
  if (filter.keyword) {
    results = results.filter(q => q.stem && q.stem.includes(filter.keyword));
  }

  const offset = filter.offset || 0;
  if (filter.limit) {
    return results.slice(offset, offset + filter.limit);
  }
  return offset > 0 ? results.slice(offset) : results;
}

/**
 * 获取某一整套卷子的完整试题 (按试卷原始题号升序排序)
 * @param {string} paper 卷种名称，如 '数学一'
 * @param {number} year 年份，如 2026
 */
function getPaper(paper, year) {
  ensureLoaded();
  const y = Number(year);
  return allQuestions
    .filter(q => q.year === y && q.papers && q.papers.includes(paper))
    .sort((a, b) => {
      const idxA = (a.indexByPaper && a.indexByPaper[paper]) || a.index || 0;
      const idxB = (b.indexByPaper && b.indexByPaper[paper]) || b.index || 0;
      return idxA - idxB;
    });
}

/**
 * 举一反三：推荐同招法/同考点巩固题目
 * @param {number|string|Object} target 目标题号或题目对象
 * @param {number} [count=3] 推荐题目数
 */
function getSimilarQuestions(target, count = 3) {
  ensureLoaded();
  const q = typeof target === 'object' ? target : getQuestionById(target);
  if (!q) return [];

  const qMethods = new Set(q.methods || []);
  const qKps = new Set((q.kps || []).map(k => typeof k === 'string' ? k : k.kp));

  const candidates = allQuestions.filter(item => String(item.id) !== String(q.id));

  const scored = candidates.map(item => {
    let score = 0;
    // 招法匹配权重高
    if (item.methods) {
      item.methods.forEach(m => {
        if (qMethods.has(m)) score += 100;
      });
    }
    // 考点匹配
    if (item.kps) {
      item.kps.forEach(k => {
        const kpName = typeof k === 'string' ? k : k.kp;
        if (qKps.has(kpName)) score += 30;
      });
    }
    // 同卷种加分
    if (item.papers && q.papers && item.papers.some(p => q.papers.includes(p))) {
      score += 10;
    }
    // 题型相同加分
    if (item.type === q.type) {
      score += 5;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.item);
}

/**
 * 获取考纲知识结构体系
 * @param {string} [paper] 可选指定卷种，如 '数学一'
 */
function getSyllabus(paper) {
  ensureLoaded();
  return paper ? syllabus[paper] || [] : syllabus;
}

/**
 * 获取破题诀招法与领域清单
 * @param {string} [domain] 可选指定领域名称
 */
function getMethods(domain) {
  ensureLoaded();
  return domain ? pojueMethods.filter(m => m.domainName === domain || m.domain === domain) : pojueMethods;
}

/**
 * 获取题库宏观元数据
 */
function getMeta() {
  ensureLoaded();
  return meta;
}

module.exports = {
  getAllQuestions,
  getMainQuestions,
  getQuestionById,
  queryQuestions,
  getPaper,
  getSimilarQuestions,
  getSyllabus,
  getMethods,
  getMeta
};
