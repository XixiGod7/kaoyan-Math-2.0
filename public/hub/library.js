(() => {
  let kind = 'notes', page = 0, generation = 0;
  const safe = window.platformEscape, content = document.getElementById('library-content'), status = document.getElementById('library-status'), pager = document.getElementById('library-pages');
  const fetchJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error('档案加载失败，请稍后重试'); return r.json(); };
  async function load() {
    window.studyPosition?.set('library:page',{kind,page});
    const version = ++generation; status.textContent = '正在加载学习档案…'; content.replaceChildren(); pager.replaceChildren();
    const mathURLs = { notes: '/api/notes', favorites: '/api/favorites', review: '/api/review/today', wrong: '/api/wrong-book' };
    try {
      const [m, p, en] = await Promise.all([fetchJSON(mathURLs[kind]), fetchJSON(`/api/politics/${kind}?page=${page}&limit=20`),fetchJSON(`/api/english/library?kind=${kind}&page=${page}`)]);
      if (version !== generation) return;
      const allMath = kind === 'notes' ? m.notes.filter(n => n.text).map(n => ({ id: n.questionId, text: n.text })) : kind === 'favorites' ? m.ids.map(id => ({ id })) : kind === 'review' ? m.due : m.items || m.list || (Array.isArray(m) ? m : []);
      const math = allMath.slice(page * 20, (page + 1) * 20);
      const cards = [...math.map(n => ({ subject: '数学', id: n.id ?? n.questionId, text: n.text || '', title: `数学题 #${n.id ?? n.questionId}`, href: `/math/q/${n.id ?? n.questionId}` })), ...p.items.map(n => ({ subject: '政治', text: kind === 'notes' ? n.userNote : '', title: n.stem, href: '/politics/practice/' + n.chapterCode })),...en.items.map(n=>({...n,subject:'英语'}))];
      status.textContent = cards.length ? `共 ${allMath.length + p.total + en.total} 项 · 第 ${page + 1} 页` : '这里还没有记录。去完成一道练习，收藏重点或写下自己的思考。';
      content.innerHTML = cards.map(n => `<article class="library-note"><small>${n.subject} · ${{ notes: '笔记', favorites: '收藏', review: '复习', wrong: '错题' }[kind]}</small><h3 style="font-size:15px;line-height:1.8;font-weight:600">${safe(n.title)}</h3>${n.text ? `<p>${safe(n.text)}</p>` : ''}<a href="${safe(n.href)}">回到题目 →</a></article>`).join('');
      const pages = Math.ceil(Math.max(allMath.length, p.total, en.total) / 20);
      if (pages > 1) { for (const [label, target, disabled] of [['上一页', page - 1, page === 0], ['下一页', page + 1, page + 1 >= pages]]) { const b = document.createElement('button'); b.className = 'platform-button secondary'; b.textContent = label; b.disabled = disabled; b.onclick = () => { page = target; load(); }; pager.append(b); } }
    } catch (e) { if (version === generation) status.textContent = e.message; }
  }
  document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; page = 0; document.querySelectorAll('[data-kind]').forEach(el => el.classList.toggle('active', el === b)); load(); });
  window.studyReady.then(()=>{const previous=window.studyPosition?.get('library:page');if(previous&&['notes','favorites','review','wrong'].includes(previous.kind)){kind=previous.kind;page=Number(previous.page)||0;document.querySelectorAll('[data-kind]').forEach(el=>el.classList.toggle('active',el.dataset.kind===kind));}load();});
})();
