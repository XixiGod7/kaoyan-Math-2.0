const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
let child,
  base = process.env.TEST_BASE_URL;
before(async () => {
  if (base) return;
  const port = 41000 + Math.floor(Math.random() * 1000),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "study-contract-"));
  base = "http://127.0.0.1:" + port;
  child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port), DATA_DIR: temp, AI_API_KEY: "" },
    stdio: "ignore",
  });
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("测试服务未启动");
});
after(() => child?.kill());
function client() {
  let cookie = "";
  return async (url, body, options = {}) => {
    const r = await fetch(base + url, {
      method: body === undefined ? "GET" : "POST",
      ...options,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (r.headers.getSetCookie().length)
      cookie = r.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
}
test("双环境账号入口拒绝畸形 JSON 与无长度头的超大正文", async () => {
  assert.equal(
    (
      await fetch(base + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{broken",
      })
    ).status,
    400,
  );
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(
          JSON.stringify({ username: "test", password: "x".repeat(9000) }),
        ),
      );
      c.close();
    },
  });
  assert.equal(
    (
      await fetch(base + "/api/auth/register", {
        method: "POST",
        duplex: "half",
        headers: { "Content-Type": "application/json" },
        body: stream,
      })
    ).status,
    413,
  );
});
test("双环境备份预览、合并、替换、草稿和标签恢复一致", async () => {
  const c = client();
  await c("/api/note", { questionId: 90101, text: "账号原笔记" });
  const backup = {
    format: "yanzhuan-study",
    version: 2,
    data: {
      user_notes: { 90101: { text: "备份笔记" } },
      favorite_tags: { 90101: "重要" },
      favorite_stars: { 90101: 4 },
      exam_drafts: { p: { answers: ["A"] } },
    },
  };
  async function apply(mode) {
    const p = await c("/api/study/restore", { backup, mode });
    assert.equal(p.status, 200);
    return c("/api/study/restore", {
      backup,
      mode,
      preview: false,
      confirmation: p.data.confirmation,
      revision: p.data.revision,
    });
  }
  assert.equal((await apply("merge")).status, 200);
  let data = (await c("/api/study/sync")).data.data;
  assert.match(data.user_notes[90101].text, /账号原笔记[\s\S]*备份笔记/);
  assert.equal(data.favorite_stars[90101], 4);
  assert.deepEqual(data.exam_drafts.p.answers, ["A"]);
  assert.equal((await apply("merge")).data.replayed, true);
  assert.equal((await apply("replace")).status, 200);
  data = (await c("/api/study/sync")).data.data;
  assert.equal(data.user_notes[90101].text, "备份笔记");
});
test("双环境增量同步只返回修改键，清理删除真实英语记录", async () => {
  const c = client();
  await c("/api/english/storage", {
    patch: { kaoyan_word_statuses: "{}", kaoyan_quiz_history: "{}" },
  });
  const r = (await c("/api/study/sync")).data.revision;
  await c("/api/english/storage", { patch: { kaoyan_quiz_history: null } });
  assert.deepEqual(
    (await c("/api/study/sync?since=" + r)).data.data.english_storage,
    { kaoyan_quiz_history: null },
  );
  assert.equal(
    (await c("/api/study/cleanup", { name: "english_storage" })).status,
    400,
  );
  assert.equal(
    (
      await c("/api/study/cleanup", {
        name: "english_storage",
        confirmation: "已导出并清理",
      })
    ).status,
    200,
  );
  assert.deepEqual((await c("/api/english/storage")).data.items, {});
});
test("双环境同一成长编号内容不同返回 409，公共题库不创建身份", async () => {
  const c = client(),
    id = "contract-operation";
  assert.equal(
    (
      await c(
        "/api/incentive/points/adjust",
        { amount: 1, reason: "test" },
        { headers: { "Idempotency-Key": id } },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await c(
        "/api/incentive/points/adjust",
        { amount: 9, reason: "test" },
        { headers: { "Idempotency-Key": id } },
      )
    ).status,
    409,
  );
  const r = await fetch(base + "/api/syllabus");
  assert.equal(r.status, 200);
  assert.equal(r.headers.getSetCookie().length, 0);
  assert.match(r.headers.get("Cache-Control"), /^public/);
});
