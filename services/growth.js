const { randomUUID } = require('node:crypto');
const db = require('../db');
const defaults = require('./growth-defaults.json');
const DAY = 86400000;
const rewardRules = { answer: 2, review: 3, note: 2, exam: 20 };
const subjectNames = { math: '数学', politics: '政治' };
const kindNames = { answer: '完成答题', review: '完成复习', note: '记录笔记', exam: '完成模考' };
const dayKey = (now = Date.now()) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();
const id = prefix => prefix + '_' + randomUUID();
const emptyCounts = () => ({ math: 0, politics: 0, reviews: 0, notes: 0, exams: 0 });

function newState() {
  return {
    version: 1, points: 0, tokens: Object.fromEntries(defaults.currencies.map(c => [c.id, 0])),
    user_profile: { status: 'normal', cooling_expiry: null }, daily_session: {},
    loans: [], deposits: [], secondary_payments: [], caterpillar_list: [], caterpillar_today_done_count: 0,
    pbl_projects: [{ id: 'study-journey', title: '考研成长之路', deadline: '', deliverable: '让每一次练习都成为看得见的积累',
      milestones: [
        { id: 'first-ten', title: '完成 10 道数学与政治练习', metric: 'answers', target: 10, points: 0, status: 'in_progress', automatic: true },
        { id: 'review-ten', title: '完成 10 次到期复习', metric: 'reviews', target: 10, points: 0, status: 'in_progress', automatic: true },
        { id: 'notes-five', title: '积累 5 篇学习笔记', metric: 'notes', target: 5, points: 0, status: 'in_progress', automatic: true },
        { id: 'papers-three', title: '完成 3 套模拟试卷', metric: 'exams', target: 3, points: 0, status: 'in_progress', automatic: true }
      ] }],
    history_logs: [], session_history: [], requests: {},
    learning: { goals: { math: 10, politics: 20, reviews: 5, notes: 1 }, days: {}, totals: emptyCounts() }
  };
}

function log(state, type, desc, extra = {}) {
  state.history_logs.unshift({ id: id('log'), timestamp: stamp(), type, desc, ...extra });
  state.history_logs = state.history_logs.slice(0, 500);
}

