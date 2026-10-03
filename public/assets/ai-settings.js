(function () {
  'use strict';

  let modalEl = null;

  const presets = [
    { label: '商汤日日新 (SenseNova)', url: 'https://token.sensenova.cn/v1', model: 'deepseek-v4-flash' },
    { label: 'DeepSeek Chat (推荐)', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { label: 'DeepSeek 深度思考 (R1)', url: 'https://api.deepseek.com/v1', model: 'deepseek-reasoner' },
    { label: '阿里通义千问 (Qwen)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { label: 'Moonshot (Kimi)', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { label: 'OpenAI (GPT-4o-mini)', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
  ];

  function createModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'ai-modal-mask';
    modalEl.style.display = 'none';

    modalEl.innerHTML = `
      <div class="ai-modal" role="dialog" aria-modal="true">
        <div class="ai-modal-head">
          <div class="ai-modal-title">
            <span>🤖</span>
            <span>AI 答疑与追问 · 大模型 API 设置</span>
          </div>
          <button type="button" class="ai-modal-close" aria-label="关闭">&times;</button>
        </div>

        <div id="ai-status-banner" class="ai-status-banner builtin">
          <div>正在加载配置状态…</div>
        </div>

        <div class="ai-section-label">⚡ 常用大模型一键填入预设：</div>
        <div class="ai-presets" id="ai-preset-container"></div>

        <form id="ai-config-form" onsubmit="return false;">
          <div class="ai-form-group">
            <label class="ai-form-label" for="ai-input-url">接口地址 (Base URL)</label>
            <input id="ai-input-url" class="ai-form-input" placeholder="例如：https://api.deepseek.com/v1" autocomplete="off" />
          </div>

          <div class="ai-form-group">
            <label class="ai-form-label" for="ai-input-key">API Key (密钥)</label>
            <div class="ai-key-wrap">
              <input id="ai-input-key" type="password" class="ai-form-input" placeholder="sk-..." autocomplete="off" />
              <button type="button" id="ai-key-toggle-btn" class="ai-key-toggle">显示</button>
            </div>
            <div style="font-size:11.5px;color:var(--dim, #6b7280);margin-top:4px;">
              🔒 密钥保存在服务器，配置查询不会返回密钥。云端部署按当前浏览器身份隔离；清除 Cookie 后需重新设置。
            </div>
          </div>

          <div class="ai-form-group">
            <label class="ai-form-label" for="ai-input-model">模型名称 (Model)</label>
            <input id="ai-input-model" class="ai-form-input" placeholder="例如：deepseek-chat" autocomplete="off" />
          </div>

          <div class="ai-form-group" style="margin-top: 10px; background: rgba(59, 130, 246, 0.05); padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.15);">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text, #1f2937); margin: 0;">
              <input type="checkbox" id="ai-input-thinking" checked style="width: 16px; height: 16px; cursor: pointer;" />
              <span>输出 AI 深度思考过程（前端折叠显示，点击可展开）</span>
            </label>
            <div style="font-size:11.5px;color:var(--dim, #6b7280);margin-top:5px;padding-left:24px;line-height:1.4;">
              💡 提示：开启时，网页端将以精简折叠卡片展示思考过程，不干扰正文；关闭时，将直接输出极速纯净正式回答，速度提升 3 倍。
            </div>
          </div>

          <div id="ai-test-result" class="ai-test-result"></div>

          <div class="ai-modal-foot">
            <button type="button" id="ai-clear-btn" class="ai-btn-danger">清空密钥 (切回内置)</button>
            <button type="button" id="ai-test-btn" class="ai-btn-secondary">⚡ 测试连接</button>
            <button type="button" id="ai-save-btn" class="ai-btn-primary">💾 保存设置</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Render presets
    const presetContainer = modalEl.querySelector('#ai-preset-container');
    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-preset-chip';
      btn.textContent = p.label;
      btn.onclick = () => {
        modalEl.querySelector('#ai-input-url').value = p.url;
        modalEl.querySelector('#ai-input-model').value = p.model;
        showResult(`已填入 ${p.label} 的接口地址与模型名称，请在下方填入您的 API Key。`, 'ok');
      };
      presetContainer.appendChild(btn);
    });

    // Close buttons
    modalEl.querySelector('.ai-modal-close').onclick = closeModal;
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };

    // Toggle password visibility
    const keyInput = modalEl.querySelector('#ai-input-key');
    const toggleBtn = modalEl.querySelector('#ai-key-toggle-btn');
    toggleBtn.onclick = () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '隐藏';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '显示';
      }
    };

    // Test connection
    modalEl.querySelector('#ai-test-btn').onclick = async () => {
      const testBtn = modalEl.querySelector('#ai-test-btn');
      const url = modalEl.querySelector('#ai-input-url').value.trim();
      const key = modalEl.querySelector('#ai-input-key').value.trim();
      const model = modalEl.querySelector('#ai-input-model').value.trim();

      testBtn.disabled = true;
      testBtn.textContent = '测试中…';
      showResult('正在向大模型 API 发起测试握手请求…', 'ok');

      try {
        const res = await fetch('/api/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: url, apiKey: key, model: model })
        });
        const data = await res.json();
        if (data.ok) {
          showResult(`✅ ${data.message || '连接成功，模型响应正常！'}`, 'ok');
        } else {
          showResult(`❌ ${data.error || '连接失败，请检查密钥与地址'}`, 'err');
        }
      } catch (err) {
        showResult(`❌ 网络请求失败: ${err.message}`, 'err');
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = '⚡ 测试连接';
      }
    };

    // Save config
    modalEl.querySelector('#ai-save-btn').onclick = async () => {
      const saveBtn = modalEl.querySelector('#ai-save-btn');
      const url = modalEl.querySelector('#ai-input-url').value.trim();
      const key = modalEl.querySelector('#ai-input-key').value.trim();
      const model = modalEl.querySelector('#ai-input-model').value.trim();
      const enableThinking = modalEl.querySelector('#ai-input-thinking').checked;

      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';

      try {
        const res = await fetch('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: url, ...(key ? { apiKey: key } : {}), model: model, enableThinking: enableThinking })
        });
        const data = await res.json();
        if (data.ok) {
          showResult('✅ 配置已成功保存！当前「讲讲思路」与「追问」将立即使用新配置。', 'ok');
          loadConfig();
        } else {
          showResult('❌ ' + (data.error || '保存失败，稍后再试'), 'err');
        }
      } catch (err) {
        showResult(`❌ 保存失败: ${err.message}`, 'err');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 保存设置';
      }
    };

    // Clear key
    modalEl.querySelector('#ai-clear-btn').onclick = async () => {
      if (!confirm('确定清空 API Key 并切回系统内置的考研数学启发式导师引擎吗？')) return;
      modalEl.querySelector('#ai-input-key').value = '';
      try {
        await fetch('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: '' })
        });
        showResult('已清空密钥，已成功切回内置考研数学启发式导师引擎。', 'ok');
        loadConfig();
      } catch (err) {
        showResult('操作失败: ' + err.message, 'err');
      }
    };

    return modalEl;
  }

  function showResult(msg, type) {
    if (!modalEl) return;
    const resBox = modalEl.querySelector('#ai-test-result');
    resBox.textContent = msg;
    resBox.className = `ai-test-result ${type}`;
    resBox.style.display = 'block';
  }

  async function loadConfig() {
    if (!modalEl) return;
    const banner = modalEl.querySelector('#ai-status-banner');
    try {
      const res = await fetch('/api/ai/config');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      modalEl.querySelector('#ai-input-url').value = data.baseUrl || 'https://api.deepseek.com/v1';
      modalEl.querySelector('#ai-input-model').value = data.model || 'deepseek-chat';
      modalEl.querySelector('#ai-input-thinking').checked = data.enableThinking !== false;

      if (data.hasKey) {
        banner.className = 'ai-status-banner custom';
        banner.innerHTML = `
          <div>
            <b>🟢 当前状态：已启用自定义大模型 (${escapeHtml(data.model)})</b><br>
            所有「讲讲思路」与「追问」都将直连您配置的大模型进行深度解答。
          </div>
        `;
        if (!modalEl.querySelector('#ai-input-key').value) {
          modalEl.querySelector('#ai-input-key').placeholder = '已配置密钥（如需更改请输入新密钥）';
        }
      } else {
        banner.className = 'ai-status-banner builtin';
        banner.innerHTML = `
          <div>
            <b>🔵 当前状态：正在使用系统内置考研数学导师引擎（开箱即用）</b><br>
            如需接入 DeepSeek、通义千问、Kimi 等真实大模型，请在下方填入您的 API Key 并保存。
          </div>
        `;
        modalEl.querySelector('#ai-input-key').placeholder = 'sk-...';
      }
    } catch (e) {
      banner.className = 'ai-status-banner builtin';
      banner.innerHTML = `<div>无法读取当前配置状态，请检查网络。</div>`;
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function openModal() {
    const el = createModal();
    el.style.display = 'flex';
    const resBox = el.querySelector('#ai-test-result');
    if (resBox) resBox.style.display = 'none';
    loadConfig();
  }

  function closeModal() {
    if (modalEl) modalEl.style.display = 'none';
  }

  window.openAiSettings = openModal;
  window.addEventListener('open-ai-settings', openModal);

  // Keyboard shortcut: Escape to close
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && modalEl.style.display !== 'none') {
      closeModal();
    }
  });

  // Inject convenient triggers into the UI
  function injectTriggers() {
    // 1. In top navigation bar next to .um
    const um = document.querySelector('.um');
    if (um && !document.querySelector('.ai-cfg-nav-btn')) {
      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = 'ai-cfg-nav-btn';
      navBtn.title = '配置自定义大模型 API (DeepSeek / Qwen / OpenAI 等)';
      navBtn.innerHTML = `<span>⚙️</span><span>AI 设置</span>`;
      navBtn.onclick = openModal;
      um.parentNode.insertBefore(navBtn, um);
    }

    // 2. In /math/ask page sidebar or header
    const askSidebar = document.querySelector('.ask-sidebar');
    if (askSidebar && !askSidebar.querySelector('.ai-ask-cfg-btn')) {
      const askBtn = document.createElement('button');
      askBtn.type = 'button';
      askBtn.className = 'ai-ask-cfg-btn';
      askBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:10px;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--card-bg,#fff);color:var(--text,#374151);cursor:pointer;';
      askBtn.innerHTML = `<span>⚙️</span><span>大模型 API 设置</span>`;
      askBtn.onclick = openModal;
      askSidebar.appendChild(askBtn);
    }

    // 3. Inside .um-dropdown (User Menu)
    const dropdown = document.querySelector('.um-dropdown');
    if (dropdown && !dropdown.querySelector('.um-ai-cfg-item')) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'um-item um-ai-cfg-item';
      item.style.cssText = 'width:100%;text-align:left;background:none;border:none;cursor:pointer;';
      item.innerHTML = `<span>⚙️ AI 答疑 / API 设置</span><span class="um-tag">大模型</span>`;
      item.onclick = (e) => {
        e.stopPropagation();
        openModal();
      };
      const divider = dropdown.querySelector('.um-divider');
      if (divider) {
        dropdown.insertBefore(item, divider);
      } else {
        dropdown.appendChild(item);
      }
    }
  }

  // Observe DOM changes to maintain trigger buttons
  const observer = new MutationObserver(() => {
    injectTriggers();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectTriggers();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    injectTriggers();
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
