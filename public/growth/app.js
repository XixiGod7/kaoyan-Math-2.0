(() => {
  const safe = window.platformEscape;
  const names = { math: '数学练习', english: '英语练习', politics: '政治练习', reviews: '到期复习', notes: '学习笔记', answer: '答题', review: '复习', note: '笔记', exam: '模考' };
  const money = value => Number(value || 0).toLocaleString('zh-CN');
  const when = value => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
  const btn = (title, action, data = {}, disabled = false) => `<button class="platform-button secondary" data-action="${action}" data-value="${safe(JSON.stringify(data))}" ${disabled ? 'disabled' : ''}>${safe(title)}</button>`;
  const empty = text => `<p class="platform-empty">${text}</p>`;
  const progress = (value, target) => `<div class="growth-progress"><i style="width:${Math.min(100, 100 * value / target)}%"></i></div>`;
  let growthImages=[],imagePicker;
  let state, config, overview, activeTab = 'dashboard', pending = false, chat = [], asking = false;
  const content = document.getElementById('growth-content'), dialog = document.getElementById('growth-dialog');

  async function load() {
    try {
      const res = await fetch('/api/incentive/state');
      if (!res.ok) throw new Error('成长记录暂时无法加载');
      const value = await res.json(); state = value.state; config = value.config; overview = value.overview;
      document.getElementById('growth-error').hidden = true;
      render();
    } catch (e) {
      const box = document.getElementById('growth-error'); box.hidden = false;
      box.textContent = `${e.message}，请稍后刷新页面重试。`;
    }
  }
  async function mutate(action, data = {}) {
    if (pending) return false;
    pending = true;
    const controls = [...document.querySelectorAll('[data-action], .growth-dialog button')];
    const oldDisabled = controls.map(b => b.disabled); controls.forEach(b => b.disabled = true);
    try {
      const res = await fetch('/api/incentive/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(data) });
      const value = await res.json();
      if (!res.ok || !value.success) throw new Error(value.error || '保存失败');
      state = value.state; window.platformToast(value.message || '已保存');
      window.dispatchEvent(new Event('study:update'));
      await load(); return true;
    } catch (e) { window.platformToast(e.message); return false; }
    finally { pending = false; controls.forEach((b, i) => b.disabled = oldDisabled[i]); }
  }
  function render() {
    if (!state) return;
    document.getElementById('growth-date').textContent = `${overview.date} · 北京时间\n连续学习 ${overview.streak} 天`;
    const views = { dashboard, contracts, vault, shop, tasks, records, help };
    content.innerHTML = views[activeTab]();
    if (activeTab === 'dashboard') {renderChat();imagePicker=window.createStudyImagePicker(document.getElementById('growth-images'),{ids:growthImages,onChange:ids=>growthImages=ids});}
    if (activeTab === 'help') loadDocs();
  }
  function goals() {
    return overview.goals.map(g => `<div class="goal-row"><span>${names[g.key]}</span><div class="goal-track"><i style="width:${Math.min(100, 100 * g.value / g.target)}%"></i></div><span>${g.value} / ${g.target}</span></div>`).join('');
  }
  function dashboard() {
    const sess = state.daily_session, cooling = overview.cooling;
    return `<section class="hub-metrics"><div class="hub-metric"><span>可用积分</span><strong>${money(state.points)}</strong><em>每一次认真学习都有积累</em></div><div class="hub-metric"><span>今日学习奖励</span><strong>+${overview.today.earned}</strong><em>按不同题目计数</em></div><div class="hub-metric"><span>今日总收入 / 支出</span><strong style="font-size:23px">+${sess.today_earned_points} / −${sess.today_spent_points}</strong><em>包括手动结算</em></div><div class="hub-metric"><span>连续学习</span><strong>${overview.streak}<em> 天</em></strong><em>今天模考 ${overview.today.exams} 套</em></div></section>
      <div class="growth-grid"><section class="platform-panel"><div class="growth-status"><div><h2>今日打卡</h2><strong>${cooling ? '先休息，再出发' : overview.activeSession ? `第 ${sess.session_round} 轮 · 专注中` : sess.is_ended ? '本轮已结账' : '准备开始'}</strong></div><span class="growth-tag">${cooling ? '休息保护' : '学习自动记录'}</span></div><p class="growth-small">${sess.start_time ? `开始于 ${when(sess.start_time)}` : '学习记录会自动积累；打卡用于标记你的专注时段。'}${cooling ? `。休息保护将于 ${when(state.user_profile.cooling_expiry)} 结束。` : ''}</p><div class="growth-actions">${btn(sess.is_ended ? '开启下一轮' : '开始打卡', 'session/start', {}, overview.activeSession || cooling)}${btn('本轮结账', 'session/end', {}, !overview.activeSession)}${btn(cooling ? '解除休息保护' : '休息两小时', 'session/cooling', { enable: !cooling })}</div><p class="growth-small">开始新一轮会保留今天全部积累。</p></section>
      <section class="platform-panel"><div class="growth-list-head"><h2>我的每日目标</h2>${btn('调整目标', 'form-goals')}</div>${goals()}<p class="growth-small">每题 +2 · 到期复习 +3 · 有效笔记 +2 · 完整模考 +20<br>同一天的重复操作不会重复奖励。</p></section>
      <section class="platform-panel"><h2>继续学习</h2><p class="panel-sub">完成一小步，积累一个清晰的成果。</p><div class="growth-actions"><a class="platform-button" href="/math">去学数学</a><a class="platform-button" href="/politics">去学政治</a><a class="platform-button" href="/english">去学英语</a><a class="platform-button secondary" href="/library">查看学习档案</a></div>${overview.recent.slice(0, 5).map(e => `<a class="study-item" href="${safe(e.href)}"><span>${({math:'数学',politics:'政治',english:'英语'})[e.subject]} · ${names[e.kind]}</span><span>+${e.points} 积分</span></a>`).join('') || empty('还没有今日学习记录。从一道题开始吧。')}</section>
      <section class="platform-panel"><h2>学习复盘</h2><p class="panel-sub">结合真实学习记录，梳理收获和下一步。使用顶部统一 AI 设置。</p><div id="growth-chat"></div><form id="chat-form" class="growth-form"><label for="chat-message">今天有什么收获或困惑？</label><textarea id="chat-message" name="message" rows="3" maxlength="4000" placeholder="例如：政治多选题容易漏选，下一轮想重点复习。"></textarea><div id="growth-images"></div><div class="growth-actions"><button class="platform-button" ${asking ? 'disabled' : ''}>${asking ? '正在复盘…' : '开始复盘'}</button></div></form><p class="growth-small">AI 提供建议。线下任务的收支可在「代币与储蓄」中手动记录。</p></section></div>`;
  }
  function contracts() {
    return `<section class="platform-panel"><div class="growth-list-head"><div><h2>行动契约</h2><p class="panel-sub">为已购买的书籍或课程约定行动。学科契约会随学习自动推进。</p></div>${btn('新建契约', 'form-contract')}</div>${state.secondary_payments.map(c => `<article class="growth-list-card"><div class="growth-list-head"><h3>${safe(c.name)}</h3><span class="growth-tag">${c.status === 'completed' ? '已达成' : '进行中'}</span></div><p class="growth-small">${safe(c.notes || '一步一步完成目标。')}</p><div>${c.current_progress} / ${c.total_target} ${safe(c.unit)} ${c.link_subject ? `· ${({math:'数学',politics:'政治',english:'英语'})[c.link_subject]}${names[c.link_kind]}自动联动` : '· 手动记录'}</div>${progress(c.current_progress, c.total_target)}${!c.link_subject ? btn('更新进度', 'form-progress', { id: c.id }) : ''}</article>`).join('') || empty('还没有行动契约。可以设置「完成 20 道政治练习」并开启自动联动。')}</section>`;
  }
  function vault() {
    return `<section class="platform-panel"><div class="growth-list-head"><div><h2>个人学习代币</h2><p class="panel-sub">保留六类学习奖励。线下学习由你记录；数学、政治与英语自动发放的是积分。</p></div>${btn('微调收支', 'form-adjust')}</div><div class="growth-token-grid">${config.currencies.map(c => `<article class="growth-token"><span>${safe(c.icon)} ${safe(c.name)}</span><strong>${money(state.tokens[c.id])}</strong><small>${safe(c.desc)}</small></article>`).join('')}</div></section>
      <div class="growth-grid"><section class="platform-panel"><div class="growth-list-head"><h2>代币预支</h2>${btn('申请预支', 'form-loan')}</div><p class="panel-sub">未来同种代币收入会优先偿还预支。所有记录均为个人虚拟账本。</p>${state.loans.map(l => `<article class="growth-list-card"><h3>${safe(l.currency_name)} · 剩余 ${l.remaining_amount} 枚</h3><p class="growth-small">${safe(l.reason)}<br>${safe(l.borrow_date)} → ${safe(l.due_date)} · ${l.status === 'active' ? '待偿还' : '已还清'}</p>${l.status === 'active' ? btn('偿还', 'form-repay', { id: l.id }) : ''}</article>`).join('') || empty('目前没有预支记录。')}</section>
      <section class="platform-panel"><div class="growth-list-head"><h2>积分存单</h2>${btn('新建存单', 'form-deposit')}</div><p class="panel-sub">培养延迟满足。提前取回本金不计利息，到期按方案记录收益。</p>${state.deposits.map(d => `<article class="growth-list-card"><h3>${d.principal} 积分 · ${d.days} 天</h3><p class="growth-small">${safe(d.start_date)} → ${safe(d.end_date)}<br>累计利息 ${d.accrued_interest} · ${d.status === 'active' ? d.can_claim ? '已到期' : '储蓄中' : d.status === 'matured' ? '已兑付' : '已提前支取'}</p>${d.status === 'active' ? btn(d.can_claim ? '到期兑付' : '提前支取', 'bank/deposit/claim', { deposit_id: d.id }) : ''}</article>`).join('') || empty('目前没有存单。积累到 500 分后可以开始储蓄。')}</section></div>`;
  }
  function shop() {
    return `<p class="hub-footnote" style="margin:0 0 20px">给完成的努力一个小奖励。这里记录个人兑换计划，不会进行实际支付。</p><div class="growth-grid">${config.default_shop_items.map(item => {
      const lock = state.secondary_payments.find(c => c.status === 'in_progress' && c.category === (item.secondary_payment_category || item.category));
      const cost = item.type === 'points' ? `${item.points_cost} 积分` : item.cost_type === 'multi_token' ? '两种代币各 2 枚' : `任一币种 ${item.cost_amount} 枚`;
      return `<article class="platform-panel"><h2>${safe(item.title)}</h2><p class="panel-sub">${safe(item.desc)}</p><strong>${cost}</strong><div class="growth-actions">${btn(lock ? '请先完成行动契约' : '记录兑换', 'store/buy', { item_id: item.id }, Boolean(lock))}</div>${lock ? `<p class="growth-small">当前契约：${safe(lock.name)}</p>` : ''}</article>`;
    }).join('')}</div>`;
  }
  function tasks() {
    const available = Math.max(0, state.caterpillar_today_done_count - 5 - state.daily_session.draws);
    return `<section class="platform-panel"><div class="growth-list-head"><div><h2>额外任务清单</h2><p class="panel-sub">今日完成 ${state.caterpillar_today_done_count} 个不同任务。第 6 项起，每个新任务可领取 5 积分。</p></div>${btn('添加任务', 'form-task')}</div>${state.caterpillar_list.map(t => `<label class="task-line ${t.done ? 'done' : ''}"><input type="checkbox" data-task="${safe(t.id)}" ${t.done ? 'checked' : ''}><span>${safe(t.text)}</span></label>`).join('') || empty('把学习之外的小事也记下来。')}<div class="growth-actions">${btn(`领取额外奖励（${available} 次）`, 'caterpillar/draw', {}, !available)}</div><p class="growth-small">同一任务当天仅计一次。重复勾选不会增加次数。</p></section>
      <section class="platform-panel"><div class="growth-list-head"><div><h2>项目与里程碑</h2><p class="panel-sub">考研成长里程碑自动联动；个人项目支持分阶段记录。</p></div>${btn('添加项目', 'form-project')}</div>${state.pbl_projects.map(p => `<article class="growth-list-card"><h3>${safe(p.title)}</h3><p class="growth-small">${safe(p.deliverable)}${p.deadline ? ` · 计划完成 ${safe(p.deadline)}` : ''}</p>${p.milestones.map(m => `<div class="growth-list-card"><div class="growth-list-head"><span>${m.status === 'completed' ? '✓' : '○'} ${safe(m.title)}</span><span class="growth-tag">${m.automatic ? '学习联动' : `首次完成 +${m.points}`}</span></div>${m.automatic ? `<p class="growth-small">${m.progress || 0} / ${m.target}</p>${progress(m.progress || 0, m.target)}` : `<div class="growth-actions">${btn(m.status === 'completed' ? '重新打开' : '标记完成', 'pbl/milestone/toggle', { project_id: p.id, milestone_id: m.id })}</div>`}</div>`).join('')}</article>`).join('')}</section>`;
  }
  function records() {
    return `<section class="platform-panel"><h2>收支与行动记录</h2><p class="panel-sub">学习奖励、手动收支、兑换和项目进度，统一记录在这里。</p><div class="growth-history">${state.history_logs.map(l => `<article><time>${safe(when(l.timestamp))}</time><p>${safe(l.desc)}</p></article>`).join('') || empty('还没有记录。完成一道练习题，记录就会自动出现。')}</div></section>`;
  }
  function help() { return '<section class="platform-panel growth-docs" id="growth-docs"><p class="platform-empty">正在加载使用说明…</p></section>'; }
  async function loadDocs() {
    try {
      const res = await fetch('/api/incentive/docs/content'); if (!res.ok) throw new Error();
      const { content: text } = await res.json(), box = document.getElementById('growth-docs'); if (!box) return;
      box.replaceChildren(); text.split('\n\n').forEach(part => { const h = /^#{1,2} /.test(part); const el = document.createElement(h ? 'h2' : 'p'); el.textContent = part.replace(/^#{1,2} /, ''); box.append(el); });
    } catch { const box = document.getElementById('growth-docs'); if (box) box.textContent = '说明暂时加载失败，请稍后重试。'; }
  }
  function openForm(title, html, action, convert = value => value) {
    dialog.innerHTML = `<h2>${title}</h2><form class="growth-form">${html}<div class="growth-actions"><button type="submit" class="platform-button">保存</button><button type="button" class="platform-button secondary" data-close>取消</button></div></form>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async e => { e.preventDefault(); const data = convert(Object.fromEntries(new FormData(e.target))); if (await mutate(action, data)) dialog.close(); };
    dialog.showModal();
  }
  const field = (title, name, type = 'text', value = '', extra = '') => `<label>${title}<input name="${name}" type="${type}" value="${safe(value)}" ${extra}></label>`;
  const currencies = () => config.currencies.map(c => `<option value="${c.id}">${safe(c.icon)} ${safe(c.name)}</option>`).join('');
  function forms(action, value) {
    if (action === 'form-goals') openForm('调整每日目标', `<div class="two">${overview.goals.map(g => field(names[g.key], g.key, 'number', g.target, 'min="1" max="500" required')).join('')}</div><p class="growth-small">修改目标不会清除今天已经完成的学习。目标按北京时间每天更新。</p>`, 'goals');
    if (action === 'form-contract') openForm('新建行动契约', `${field('契约名称', 'name', 'text', '', 'maxlength="120" required')}<label>品类<select name="category"><option value="books">书籍</option><option value="course">课程</option><option value="stationery">文具</option><option value="electronics">数码</option><option value="other">其他</option></select></label><div class="two">${field('目标数量', 'total_target', 'number', 20, 'min="1" max="10000" required')}${field('计量单位', 'unit', 'text', '次', 'maxlength="20" required')}</div><label>联动学科<select name="link_subject"><option value="">手动记录</option><option value="math">数学</option><option value="politics">政治</option><option value="english">英语</option></select></label><label>联动行为<select name="link_kind"><option value="answer">完成答题</option><option value="review">完成到期复习</option><option value="note">记录有效笔记</option><option value="exam">完成模考</option></select></label><label>说明<textarea name="notes" maxlength="1000" rows="2"></textarea></label>`, 'secondary_payment/add', d => ({ ...d, link_kind: d.link_subject ? d.link_kind : null }));
    if (action === 'form-progress') { const c = state.secondary_payments.find(c => c.id === value.id); openForm('更新契约进度', field(`已完成数量（目标 ${c.total_target} ${safe(c.unit)}）`, 'progress', 'number', c.current_progress, `min="0" max="${c.total_target}" required`), 'secondary_payment/update', d => ({ ...d, id: c.id })); }
    if (action === 'form-adjust') openForm('记录个人收支', `<label>账本<select name="type"><option value="points">积分</option>${config.currencies.map(c => `<option value="${c.id}">${safe(c.name)}代币</option>`).join('')}</select></label>${field('变动数值（收入为正，支出为负）', 'amount', 'number', 5, 'min="-100000" max="100000" required')}${field('事由', 'reason', 'text', '', 'maxlength="500" required')}`, 'points/adjust');
    if (action === 'form-adjust') dialog.querySelector('form').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (await mutate(d.type === 'points' ? 'points/adjust' : 'tokens/adjust', { amount: d.amount, reason: d.reason, currency_id: d.type })) dialog.close(); };
    if (action === 'form-loan') openForm('申请代币预支', `<label>币种<select name="currency_id">${currencies()}</select></label>${field('数量', 'amount', 'number', 1, 'min="1" max="100" required')}${field('用途', 'reason', 'text', '', 'maxlength="500" required')}<p class="growth-small">未来获得的同种代币会优先还款。可在记录中查看期限。</p>`, 'bank/loan');
    if (action === 'form-repay') { const l = state.loans.find(l => l.id === value.id); openForm('偿还代币', field(`偿还 ${safe(l.currency_name)}（剩余 ${l.remaining_amount}）`, 'amount', 'number', l.remaining_amount, `min="1" max="${l.remaining_amount}" required`), 'bank/loan/repay', d => ({ ...d, loan_id: l.id })); }
    if (action === 'form-deposit') openForm('新建积分存单', `<label>储蓄方案<select name="tier">${config.deposit_tiers.map((t, i) => `<option value="${i}">${t.amount} 分 · ${t.days} 天 · 每天 ${t.daily_interest} 分利息${t.token_reward ? ` · 到期知识点 ${t.token_reward} 枚` : ''}</option>`).join('')}</select></label><p class="growth-small">存入后积分暂时锁定。提前支取只返还本金。</p>`, 'bank/deposit', d => { const t = config.deposit_tiers[Number(d.tier)]; return { amount: t.amount, days: t.days }; });
    if (action === 'form-task') openForm('添加额外任务', field('任务内容', 'text', 'text', '', 'maxlength="200" required'), 'caterpillar/add');
    if (action === 'form-project') openForm('添加个人项目', `${field('项目名称', 'title', 'text', '', 'maxlength="120" required')}${field('计划完成日期', 'deadline', 'date')}<label>预期成果<textarea name="deliverable" maxlength="500" rows="3" required></textarea></label><p class="growth-small">包含明确目标、完成实践、整理输出三个里程碑，首次完成分别 +5 / +10 / +5 分。</p>`, 'pbl/add');
  }
  function renderChat() {
    const box = document.getElementById('growth-chat'); if (!box) return;
    chat.slice(-4).forEach(m => { const el = document.createElement('div'); el.className = 'chat-bubble' + (m.user ? ' user' : ''); el.textContent = m.text; box.append(el); });
  }
  content.addEventListener('click', async e => {
    const button = e.target.closest('[data-action]'); if (!button || pending) return;
    const action = button.dataset.action, data = JSON.parse(button.dataset.value || '{}');
    if (action.startsWith('form-')) return forms(action, data);
    if (['store/buy', 'bank/deposit/claim', 'session/end'].includes(action) && !confirm(action === 'bank/deposit/claim' ? '确认支取这张存单？未到期将不计利息。' : action === 'store/buy' ? '确认按所示消耗记录这项个人奖励？' : '确认结束本轮专注？今天的学习和积分将保留。')) return;
    await mutate(action, data);
  });
  content.addEventListener('change', async e => { if (e.target.dataset.task) await mutate('caterpillar/toggle', { id: e.target.dataset.task, done: e.target.checked }); });
  content.addEventListener('submit', async e => {
    if (e.target.id !== 'chat-form') return;
    e.preventDefault(); if (asking) return;
    const message = new FormData(e.target).get('message').trim(); if (imagePicker?.busy()) return;const imageIds=[...growthImages];if (!message && !imageIds.length) return;
    asking = true; chat.push({ user: true, text: message }); render();
    try {
      const res = await fetch('/api/incentive/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message:message || '请结合图片与实际记录进行复盘',imageIds }) });
      const value = await res.json(); if (!res.ok) throw new Error(value.error || '复盘失败');
      chat.push({ text: value.reply });
    } catch (e) { chat.push({ text: e.message + '，请稍后重试。' }); }
    finally { asking = false; render(); }
  });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.tab;window.studyPosition?.set('growth:tab',{tab:activeTab});document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === button)); render(); }));
  window.addEventListener('focus', () => { if (!dialog.open && !pending && !asking) load(); });
  setInterval(() => { if (!document.hidden && !dialog.open && !pending && !asking && !content.contains(document.activeElement)) load(); }, 30000);
  window.studyReady.then(()=>{const previous=window.studyPosition?.get('growth:tab')?.tab;if([...document.querySelectorAll('[data-tab]')].some(b=>b.dataset.tab===previous))activeTab=previous;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));load();});
})();
