(() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  window.platformEscape = safe;
  function theme() {
    const selected = localStorage.getItem('mb_theme');
    const dark = selected === 'dark' || (!selected && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark',dark);
    document.documentElement.style.setProperty('--fs', String(Number(localStorage.getItem('mb_fontscale')) || 1));
    const font=document.getElementById('platform-font-reset');if(font)font.textContent=Math.round((Number(localStorage.getItem('mb_fontscale'))||1)*100)+'%';
    const btn = document.getElementById('platform-theme'); if (btn) btn.textContent = dark ? '浅色' : '深色';
  }
  theme();
  function toast(message) {
    let box = document.querySelector('.platform-toast'); if (box) box.remove();
    box = document.createElement('div'); box.className = 'platform-toast'; box.setAttribute('role', 'status'); box.textContent = message; document.body.append(box); setTimeout(() => box.remove(), 3300);
  }
  window.platformToast = toast;
  window.addEventListener('study:save-error',e=>toast(e.detail));window.addEventListener('study:reward',e=>{toast(`学习已记录 · +${e.detail} 积分`);refresh();});
  let refreshPending;
  async function refresh() {
    if(refreshPending)return refreshPending;
    refreshPending=(async()=>{
    try {
      const res = await fetch('/api/study/overview'); if (!res.ok) return;
      const data = await res.json(); window.platformOverview = data;
      const score = document.getElementById('platform-score'); if (score) score.textContent = `${data.points} 积分`;
      const profile = document.getElementById('platform-profile'); if (profile) profile.textContent = data.nickname || '研友';
      localStorage.setItem('mb_nickname', data.nickname || '研友');
      window.dispatchEvent(new CustomEvent('study:overview', { detail: data }));
    } catch {}
    })();try{return await refreshPending;}finally{refreshPending=null;}
  }
  window.refreshStudyOverview = refresh;
  function mount() {
    document.body.classList.toggle('math-body', location.pathname.startsWith('/math'));document.body.classList.toggle('english-body',location.pathname.startsWith('/english'));
    const entries = [['/', '学习总览'], ['/math', '数学'], ['/politics', '政治'], ['/english', '英语'], ['/growth', '成长打卡'], ['/library', '学习档案']];
    const header = document.createElement('header'); header.className = 'platform-header';
    header.innerHTML = `<a class="platform-brand" href="/"><i>题</i>真题库</a><nav aria-label="全站导航">${entries.map(([url, title]) => `<a href="${url}" class="${(url === '/' ? location.pathname === '/' : location.pathname.startsWith(url)) ? 'active' : ''}">${title}</a>`).join('')}</nav><div class="platform-tools"><a href="/growth" class="platform-score" id="platform-score">成长积分</a><button id="platform-ai">AI 设置</button><div class="platform-font" role="group" aria-label="全站阅读字号"><button id="platform-font-down" aria-label="缩小全站字号">A−</button><button id="platform-font-reset" aria-label="重置全站字号">100%</button><button id="platform-font-up" aria-label="放大全站字号">A+</button></div><button id="platform-export">学习进度</button><button id="platform-theme">深色</button><button id="platform-profile">研友</button></div>`;
    document.body.prepend(header);
    document.getElementById('platform-ai').onclick = () => window.dispatchEvent(new Event('open-ai-settings'));
    document.getElementById('platform-theme').onclick = () => { localStorage.setItem('mb_theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); theme(); window.dispatchEvent(new Event('study:theme')); };
    document.getElementById('platform-profile').onclick = profileDialog;
    const resize=delta=>{const current=Number(localStorage.getItem('mb_fontscale'))||1;const next=delta===0?1:Math.max(.9,Math.min(1.4,Math.round((current+delta)*10)/10));localStorage.setItem('mb_fontscale',String(next));theme();window.dispatchEvent(new Event('study:preferences'));};
    document.getElementById('platform-font-down').onclick=()=>resize(-.1);document.getElementById('platform-font-up').onclick=()=>resize(.1);document.getElementById('platform-font-reset').onclick=()=>resize(0);document.getElementById('platform-export').onclick=exportDialog;
    new ResizeObserver(()=>document.documentElement.style.setProperty('--platform-header-height',header.offsetHeight+'px')).observe(header);
    theme(); refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }

  async function exportDialog(){
    if(document.getElementById('platform-export-dialog'))return;
    const dialog=document.createElement('dialog');dialog.id='platform-export-dialog';dialog.className='platform-modal study-export-modal';
    dialog.innerHTML='<div class="study-export-heading"><div><small>YOUR STUDY, TOGETHER</small><h2>全站学习进度</h2></div><button type="button" class="study-modal-close" aria-label="关闭学习进度" data-close><span aria-hidden="true">×</span>关闭</button></div><p>数学、政治、英语与成长记录统一汇总。导出文件包含作答、笔记、收藏、复习、模考、英语草稿和成长账本，不包含 API 密钥或图片附件。</p><div class="export-subjects">正在读取学习进度…</div><div class="export-actions"><button data-export>导出全部学习进度</button><button class="secondary" data-legacy>导入旧英语备份</button></div><p role="status"></p>';
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();
    try{const r=await fetch('/api/study/overview');if(!r.ok)throw Error('进度读取失败');const v=await r.json();dialog.querySelector('.export-subjects').innerHTML=Object.entries(v.subjects).map(([key,item])=>'<article><strong>'+({math:'数学',politics:'政治',english:'英语'}[key]||safe(key))+'</strong><b>'+Number(item.answered||0)+'<small> 道已学</small></b><span>'+Number(item.notes||0)+' 篇笔记 · '+Number(item.due||0)+' 项待复习</span></article>').join('');}catch(e){dialog.querySelector('.export-subjects').textContent=e.message;}
    dialog.querySelector('[data-export]').onclick=async()=>{const button=dialog.querySelector('[data-export]');button.disabled=true;try{await window.beforeStudyExport?.();const a=document.createElement('a');a.href='/api/study/export?fontScale='+encodeURIComponent(localStorage.getItem('mb_fontscale')||'1')+'&theme='+encodeURIComponent(localStorage.getItem('mb_theme')||'system');a.download='yanzhuan-study.json';document.body.append(a);a.click();a.remove();dialog.querySelector('[role=status]').textContent='学习进度文件已生成，已开始下载。';}catch(e){dialog.querySelector('[role=status]').textContent=e.message;}finally{button.disabled=false;}};
    dialog.querySelector('[data-legacy]').onclick=()=>{dialog.close();if(location.pathname.startsWith('/english'))window.dispatchEvent(new Event('study:legacy-english-import'));else location.href='/english?import=1';};
  }
  window.addEventListener('study:export',exportDialog);

  function profileDialog() {
    const dialog = document.createElement('dialog'); dialog.className = 'platform-modal';
    dialog.innerHTML = `<h2>我的偏好</h2><form><label>研友昵称<input name="nickname" maxlength="30" value="${safe(localStorage.getItem('mb_nickname') || '研友')}" required></label><p>昵称和 AI 设置在各个模块共用。云端学习记录与当前浏览器身份关联。</p><button type="submit">保存</button><button type="button" id="profile-close">取消</button></form>`;
    document.body.append(dialog);
    dialog.querySelector('#profile-close').onclick = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const nickname = dialog.querySelector('[name=nickname]').value.trim();
      const res = await fetch('/api/me/nickname', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }) });
      if (!res.ok) return toast('昵称保存失败');

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
