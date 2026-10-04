const db = require('../db');
const { digest } = require('./auth-core');
const { snapshot, documents } = require('./study-export');
const extras = ['favorite_tags','favorite_stars','exam_drafts','study_positions'];
function backup() { const result = snapshot(); for (const name of extras) result.data[name] = db.readJSON(name, null); return result; }
function mergeValue(current, incoming, key = '') {
  if (incoming == null) return current;
  if (current == null) return incoming;
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const seen = new Set(current.map(item => digest(JSON.stringify(item?.id ?? item))));
    return [...current, ...incoming.filter(item => { const id = digest(JSON.stringify(item?.id ?? item)); if (seen.has(id)) return false; seen.add(id); return true; })];
  }
  if (typeof current === 'object' && typeof incoming === 'object' && !Array.isArray(current) && !Array.isArray(incoming)) {
    const output = { ...current }; for (const [name, value] of Object.entries(incoming)) {
      if (['__proto__','prototype','constructor','requests'].includes(name)) continue;
      output[name] = mergeValue(current[name], value, name);
    } return output;
  }
  if (key === 'text' && typeof current === 'string' && typeof incoming === 'string' && current !== incoming && incoming.trim()) return current + '\n\n——合并的访客笔记——\n' + incoming;
  return current;
}
function mergeGuest(guest, incoming) {
  const imports = db.readJSON('guest_imports', {});
  if (imports[guest]) return { merged: false };
  // Both snapshots originate from trusted private stores, never from an HTTP upload.
  for (const name of [...documents, ...extras]) {
    if (name === 'growth_state' || !incoming.data[name]) continue;
    const current = db.readJSON(name, null);
    if (name === 'english_storage' && current) {
      const result = { ...current };
      for (const [key, value] of Object.entries(incoming.data[name])) {
        if (!require('./english').validKey(key)) continue;
        if (!(key in result)) result[key] = value;
        else if (key.startsWith('kaoyan_essay_') && result[key] !== value) result[key] += '\n\n——合并的访客草稿——\n' + value;
        else { try { result[key] = JSON.stringify(mergeValue(JSON.parse(result[key]), JSON.parse(value))); } catch {} }
      } db.saveJSON(name, result);
    } else if(name==='study_positions'&&current){const positions={...current};for(const [key,value] of Object.entries(incoming.data[name]))if(!positions[key]||positions[key].at<value.at)positions[key]=value;db.saveJSON(name,positions);}
    else db.saveJSON(name, mergeValue(current, incoming.data[name]));
  }
  const guestGrowth = incoming.data.growth_state;
  if (guestGrowth) {
    const old = db.readJSON('growth_state', null);
    if (!old) db.saveJSON('growth_state', guestGrowth);
    else {
      const merged = mergeValue(old, guestGrowth), totals = { math:0,politics:0,english:0,reviews:0,notes:0,exams:0 }; let duplicates = 0;
      for (const [date, day] of Object.entries(guestGrowth.learning.days || {})) for (const [key, event] of Object.entries(day.events || {})) if (old.learning.days[date]?.events[key]) duplicates += event.points || 0;
      for (const day of Object.values(merged.learning.days)) {
        Object.assign(day, { math:0,politics:0,english:0,reviews:0,notes:0,exams:0,earned:0 });
        for (const event of Object.values(day.events)) { const key = event.kind === 'answer' ? event.subject : ({review:'reviews',note:'notes',exam:'exams'})[event.kind]; if (key in totals) { day[key]++; totals[key]++; } day.earned += event.points || 0; }
      }
      merged.learning.totals = totals; merged.points = Math.max(0, old.points + guestGrowth.points - duplicates);
      for (const key of Object.keys(merged.tokens)) merged.tokens[key] = (old.tokens[key] || 0) + (guestGrowth.tokens[key] || 0);
      db.saveJSON('growth_state', merged);
    }
  }
  if (!db.readJSON('user_profile', null)) db.saveJSON('user_profile', {...db.getProfile(),...incoming.profile});
  imports[guest] = Date.now(); db.saveJSON('guest_imports', imports); return { merged: true };
}
const allowedWrite = path => /^\/api\/(?:answer(?:\/[^/]+\/time)?|math\/grade|note(?:\/append)?|favorite(?:\/(?:tag|star))?|wrong-book\/[^/]+(?:\/(?:collect|master))?|review\/(?:answer|enroll|drop)|exam-papers(?:\/.*)?|politics\/(?:answer|note|favorite|review|papers\/[^/]+\/(?:draft|submit))|english\/(?:storage|note|submit|review|practice)|incentive\/actions|me\/(?:nickname|beta)|study\/position)$/.test(path);
function noteValue(path, body) {
  if (path === '/api/note') { const n = db.getNotes()[String(body.questionId)]; return n?.text ?? n ?? ''; }
  if (path === '/api/politics/note') return db.readJSON('politics_state', {}).notes?.[body.qid] || '';
  if (path === '/api/english/note') return db.readJSON('english_state', {}).notes?.[body.sourceId]?.text || '';
  return undefined;
}
const locks = new Map();
function writes(req, res, next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method) || !req.path.startsWith('/api/')) return next();
  if (req.is('application/json') && !req.body) return res.status(400).json({error:'请提交有效 JSON 内容'});
  const scope = db.identity()?.scope || 'legacy';
  const previous = locks.get(scope) || Promise.resolve(); let release;
  const current = new Promise(resolve => release = resolve); locks.set(scope, current);
  previous.then(() => {
    let finished = false; const unlock = () => { if (finished) return; finished=true;release();if(locks.get(scope)===current)locks.delete(scope); };
    res.once('finish', unlock); res.once('close', unlock);
    try {
      const operation = req.get('X-Study-Operation');
      if (!operation || !allowedWrite(req.path)) return next();
      if (!/^[a-f0-9-]{36}$/.test(operation)) return res.status(400).json({error:'同步操作编号无效'});
      const data = db.readJSON('sync_operations', {}), hash = digest(JSON.stringify([req.method,req.originalUrl,req.body]));
      const prior = data[operation];
      if (prior) return prior.hash !== hash ? res.status(409).json({error:'同步编号与内容不匹配'}) : res.set('X-Study-Replayed','1').status(prior.status).json(prior.body);
      const base = req.body?._studyBase;
      if (base) {
        const value = noteValue(req.path, req.body);
        if (value !== undefined && base.note && digest(value) !== base.note && value !== (req.body.text ?? req.body.note)?.trim()) return res.status(409).json({error:'这条笔记已在另一台设备修改，请选择要保留的版本',conflict:true,cloud:value});
        if (req.path === '/api/english/storage' && base.keys) {
          const storage = db.readJSON('english_storage',{});
          for (const [key, hash] of Object.entries(base.keys)) if (digest(storage[key] ?? null) !== hash && (storage[key] ?? null) !== req.body.patch[key]) {
            // Timers and navigation do not conflict. Different choices for the same question do.
            if(/^kaoyan_quiz_progress_\d{4}$/.test(key)&&storage[key]&&req.body.patch[key]) {
              const old=JSON.parse(storage[key]),incoming=JSON.parse(req.body.patch[key]);
              if(Object.entries(old.answers||{}).every(([id,answer])=>!Object.hasOwn(incoming.answers||{},id)||JSON.stringify(incoming.answers[id])===JSON.stringify(answer)))continue;
            }
            return res.status(409).json({error:'英语记录已在另一台设备修改，请选择版本',conflict:true,key,cloud:storage[key] ?? null});
          }
        }
      }
      const original = res.json.bind(res);
      res.json = body => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const entries = Object.entries(data).filter(([,item]) => item.at > Date.now() - 30*86400000).slice(-499);let bytes=JSON.stringify(body).length;while(entries.length&&bytes+JSON.stringify(entries).length>5000000)entries.shift();
          db.saveJSON('sync_operations', { ...Object.fromEntries(entries), [operation]:{hash,body,status:res.statusCode,at:Date.now()} });
        } return original(body);
      };
      next();
    } catch (e) { next(e); }
  });
}
function mount(app) {
  app.get('/api/study/sync', (req,res) => res.json({scope:db.identity()?.scope, ...backup()}));
  app.get('/api/study/position', (req,res) => res.json({items:db.readJSON('study_positions',{})}));
  app.post('/api/study/position', (req,res) => {
    const { key, value } = req.body;
    if (typeof key !== 'string' || key.length<1 || key.length>180 || /[\x00-\x1f]/.test(key) || ['__proto__','constructor','prototype'].includes(key) || !value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 12000) return res.status(400).json({error:'浏览位置无效'});
    if (value.url && (!/^\/(?:math|politics|english|growth|library)(?:[/?#]|$)/.test(value.url) || value.url.length>1000 || /[\\\r\n]/.test(value.url))) return res.status(400).json({error:'导航地址无效'});
    const items = db.readJSON('study_positions',{}); if (Object.keys(items).length > 250 && !items[key]) delete items[Object.keys(items)[0]];
    items[key]={...value,at:Date.now()};db.saveJSON('study_positions',items);res.json({ok:true});
  });
}
module.exports = { backup, mergeGuest, allowedWrite, writes, mount };
