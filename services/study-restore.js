const db = require("../db");
const v = require("./validation");
const { digest } = require("./auth-core");
const { documents } = require("./study-export");
const arrays = new Set([
  "user_wrong_book",
  "user_favorites",
  "user_review",
  "user_exam_papers",
]);

function sourceOf(input) {
  v.object(input);
  const source =
    input.format === "question-bank-local" ? input.snapshot : input;
  if (
    !source ||
    source.format !== "yanzhuan-study" ||
    ![1, 2].includes(source.version)
  )
    v.fail("请选择真题库学习备份");
  return source;
}

function preferencesOf(source) {
  if (!source.preferences) return undefined;
  const { fontScale, theme } = source.preferences;
  v.finite(fontScale, { min: 0.9, max: 1.4 });
  if (!["dark", "light", "system"].includes(theme)) v.fail("备份阅读偏好无效");
  return { fontScale: Number(fontScale), theme };
}

function validate(input) {
  const source = sourceOf(input);
  v.object(source.data);
  const data = {};
  for (const [name, value] of Object.entries(source.data)) {
    if (!documents.includes(name)) v.fail("备份包含未知资料字段");
    if (value == null) {
      data[name] = null;
      continue;
    }
    if (arrays.has(name)) {
      if (!Array.isArray(value)) v.fail("备份列表结构无效");
    } else v.object(value);
    if (name === "english_storage")
      require("./english-schema").validatePatch(value);
    if (name === "user_notes")
      for (const note of Object.values(value)) {
        const text = typeof note === "string" ? note : note?.text;
        if (typeof text !== "string" || text.length > 20000)
          v.fail("备份笔记无效");
      }
    if (["english_state", "politics_state"].includes(name)) {
      v.object(value.answers);
      v.object(value.notes);
      for (const note of Object.values(value.notes)) {
        const text = typeof note === "string" ? note : note?.text;
        if (typeof text !== "string" || text.length > 20000)
          v.fail("备份笔记无效");
      }
      if (name === "english_state") {
        v.object(value.cards);
        if (!Array.isArray(value.exams)) v.fail("英语考试记录无效");
      } else {
        v.object(value.drafts);
        v.object(value.history);
        if (!Array.isArray(value.favorites)) v.fail("政治收藏无效");
      }
    }
    if (name === "growth_state") {
      v.object(value.user_profile);
      v.object(value.daily_session);
      v.object(value.requests);
      if (!["normal", "cooling"].includes(value.user_profile.status))
        v.fail("成长状态无效");
      for (const key of [
        "loans",
        "deposits",
        "secondary_payments",
        "caterpillar_list",
        "pbl_projects",
        "history_logs",
        "session_history",
      ]) {
        if (!Array.isArray(value[key])) v.fail("成长记录列表无效");
        for (const row of value[key]) v.object(row);
      }
      if (value.daily_session.date) {
        for (const key of [
          "today_earned_points",
          "today_spent_points",
          "draws",
          "session_round",
        ])
          v.finite(value.daily_session[key], { max: 1e12 });
        v.object(value.daily_session.today_earned_tokens);
        v.object(value.daily_session.today_spent_tokens);
        if (!Array.isArray(value.daily_session.today_tasks_done))
          v.fail("每日任务记录无效");
      }
      v.object(value.learning);
      v.object(value.learning.days);
      v.object(value.learning.totals);
      v.object(value.tokens);
      v.finite(value.points, { max: 1e12 });
      for (const count of Object.values(value.learning.totals))
        v.finite(count, { max: 1e12 });
      for (const count of Object.values(value.tokens))
        v.finite(count, { max: 1e12 });
      for (const day of Object.values(value.learning.days)) {
        v.object(day);
        v.object(day.events);
        for (const event of Object.values(day.events)) {
          v.object(event);
          v.finite(event.points, { max: 1e6 });
        }
      }
    }
    data[name] = value;
  }
  if (source.profile) {
    const { nickname, examTrack } = source.profile;
    if (
      typeof nickname !== "string" ||
      !nickname.trim() ||
      nickname.length > 30 ||
      !["math1", "math2", "math3"].includes(examTrack)
    )
      v.fail("备份个人偏好无效");
    data.user_profile = { nickname: nickname.trim(), examTrack };
  }
  preferencesOf(source);
  v.safeTree(data);
  return data;
}

function mount(app) {
  app.post("/api/study/restore", (req, res) => {
    const {
      backup,
      mode = "merge",
      preview = true,
      confirmation,
      revision,
    } = req.body;
    if (!["merge", "replace"].includes(mode)) v.fail("恢复方式无效");
    const data = validate(backup),
      preferences = preferencesOf(sourceOf(backup));
    const fingerprint = digest(JSON.stringify([data, preferences]));
    const hash = digest(JSON.stringify([fingerprint, mode]));
    const metadata = db.readJSON("study_meta", { revision: 0 });
    if (preview)
      return res.json({
        ok: true,
        confirmation: hash,
        revision: metadata.revision,
        items: Object.entries(data).map(([name, value]) => ({
          name,
          entries: value == null ? 0 : Object.keys(value).length,
        })),
        preferences,
        pendingIgnored: backup.pending?.length || 0,
      });
    if (hash !== confirmation || revision !== metadata.revision)
      return res
        .status(409)
        .json({ error: "备份内容或云端资料已变化，请重新预览" });
    const history = db.readJSON("restore_history", {});
    if (mode === "merge" && history[fingerprint])
      return res.json({ ok: true, replayed: true, preferences });
    if (!history[fingerprint] && Object.keys(history).length >= 1000)
      v.fail("已达到备份合并次数上限，请使用完整备份替换恢复", 413);
    const { mergeValue, mergeGrowth, mergeEnglish } = require("./study-sync");
    for (const [name, value] of Object.entries(data)) {
      const current = db.readJSON(name, null);
      let merged;
      if (name === "user_profile") merged = { ...db.getProfile(), ...value };
      else if (mode === "replace") merged = value;
      else if (name === "growth_state" && value)
        merged = mergeGrowth(current, value);
      else if (name === "english_storage")
        merged = mergeEnglish(current, value);
      else
        merged = mergeValue(
          current,
          value,
          name === "user_notes" ? "notes" : "",
        );
      if (name !== "user_profile")
        validate({
          format: "yanzhuan-study",
          version: 2,
          data: { [name]: merged },
        });
      db.saveJSON(name, merged);
    }
    history[fingerprint] = { at: Date.now(), mode };
    db.saveJSON("restore_history", history);
    res.json({ ok: true, preferences });
  });
  app.post("/api/study/cleanup", (req, res) => {
    const { name, confirmation } = req.body;
    if (!documents.includes(name) || confirmation !== "已导出并清理")
      v.fail("请先导出并明确选择要清理的资料");
    db.saveJSON(name, null);
    res.json({ ok: true });
  });
}
module.exports = { validate, mount };
