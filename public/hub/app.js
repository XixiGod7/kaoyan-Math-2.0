(() => {
  const safe = window.platformEscape;
  const names = { math: '数学练习', politics: '政治练习', reviews: '到期复习', notes: '学习笔记', answer: '完成答题', review: '完成复习', note: '记录笔记', exam: '完成模考' };
  function render(data) {
    const math = data.subjects.math, pol = data.subjects.politics;
    document.getElementById('hub-date').textContent = `${data.date} · 北京时间`;
    const metrics = [['成长积分', data.points, `今日学习 +${data.today.earned} 分`], ['今日练习', data.today.math + data.today.politics, `数学 ${data.today.math} · 政治 ${data.today.politics}`], ['待复习', math.due + pol.due, `数学 ${math.due} · 政治 ${pol.due}`], ['连续学习', data.streak + ' 天', '每天一小步，积成大进步']];
    document.getElementById('hub-metrics').innerHTML = metrics.map(([title, value, sub]) => `<div class="hub-metric"><span>${title}</span><strong>${value}</strong><em>${sub}</em></div>`).join('');
    document.getElementById('hub-math-count').textContent = `已学 ${math.answered} 题 · 收藏 ${math.favorites} 题 · 笔记 ${math.notes} 篇`;
    document.getElementById('hub-politics-count').textContent = `已学 ${pol.total} 题 · 收藏 ${pol.favorites} 题 · 错题 ${pol.wrong} 题`;
    document.getElementById('hub-goals').innerHTML = data.goals.map(g => `<div class="goal-row"><span>${names[g.key]}</span><div class="goal-track"><i style="width:${Math.min(100, g.value / g.target * 100)}%"></i></div><span>${g.value} / ${g.target}</span></div>`).join('');
    document.getElementById('hub-recent').innerHTML = data.recent.slice(0, 5).map(e => `<a class="study-item" href="${safe(e.href)}"><span>${e.subject === 'math' ? '数学' : '政治'} · ${names[e.kind]}</span><span>+${e.points} 分</span></a>`).join('') || '<p class="platform-empty">今天的积累，从第一道题开始。<br>完成练习后回来，看看自己的进步。</p>';
  }
  window.addEventListener('study:overview', e => render(e.detail));
  if (window.platformOverview) render(window.platformOverview);
  setTimeout(() => { if (!window.platformOverview) document.getElementById('hub-goals').textContent = '学习记录暂时加载失败，请稍后刷新重试。'; }, 12000);
})();
