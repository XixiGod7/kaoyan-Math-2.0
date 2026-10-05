const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const source = fs.readFileSync(
  require.resolve("../public/shared/sync.js"),
  "utf8",
);
const scope = "guest:" + "a".repeat(64);
// In-memory IndexedDB implements asynchronous completion. The production queue
// and fetch adapter run unchanged; no test-only branches exist in the client.
async function harness({
  records = new Map(),
  backend = { online: true, applied: new Set(), calls: [] },
  identityScope = scope,
} = {}) {
  const listeners = new Map(),
    events = [],
    writes = [];
  const on = (name, fn) =>
    listeners.set(name, [...(listeners.get(name) || []), fn]);
  const database = {
    createObjectStore() {},
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = structuredClone(records.get(key));
                request.onsuccess?.();
              });
              return request;
            },
            put(value, key) {
              records.set(key, structuredClone(value));
              writes.push(key);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            delete(key) {
              records.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };
  const storage = new Map(),
    document = {
      hidden: false,
      addEventListener: on,
      querySelectorAll: () => [],
    };
  const location = {
    href: "http://localhost/english?home=1",
    origin: "http://localhost",
    pathname: "/english",
    search: "?home=1",
    replace() {},
    assign() {},
  };
  const raw = async (input, options = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      location.href,
    );
    backend.calls.push({ url: url.pathname, options });
    if (!backend.online) throw new TypeError("offline");
    const result = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname === "/api/auth/session")
      return result({ authenticated: false, scope: identityScope });
    if (url.pathname === "/api/study/sync")
      return result({
        scope: identityScope,
        format: "yanzhuan-study",
        version: 2,
        revision: 1,
        data: { english_storage: { kaoyan_word_statuses: "{}" } },
      });
    if (options.method === "POST") {
      const body = JSON.parse(options.body),
        id = options.headers.get("X-Study-Operation");
      if (body.questionId === "invalid")
        return result({ error: "invalid note" }, 400);
      backend.applied.add(id);
      return result({ ok: true });
    }
    return result({ items: [] });
  };
  const window = {
    fetch: raw,
    addEventListener: on,
    dispatchEvent(event) {
      events.push(event.type);
      for (const listener of listeners.get(event.type) || []) listener(event);
    },
    studyOperations: require("../public/shared/operations"),
  };
  const context = vm.createContext({
    window,
    document,
    location,
    history: { pushState() {}, replaceState() {} },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    indexedDB: {
      open() {
        const request = { result: database };
        queueMicrotask(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
    crypto: webcrypto,
    Headers,
    Request,
    Response,
    URL,
    URLSearchParams,
    Blob,
    Event,
    CustomEvent,
    TextEncoder,
    TextDecoder,
    structuredClone,
    navigator: { onLine: true },
    console,
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    scrollX: 0,
    scrollY: 0,
    scrollTo() {},
  });
  vm.runInContext(source, context, { timeout: 500 });
  await window.studyReady;
  return { window, records, backend, events, writes };
}
const body = (questionId, text) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionId, text }),
});
test("离线笔记持久化，页面重建后重放同一操作编号并仅执行一次", async () => {
  const h = await harness();
  h.backend.online = false;
  const response = await h.window.fetch("/api/note", body(90101, "离线笔记"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).localSaved, true);
  assert.equal(h.window.studySync.status.pending, 1);
  const queued = h.records.get(scope + ":pending")[0];
  h.backend.online = true;
  const restored = await harness({ records: h.records, backend: h.backend });
  await restored.window.studySync.flush();
  await restored.window.studySync.flush();
  assert.equal(restored.window.studySync.status.pending, 0);
  assert.deepEqual([...h.backend.applied], [queued.id]);
});
test("错误记录不阻塞独立操作，同一笔记的后续修改保持排队", async () => {
  const records = new Map([
    [
      scope + ":pending",
      [
        {
          id: "invalid-operation",
          path: "/api/note",
          method: "POST",
          body: { questionId: "invalid", text: "bad" },
          headers: {},
        },
        {
          id: "later-note-operation",
          path: "/api/note",
          method: "POST",
          body: { questionId: "invalid", text: "later" },
          headers: {},
        },
        {
          id: "independent-operation",
          path: "/api/incentive/points/adjust",
          method: "POST",
          body: { amount: 1 },
          headers: {},
        },
      ],
    ],
  ]);
  const h = await harness({ records });
  await h.window.studySync.flush();
  assert.equal(h.window.studySync.status.pending, 2);
  assert.equal(h.window.studySync.status.conflicts.length, 1);
  assert.deepEqual([...h.backend.applied], ["independent-operation"]);
});
test("Request 对象保留 method、credentials、keepalive 和取消信号，成功只通知一次", async () => {
  const h = await harness(),
    controller = new AbortController();
  const request = new Request("http://localhost/api/note", {
    ...body(90101, "Request 笔记"),
    credentials: "same-origin",
    keepalive: true,
    signal: controller.signal,
  });
  assert.equal((await h.window.fetch(request)).status, 200);
  const sent = h.backend.calls.find((c) => c.url === "/api/note").options;
  assert.equal(sent.method, "POST");
  assert.equal(sent.credentials, "same-origin");
  assert.equal(sent.keepalive, true);
  controller.abort();
  assert.equal(sent.signal.aborted, true);
  assert.equal(h.events.filter((e) => e === "study:write").length, 1);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    h.window.fetch("/api/note", {
      ...body(90101, "未发送"),
      signal: aborted.signal,
    }),
    (e) => e.name === "AbortError",
  );
  assert.equal(h.window.studySync.status.pending, 0);
});
test("切换身份后旧账号队列不被重放，公共题库不写入私有缓存", async () => {
  const records = new Map([
    [
      scope + ":pending",
      [
        {
          id: "old-operation",
          path: "/api/note",
          method: "POST",
          body: { questionId: 90101, text: "old" },
          headers: {},
        },
      ],
    ],
  ]);
  const h = await harness({ records, identityScope: "account:another" });
  await h.window.studySync.flush();
  assert.equal(h.backend.applied.size, 0);
  assert.equal(records.get(scope + ":pending").length, 1);
  const count = h.writes.length;
  assert.equal((await h.window.fetch("/api/real/meta")).status, 200);
  assert.equal(h.writes.length, count);
});
test("仅位置变化不重写学习快照和离线队列", async () => {
  const h = await harness(),
    before = h.records.get(scope + ":snapshot");
  h.window.studyPosition.set("last:english", { url: "/english?tab=quiz" });
  await h.window.studySync.saveEnglish({ kaoyan_essay_test: "草稿" });
  assert.deepEqual(h.records.get(scope + ":snapshot"), before);
  assert.equal(h.writes.filter((k) => k === scope + ":snapshot").length, 1);
});
