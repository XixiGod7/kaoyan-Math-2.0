const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  restore = require("../apps/math/src/restoreTokens.cjs");
const baseline = fs.readFileSync(
  path.join(root, "apps/math/vendor/Md-baseline.js"),
  "utf8",
);
const unsafe =
  '(()=>{while(e.includes(i)){e=e.replace(new RegExp(`${i}(\\\\d+)${h}`,"g"),(o,c)=>a[Number(c)])}})()';
if (!baseline.includes(unsafe))
  throw Error("数学 Markdown 基线不匹配，禁止发布未校验的补丁");
const output = baseline.replace(
    unsafe,
    "e=(" + restore.toString() + ")(e,a,i,h)",
  ),
  name =
    "Md-review-" +
    crypto.createHash("sha256").update(output).digest("hex").slice(0, 12) +
    ".js";
fs.writeFileSync(path.join(root, "public/assets", name), output);
fs.writeFileSync(path.join(root, "public/assets/Md-k3-rmIqK.js"), output);
for (const file of fs
  .readdirSync(path.join(root, "public/assets"))
  .filter((f) => f.endsWith(".js"))) {
  const p = path.join(root, "public/assets", file),
    old = fs.readFileSync(p, "utf8"),
    next = old.replace(/Md-(?:k3-rmIqK|review-[a-f0-9]+)\.js/g, name);
  if (next !== old) fs.writeFileSync(p, next);
}
console.log("数学 Markdown 补丁：" + name);
