const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
// Cache public content only. Private records always go through the visitor store.
const cache = new Map();
async function readContent(relative) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.includes('..')) throw new Error('无效内容路径');
  if (cache.has(relative)) return cache.get(relative);
  const assets = db.getAssets();
  let data;
  if (assets) {
    const response = await assets.fetch(new Request(`https://assets.local/${relative}`));
    if (!response.ok) throw new Error('题库资源加载失败');
    data = await response.json();
  } else data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public', relative), 'utf8'));
  if (cache.size >= 30) cache.delete(cache.keys().next().value);
  cache.set(relative, data);
  return data;
}
module.exports = { readContent };
