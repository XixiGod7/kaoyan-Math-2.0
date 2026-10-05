const db = require("../db");
const { digest } = require("./auth-core");
const { snapshot, documents } = require("./study-export");
const extras = [];
function backup() {
  const result = snapshot();
  for (const name of extras) result.data[name] = db.readJSON(name, null);
  return result;
}
function mergeValue(current, incoming, key = "") {
  if (incoming == null) return current;
  if (current == null) return incoming;
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const identity = (item) =>
      digest(JSON.stringify(item?.id ?? item?.sid ?? item));
    const seen = new Set(current.map(identity));
    return [
      ...current,
      ...incoming.filter((item) => {
        const id = identity(item);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    ];
  }
  if (
    typeof current === "object" &&
    typeof incoming === "object" &&
    !Array.isArray(current) &&
    !Array.isArray(incoming)
  ) {
    const output = { ...current };
    for (const [name, value] of Object.entries(incoming)) {
      if (["__proto__", "prototype", "constructor", "requests"].includes(name))
        continue;
      output[name] = mergeValue(
        current[name],
        value,
        key === "notes" ? "notes" : name,
      );
    }
    return output;
  }
  if (
    (key === "text" || key === "notes") &&
    typeof current === "string" &&
    typeof incoming === "string" &&
    current !== incoming &&
    incoming.trim()
  )
    return current + "\n\n——合并的访客笔记——\n" + incoming;
  return current;
}
function mergeGrowth(old, guestGrowth) {
  if (!old) return guestGrowth;
  const merged = mergeValue(old, guestGrowth),
    keys = ["math", "politics", "english", "reviews", "notes", "exams"],
    totals = Object.fromEntries(
      keys.map((k) => [
        k,
        (old.learning.totals[k] || 0) + (guestGrowth.learning.totals[k] || 0),
      ]),
    );
  let duplicates = 0;
  for (const [date, day] of Object.entries(guestGrowth.learning.days || {}))
    for (const [key, event] of Object.entries(day.events || {}))
      if (old.learning.days[date]?.events[key]) {
        duplicates += event.points || 0;
        const k =
          event.kind === "answer"
            ? event.subject
            : { review: "reviews", note: "notes", exam: "exams" }[event.kind];
        if (k in totals) totals[k] = Math.max(0, totals[k] - 1);
      }
  for (const day of Object.values(merged.learning.days)) {
    Object.assign(day, {
      math: 0,
      politics: 0,
      english: 0,
      reviews: 0,
      notes: 0,
      exams: 0,
      earned: 0,
    });
    for (const event of Object.values(day.events)) {
      const key =
        event.kind === "answer"
          ? event.subject
          : { review: "reviews", note: "notes", exam: "exams" }[event.kind];
      if (key in totals) {
        day[key]++;
      }
      day.earned += event.points || 0;
    }
  }
  merged.learning.totals = totals;
  merged.points = Math.max(0, old.points + guestGrowth.points - duplicates);
  for (const key of Object.keys(merged.tokens))
    merged.tokens[key] =
      (old.tokens[key] || 0) + (guestGrowth.tokens[key] || 0);

  return merged;
}
function mergeGuest(guest, incoming) {
  const imports = db.readJSON("guest_imports", {});
  if (imports[guest]) return { merged: false };
  // Both snapshots originate from trusted private stores, never from an HTTP upload.
  for (const name of [...documents, ...extras]) {
    if (name === "growth_state" || !incoming.data[name]) continue;
    const current = db.readJSON(name, null);
    if (name === "english_storage")
      db.saveJSON(name, mergeEnglish(current, incoming.data[name]));
    else if (name === "study_positions" && current) {
      const positions = { ...current };
      for (const [key, value] of Object.entries(incoming.data[name]))
        if (!positions[key] || positions[key].at < value.at)
          positions[key] = value;
      db.saveJSON(name, positions);
    } else db.saveJSON(name, mergeValue(current, incoming.data[name]));
  }
  if (incoming.data.growth_state)
    db.saveJSON(
      "growth_state",
      mergeGrowth(
        db.readJSON("growth_state", null),
        incoming.data.growth_state,
      ),
    );
  if (!db.readJSON("user_profile", null))
    db.saveJSON("user_profile", { ...db.getProfile(), ...incoming.profile });
  imports[guest] = Date.now();
  db.saveJSON("guest_imports", imports);
  return { merged: true };
}
const allowedWrite = require("../public/shared/operations").allowed;
function noteValue(path, body) {
  if (path === "/api/note") {
    const n = db.getNotes()[String(body.questionId)];
    return n?.text ?? n ?? "";
  }
  if (path === "/api/politics/note")
    return db.readJSON("politics_state", {}).notes?.[body.qid] || "";
  if (path === "/api/english/note")
    return db.readJSON("english_state", {}).notes?.[body.sourceId]?.text || "";
  return undefined;
}
const locks = new Map();
async function exclusive(callback) {
  const key = db.lockKey(),
    previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => (release = resolve));
  locks.set(key, current);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}
