(() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  window.platformEscape = safe;
  function theme() {
    const selected = localStorage.getItem('mb_theme');
    const dark = selected === 'dark' || (!selected && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--fs', String(Number(localStorage.getItem('mb_fontscale')) || 1));
    const btn = document.getElementById('platform-theme'); if (btn) btn.textContent = dark ? '浅色' : '深色';
  }
  theme();
  function toast(message) {
    let box = document.querySelector('.platform-toast'); if (box) box.remove();
    box = document.createElement('div'); box.className = 'platform-toast'; box.setAttribute('role', 'status'); box.textContent = message; document.body.append(box); setTimeout(() => box.remove(), 3300);
  }
  window.platformToast = toast;
  async function refresh() {
    try {
      const res = await fetch('/api/study/overview'); if (!res.ok) return;
      const data = await res.json(); window.platformOverview = data;
      const score = document.getElementById('platform-score'); if (score) score.textContent = `${data.points} 积分`;
      const profile = document.getElementById('platform-profile'); if (profile) profile.textContent = data.nickname || '研友';
      localStorage.setItem('mb_nickname', data.nickname || '研友');
      window.dispatchEvent(new CustomEvent('study:overview', { detail: data }));
    } catch {}
  }
  window.refreshStudyOverview = refresh;
  function mount() {
    document.body.classList.toggle('math-body', location.pathname.startsWith('/math'));
    const entries = [['/', '学习总览'], ['/math', '数学'], ['/politics', '政治'], ['/growth', '成长打卡'], ['/library', '学习档案']];
    const header = document.createElement('header'); header.className = 'platform-header';
    header.innerHTML = `<a class="platform-brand" href="/"><i>研</i>研砖</a><nav aria-label="全站导航">${entries.map(([url, title]) => `<a href="${url}" class="${(url === '/' ? location.pathname === '/' : location.pathname.startsWith(url)) ? 'active' : ''}">${title}</a>`).join('')}</nav><div class="platform-tools"><a href="/growth" class="platform-score" id="platform-score">成长积分</a><button id="platform-ai">AI 设置</button><button id="platform-theme">深色</button><button id="platform-profile">研友</button></div>`;
    document.body.prepend(header);
    document.getElementById('platform-ai').onclick = () => window.dispatchEvent(new Event('open-ai-settings'));
    document.getElementById('platform-theme').onclick = () => { localStorage.setItem('mb_theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); theme(); window.dispatchEvent(new Event('study:theme')); };
    document.getElementById('platform-profile').onclick = profileDialog;
    theme(); refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  }
  function profileDialog() {
    const dialog = document.createElement('dialog'); dialog.className = 'platform-modal';
    dialog.innerHTML = `<h2>我的偏好</h2><form><label>研友昵称<input name="nickname" maxlength="30" value="${safe(localStorage.getItem('mb_nickname') || '研友')}" required></label><label>阅读字号<select name="font"><option value="1">标准</option><option value="1.12">大</option><option value="1.25">更大</option><option value="1.4">特大</option></select></label><p>昵称和 AI 设置在三个模块共用。云端学习记录与当前浏览器身份关联。</p><button type="submit">保存</button><button type="button" id="profile-close">取消</button></form>`;
    document.body.append(dialog); dialog.querySelector('[name=font]').value = localStorage.getItem('mb_fontscale') || '1';
    dialog.querySelector('#profile-close').onclick = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const nickname = dialog.querySelector('[name=nickname]').value.trim();
      const res = await fetch('/api/me/nickname', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }) });
      if (!res.ok) return toast('昵称保存失败');
      localStorage.setItem('mb_fontscale', dialog.querySelector('[name=font]').value); theme();
      dialog.close(); dialog.remove(); refresh(); toast('偏好已保存');
    };
    dialog.showModal();
  }
  window.addEventListener('study:update', refresh); window.addEventListener('focus', refresh);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
  // Observe only successful study writes; do not change request bodies or grading.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await originalFetch(...args), url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '', method = args[1]?.method || 'GET';
    if (res.ok && method !== 'GET' && /^\/api\/(?:answer$|math\/grade$|note(?:\/append)?$|review\/answer$|exam-papers\/.*\/submit$|politics\/(?:answer|note|review|papers\/.*\/submit)$)/.test(url)) {
      res.clone().json().then(data => { if (data.reward?.credited) toast(`学习已记录 · +${data.reward.points} 积分`); refresh(); }).catch(() => {});
    }
    return res;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
