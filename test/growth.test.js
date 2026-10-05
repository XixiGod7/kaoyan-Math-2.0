const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const db = require('../db');
const growth = require('../services/growth');
function isolated(run) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE documents (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const sql = { exec(query, ...args) { const stmt = sqlite.prepare(query); return query.startsWith('SELECT') ? { toArray: () => stmt.all(...args) } : stmt.run(...args); } };
  try { return db.runWithStorage(sql,run,undefined,undefined,{transactionSync(callback){sqlite.exec('BEGIN');try{const value=callback();sqlite.exec('COMMIT');return value;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}); } finally { sqlite.close(); }
}
test('北京时间跨日会更新目标计数，保留历史和总积分', () => {
  assert.equal(growth.dayKey(Date.parse('2026-10-03T15:59:59Z')), '2026-10-03');
  assert.equal(growth.dayKey(Date.parse('2026-10-03T16:00:00Z')), '2026-10-04');
  const state = growth.newState();
  growth.rollDay(state, Date.parse('2026-10-03T15:59:59Z'));
  state.points = 12; state.learning.days['2026-10-03'].math = 3; state.daily_session.today_earned_points = 12;
  growth.rollDay(state, Date.parse('2026-10-03T16:00:00Z'));
  assert.equal(state.points, 12); assert.equal(state.learning.days['2026-10-03'].math, 3);
  assert.equal(state.learning.days['2026-10-04'].math, 0); assert.equal(state.daily_session.today_earned_points, 0);
  assert.equal(state.session_history[0].today_earned_points, 12);
});
test('存单按日期到期，本金利息只兑付一次；休息保护到期解除', () => isolated(() => {
  growth.mutate('points/adjust', { amount: 1000, reason: '测试本金' });
  const { item } = growth.mutate('bank/deposit', { amount: 500, days: 30 });
  const state = growth.getState(), d = state.deposits[0];
  d.start_date = growth.dayKey(Date.now() - 31 * 86400000); d.end_date = growth.dayKey(Date.now() - 86400000);
  state.user_profile = { status: 'cooling', cooling_expiry: new Date(Date.now() - 1).toISOString() }; growth.save(state);
  assert.equal(growth.getState().user_profile.status, 'normal');
  const claimed = growth.mutate('bank/deposit/claim', { deposit_id: item.id });
  assert.equal(claimed.state.points, 1090); assert.equal(claimed.state.tokens.knowledge, 1);
  assert.throws(() => growth.mutate('bank/deposit/claim', { deposit_id: item.id }));
}));
test('十个不同练习推进自动里程碑，短笔记与重复题不刷进度', () => isolated(() => {
  for (let i = 0; i < 10; i++) { growth.recordLearning(i % 2 ? 'math' : 'politics', 'answer', i); growth.recordLearning(i % 2 ? 'math' : 'politics', 'answer', i); }
  assert.equal(growth.getState().points, 20);
  const milestone = growth.getState().pbl_projects[0].milestones[0];
  assert.equal(milestone.status, 'completed'); assert.equal(milestone.progress, 10);
  assert.equal(growth.recordLearning('math', 'note', 1, { text: '太短' }).credited, false);
  assert.throws(() => growth.mutate('pbl/milestone/toggle', { project_id: 'study-journey', milestone_id: 'first-ten' }));
}));
test('大量中文学习记录可完整保存，覆盖后不会残留旧数据', () => isolated(() => {
  const value = { notes: '学习记录🧱'.repeat(400000), answers: { 'pol:test:0:0': { correct: true } } };
  db.saveJSON('large_study_record', value);
  assert.deepEqual(db.readJSON('large_study_record', {}), value);
  db.saveJSON('large_study_record', { notes: '新的记录' });
  assert.deepEqual(db.readJSON('large_study_record', {}), { notes: '新的记录' });
}));