const networkPath = (path) =>
  /^\/api\/(?:ai\/|why$|qa\/(?:ask|start)|politics\/ask$|incentive\/chat$|custom\/(?:explain|recognize)$)/.test(
    path,
  );
function writes(req, res, next) {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
    !req.path.startsWith("/api/")
  )
    return next();
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  if (networkPath(req.path)) {
    if (!db.identity()?.authenticated && db.readJSON("migration_owner", null))
      return res
        .status(401)
        .json({ error: "访客资料已迁移，请刷新并登录账号后继续" });
    if (!db.hasSql())
      require("./auth-local").core().budget(req.ip, "write", 300);
    return db.withSignal(controller.signal, () => next(), req.studyTiming);
  }
  if (req.is("application/json") && !req.body)
    return res.status(400).json({ error: "请提交有效 JSON 内容" });
  const key = db.lockKey(),
    previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => (release = resolve));
  locks.set(key, current);
  const queuedAt = Date.now();
  previous.then(() => {
    req.studyTiming ||= {};
    req.studyTiming.queueMs = Date.now() - queuedAt;
    let finished = false;
    const unlock = () => {
      if (finished) return;
      finished = true;
      release();
      if (locks.get(key) === current) locks.delete(key);
    };
    res.once("finish", unlock);
    res.once("close", unlock);
    const transaction = new Map();
    db.withSignal(
      controller.signal,
      () =>
        db.withTransaction(transaction, () => {
          try {
            if (
              !db.identity()?.authenticated &&
              db.readJSON("migration_owner", null)
            )
              return res
                .status(401)
                .json({ error: "访客资料已迁移，请刷新页面并登录账号后继续" });
            if (req.is("application/json"))
              require("./validation").safeTree(req.body);
            if (!db.hasSql())
              require("./auth-local").core().budget(req.ip, "write", 300);
            const operation =
                req.get("X-Study-Operation") || req.get("Idempotency-Key"),
              source = req.get("X-Study-Operation") ? "study:" : "idempotent:";
            const tracked =
              operation &&
              allowedWrite(req.path) &&
              !(
                req.path === "/api/study/restore" && req.body.preview !== false
              );
            if (tracked && !/^[a-zA-Z0-9_-]{8,100}$/.test(operation))
              return res.status(400).json({ error: "同步操作编号无效" });
            const data = tracked ? db.readJSON("sync_operations", {}) : null,
              hash = tracked
                ? digest(
                    JSON.stringify([req.method, req.originalUrl, req.body]),
                  )
                : null,
              recordKey = source + operation;
            const prior = data?.[recordKey];
            if (prior)
              return prior.hash !== hash
                ? res.status(409).json({ error: "同步编号与内容不匹配" })
                : res
                    .set("X-Study-Replayed", "1")
                    .status(prior.status)
                    .json(prior.body);
            const base = req.body?._studyBase;
            if (base) {
              const value = noteValue(req.path, req.body);
              if (
                value !== undefined &&
                base.note &&
                digest(value) !== base.note &&
                value !== (req.body.text ?? req.body.note)?.trim()
              )
                return res.status(409).json({
                  error: "这条笔记已在另一台设备修改，请选择要保留的版本",
                  conflict: true,
                  cloud: value,
                });
              if (req.path === "/api/english/storage" && base.keys) {
                const storage = db.readJSON("english_storage", {});
                for (const [key, baseHash] of Object.entries(base.keys))
                  if (
                    digest(storage[key] ?? null) !== baseHash &&
                    (storage[key] ?? null) !== req.body.patch?.[key]
                  ) {
                    if (
                      /^kaoyan_quiz_progress_\d{4}$/.test(key) &&
                      storage[key] &&
                      req.body.patch?.[key]
                    ) {
                      const old = JSON.parse(storage[key]),
                        incoming = JSON.parse(req.body.patch[key]);
                      if (
                        (!old.attemptId ||
                          old.attemptId === incoming.attemptId) &&
                        Object.entries(old.answers || {}).every(
                          ([id, answer]) =>
                            !Object.hasOwn(incoming.answers || {}, id) ||
                            JSON.stringify(incoming.answers[id]) ===
                              JSON.stringify(answer),
                        )
                      )
                        continue;
                    }
                    return res.status(409).json({
                      error: "英语记录已在另一台设备修改，请选择版本",
                      conflict: true,
                      key,
                      cloud: storage[key] ?? null,
                    });
                  }
              }
            }
            const original = res.json.bind(res);
            res.json = (body) => {
              if (
                res.statusCode >= 200 &&
                res.statusCode < 300 &&
                !controller.signal.aborted
              ) {
                if (tracked) {
                  const entries = Object.entries(data)
                    .filter(([, item]) => item.at > Date.now() - 30 * 86400000)
                    .slice(-499);
                  let bytes = JSON.stringify(body).length;
                  while (
                    entries.length &&
                    bytes + JSON.stringify(entries).length > 2000000
                  )
                    entries.shift();
                  db.saveJSON("sync_operations", {
                    ...Object.fromEntries(entries),
                    [recordKey]: {
                      hash,
                      body,
                      status: res.statusCode,
                      at: Date.now(),
                    },
                  });
                }
                db.commitTransaction(transaction);
              }
              return original(body);
            };
            next();
          } catch (e) {
            next(e);
          }
        }),
      req.studyTiming,
    );
  });
}
function mount(app) {
  app.get("/api/study/sync", (req, res) => {
    const result = backup(),
      metadata = db.readJSON("study_meta", { revision: 0, documents: {} }),
      since = Number(req.query.since) || 0;
    const partial =
      since > 0 &&
      since <= metadata.revision &&
      since >= (metadata.englishFloor || 0);
    if (partial)
      result.data = Object.fromEntries(
        Object.entries(result.data).filter(
          ([key]) => (metadata.documents[key] || 0) > since,
        ),
      );
    if (partial && result.data.english_storage && metadata.englishKeys)
      result.data.english_storage = Object.fromEntries(
        Object.entries(metadata.englishKeys)
          .filter(([, rev]) => rev > since)
          .map(([key]) => [key, result.data.english_storage[key] ?? null]),
      );
    res.json({
      scope: db.identity()?.scope,
      revision: metadata.revision,
      partial,
      ...result,
    });
  });
  app.get("/api/study/position", (req, res) =>
    res.json({ items: db.readJSON("study_positions", {}) }),
  );
  app.post("/api/study/position", (req, res) => {
    const { key, value } = req.body;
    if (
      typeof key !== "string" ||
      key.length < 1 ||
      key.length > 180 ||
      /[\x00-\x1f]/.test(key) ||
      ["__proto__", "constructor", "prototype"].includes(key) ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(value).length > 12000
    )
      return res.status(400).json({ error: "浏览位置无效" });
    if (
      value.url &&
      (!/^\/(?:math|politics|english|growth|library)(?:[/?#]|$)/.test(
        value.url,
      ) ||
        value.url.length > 1000 ||
        /[\\\r\n]/.test(value.url))
    )
      return res.status(400).json({ error: "导航地址无效" });
    const items = db.readJSON("study_positions", {});
    if (Object.keys(items).length > 250 && !items[key])
      delete items[Object.keys(items)[0]];
    items[key] = { ...value, at: Date.now() };
    db.saveJSON("study_positions", items);
    res.json({ ok: true });
  });
}
function mergeEnglish(current, incoming) {
  const schema = require("./english-schema"),
    result = { ...current };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (!schema.validKey(key) || value === null) continue;
    schema.validate(key, value);
    if (result[key] == null) {
      result[key] = value;
      continue;
    }
    if (key.startsWith("kaoyan_essay_")) {
      if (result[key] !== value && !result[key].includes(value))
        result[key] += "\n\n——合并的学习草稿——\n" + value;
    } else
      result[key] = JSON.stringify(
        mergeValue(JSON.parse(result[key]), JSON.parse(value)),
      );
    schema.validate(key, result[key]);
  }
  return result;
}
module.exports = {
  backup,
  mergeGuest,
  allowedWrite,
  writes,
  mount,
  exclusive,
  mergeValue,
  mergeGrowth,
  mergeEnglish,
};
