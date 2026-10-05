const fs = require("node:fs"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "../public");
function checked(target) {
  const absolute = path.resolve(target);
  if (
    path.dirname(absolute) !== root ||
    !/-data$|-images$|-thumbs$/.test(path.basename(absolute))
  )
    throw Error("生成目录超出预期范围");
  return absolute;
}
function stage(target) {
  target = checked(target);
  const value = target + ".stage-" + randomUUID();
  fs.mkdirSync(value);
  return value;
}
function publish(stage, target) {
  target = checked(target);
  stage = path.resolve(stage);
  if (path.dirname(stage) !== root || !stage.startsWith(target + ".stage-"))
    throw Error("暂存路径不匹配");
  const walk = (p) => {
    for (const item of fs.readdirSync(p, { withFileTypes: true })) {
      const file = path.join(p, item.name);
      if (item.isDirectory()) walk(file);
      else if (file.endsWith(".json"))
        JSON.parse(fs.readFileSync(file, "utf8"));
    }
  };
  walk(stage);
  const old = target + ".previous";
  if (fs.existsSync(old)) {
    if (path.dirname(old) !== root) throw Error("备份路径无效");
    fs.rmSync(old, { recursive: true });
  }
  if (fs.existsSync(target)) fs.renameSync(target, old);
  try {
    fs.renameSync(stage, target);
  } catch (e) {
    if (fs.existsSync(old)) fs.renameSync(old, target);
    throw e;
  }
  if (fs.existsSync(old)) fs.rmSync(old, { recursive: true });
}
module.exports = { stage, publish };
