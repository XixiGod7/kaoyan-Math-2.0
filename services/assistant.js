const db = require('../db');
async function reply(system, content, fallback) {
  const config = db.getAiConfig();
  if (!config.apiKey) return { answer: fallback, mode: 'builtin' };
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, temperature: 0.4, max_tokens: 1200,
        messages: [{ role: 'system', content: system }, { role: 'user', content }] })
    });
    if (!response.ok) throw new Error(`模型接口返回 ${response.status}`);
    const result = await response.json();
    if (!result.choices?.[0]?.message?.content) throw new Error('模型没有返回有效回复');
    return { answer: result.choices[0].message.content, mode: 'ai' };
  } catch (error) {
    return { answer: `AI 暂时不可用：${error.name === 'TimeoutError' ? '请求超时' : '连接失败'}。\n\n${fallback}`, mode: 'fallback' };
  }
}
module.exports = { reply };
