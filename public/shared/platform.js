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
    const cancelAI=document.createElement('button');cancelAI.hidden=true;cancelAI.textContent='取消 AI';cancelAI.onclick=()=>window.dispatchEvent(new Event('study:cancel-ai'));document.getElementById('platform-ai').after(cancelAI);window.addEventListener('study:ai-active',event=>{cancelAI.hidden=!event.detail;});
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
    dialog.innerHTML='<div class="study-export-heading"><div><small>YOUR STUDY, TOGETHER</small><h2>全站学习进度</h2></div><button type="button" class="study-modal-close" aria-label="关闭学习进度" data-close><span aria-hidden="true">×</span>关闭</button></div><p>数学、政治、英语与成长记录统一汇总。导出文件包含作答、笔记、收藏、复习、模考、英语草稿和成长账本，不包含 API 密钥或图片附件。</p><div class="export-subjects">正在读取学习进度…</div><div class="export-actions"><button data-export>导出全部学习进度</button><button class="secondary" data-restore>恢复学习备份</button><input hidden type="file" accept="application/json,.json" data-restore-file><select data-restore-mode aria-label="备份恢复方式"><option value="merge">合并已有资料</option><option value="replace">替换备份内的资料</option></select><button hidden data-apply>确认合并恢复</button><button class="secondary" data-legacy>导入旧英语备份</button></div><p role="status"></p><details class="study-storage"><summary>管理学习存储</summary><p>先导出并保存备份，再选择需要清理的资料。清理会同步到当前账号的其他设备。</p><select data-cleanup-name aria-label="要清理的资料"></select><label><input type="checkbox" data-cleanup-confirm> 我已保存备份，确认删除选中的资料</label><button class="secondary" data-cleanup disabled>清理选中资料</button></details>';
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();
    try{const r=await fetch('/api/study/overview');if(!r.ok)throw Error('进度读取失败');const v=await r.json();dialog.querySelector('.export-subjects').innerHTML=Object.entries(v.subjects).map(([key,item])=>'<article><strong>'+({math:'数学',politics:'政治',english:'英语'}[key]||safe(key))+'</strong><b>'+Number(item.answered||0)+'<small> 道已学</small></b><span>'+Number(item.notes||0)+' 篇笔记 · '+Number(item.due||0)+' 项待复习</span></article>').join('');}catch(e){dialog.querySelector('.export-subjects').textContent=e.message;}
    dialog.querySelector('[data-export]').onclick=async()=>{const button=dialog.querySelector('[data-export]');button.disabled=true;try{await window.beforeStudyExport?.();const a=document.createElement('a');a.href='/api/study/export?fontScale='+encodeURIComponent(localStorage.getItem('mb_fontscale')||'1')+'&theme='+encodeURIComponent(localStorage.getItem('mb_theme')||'system');a.download='yanzhuan-study.json';document.body.append(a);a.click();a.remove();dialog.querySelector('[role=status]').textContent='学习进度文件已生成，已开始下载。';}catch(e){dialog.querySelector('[role=status]').textContent=e.message;}finally{button.disabled=false;}};
    let restoreValue,previewValue;const mode=dialog.querySelector('[data-restore-mode]');const status=dialog.querySelector('[role=status]'),fileInput=dialog.querySelector('[data-restore-file]'),apply=dialog.querySelector('[data-apply]');dialog.querySelector('[data-restore]').onclick=()=>fileInput.click();
    fileInput.onchange=async()=>{try{const file=fileInput.files[0];if(!file||file.size>25*1024*1024)throw Error('备份需小于 25 MB');restoreValue=JSON.parse(await file.text());const r=await fetch('/api/study/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({backup:restoreValue,mode:mode.value,preview:true})});previewValue=await r.json();if(!r.ok)throw Error(previewValue.error);status.textContent='已验证 '+previewValue.items.length+' 类学习资料，共 '+previewValue.items.reduce((n,i)=>n+i.entries,0)+' 项。'+(mode.value==='replace'?'确认后会替换备份内的资料，请先导出当前记录。':'将合并已有资料。')+'备份中的待同步操作不会跨身份重放。';apply.textContent=mode.value==='replace'?'确认替换这些资料':'确认合并恢复';apply.hidden=false;}catch(e){apply.hidden=true;status.textContent=e.message;}finally{fileInput.value='';}};
    mode.onchange=()=>{apply.hidden=true;status.textContent='恢复方式已变化，请重新选择备份以预览。';};apply.onclick=async()=>{apply.disabled=true;try{const r=await fetch('/api/study/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({backup:restoreValue,mode:mode.value,preview:false,confirmation:previewValue.confirmation,revision:previewValue.revision})});const value=await r.json();if(!r.ok)throw Error(value.error);if(value.preferences){localStorage.setItem('mb_fontscale',String(value.preferences.fontScale));if(value.preferences.theme==='system')localStorage.removeItem('mb_theme');else localStorage.setItem('mb_theme',value.preferences.theme);}location.reload();}catch(e){status.textContent=e.message;apply.disabled=false;}};
    const labels={user_wrong_book:'数学错题本',user_favorites:'数学收藏',user_notes:'数学笔记',user_review:'数学复习',user_progress:'数学学习记录',user_exam_papers:'数学自建试卷',user_paper_attempts:'数学模考记录',politics_state:'政治学习记录',english_state:'英语学习联动记录',english_storage:'英语词汇、草稿和练习记录',growth_state:'成长账本',favorite_tags:'收藏标签',favorite_stars:'收藏星级',exam_drafts:'数学草稿',study_positions:'浏览位置'};
    const cleanupName=dialog.querySelector('[data-cleanup-name]'),cleanup=dialog.querySelector('[data-cleanup]'),confirm=dialog.querySelector('[data-cleanup-confirm]');
    cleanupName.innerHTML=Object.entries(labels).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');
    let exported=false;const exportButton=dialog.querySelector('[data-export]'),exportAction=exportButton.onclick;
    exportButton.onclick=async()=>{await exportAction();exported=status.textContent.includes('已开始下载');cleanup.disabled=!exported||!confirm.checked;};
    confirm.onchange=()=>{cleanup.disabled=!exported||!confirm.checked;if(!exported&&confirm.checked)status.textContent='请先导出并保存全部学习进度。';};
    cleanupName.onchange=()=>{confirm.checked=false;cleanup.disabled=true;};
    cleanup.onclick=async()=>{if(!exported||!confirm.checked)return;cleanup.disabled=true;try{const response=await fetch('/api/study/cleanup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:cleanupName.value,confirmation:'已导出并清理'})});const value=await response.json();if(!response.ok)throw Error(value.error);location.reload();}catch(e){status.textContent=e.message;cleanup.disabled=false;}};
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
  window.addEventListener('study:write',event=>{const data=event.detail;if(data.reward?.credited)toast('学习已记录 · +'+data.reward.points+' 积分');refresh();});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
