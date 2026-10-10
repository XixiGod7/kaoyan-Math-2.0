const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions, Response: MockResponse } = require("miniflare");

test("Workers 运行时接受手动重定向模式，拒绝跳转且不转发密钥", { timeout: 30000 }, async (t) => {
  const bundle = await build({
    stdin: {
      contents: `
        import outbound from './services/outbound.js';
        export default {
          async fetch(request) {
            try {
              const response = await outbound.request('https://token.sensenova.cn/v1/chat/completions', {
                method: 'POST',
                body: JSON.stringify({ model: 'deepseek-flash' }),
                headers: { Authorization: 'Bearer runtime-test-placeholder', 'Content-Type': 'application/json' },
                redirect: 'follow',
              });
              return new Response(await outbound.text(response));
            } catch (error) {
              return Response.json({ error: error.message }, { status: error.status || 500 });
            }
          }
        };
      `,
      resolveDir: path.resolve(__dirname, ".."),
      sourcefile: "outbound-runtime-test.mjs",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    plugins: [{
      name: "isolate-request-context",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/db$/ }, (args) => {
          if (args.importer.endsWith("outbound.js")) return { path: "db", namespace: "test-context" };
        });
        build.onLoad({ filter: /.*/, namespace: "test-context" }, () => ({ contents: "module.exports = {};" }));
      },
    }],
  });
  let upstreamStatus = 200;
  const calls = [];
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-10-03",
    compatibilityFlags: ["nodejs_compat"],
    cf: false,
    outboundService: async (request) => {
      calls.push({ url: request.url, authorization: request.headers.get("Authorization") });
      if (request.url !== "https://token.sensenova.cn/v1/chat/completions") {
        return new MockResponse("unexpected redirect target", { status: 500 });
      }
      assert.equal(JSON.parse(await request.text()).model, "deepseek-flash");
      return new MockResponse("mocked response", {
        status: upstreamStatus,
        headers: upstreamStatus === 200 ? {} : { Location: "https://untrusted.example/key-capture" },
      });
    },
  }));
  t.after(() => worker.dispose());
  const success = await worker.dispatchFetch("http://localhost/");
  assert.equal(success.status, 200);
  assert.equal(await success.text(), "mocked response");
  for (const status of [301, 302, 303, 307, 308]) {
    upstreamStatus = status;
    const blocked = await worker.dispatchFetch("http://localhost/");
    assert.equal(blocked.status, 400);
    assert.match((await blocked.json()).error, /拒绝重定向/);
  }
  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => call.url === "https://token.sensenova.cn/v1/chat/completions"));
  assert.ok(calls.every((call) => call.authorization === "Bearer runtime-test-placeholder"));
});
