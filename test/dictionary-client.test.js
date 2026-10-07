const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), path = require('node:path');
const { createHash, webcrypto } = require('node:crypto');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../apps/english/src/services/dictionaryService.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'] }).outputFiles[0].text;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
function pack() {
  const entries = Object.fromEntries(['probable', 'used', 'provided', 'well-known'].map(word => [word, { definition_cn: word + '的释义' }]));
  const dict = { version: 2, entries };
  const frequency = { version: 2, items: { probable: { w: 'probable', n: 4, rank: 1, byYear: { 2020: 4 } } } };
  const manifest = { version: 2, lexicon: { hash: hash(dict), hashedPath: `/english-data/lexicon.${hash(dict)}.json`, entriesCount: 4 }, frequency: { hash: hash(frequency), hashedPath: `/english-data/vocab-frequency.${hash(frequency)}.json`, itemsCount: 1 } };
  return { dict, frequency, manifest };
}
function harness({ records = new Map(), brokenWrites = false, blocked = false } = {}) {
  const data = pack(), calls = [], backend = { online: true, corrupt: false }, closed = [];
  const indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
      if (blocked) { request.onblocked?.(); return; }
      request.result = { objectStoreNames: { contains: () => true }, close: () => closed.push(true), transaction() {
        const tx = { objectStore() { return {
          get(key) { const req = {}; queueMicrotask(() => { req.result = structuredClone(records.get(key)); req.onsuccess?.(); tx.oncomplete?.(); }); return req; },
          put(value, key) { queueMicrotask(() => { if (brokenWrites) tx.onerror?.(); else { records.set(key, structuredClone(value)); tx.oncomplete?.(); } }); return {}; }
        }; } }; return tx;
      } };
      request.onsuccess?.();
    });
    return request;
  } };
  const context = vm.createContext({ module: { exports: {} }, require, console, setTimeout, clearTimeout, TextEncoder, crypto: webcrypto, indexedDB,
    fetch: async url => {
      calls.push(url);
      if (!backend.online) throw Error('offline');
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(data.manifest));
      if (url === data.manifest.lexicon.hashedPath) return new Response(JSON.stringify(backend.corrupt ? { version: 2, entries: {} } : data.dict));
      if (url === data.manifest.frequency.hashedPath) return new Response(JSON.stringify(data.frequency));
      return new Response('', { status: 404 });
    }
  });
  vm.runInContext(code, context);
  return { service: context.module.exports, calls, backend, data, records, closed };
}
test('查询精确词优先、保留连字符并拒绝原型属性，歧义词不猜根', () => {
  const { service, data } = harness();
  assert.equal(service.lookup('（Ｐｒｏｖｉｄｅｄ）', data.dict).wordKey, 'provided');
  assert.equal(service.lookup('well–known', data.dict).wordKey, 'well-known');
  assert.equal(service.lookup('constructor', data.dict).found, false);
  assert.equal(service.lookup('used', data.dict).wordKey, 'used');
  assert.equal(service.resolveLemma('planes', { plan: { definition_cn: '计划' }, plane: { definition_cn: '飞机' } }), null);
});
test('搜索在全量匹配中排序，后面的精确词不会被提前截断', () => {
  const { service } = harness();
  const entries = Object.fromEntries(Array.from({ length: 150 }, (_, n) => ['azoo' + n, { definition_cn: '其他' }]));
  entries.zoo = { definition_cn: '动物园' };
  assert.equal(service.searchDictionary(' zoo ', { entries }, 1)[0].word, 'zoo');
});
test('并发加载和重试共用一次请求，词典与词频绑定同一 manifest', async () => {
  const h = harness();
  await Promise.all([h.service.loadDictionary(), h.service.loadDictionary(true), h.service.loadDictionary()]);
  assert.equal(h.calls.length, 3);
  assert.equal(h.service.getDictionaryState().manifest.lexicon.hash, h.data.manifest.lexicon.hash);
  assert.equal(h.service.getDictionaryState().status, 'ready');
});
test('资源摘要不匹配不会静默接受，失败后可以重新加载', async () => {
  const h = harness(); h.backend.corrupt = true;
  await assert.rejects(h.service.loadDictionary(), /版本校验失败/);
  assert.equal(h.service.getDictionaryState().status, 'error');
  h.backend.corrupt = false;
  await h.service.loadDictionary(true);
  assert.equal(h.service.getDictionaryState().status, 'ready');
});
test('离线读取完整同版本缓存，损坏缓存不可成为可用词库', async () => {
  const h = harness(); await h.service.loadDictionary();
  await new Promise(setImmediate);
  h.backend.online = false;
  await h.service.loadDictionary(true);
  assert.equal(h.service.getDictionaryState().offline, true);
  const cache = h.records.get('v2_package'); cache.frequency.items.probable.n++;
  await assert.rejects(h.service.loadDictionary(true));
  assert.equal(h.service.getDictionaryState().status, 'error');
  assert.ok(h.closed.length >= 3);
});
test('缓存写入失败或数据库阻塞不破坏在线加载及错误恢复', async () => {
  const h = harness({ brokenWrites: true });
  await h.service.loadDictionary(); await new Promise(setImmediate);
  assert.equal(h.service.getDictionaryState().status, 'ready');
  assert.equal(h.records.size, 0);
  const blocked = harness({ blocked: true }); blocked.backend.online = false;
  await assert.rejects(blocked.service.loadDictionary());
  assert.equal(blocked.service.getDictionaryState().status, 'error');
});
