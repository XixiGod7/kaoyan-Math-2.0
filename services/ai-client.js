const db = require('../db');
const endpoint = url => /\/chat\/completions\/?$/.test(url) ? url.replace(/\/$/, '') : `${url.replace(/\/+$/, '')}/chat/completions`;
function stripThinking(text) { return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trimStart(); }
async function complete(messages, { onDelta, config = db.getAiConfig() } = {}) {
  if (!config.apiKey) throw new Error('请在顶部 AI 设置中配置接口和密钥');
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
  const sense = new URL(config.baseUrl).hostname === 'token.sensenova.cn';
  const model = hasImages ? (config.visionModel || (sense ? 'sensenova-6.8-flash-lite' : config.model)) : config.model;
  const payload = { model, messages, temperature: 0.3, max_tokens: config.enableThinking ? 6000 : 4096, stream: Boolean(onDelta) };
  if (sense) payload.reasoning_effort = config.enableThinking ? 'medium' : 'none';
  const response = await fetch(endpoint(config.baseUrl), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`模型接口返回 HTTP ${response.status}；请检查密钥、额度和${hasImages ? '图片模型' : '模型'}设置`);
  let answer = '';
  if (onDelta && response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '', emitted = '';
    const line = input => {
      if (!input.startsWith('data:')) return;
      const data = input.slice(5).trim(); if (!data || data === '[DONE]') return;
      let chunk; try { chunk = JSON.parse(data); } catch { throw new Error('模型返回了无法读取的数据'); }
      if (chunk.error) throw new Error('模型输出中断，请重试');
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        answer += delta;
        const clean = stripThinking(answer);
        if (!/^<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/.test(clean) && clean.startsWith(emitted) && clean.length > emitted.length) { onDelta(clean.slice(emitted.length)); emitted = clean; }
      }
    };
    while (true) { const part = await reader.read(); if (part.done) break; pending += decoder.decode(part.value, { stream: true }); const lines = pending.split('\n'); pending = lines.pop(); for (const value of lines) line(value.trimEnd()); }
    pending += decoder.decode(); if (pending.trim()) line(pending.trimEnd());
  } else { const data = await response.json(); answer = data.choices?.[0]?.message?.content || ''; if (onDelta && stripThinking(answer)) onDelta(stripThinking(answer)); }
  answer = stripThinking(answer).trim(); if (!answer) throw new Error('模型没有返回正式答复，请重试或关闭深度推理'); return answer;
}
module.exports = { complete, endpoint, stripThinking };
