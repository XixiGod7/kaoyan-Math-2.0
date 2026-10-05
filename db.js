const fs = require("node:fs");
const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const storageContext = new AsyncLocalStorage();
const DATA_DIR =
  process.env.DATA_DIR ||
  path.join(typeof __dirname === "string" ? __dirname : "/tmp", "data");
let localDatabase;
function localStore() {
  if (localDatabase) return localDatabase;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  localDatabase = new DatabaseSync(path.join(DATA_DIR, "study.sqlite"));
  localDatabase.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS documents(scope TEXT NOT NULL,name TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(scope,name)); CREATE TABLE IF NOT EXISTS auth_registry(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
  );
  return localDatabase;
}
function scopeKey() {
  const c = storageContext.getStore();
  return (
    c?.identity?.storageScope || c?.scope || c?.identity?.scope || "legacy"
  );
}
function getFilePath(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("无效记录名称");
  const scope = scopeKey();
  return path.join(
    DATA_DIR,
    ...(scope === "legacy" ? [] : ["users", scope.replace(":", "_")]),
    name + ".json",
  );
}
function getDocument(name) {
  const c = storageContext.getStore();
  return c?.sql
    ? c.sql
        .exec("SELECT value FROM documents WHERE name = ?", name)
        .toArray()[0]?.value
    : localStore()
        .prepare("SELECT value FROM documents WHERE scope=? AND name=?")
        .get(scopeKey(), name)?.value;
}
function putDocument(name, value) {
  const c = storageContext.getStore();
  if (c?.sql)
    c.sql.exec(
      "INSERT INTO documents (name,value) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
      name,
      value,
    );
  else
    localStore()
      .prepare(
        "INSERT INTO documents(scope,name,value) VALUES (?,?,?) ON CONFLICT(scope,name) DO UPDATE SET value=excluded.value",
      )
      .run(scopeKey(), name, value);
}
function removeDocument(name) {
  const c = storageContext.getStore();
  if (c?.sql) c.sql.exec("DELETE FROM documents WHERE name=?", name);
  else
    localStore()
      .prepare("DELETE FROM documents WHERE scope=? AND name=?")
      .run(scopeKey(), name);
}
function readJSON(name, defaultValue) {
  const c = storageContext.getStore();
  if (c?.transaction?.has(name))
    return structuredClone(c.transaction.get(name));
  let content = getDocument(name);
  if (content === undefined && !c?.sql) {
    const file = getFilePath(name);
    if (fs.existsSync(file)) {
      content = fs.readFileSync(file, "utf8");
      JSON.parse(content);
      putDocument(name, content);
    }
  }
  if (content === undefined) return structuredClone(defaultValue);
  let value = JSON.parse(content);
  if (value?.__mb_english_keys) {
    value = Object.fromEntries(
      value.__mb_english_keys.map((key) => [
        key,
        JSON.parse(
          getDocument(
            "english_key_" + require("./services/auth-core").digest(key),
          ) || "null",
        ),
      ]),
    );
  }
  if (value?.__mb_chunks) {
    let text = "";
    for (let i = 0; i < value.count; i++) {
      const part = getDocument(name + "::" + value.__mb_chunks + ":" + i);
      if (part === undefined) throw new Error("个人记录分片不完整");
      text += JSON.parse(part);
    }
    value = JSON.parse(text);
  }
  return value === null && defaultValue !== null
    ? structuredClone(defaultValue)
    : value;
}
function writeOne(name, data) {
  const content = JSON.stringify(data),
    old = getDocument(name),
    prior = old ? JSON.parse(old) : null;
  if (name === "english_storage" && data == null)
    for (const key of prior?.__mb_english_keys || [])
      removeDocument(
        "english_key_" + require("./services/auth-core").digest(key),
      );
  if (name === "english_storage" && data) {
    const keys = Object.keys(data);
    for (const key of keys) {
      const id = "english_key_" + require("./services/auth-core").digest(key),
        value = JSON.stringify(data[key]);
      if (getDocument(id) !== value) putDocument(id, value);
    }
    for (const key of prior?.__mb_english_keys || [])
      if (!Object.hasOwn(data, key))
        removeDocument(
          "english_key_" + require("./services/auth-core").digest(key),
        );
    putDocument(name, JSON.stringify({ __mb_english_keys: keys }));
    if (prior?.__mb_chunks)
      for (let i = 0; i < prior.count; i++)
        removeDocument(name + "::" + prior.__mb_chunks + ":" + i);
    return;
  }
  if (storageContext.getStore()?.sql && content.length > 128000) {
    const version = randomUUID(),
      count = Math.ceil(content.length / 128000);
    for (let i = 0; i < count; i++)
      putDocument(
        name + "::" + version + ":" + i,
        JSON.stringify(content.slice(i * 128000, (i + 1) * 128000)),
      );
    putDocument(name, JSON.stringify({ __mb_chunks: version, count }));
  } else putDocument(name, content);
  if (prior?.__mb_chunks)
    for (let i = 0; i < prior.count; i++)
      removeDocument(name + "::" + prior.__mb_chunks + ":" + i);
}
function commitTransaction(transaction) {
  if (!transaction.size) return;
  const started = Date.now();
  return storageContext.run(
    { ...storageContext.getStore(), transaction: null },
    () => {
      const usage = require("./services/storage-budget").check(
        transaction,
        readJSON,
      );
      const englishBefore = transaction.has("english_storage")
        ? readJSON("english_storage", {})
        : null;
      const perform = () => {
        writeOne("storage_usage", usage);
        for (const [name, value] of transaction) writeOne(name, value);
        const metadata = readJSON("study_meta", { revision: 0, documents: {} });
        metadata.revision++;
        if (englishBefore) {
          metadata.englishKeys ||= {};
          const after = transaction.get("english_storage") || {};
          for (const key of new Set([
            ...Object.keys(englishBefore),
            ...Object.keys(after),
          ]))
            if (englishBefore[key] !== after[key])
              metadata.englishKeys[key] = metadata.revision;
          const revisions = Object.entries(metadata.englishKeys).sort(
            (a, b) => a[1] - b[1],
          );
          for (const [key, revision] of revisions.slice(0, -4000)) {
            delete metadata.englishKeys[key];
            metadata.englishFloor = Math.max(
              metadata.englishFloor || 0,
              revision,
            );
          }
        }
        for (const name of transaction.keys())
          if (require("./services/storage-budget").documents.includes(name))
            metadata.documents[name] = metadata.revision;
        writeOne("study_meta", metadata);
      };
      const c = storageContext.getStore();
      if (c?.storage) c.storage.transactionSync(perform);
      else if (c?.sql) throw new Error("云端事务存储未初始化");
      else {
        const store = localStore();
        store.exec("BEGIN IMMEDIATE");
        try {
          perform();
          store.exec("COMMIT");
        } catch (e) {
          store.exec("ROLLBACK");
          throw e;
        }
      }
      if (c?.timing)
        c.timing.persistMs = (c.timing.persistMs || 0) + Date.now() - started;
    },
  );
}
function saveJSON(name, data) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("无效记录名称");
  const tx = storageContext.getStore()?.transaction;
  if (tx) tx.set(name, structuredClone(data));
  else commitTransaction(new Map([[name, data]]));
}
function withTransaction(transaction, callback) {
  return storageContext.run(
    { ...storageContext.getStore(), transaction },
    callback,
  );
}
function atomic(callback) {
  if (storageContext.getStore()?.transaction) return callback();
  const transaction = new Map();
  return withTransaction(transaction, () => {
    const result = callback();
    if (result?.then) throw new Error("持久化事务中不能等待外部请求");
    commitTransaction(transaction);
    return result;
  });
}
function authStore() {
  const store = localStore();
  const count = store
    .prepare("SELECT count(*) AS count FROM auth_registry")
    .get().count;
  if (!count) {
    const file = path.join(DATA_DIR, "auth", "registry.json");
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      store.exec("BEGIN IMMEDIATE");
      try {
        for (const [key, value] of Object.entries(data))
          store
            .prepare(
              "INSERT OR IGNORE INTO auth_registry(key,value) VALUES (?,?)",
            )
            .run(key, JSON.stringify(value));
        store.exec("COMMIT");
      } catch (e) {
        store.exec("ROLLBACK");
        throw e;
      }
    }
  }
  return {
    get: (key) => {
      const row = store
        .prepare("SELECT value FROM auth_registry WHERE key=?")
        .get(key);
      return row ? JSON.parse(row.value) : null;
    },
    set: (key, value) =>
      store
        .prepare(
          "INSERT INTO auth_registry(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, JSON.stringify(value)),
    delete: (key) =>
      store.prepare("DELETE FROM auth_registry WHERE key=?").run(key),
  };
}

