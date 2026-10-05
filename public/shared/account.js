(() => {
  const safe=window.platformEscape;
  function dialog(title) {
    const el=document.createElement('dialog');el.className='platform-modal account-modal';
    el.innerHTML='<div class="account-heading"><h2>'+safe(title)+'</h2><button class="study-modal-close" aria-label="关闭账号窗口" data-close>× 关闭</button></div><div data-content></div><p class="account-status" role="status"></p>';
    el.querySelector('[data-close]').onclick=()=>el.close();el.addEventListener('close',()=>el.remove());document.body.append(el);el.showModal();return el;
  }
  async function accountDialog(mode='login') {
    await window.studyReady;
    const identity=window.studySync.identity,el=dialog(identity.authenticated&&!identity.expired?'我的账号':'登录真题库'),content=el.querySelector('[data-content]'),status=el.querySelector('[role=status]');
    if(identity.authenticated&&!identity.expired&&mode!=='password'){
      content.innerHTML='<p class="account-identity">'+safe(identity.username||'已登录账号')+'</p><p>学习记录同时保存在本机与云端。换一台设备登录即可继续学习。</p><div class="account-actions"><button data-password>修改密码</button><button class="secondary" data-backup>导出本地备份</button><button class="secondary" data-logout>退出账号</button></div>';
      content.querySelector('[data-backup]').onclick=()=>window.studySync.export();content.querySelector('[data-password]').onclick=()=>{el.close();accountDialog('password');};
      content.querySelector('[data-logout]').onclick=async()=>{try{await window.studySync.changeAccount('logout',{});location.reload();}catch(e){status.textContent=e.message;}};return;
    }
    const render=action=>{
      const register=action==='register',recover=action==='recover',password=action==='password';
      content.innerHTML=(password?'':'<div class="account-tabs" role="group" aria-label="账号操作"><button data-mode="login" class="'+(action==='login'?'active':'')+'">登录</button><button data-mode="register" class="'+(register?'active':'')+'">注册</button><button data-mode="recover" class="'+(recover?'active':'')+'">找回密码</button></div>')+
        '<form class="account-form">'+(password?'':'<label>用户名<input name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="3–32 个字母、汉字或数字"></label>')+
        (password?'<label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128"></label>':'')+
        (recover?'<label>恢复码<input name="recoveryCode" autocomplete="off" required placeholder="注册时保存的恢复码"></label>':'')+
        '<label>'+(recover||password?'新密码':'密码')+'<input name="password" type="password" autocomplete="'+(register||recover||password?'new-password':'current-password')+'" minlength="12" maxlength="128" required placeholder="至少 12 个字符"></label>'+
        (register||recover||password?'<label>确认密码<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>':'')+
        '<button type="submit">'+(register?'注册并合并学习记录':recover?'重置密码':password?'更新密码':'登录并继续学习')+'</button></form>';
      content.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{status.textContent='';render(button.dataset.mode);});
      content.querySelector('form').onsubmit=async event=>{
        event.preventDefault();const form=event.target,body=Object.fromEntries(new FormData(form).entries()),button=form.querySelector('[type=submit]');
        if(body.confirmPassword&&body.confirmPassword!==body.password){status.textContent='两次输入的密码不一致';return;}
        delete body.confirmPassword;button.disabled=true;status.textContent='正在安全保存账号信息…';
        try{const value=await window.studySync.changeAccount(action,body);if(value.recoveryCode){
          status.textContent=value.migrationWarning||'';content.innerHTML='<h3>请保存您的恢复码</h3><p>忘记密码时可用它找回账号。此码只显示一次；修改或重置密码后，旧恢复码会失效。</p><code class="recovery-code"></code><div class="account-actions"><button data-download>下载恢复码</button><button class="secondary" data-copy>复制</button></div><button class="account-continue" data-ready>已保存，开始学习</button>';
          content.querySelector('code').textContent=value.recoveryCode;
          content.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(value.recoveryCode);status.textContent='恢复码已复制';}catch{status.textContent='请选择上方恢复码并复制';}};
          content.querySelector('[data-download]').onclick=()=>{const url=URL.createObjectURL(new Blob(['真题库账号：'+value.username+'\n恢复码：'+value.recoveryCode+'\n请妥善保存，不要分享。'],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='真题库-恢复码.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
          content.querySelector('[data-ready]').onclick=()=>location.reload();el.querySelector('[data-close]').onclick=()=>location.reload();
          el.addEventListener('cancel',event=>{event.preventDefault();location.reload();});
        }else if(value.migrationWarning){status.textContent=value.migrationWarning;content.innerHTML='<p>账号已登录。未合并的资料仍保留，可以下次登录时重试。</p><button data-continue>继续学习</button>';content.querySelector('[data-continue]').onclick=()=>location.reload();el.querySelector('[data-close]').onclick=()=>location.reload();}else location.reload();}catch(e){status.textContent=e.message;button.disabled=false;}
      };
    };render(mode);
  }
  window.openStudyAccount=accountDialog;
  async function syncDialog(){
    await window.studyReady;const el=dialog('保存与同步'),content=el.querySelector('[data-content]');
    const render=()=>{const state=window.studySync.status;
      content.innerHTML='<p class="account-identity">'+(state.online?'本地与云端保存':'离线 · 本地记录已保留')+'</p><p>'+state.pending+' 项待同步'+(state.busy?'，正在同步…':'')+'</p><div class="account-actions"><button data-sync>立即同步</button><button class="secondary" data-export>导出本地备份</button></div><div class="sync-conflicts"></div>';
      content.querySelector('[data-sync]').onclick=()=>window.studySync.flush();content.querySelector('[data-export]').onclick=()=>window.studySync.export();
      for(const item of state.conflicts.slice(0,5)){const card=document.createElement('article');card.className='sync-conflict';
        card.innerHTML='<h3>需要处理的记录</h3><p data-error></p><label>本地内容<pre data-local></pre></label><label>云端内容<pre data-cloud></pre></label><div class="account-actions"><button data-local-use>使用本地版本</button><button class="secondary" data-cloud-use>保留云端版本</button></div>';
        card.querySelector('[data-error]').textContent=item.conflict?.error||item.error;card.querySelector('[data-local]').textContent=String(item.body.text??item.body.note??(item.conflict?.key?item.body.patch[item.conflict.key]:JSON.stringify(item.body))).slice(0,5000);card.querySelector('[data-cloud]').textContent=String(item.conflict?.cloud??'');
        card.querySelector('[data-local-use]').onclick=()=>window.studySync.resolve(item.id,true);card.querySelector('[data-cloud-use]').onclick=()=>window.studySync.resolve(item.id,false);content.querySelector('.sync-conflicts').append(card);
      }
    };render();window.addEventListener('study:sync',render);el.addEventListener('close',()=>window.removeEventListener('study:sync',render));
  }
  function mount(){
    const tools=document.querySelector('.platform-tools');if(!tools)return;
    const sync=document.createElement('button');sync.id='platform-sync';sync.onclick=syncDialog;sync.setAttribute('aria-label','保存与同步');
    const account=document.createElement('button');account.id='platform-account';account.textContent='账号';account.onclick=()=>accountDialog();tools.append(sync,account);
    function refresh(){const state=window.studySync?.status,identity=window.studySync?.identity;if(!state)return;sync.textContent=identity?.expired?'请重新登录':state.conflicts.length?'同步冲突':state.pending?'待同步 '+state.pending:state.online?'已同步':'离线保存';sync.classList.toggle('sync-warning',Boolean(state.pending||identity?.expired));account.textContent=identity?.username||'登录 / 注册';}
    window.addEventListener('study:sync',refresh);window.addEventListener('study:identity',refresh);window.studyReady.then(refresh).catch(()=>{sync.textContent='本地保存不可用';});
    const current=location.pathname.match(/^\/(math|politics|english|growth)(?:\/|$)/)?.[1];if(current){const nav=document.querySelector('.platform-header nav');const a=document.createElement('a');a.href='/'+current+'?home=1';a.className='platform-subject-home';a.textContent='科目首页';nav.append(a);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
