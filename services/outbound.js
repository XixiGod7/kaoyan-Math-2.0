const db = require("../db");
const trustedHosts = new Set([
  "token.sensenova.cn",
  "api.deepseek.com",
  "dashscope.aliyuncs.com",
  "api.moonshot.cn",
  "api.moonshot.ai",
  "api.openai.com",
]);
function validUrl(value) {
  try {
    const u = new URL(value);
    return (
      value.length <= 2000 &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      !u.search &&
      trustedHosts.has(u.hostname)
    );
  } catch {
    return false;
  }
}
async function request(url, options = {}) {
  if (!validUrl(url))
    throw Object.assign(
      new Error("请使用顶部预设中的官方模型接口；自建网关暂未开放"),
      { status: 400 },
    );
  const signals = [
    AbortSignal.timeout(options.timeout || 90000),
    options.signal,
    db.requestSignal?.(),
  ].filter(Boolean);
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, {
      ...options,
      // Workers requires manual handling here; never forward credentials to a redirect target.
      redirect: "manual",
      signal: AbortSignal.any(signals),
    });
    if (
      (response.status >= 300 && response.status < 400) ||
      response.type === "opaqueredirect"
    ) {
      await response.body?.cancel().catch(() => {});
      throw Object.assign(new Error("出站请求拒绝重定向"), { status: 400 });
    }
  } catch (e) {
    const kind = ["AbortError", "TimeoutError"].includes(e.name)
      ? e.name
      : "network";
    console.info(
      JSON.stringify({
        event: "model_request",
        provider: new URL(url).hostname,
        durationMs: Date.now() - started,
        failure: kind,
      }),
    );
    throw e;
  }
  const timing = db.requestTiming?.();
  if (timing) timing.modelMs = (timing.modelMs || 0) + Date.now() - started;
  console.info(
    JSON.stringify({
      event: "model_request",
      provider: new URL(url).hostname,
      durationMs: Date.now() - started,
      status: response.status,
      failure: response.ok ? null : "http",
    }),
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw Object.assign(
      new Error(`模型接口返回 HTTP ${response.status}，请检查密钥、模型和额度`),
      { status: 502 },
    );
  }
  return response;
}
async function text(response, limit = 1000000) {
  const bytes = await require("./body-limit").boundedBytes(response, limit);
  return new TextDecoder().decode(bytes);
}
module.exports = { validUrl, request, text, trustedHosts };
