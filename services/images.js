const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const MAX_BYTES = 5 * 1024 * 1024;
function fail(message, status = 400) { const error = new Error(message); error.status = status; return error; }
function read(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return null;
  return db.readJSON('ai_image_' + id, null);
}
function remove(id) {
  const index = db.readJSON('ai_images', {});
  if (index[id]) { delete index[id]; db.saveJSON('ai_images', index); db.saveJSON('ai_image_' + id, null); }
}
async function upload(req) {
  if (!/multipart\/form-data;.*boundary=/i.test(req.get('Content-Type') || '') || !Buffer.isBuffer(req.body)) throw fail('请选择 PNG、JPEG 或 WebP 图片');
  const form = await new Request('https://upload.invalid', { method: 'POST', headers: { 'Content-Type': req.get('Content-Type') }, body: req.body }).formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_BYTES) throw fail('图片大小须在 1 字节至 5 MB 之间');
  const bytes = Buffer.from(await file.arrayBuffer()); let mime;
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR') mime = 'image/png';
  else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) mime = 'image/jpeg';
  else if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
  if (!mime || (file.type && file.type !== mime)) throw fail('文件不是有效的 PNG、JPEG 或 WebP 图片');
  const index = db.readJSON('ai_images', {});
  if (Object.keys(index).length >= 100 || Object.values(index).reduce((sum, x) => sum + x.size, 0) + bytes.length > 50 * 1024 * 1024) throw fail('图片保存空间已满，请移除不需要的图片后重试', 413);
  const id = randomUUID(); db.saveJSON('ai_image_' + id, { mime, data: bytes.toString('base64'), size: bytes.length });
  index[id] = { size: bytes.length, createdAt: Date.now() }; db.saveJSON('ai_images', index); return id;
}
function content(text, ids = [], { allowMissing = false } = {}) {
  if (ids == null) ids = [];
  if (!Array.isArray(ids) || ids.length > 3 || ids.some(id => typeof id !== 'string')) throw fail('每次最多上传 3 张图片');
  const parts = [{ type: 'text', text: text || '请分析图片中的问题；看不清的内容请说明。' }];
  for (const id of [...new Set(ids)]) {
    const image = read(id);
    if (!image) { if (allowMissing) { parts.push({ type: 'text', text: '[历史图片已移除]' }); continue; } throw fail('图片不存在或已移除，请重新上传', 404); }
    parts.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.data}` } });
  }
  return ids.length ? parts : text;
}
function mount(app, findQuestion) {
  const raw = express.raw({ type: 'multipart/form-data', limit: '6mb' });
  const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || 400).json({ ok: false, error: e.message, message: e.message }); } };
  app.post('/api/qa/image', raw, wrap(async (req, res) => res.json({ ok: true, id: await upload(req) })));
  const send = (req, res) => { const data = read(req.params.id); if (!data) return res.status(404).json({ error: '图片不存在' }); res.set({ 'Content-Type': data.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(data.data, 'base64')); };
  app.get('/api/qa/image/:id', send);
  app.delete('/api/qa/image/:id', (req, res) => { remove(req.params.id); res.json({ ok: true }); });
  app.post('/api/math/answer-image', raw, wrap(async (req, res) => {
    if (!findQuestion(req.query.questionId)) throw fail('题目不存在', 404);
    const map = db.readJSON('math_images', {}), id = await upload(req);
    if (map[req.query.questionId]) remove(map[req.query.questionId]);
    map[req.query.questionId] = id; db.saveJSON('math_images', map); res.json({ ok: true, id });
  }));
  app.get('/api/math/answer-image', (req, res) => res.json({ id: db.readJSON('math_images', {})[req.query.questionId] || null }));
  app.get('/api/math/answer-image/:id', send);
  app.delete('/api/math/answer-image', (req, res) => { const map = db.readJSON('math_images', {}); remove(map[req.query.questionId]); delete map[req.query.questionId]; db.saveJSON('math_images', map); res.json({ ok: true }); });
  app.post('/api/custom/recognize', raw, wrap(async (req, res) => {
    const id = await upload(req);
    try {
      if (!db.getAiConfig().apiKey) throw fail('请在统一 AI 设置中配置支持图片的模型');
      const result = await require('./ai-client').complete([{ role: 'system', content: '识别考研数学题目，返回 JSON 对象 {isMath:boolean,stem:string,type:string,options:[{key:string,text:string}],note:string}，用 LaTeX 表示公式。不要补造看不清的内容或参考答案。' }, { role: 'user', content: content('识别这张图片中的题目。', [id]) }]);
      const match = result.match(/\{[\s\S]*\}/); if (!match) throw fail('识别结果无法读取，请拍摄清晰图片重试');
      const parsed=JSON.parse(match[0]);if(typeof parsed.stem!=='string' || typeof parsed.isMath!=='boolean')throw fail('识别结果不完整，请重试');
      parsed.options=Array.isArray(parsed.options)?parsed.options:Object.entries(parsed.options || {}).map(([key,text])=>({key,text:String(text)}));res.json(parsed);
    } finally { remove(id); }
  }));
}
module.exports = { mount, upload, read, remove, content, MAX_BYTES };