function rollDay(state, now = Date.now()) {
  const today = dayKey(now);
  if (state.daily_session.date !== today) {
    if (state.daily_session.date) state.session_history.unshift({ ...state.daily_session, is_ended: true });
    state.session_history = state.session_history.slice(0, 120);
    state.daily_session = { date: today, is_started: false, is_ended: false, session_round: 0, start_time: null, end_time: null,
      today_earned_points: 0, today_spent_points: 0, today_earned_tokens: {}, today_spent_tokens: {}, today_tasks_done: [], draws: 0 };
    state.caterpillar_today_done_count = 0;
  }
  state.learning.days[today] ||= { ...emptyCounts(), earned: 0, events: {} };
  for (const key of Object.keys(state.learning.days).sort().slice(0, -400)) delete state.learning.days[key];
  if (state.user_profile.status === 'cooling' && Date.parse(state.user_profile.cooling_expiry) <= now) {
    state.user_profile.status = 'normal'; state.user_profile.cooling_expiry = null;
  }
  for (const d of state.deposits) if (d.status === 'active') {
    const elapsed = Math.max(0, Math.min(d.days, Math.floor((Date.parse(today) - Date.parse(d.start_date)) / DAY)));
    d.accrued_interest = elapsed * d.daily_interest;
    d.can_claim = today >= d.end_date;
  }
  return state;
}
function getState() { return rollDay(db.readJSON('growth_state', newState())); }
function save(state) { db.saveJSON('growth_state', state); }
function points(state, amount, reason, type = 'POINTS') {
  if (state.points + amount < 0) throw new Error('积分不足');
  state.points += amount;
  state.daily_session[amount >= 0 ? 'today_earned_points' : 'today_spent_points'] += Math.abs(amount);
  log(state, type, `${reason}：${amount >= 0 ? '+' : ''}${amount} 积分`, { amount });
}
function currency(curr) {
  const found = defaults.currencies.find(c => c.id === curr);
  if (!found) throw new Error('代币类型无效');
  return found;
}
function tokens(state, curr, amount, reason) {
  const c = currency(curr);
  if (state.tokens[curr] + amount < 0) throw new Error('代币余额不足');
  let remaining = amount;
  if (remaining > 0) for (const loan of state.loans) {
    if (loan.currency_id !== curr || loan.status !== 'active') continue;
    const repayment = Math.min(remaining, loan.remaining_amount);
    loan.remaining_amount -= repayment; remaining -= repayment;
    if (!loan.remaining_amount) loan.status = 'repaid';
    log(state, 'BANK_REPAY', `新收入自动偿还 ${c.name} ${repayment} 枚`);
    if (!remaining) break;
  }
  state.tokens[curr] += remaining;
  const bucket = amount >= 0 ? 'today_earned_tokens' : 'today_spent_tokens';
  state.daily_session[bucket][c.name] = (state.daily_session[bucket][c.name] || 0) + Math.abs(amount);
  log(state, 'TOKEN', `${reason}：${c.name} ${amount >= 0 ? '+' : ''}${amount} 枚`);
}
function advanceMilestones(state) {
  const t = state.learning.totals;
  const metrics = { answers: t.math + t.politics, ...t };
  for (const project of state.pbl_projects) for (const m of project.milestones) if (m.automatic) {
    m.progress = Math.min(m.target, metrics[m.metric] || 0);
    if (m.progress >= m.target && m.status !== 'completed') {
      m.status = 'completed'; m.completed_at = stamp();
      log(state, 'PBL', `学习联动里程碑达成：${m.title}`);
    }
  }
}
// Called only after successful domain writes; clients cannot post reward values.
function recordLearning(subject, kind, sourceId, detail = {}) {
  if (!(subject in subjectNames) || !(kind in rewardRules)) throw new Error('无效学习事件');
  if (kind === 'note' && String(detail.text || '').trim().length < 10) return { credited: false, points: 0 };
  const state = getState(), today = dayKey(), daily = state.learning.days[today];
  const key = `${subject}:${kind}:${sourceId}`;
  if (daily.events[key]) return { credited: false, points: 0, totalPoints: state.points };
  const amount = rewardRules[kind];
  daily.events[key] = { at: stamp(), subject, kind, sourceId: String(sourceId), points: amount,
    href: subject === 'math' ? (kind === 'exam' ? '/math/papers' : `/math/q/${sourceId}`) : (detail.href || '/politics') };
  const counter = kind === 'answer' ? subject : ({ review: 'reviews', note: 'notes', exam: 'exams' })[kind];
  daily[counter]++; state.learning.totals[counter]++; daily.earned += amount;
  points(state, amount, `${subjectNames[subject]} · ${kindNames[kind]}`, 'STUDY');
  // Subject-specific plans and contracts advance from successful study actions.
  for (const contract of state.secondary_payments) if (contract.status === 'in_progress' && contract.link_subject === subject && contract.link_kind === kind) {
    contract.current_progress = Math.min(contract.total_target, contract.current_progress + 1);
    if (contract.current_progress >= contract.total_target) contract.status = 'completed';
  }
  advanceMilestones(state); save(state);
  return { credited: true, points: amount, totalPoints: state.points };
}
function overview(state = getState()) {
  const today = dayKey(), day = state.learning.days[today];
  const goals = Object.entries(state.learning.goals).map(([key, target]) => ({ key, target, value: day[key], complete: day[key] >= target }));
  let cursor = new Date(`${today}T00:00:00Z`).getTime(), streak = 0;
  const active = d => d && Object.keys(d.events).length > 0;
  if (!active(day)) cursor -= DAY;
  while (active(state.learning.days[new Date(cursor).toISOString().slice(0, 10)])) { streak++; cursor -= DAY; }
  return { date: today, points: state.points, streak, goals, today: { ...day, events: undefined }, totals: state.learning.totals,
    recent: Object.values(day.events).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12),
    days: Object.entries(state.learning.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 35).map(([date, d]) => ({ date, count: Object.keys(d.events).length, earned: d.earned })),
    rewardRules, activeSession: state.daily_session.is_started && !state.daily_session.is_ended, cooling: state.user_profile.status === 'cooling' };
}
function number(value, min = 1, max = 100000) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`请输入 ${min}–${max} 之间的整数`);
  return n;
}
function text(value, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('请输入有效内容');
  return value.trim();
}
function mutate(action, data, requestId) {
  const state = getState();
  if (requestId && state.requests[requestId]) {
    if (state.requests[requestId] !== action) throw new Error('重复请求标识不匹配');
    return { success: true, duplicate: true, state };
  }
  let message = '已保存', item;
  switch (action) {
    case 'goals':
      for (const key of ['math', 'politics', 'reviews', 'notes']) if (data[key] !== undefined) state.learning.goals[key] = number(data[key], 1, 500);
      break;
    case 'session/start': {
      if (state.user_profile.status === 'cooling') throw new Error('休息时间尚未结束，请先休息或解除冷却');
      const sess = state.daily_session;
      if (!sess.is_started || sess.is_ended) {
        sess.is_started = true; sess.is_ended = false; sess.start_time = stamp(); sess.end_time = null; sess.session_round++;
        log(state, 'CHECKIN', `开始今日第 ${sess.session_round} 轮学习`);
      }
      message = '打卡已开始，数学和政治学习会自动记录'; break;
    }
    case 'session/end':
      if (!state.daily_session.is_started) throw new Error('请先开始打卡');
      if (!state.daily_session.is_ended) {
        state.daily_session.is_ended = true; state.daily_session.end_time = stamp();
        log(state, 'SETTLEMENT', `今日获得 ${state.daily_session.today_earned_points} 积分，消耗 ${state.daily_session.today_spent_points} 积分`);
      }
      message = '本轮已结账，今日累计学习和积分会保留'; break;
    case 'session/cooling':
      if (typeof data.enable !== 'boolean') throw new Error('状态无效');
      state.user_profile = { status: data.enable ? 'cooling' : 'normal', cooling_expiry: data.enable ? new Date(Date.now() + 7200000).toISOString() : null };
      log(state, 'COOLING', data.enable ? '开始两小时休息保护' : '已解除休息保护'); break;
    case 'points/adjust': points(state, number(data.amount, -100000, 100000), text(data.reason)); break;
    case 'tokens/adjust': tokens(state, data.currency_id, number(data.amount, -1000, 1000), text(data.reason)); break;
    case 'bank/loan': {
      const c = currency(data.currency_id), amount = number(data.amount, 1, 100), rule = defaults.loan_rules[c.id];
      const days = rule.base_days + (amount - 1) * rule.per_coin_days;
      item = { id: id('loan'), currency_id: c.id, currency_name: c.name, borrowed_amount: amount, remaining_amount: amount,
        borrow_date: dayKey(), due_date: dayKey(Date.now() + days * DAY), days_allowed: days, status: 'active', reason: text(data.reason || '学习奖励预支'), stamp: '学习代币预支' };
      state.loans.unshift(item); state.tokens[c.id] += amount;
      log(state, 'BANK_LOAN', `预支 ${c.name} ${amount} 枚，后续该币种收入优先还款`); break;
    }
    case 'bank/loan/repay': {
      const loan = state.loans.find(l => l.id === data.loan_id && l.status === 'active');
      if (!loan) throw new Error('未找到有效借贷单');
      const amount = Math.min(number(data.amount, 1, 1000), loan.remaining_amount);
      if (state.tokens[loan.currency_id] < amount) throw new Error('代币余额不足');
      state.tokens[loan.currency_id] -= amount; loan.remaining_amount -= amount;
      if (!loan.remaining_amount) loan.status = 'repaid';
      log(state, 'BANK_REPAY', `偿还 ${loan.currency_name} ${amount} 枚`); break;
    }
    case 'bank/deposit': {
      const tier = defaults.deposit_tiers.find(t => t.amount === Number(data.amount) && t.days === Number(data.days));
      if (!tier) throw new Error('请选择有效的存款方案');
      if (state.points < tier.amount) throw new Error('积分不足');
      state.points -= tier.amount;
      item = { id: id('deposit'), principal: tier.amount, days: tier.days, daily_interest: tier.daily_interest, token_reward: tier.token_reward,
        start_date: dayKey(), end_date: dayKey(Date.now() + tier.days * DAY), status: 'active', accrued_interest: 0, can_claim: false };
      state.deposits.unshift(item); log(state, 'BANK_DEPOSIT', `存入 ${tier.amount} 积分，期限 ${tier.days} 天`); break;
    }
    case 'bank/deposit/claim': {
      const d = state.deposits.find(d => d.id === data.deposit_id && d.status === 'active');
      if (!d) throw new Error('存单不存在或已经兑付');
      state.points += d.principal;
      if (d.can_claim) {
        if (d.accrued_interest) points(state, d.accrued_interest, '存款利息', 'BANK_DEPOSIT');
        if (d.token_reward) tokens(state, 'knowledge', d.token_reward, '存款到期奖励');
        d.status = 'matured'; message = '本金和到期收益已兑付';
      } else { d.status = 'cancelled_early'; message = '已提前支取本金，不计利息'; }
      log(state, 'BANK_DEPOSIT', message); break;
    }
    case 'secondary_payment/add': {
      const linked = Boolean(data.link_subject || data.link_kind);
      if (linked && (!(data.link_subject in subjectNames) || !(data.link_kind in rewardRules))) throw new Error('学习联动条件无效');
      item = { id: id('contract'), name: text(data.name, 120), category: text(data.category || 'books', 50), total_target: number(data.total_target, 1, 10000), current_progress: 0,
        unit: text(data.unit || '次', 20), status: 'in_progress', created_at: dayKey(), notes: String(data.notes || '').slice(0, 1000),
        link_subject: linked ? data.link_subject : null, link_kind: linked ? data.link_kind : null };
      state.secondary_payments.unshift(item); log(state, 'SECONDARY_PAY', `新增行动契约：${item.name}`); break;
    }
    case 'secondary_payment/update':
      item = state.secondary_payments.find(c => c.id === data.id);
      if (!item) throw new Error('未找到行动契约');
      if (item.link_subject) throw new Error('该契约由学习记录自动推进');
      item.current_progress = Math.min(item.total_target, number(data.progress, 0, 10000));
      item.status = item.current_progress >= item.total_target ? 'completed' : 'in_progress';
      log(state, 'SECONDARY_PAY', `更新契约：${item.name} ${item.current_progress}/${item.total_target}`); break;
    case 'store/buy': {
      item = defaults.default_shop_items.find(i => i.id === data.item_id);
      if (!item) throw new Error('兑换项目不存在');
      if (item.id === 'item_tv_ep' && state.caterpillar_list.filter(t => !t.done).length >= 15) throw new Error('请先将未完成任务减少到 15 项以内，再兑换追剧奖励');
      const lock = state.secondary_payments.find(c => c.status === 'in_progress' && c.category === (item.secondary_payment_category || item.category));
      if (lock) throw new Error(`先完成行动契约「${lock.name}」，再兑换同类物品`);
      if (item.type === 'points') points(state, -item.points_cost, `兑换 ${item.title}`, 'STORE_BUY');
      else if (item.cost_type === 'multi_token') {
        const available = defaults.currencies.map(c => c.id).filter(c => state.tokens[c] >= 2);
        if (available.length < 2) throw new Error('需要两种代币各 2 枚');
        tokens(state, available[0], -2, `兑换 ${item.title}`); tokens(state, available[1], -2, `兑换 ${item.title}`);
      } else {
        const curr = data.currency_id || defaults.currencies.find(c => state.tokens[c.id] >= item.cost_amount)?.id;
        if (!curr) throw new Error('单一币种余额不足，请选择足够的代币');
        tokens(state, curr, -item.cost_amount, `兑换 ${item.title}`);
      }
      message = `已记录兑换：${item.title}（仅为个人奖励记录）`; break;
    }
    case 'caterpillar/add':
      item = { id: id('task'), text: text(data.text, 200), done: false, created_at: dayKey() };
      state.caterpillar_list.push(item); break;
    case 'caterpillar/toggle':
      item = state.caterpillar_list.find(c => c.id === data.id);
      if (!item) throw new Error('任务不存在');
      item.done = typeof data.done === 'boolean' ? data.done : !item.done;
      if (item.done && !state.daily_session.today_tasks_done.includes(item.id)) state.daily_session.today_tasks_done.push(item.id);
      state.caterpillar_today_done_count = state.daily_session.today_tasks_done.length;
      log(state, 'CATERPILLAR', `${item.done ? '完成' : '重新打开'}任务：${item.text}`); break;
    case 'caterpillar/draw': {
      if (state.caterpillar_today_done_count - 5 - state.daily_session.draws <= 0) throw new Error('暂无可领取的超额奖励；第 6 项起每个新任务获得一次机会');
      state.daily_session.draws++;
      points(state, 5, '完成额外任务的小奖励', 'CATERPILLAR_LOTTERY'); message = '额外任务奖励：5 积分'; break;
    }
    case 'pbl/add':
      item = { id: id('project'), title: text(data.title, 120), deadline: String(data.deadline || '').slice(0, 10), deliverable: text(data.deliverable, 500),
        milestones: ['明确目标', '完成实践', '整理输出'].map((title, i) => ({ id: id('milestone'), title, points: [5, 10, 5][i], status: 'in_progress' })) };
      state.pbl_projects.push(item); break;
    case 'pbl/milestone/toggle': {
      const project = state.pbl_projects.find(p => p.id === data.project_id);
      const m = project?.milestones.find(m => m.id === data.milestone_id);
      if (!m) throw new Error('里程碑不存在');
      if (m.automatic) throw new Error('该里程碑随学习进度自动完成');
      const completing = m.status !== 'completed';
      if (completing && !m.rewarded) { points(state, m.points, `里程碑：${m.title}`, 'PBL'); m.rewarded = true; }
      m.status = completing ? 'completed' : 'in_progress'; break;
    }
    default: throw new Error('操作不存在');
  }
  if (requestId) {
    state.requests[requestId] = action;
    for (const key of Object.keys(state.requests).slice(0, -500)) delete state.requests[key];
  }
  save(state);
  return { success: true, state, item, loan: item, deposit: item, message, summary: message, done_count: state.caterpillar_today_done_count };
}
module.exports = { defaults, rewardRules, dayKey, newState, getState, save, log, recordLearning, overview, mutate, rollDay };