// Initial datasets
const initialFeedback = [
  {
    id: "fb-1",
    title: "希望增加更多二重积分极坐标转换技巧",
    votes: 42,
    tag: "内容建议",
    status: "已收录",
    createdAt: "2026-08-15",
  },
  {
    id: "fb-2",
    title: "矩阵对角化破题诀非常受用！建议线代增加几何直观图",
    votes: 89,
    tag: "点赞",
    status: "进行中",
    createdAt: "2026-08-20",
  },
  {
    id: "fb-3",
    title: "公式手册可以增加常用泰勒展开的高阶项系数表",
    votes: 56,
    tag: "功能优化",
    status: "已上线",
    createdAt: "2026-09-01",
  },
  {
    id: "fb-4",
    title: "概率论二维随机变量边缘分布和条件分布希望增加速记口诀",
    votes: 31,
    tag: "内容建议",
    status: "已收录",
    createdAt: "2026-09-05",
  },
];

const initialProfile = {
  id: "local_user_1",
  nickname: "研友",
  avatar: "",
  bio: "一战成硕，高分上岸！",
  examTrack: "math1",
  betaDsl: true,
  wrongStreak: 0,
  permissions: ["all"],
};

module.exports = {
  runWithStorage: (sql, callback, assets, identity, storage) =>
    storageContext.run({ sql, assets, identity, storage }, callback),
  runAsUser: (identity, callback) =>
    storageContext.run({ identity, scope: identity.scope }, callback),
  identity: () => {
    const value = storageContext.getStore()?.identity;
    if (!value) return value;
    const { storageScope, ...publicIdentity } = value;
    return publicIdentity;
  },
  requestSignal: () => storageContext.getStore()?.signal,
  requestTiming: () => storageContext.getStore()?.timing,
  withSignal: (signal, callback, timing) =>
    storageContext.run(
      {
        ...storageContext.getStore(),
        signal,
        timing: timing || storageContext.getStore()?.timing,
      },
      callback,
    ),
  lockKey: () => storageContext.getStore()?.sql || scopeKey(),
  withTransaction,
  commitTransaction,
  atomic,
  authStore,
  hasSql: () => Boolean(storageContext.getStore()?.sql),
  dataDir: DATA_DIR,
  getAssets: () => storageContext.getStore()?.assets,
  readJSON,
  saveJSON,
  getProfile: () => readJSON("user_profile", initialProfile),
  updateProfile: (data) => {
    const p = { ...readJSON("user_profile", initialProfile), ...data };
    saveJSON("user_profile", p);
    return p;
  },

  getWrongBook: () => readJSON("user_wrong_book", []),
  saveWrongBook: (list) => saveJSON("user_wrong_book", list),

  getFavorites: () => readJSON("user_favorites", []),
  saveFavorites: (list) => saveJSON("user_favorites", list),

  getNotes: () => readJSON("user_notes", {}),
  saveNotes: (obj) => saveJSON("user_notes", obj),

  getReviewCards: () => readJSON("user_review", []),
  saveReviewCards: (list) => saveJSON("user_review", list),

  getProgress: () =>
    readJSON("user_progress", {
      answered: {}, // id -> { answer, correct, timestamp }
      streak: 0,
      lastActive: new Date().toISOString().split("T")[0],
      todayCount: 0,
      kpScores: {},
    }),
  saveProgress: (obj) => saveJSON("user_progress", obj),

  getFeedback: () => readJSON("feedback_board", initialFeedback),
  saveFeedback: (list) => saveJSON("feedback_board", list),

  getSolutions: () => readJSON("solutions", {}),
  saveSolutions: (obj) => saveJSON("solutions", obj),

  getExamPapers: () => readJSON("user_exam_papers", []),
  saveExamPapers: (list) => saveJSON("user_exam_papers", list),

  getPaperAttempts: () => readJSON("user_paper_attempts", {}),
  savePaperAttempts: (obj) => saveJSON("user_paper_attempts", obj),

  getAiConfig: () =>
    readJSON("ai_config", {
      apiKey: storageContext.getStore()?.sql
        ? ""
        : process.env.AI_API_KEY || "",
      baseUrl: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
      model: process.env.AI_MODEL || "deepseek-chat",
      temperature: 0.6,
    }),
  saveAiConfig: (cfg) => saveJSON("ai_config", cfg),

  getQaSessions: () => readJSON("qa_sessions", []),
  saveQaSessions: (list) => saveJSON("qa_sessions", list),
};
