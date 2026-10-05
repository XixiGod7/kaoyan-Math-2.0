const v = require("./validation");
const validKey = (key) =>
  /^(kaoyan_(?:word_statuses|wordfreq_sidebar_collapsed|quiz_history|quiz_records|ebbinghaus_records|daily_session_state|daily_review_limit|favorite_sentences|wrong_questions|paraphrase_progress|phrase_dictate_history|reading_progress|trans_\d{4}|quiz_progress_\d{4}|essay_[a-zA-Z0-9_-]+|ai_reviews_[a-zA-Z0-9_-]+))$/.test(
    key,
  );
const record = (x) => v.object(x);
const list = (x) => {
  if (!Array.isArray(x)) v.fail("学习记录应为列表");
  return x;
};
const str = (x) => {
  if (typeof x !== "string" || x.length > 20000) v.fail("学习内容无效");
};
const timestamp = (x) => v.finite(x, { max: 1e14 });
function validate(key, raw) {
  if (!validKey(key) || typeof raw !== "string" || raw.length > 1500000)
    v.fail("学习记录字段无效");
  if (key.startsWith("kaoyan_essay_")) return raw;
  let x;
  try {
    x = JSON.parse(raw);
  } catch {
    v.fail("学习记录不是有效 JSON");
  }
  v.safeTree(x);
  if (key === "kaoyan_wordfreq_sidebar_collapsed") {
    if (typeof x !== "boolean") v.fail("侧栏设置无效");
    return x;
  }
  if (key === "kaoyan_daily_review_limit") {
    v.finite(x, { max: 10000, integer: true });
    return x;
  }
  if (/kaoyan_(quiz_records|favorite_sentences|wrong_questions)$/.test(key)) {
    for (const row of list(x)) {
      record(row);
      if (key.includes("favorite")) str(row.sid);
      else if (key.includes("wrong")) {
        if (row.id == null) v.fail("错题标识缺失");
      } else {
        str(row.year);
        for (const k of ["score", "timestamp", "timeSpentSeconds"])
          if (row[k] != null) timestamp(row[k]);
      }
    }
    return x;
  }
  record(x);
  if (key === "kaoyan_quiz_history") {
    for (const [year, rows] of Object.entries(x))
      for (const row of list(rows)) {
        record(row);
        if (row.year !== year) v.fail("考试历史年份不匹配");
        str(row.tabId);
        for (const k of [
          "score",
          "totalQuestions",
          "correctQuestions",
          "timeSpentSeconds",
        ])
          v.finite(row[k]);
        timestamp(row.timestamp);
      }
    return x;
  }
  if (key === "kaoyan_word_statuses") {
    for (const s of Object.values(x)) {
      if (!["unknown", "familiar", "unfamiliar"].includes(s))
        v.fail("单词状态无效");
    }
    return x;
  }
  if (key === "kaoyan_ebbinghaus_records") {
    for (const r of Object.values(x)) {
      record(r);
      str(r.word);
      v.finite(r.stage, { max: 8, integer: true });
      timestamp(r.nextReviewTime);
      timestamp(r.lastReviewTime);
      v.finite(r.reviewCount, { max: 1000000, integer: true });
      if (r.history)
        for (const h of list(r.history)) {
          record(h);
          timestamp(h.time);
          if (!["again", "hard", "good", "easy"].includes(h.rating))
            v.fail("复习评分无效");
        }
    }
    return x;
  }
  if (key === "kaoyan_daily_session_state") {
    str(x.dateStr);
    list(x.passedWords).forEach(str);
    for (const r of list(x.activeQueueWords)) {
      record(r);
      str(r.word);
      v.finite(r.sessionMistakes);
      v.finite(r.sessionPassCount);
    }
    v.finite(x.sessionTotalTarget, { max: 10000 });
    return x;
  }
  if (key.startsWith("kaoyan_quiz_progress_")) {
    str(x.year);
    if (key.slice(-4) !== x.year) v.fail("草稿年份不匹配");
    record(x.answers);
    for (const [id, a] of Object.entries(x.answers)) {
      v.finite(id, { min: 1, max: 52, integer: true });
      str(a);
    }
    v.finite(x.elapsedSeconds);
    timestamp(x.lastUpdated);
    if (typeof x.isSubmitted !== "boolean") v.fail("提交状态无效");
    if (x.attemptId != null) v.key(x.attemptId);
    return x;
  }
  if (key === "kaoyan_reading_progress") {
    for (const r of Object.values(x)) {
      if (Array.isArray(r)) {
        r.forEach(str);
        continue;
      }
      record(r);
      list(r.readSentences).forEach(str);
    }
    return x;
  }
  if (key === "kaoyan_paraphrase_progress") {
    for (const r of Object.values(x)) {
      record(r);
      str(r.myChoice);
      if (typeof r.correct !== "boolean") v.fail("判分状态无效");
      timestamp(r.timestamp);
    }
    return x;
  }
  if (key === "kaoyan_phrase_dictate_history") {
    for (const r of Object.values(x)) {
      record(r);
      v.finite(r.correctCount);
      v.finite(r.wrongCount);
      timestamp(r.lastTested);
    }
    return x;
  }
  if (key.startsWith("kaoyan_trans_")) {
    Object.values(x).forEach(str);
    return x;
  }
  for (const r of Object.values(x)) record(r);
  return x;
}
function validatePatch(patch) {
  record(patch);
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null) validate(key, value);
    else if (!validKey(key)) v.fail("学习记录字段无效");
  }
  return patch;
}
module.exports = { validate, validatePatch, validKey };
