const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
  if (!isObject(value)) fail("记录结构无效，应为对象");
  return value;
}
function key(value, max = 180) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    unsafeKeys.has(value) ||
    /[\x00-\x1f]/.test(value)
  )
    fail("记录字段无效");
  return value;
}
function finite(value, { min = 0, max = 86400, integer = false } = {}) {
  if (!["number", "string"].includes(typeof value) || value === "")
    fail("数值无效");
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isSafeInteger(n))
  )
    fail("数值超出允许范围");
  return n;
}
function safeTree(value, depth = 0) {
  if (depth > 20) fail("数据嵌套过深");
  if (typeof value === "number" && !Number.isFinite(value)) fail("数值无效");
  if (Array.isArray(value)) {
    if (value.length > 10000) fail("记录条目过多", 413);
    value.forEach((v) => safeTree(v, depth + 1));
  } else if (isObject(value)) {
    if (Object.keys(value).length > 15000) fail("记录条目过多", 413);
    for (const [k, v] of Object.entries(value)) {
      key(k, 200);
      safeTree(v, depth + 1);
    }
  }
}
module.exports = { fail, object, key, finite, safeTree };
