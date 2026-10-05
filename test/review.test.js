const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "study-review-"));
const db = require("../db"),
  schema = require("../services/english-schema"),
  restore = require("../services/study-restore");
const sync = require("../services/study-sync"),
  growth = require("../services/growth");
function isolated(callback) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE documents(name TEXT PRIMARY KEY,value TEXT NOT NULL)",
  );
  let failName;
  const sql = {
    exec(query, ...args) {
      if (query.startsWith("INSERT") && args[0] === failName)
        throw Error("injected persistence failure");
      const stmt = sqlite.prepare(query);
      return query.startsWith("SELECT")
        ? { toArray: () => stmt.all(...args) }
        : stmt.run(...args);
    },
  };
  const storage = {
    transactionSync(fn) {
      sqlite.exec("BEGIN");
      try {
        const result = fn();
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  try {
    return db.runWithStorage(
      sql,
      () => callback({ sqlite, fail: (name) => (failName = name) }),
      undefined,
      undefined,
      storage,
    );
  } finally {
    sqlite.close();
  }
}
test("数学私用区字符、畸形占位符、嵌套与循环引用的恢复有界", () => {
  const render = require("../apps/math/src/restoreTokens.cjs");
  assert.equal(render("\ue000", []), "\ue000");
  assert.equal(render("\ue000999\ue001", ["safe"]), "\ue000999\ue001");
  assert.equal(render("\ue0000\ue001", ["\ue0001\ue001", "数学"]), "数学");
  assert.equal(render("\ue0000\ue001", ["\ue0000\ue001"]), "\ue0000\ue001");
  for (let n = 0; n < 1000; n++)
    render(String.fromCodePoint(0xe000) + (n % 2 ? "bad" : "123") + "文本", []);
});
test("英语每类记录拒绝 null、数组/对象混用、错误枚举和危险键", () => {
  for (const [key, value] of [
    ["word_statuses", "[]"],
    ["word_statuses", "null"],
    ["word_statuses", '{"hello":"bad"}'],
    ["favorite_sentences", "{}"],
    ["wrong_questions", "{}"],
    ["ebbinghaus_records", '{"word":{}}'],
    ["quiz_history", "[]"],
    ["reading_progress", '{"2024-t1":{}}'],
    ["daily_session_state", "{}"],
    ["quiz_progress_2024", "{}"],
    ["word_statuses", '{"__proto__":"familiar"}'],
  ])
    assert.throws(() => schema.validate("kaoyan_" + key, value));
});
test("英语合法记录包含实际历史按年份存储的结构", () => {
  const history = {
    2024: [
      {
        year: "2024",
        tabId: "cloze",
        score: 1,
        totalQuestions: 20,
        correctQuestions: 1,
        timestamp: Date.now(),
        timeSpentSeconds: 12,
      },
    ],
  };
  assert.deepEqual(
    schema.validate("kaoyan_quiz_history", JSON.stringify(history)),
    history,
  );
  assert.equal(
    schema.validate(
      "kaoyan_quiz_progress_2024",
      JSON.stringify({
        year: "2024",
        answers: { 1: "A" },
        elapsedSeconds: 12,
        isSubmitted: false,
        lastUpdated: Date.now(),
        attemptId: "valid-attempt",
      }),
    ).answers[1],
    "A",
  );
});
test("有界流读取取消超限流，不等待完整请求", async () => {
  let cancelled = false,
    pulls = 0;
  const request = new Request("https://unit.invalid", {
    method: "POST",
    duplex: "half",
    body: new ReadableStream({
      pull(c) {
        pulls++;
        c.enqueue(new Uint8Array(3000));
      },
      cancel() {
        cancelled = true;
      },
    }),
  });
  await assert.rejects(
    require("../services/body-limit").boundedBytes(request, 4096),
    (e) => e.status === 413,
  );
  assert.equal(cancelled, true);
  assert.ok(pulls <= 3);
});
test("AI 地址只允许官方提供商，拒绝用户域名、IP、IPv6与 URL 凭据", () => {
  const { validUrl } = require("../services/outbound");
  for (const url of [
    "https://attacker.example/v1",
    "https://127.0.0.1/v1",
    "https://[::1]/v1",
    "https://api.deepseek.com.attacker.example/v1",
    "https://user:pass@api.deepseek.com/v1",
    "https://api.deepseek.com:444/v1",
  ])
    assert.equal(validUrl(url), false);
  assert.equal(validUrl("https://token.sensenova.cn/v1"), true);
});
test("出站请求拒绝重定向、继承取消并限制响应大小", async () => {
  const original = global.fetch;
  let options;
  try {
    global.fetch = async (_, o) => {
      options = o;
      return new Response("x");
    };
    const controller = new AbortController();
    await db.withSignal(controller.signal, () =>
      require("../services/outbound").request(
        "https://api.deepseek.com/v1/chat/completions",
      ),
    );
    assert.equal(options.redirect, "error");
    controller.abort();
    assert.equal(options.signal.aborted, true);
    await assert.rejects(
      require("../services/outbound").text(
        new Response("x".repeat(4097)),
        4096,
      ),
      (e) => e.status === 413,
    );
  } finally {
    global.fetch = original;
  }
});
test("同一次提交的资料、奖励和重放凭据在持久化故障后全部回滚", () =>
  isolated(({ fail }) => {
    db.saveNotes({ 90101: { text: "原笔记" } });
    fail("growth_state");
    assert.throws(() =>
      db.atomic(() => {
        db.saveNotes({ 90101: { text: "修改" } });
        growth.recordLearning("math", "answer", 90101);
        db.saveJSON("sync_operations", { operation: "committed" });
      }),
    );
    assert.equal(db.getNotes()["90101"].text, "原笔记");
    assert.equal(db.readJSON("growth_state", null), null);
    assert.equal(db.readJSON("sync_operations", null), null);
  }));
test("访客政治冲突笔记全部保留，长期总数不从短期窗口重算", () =>
  isolated(() => {
    const old = growth.newState(),
      guest = growth.newState();
    old.learning.totals.math = 500;
    guest.learning.totals.math = 100;
    old.points = 1000;
    guest.points = 200;
    db.saveJSON("growth_state", old);
    db.saveJSON("politics_state", { notes: { q: "账号笔记" } });
    sync.mergeGuest("guest-test", {
      data: {
        growth_state: guest,
        politics_state: { notes: { q: "访客笔记" } },
      },
    });
    assert.match(
      db.readJSON("politics_state", {}).notes.q,
      /账号笔记[\s\S]*访客笔记/,
    );
    assert.equal(db.readJSON("growth_state", {}).learning.totals.math, 600);
    assert.equal(db.readJSON("growth_state", {}).points, 1200);
    sync.mergeGuest("guest-test", { data: { growth_state: guest } });
    assert.equal(db.readJSON("growth_state", {}).points, 1200);
  }));
test("英语按字段持久化，修改草稿不会改写词汇记录", () =>
  isolated(({ sqlite }) => {
    db.saveJSON("english_storage", {
      kaoyan_word_statuses: '{"a":"familiar"}',
      kaoyan_quiz_history: "{}",
    });
    const id =
        "english_key_" +
        require("../services/auth-core").digest("kaoyan_word_statuses"),
      before = sqlite
        .prepare("SELECT value FROM documents WHERE name=?")
        .get(id);
    db.saveJSON("english_storage", {
      kaoyan_word_statuses: '{"a":"familiar"}',
      kaoyan_quiz_history: '{"2024":[]}',
    });
    assert.deepEqual(
      sqlite.prepare("SELECT value FROM documents WHERE name=?").get(id),
      before,
    );
    assert.equal(
      db.readJSON("english_storage", {}).kaoyan_quiz_history,
      '{"2024":[]}',
    );
    assert.ok(
      db.readJSON("study_meta", {}).englishKeys.kaoyan_quiz_history >
        db.readJSON("study_meta", {}).englishKeys.kaoyan_word_statuses,
    );
  }));
test("成长请求相同编号不同数据被拒绝，原积分保持不变", () =>
  isolated(() => {
    growth.mutate(
      "points/adjust",
      { amount: 10, reason: "test" },
      "fixed-operation",
    );
    assert.throws(
      () =>
        growth.mutate(
          "points/adjust",
          { amount: 100, reason: "test" },
          "fixed-operation",
        ),
      (e) => e.status === 409,
    );
    assert.equal(growth.getState().points, 10);
  }));
test("存储配额、草稿数量与最终笔记上限不能以多次小提交绕过", () =>
  isolated(() => {
    assert.throws(
      () =>
        db.saveJSON(
          "exam_drafts",
          Object.fromEntries(
            Array.from({ length: 101 }, (_, i) => ["p" + i, {}]),
          ),
        ),
      (e) => e.status === 413,
    );
    assert.throws(
      () => db.saveJSON("user_notes", { q: "x".repeat(9 * 1024 * 1024) }),
      (e) => e.status === 413,
    );
    assert.equal(db.getNotes().q, undefined);
  }));
test("全站备份包含标签、星级、草稿和位置，拒绝未知资料/错误英语结构", () =>
  isolated(() => {
    db.saveJSON("favorite_tags", { 90101: "复习" });
    db.saveJSON("exam_drafts", { paper: { answers: ["A"] } });
    const backup = require("../services/study-export").snapshot();
    assert.equal(backup.version, 2);
    assert.equal(restore.validate(backup).favorite_tags["90101"], "复习");
    assert.throws(() =>
      restore.validate({
        ...backup,
        data: { ...backup.data, ai_config: { apiKey: "secret" } },
      }),
    );
    assert.throws(() =>
      restore.validate({
        ...backup,
        data: {
          ...backup.data,
          english_storage: { kaoyan_favorite_sentences: "{}" },
        },
      }),
    );
  }));
test("全部真实成长写接口与离线操作共享同一清单", () => {
  const { actions, allowed } = require("../public/shared/operations");
  for (const action of actions)
    assert.equal(allowed("/api/incentive/" + action), true);
  assert.equal(allowed("/api/incentive/actions"), false);
  assert.equal(allowed("/api/incentive/chat"), false);
});
let server,
  base,
  rawFetch = global.fetch;
const metrics = [];
before(async () => {
  const info = console.info;
  console.info = (value) => metrics.push(value);
  server = require("../server").listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => {
  global.fetch = rawFetch;
  server?.close();
});
function client() {
  let cookie = "";
  return async (url, body, headers = {}) => {
    const r = await rawFetch(base + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const jar = r.headers.getSetCookie();
    if (jar.length) cookie = jar.map((v) => v.split(";")[0]).join("; ");
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
}
test("本地私有 Host 验证与访客公开标识均不泄露访问 Cookie", async () => {
  const c = client(),
    response = await c("/api/auth/session");
  const cookie = response.headers.getSetCookie()[0].split(";")[0].split("=")[1];
  assert.notEqual(response.data.scope, "guest:" + cookie);
  assert.equal(response.data.scope.length, 70);
  const blocked = await new Promise((resolve, reject) => {
    require("node:http")
      .get(
        base + "/api/study/sync",
        { headers: { Host: "attacker.example" } },
        (r) => {
          r.resume();
          resolve(r.statusCode);
        },
      )
      .on("error", reject);
  });
  assert.equal(blocked, 403);
  assert.ok(response.headers.get("X-Request-Id"));
});
test("英语整批校验失败不会保存前面合法字段或破坏原数据", async () => {
  const c = client();
  await c("/api/english/storage", {
    patch: { kaoyan_word_statuses: '{"hello":"familiar"}' },
  });
  assert.equal(
    (
      await c("/api/english/storage", {
        patch: { kaoyan_word_statuses: "{}", kaoyan_favorite_sentences: "{}" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await c("/api/english/storage")).data.items.kaoyan_word_statuses,
    '{"hello":"familiar"}',
  );
});
test("备份预览后可恢复；数据变化后旧预览被拒绝", async () => {
  const c = client(),
    backup = {
      format: "yanzhuan-study",
      version: 2,
      data: { favorite_tags: { 90101: "恢复测试" } },
    };
  const preview = (await c("/api/study/restore", { backup })).data;
  assert.equal(preview.ok, true);
  assert.equal(
    (
      await c("/api/study/restore", {
        backup,
        preview: false,
        confirmation: preview.confirmation,
        revision: preview.revision,
      })
    ).status,
    200,
  );
  assert.equal(
    (await c("/api/study/sync")).data.data.favorite_tags["90101"],
    "恢复测试",
  );
  assert.equal(
    (
      await c("/api/study/restore", {
        backup,
        preview: false,
        confirmation: preview.confirmation,
        revision: preview.revision,
      })
    ).status,
    409,
  );
});
test("增量快照只返回有变更的英语字段和资料，删除字段带 null", async () => {
  const c = client();
  await c("/api/english/storage", {
    patch: { kaoyan_word_statuses: "{}", kaoyan_quiz_history: "{}" },
  });
  const first = (await c("/api/study/sync")).data;
  await c("/api/english/storage", { patch: { kaoyan_quiz_history: null } });
  const next = (await c("/api/study/sync?since=" + first.revision)).data;
  assert.equal(next.partial, true);
  assert.deepEqual(next.data.english_storage, { kaoyan_quiz_history: null });
  assert.equal(next.data.user_notes, undefined);
});
test("负时长、无穷数值、危险草稿键、超长追加和标签均被拒绝", async () => {
  const c = client();
  assert.equal(
    (await c("/api/answer", { questionId: 90101, correct: true, secs: -1 }))
      .status,
    400,
  );
  assert.equal(
    (
      await c("/api/answer", {
        questionId: 90101,
        correct: true,
        secs: "Infinity",
      })
    ).status,
    400,
  );
  assert.equal(
    (await c("/api/exam-papers/draft", { paperKey: "__proto__", payload: {} }))
      .status,
    400,
  );
  await c("/api/note", { questionId: 90101, text: "x".repeat(19995) });
  assert.equal(
    (await c("/api/note/append", { questionId: 90101, text: "y".repeat(10) }))
      .status,
    413,
  );
  assert.equal((await c("/api/notes")).data.notes[0].text.length, 19995);
});
test("公共数学目录响应不创建访客、包含共享缓存标记", async () => {
  const r = await rawFetch(base + "/api/real/meta");
  assert.equal(r.headers.getSetCookie().length, 0);
  assert.match(r.headers.get("Cache-Control"), /^public/);
  assert.equal(r.status, 200);
});
test("模型等待期间保存笔记不等待 AI 写锁，响应过长测试失败可取消", async () => {
  const c = client();
  await c("/api/auth/session");
  await c("/api/ai/config", {
    apiKey: "test-only-key",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  });
  let release, started;
  const ready = new Promise((r) => (started = r));
  global.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.deepseek.com/")) {
      started();
      return new Promise(
        (resolve) =>
          (release = () =>
            resolve(
              new Response(
                JSON.stringify({
                  choices: [{ message: { content: "模型回答" } }],
                }),
              ),
            )),
      );
    }
    return rawFetch(url, options);
  };
  try {
    const model = c("/api/ai/chat", {
      subject: "english",
      messages: [{ role: "user", content: "test" }],
    });
    await ready;
    const start = Date.now(),
      note = await c("/api/note", {
        questionId: 90101,
        text: "模型等待时也能保存的学习笔记",
      });
    assert.equal(note.status, 200);
    assert.ok(Date.now() - start < 1000);
    release();
    assert.equal((await model).status, 200);
  } finally {
    global.fetch = rawFetch;
  }
});
test("恢复同一备份两次不再次累加成长，英语逐字段合并并恢复阅读偏好", async () => {
  const c = client();
  await c("/api/english/storage", {
    patch: { kaoyan_word_statuses: '{"account":"familiar"}' },
  });
  const state = growth.newState();
  state.points = 27;
  state.learning.totals.math = 6;
  const backup = {
    format: "yanzhuan-study",
    version: 2,
    profile: { nickname: "恢复偏好", examTrack: "math2" },
    preferences: { fontScale: 1.2, theme: "dark" },
    data: {
      growth_state: state,
      english_storage: { kaoyan_word_statuses: '{"guest":"unfamiliar"}' },
    },
  };
  async function apply() {
    const p = (await c("/api/study/restore", { backup })).data;
    return c("/api/study/restore", {
      backup,
      preview: false,
      confirmation: p.confirmation,
      revision: p.revision,
    });
  }
  const first = await apply();
  assert.equal(first.status, 200);
  assert.equal(first.data.preferences.fontScale, 1.2);
  assert.equal((await c("/api/study/overview")).data.nickname, "恢复偏好");
  const words = JSON.parse(
    (await c("/api/english/storage")).data.items.kaoyan_word_statuses,
  );
  assert.equal(words.account, "familiar");
  assert.equal(words.guest, "unfamiliar");
  assert.equal((await apply()).data.replayed, true);
  assert.equal((await c("/api/study/overview")).data.points, 27);
});
test("清理英语数据删除真实分行记录和草稿，未确认的清理被拒绝", () =>
  isolated(({ sqlite }) => {
    db.saveJSON("english_storage", { kaoyan_word_statuses: "{}" });
    db.saveJSON("english_storage", null);
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM documents WHERE name LIKE 'english_key_%'",
        )
        .get().n,
      0,
    );
    assert.deepEqual(db.readJSON("english_storage", {}), {});
    db.saveJSON("exam_drafts", { p: { answer: "A" } });
    db.saveJSON("exam_drafts", null);
    assert.deepEqual(db.readJSON("exam_drafts", {}), {});
  }));
test("持久化故障发生于奖励或幂等阶段均回滚，重试恰好提交一次", () =>
  isolated(({ fail }) => {
    for (const phase of ["user_notes", "growth_state", "sync_operations"]) {
      fail(phase);
      assert.throws(() =>
        db.atomic(() => {
          db.saveNotes({ q: { text: "完整记录" } });
          growth.recordLearning("math", "answer", 90101);
          db.saveJSON("sync_operations", { op: "complete" });
        }),
      );
      assert.equal(db.readJSON("sync_operations", null), null);
      assert.equal(db.readJSON("growth_state", null), null);
      assert.deepEqual(db.getNotes(), {});
    }
    fail(undefined);
    db.atomic(() => {
      db.saveNotes({ q: { text: "完整记录" } });
      growth.recordLearning("math", "answer", 90101);
      db.saveJSON("sync_operations", { op: "complete" });
    });
    assert.equal(growth.getState().points, 2);
    assert.equal(db.readJSON("sync_operations", {}).op, "complete");
  }));
test("实际数学 Markdown 产物对私用区和伪造索引不挂起", () => {
  const vm = require("node:vm"),
    file = path.join(__dirname, "../public/assets/Md-k3-rmIqK.js");
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/import\{[^}]+\}from"[^"]+";/g, "")
    .replace(/export\{[^}]+\};/g, "");
  const context = vm.createContext({
    b: { memo: (f) => f },
    _: { jsx: () => ({}) },
    x: { renderToString: () => "<span>math</span>" },
    j: () => {},
    w: /(?!)/g,
    S: () => "",
    L: {},
    M: () => "",
  });
  vm.runInContext(source, context, { timeout: 500 });
  for (const value of [
    "普通内容",
    "\ue000",
    "\ue000999\ue001",
    "\ue0000\ue001",
    "文本".repeat(10000),
  ]) {
    context.input = value;
    const result = vm.runInContext("T(input)", context, { timeout: 500 });
    assert.equal(typeof result, "string");
  }
});
test("迁移附件中断后再次登录续传，已合并笔记与同期新修改不被覆盖", async () => {
  await isolatedAsync(async () => {
    const account = { id: "test-account" },
      snapshot = {
        format: "yanzhuan-study",
        version: 2,
        data: { user_notes: { q: { text: "访客笔记" } } },
      },
      image = { mime: "image/png", data: "test", size: 4 };
    let claims = 0,
      failed = false,
      stored = 0;
    const registry = {
      claimGuest() {
        claims++;
        return true;
      },
    };
    const source = {
      exportStudy: () => snapshot,
      privateIndex: () => ({
        images: { "test-image": { size: 4 } },
        config: {},
        sessions: [],
      }),
      readImage: () => image,
    };
    const target = {
      mergeGuest: (guest, value) =>
        db.atomic(() => sync.mergeGuest(guest, value)),
      putImage: () => {
        if (!failed) {
          failed = true;
          throw Error("synthetic storage failure");
        }
        stored++;
      },
      mergePrivate: () => {},
    };
    const migration = require("../services/account-migration");
    assert.match(
      await migration.safely("test-visitor", account, registry, source, target),
      /原资料仍保留/,
    );
    db.saveNotes({ q: { text: db.getNotes().q.text + "\n同期新笔记" } });
    assert.equal(
      await migration.safely("test-visitor", account, registry, source, target),
      null,
    );
    assert.equal(db.getNotes().q.text, "访客笔记\n同期新笔记");
    assert.equal(claims, 2);
    assert.equal(stored, 1);
  });
});
async function isolatedAsync(callback) {
  const id = { scope: "account:test-" + require("node:crypto").randomUUID() };
  return db.runAsUser(id, callback);
}
test("服务端恢复到较旧版本时，增量同步强制返回完整快照", async () => {
  const c = client();
  await c("/api/english/storage", { patch: { kaoyan_word_statuses: "{}" } });
  const value = (await c("/api/study/sync?since=999999999")).data;
  assert.equal(value.partial, false);
  assert.equal(value.data.english_storage.kaoyan_word_statuses, "{}");
});
test("生成目录校验禁止通过暂存路径越界移动", () => {
  const generate = require("../scripts/generated-directory.cjs"),
    root = path.join(__dirname, "../public/english-data");
  assert.throws(
    () => generate.publish(root + ".stage-x/../../data", root),
    /暂存路径不匹配/,
  );
  assert.throws(
    () => generate.stage(path.join(__dirname, "../data")),
    /超出预期范围/,
  );
});
test('英语 AI 返回整段答案；取消时不调用完成回调或保存成功记录',async()=>{
 const ts=require('typescript'),vm=require('node:vm');let completed=0;const listeners=new Map(),active=[];
 const window={studyImageIds:[],addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>{if(event.type==='study:ai-active')active.push(event.detail);}};
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../apps/english/src/utils/aiClient.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context=vm.createContext({exports:{},window,document:{querySelector:()=>null},AbortController,AbortSignal,CustomEvent,fetch:async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{name:'AbortError'})),{once:true});})});
 vm.runInContext(js,context,{timeout:500});const pending=context.exports.sendChatCompletion({},[{role:'user',content:'test'}],()=>completed++);listeners.get('study:cancel-ai')();await assert.rejects(pending,/已取消 AI 请求/);assert.equal(completed,0);assert.deepEqual(active,[1,0]);
});
