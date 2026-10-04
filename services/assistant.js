const db = require('../db');
async function reply(system, text, fallback, imageIds = []) {
  const content = require('./images').content(text, imageIds);
  const config = db.getAiConfig();
  if (!config.apiKey) return { answer: imageIds?.length ? '图片已保存。请在顶部 AI 设置中配置支持图片的模型后再次发送；当前尚未识别图片内容。' : fallback, mode: 'builtin' };
  try {
    return { answer: await require('./ai-client').complete([{ role: 'system', content: system }, { role: 'user', content }]), mode: 'ai' };
  } catch (error) {
    return { answer: `AI 暂时不可用：${error.name === 'TimeoutError' ? '请求超时' : error.message}。\n\n${imageIds?.length ? '图片尚未完成识别，请重试。' : fallback}`, mode: 'fallback' };
  }
}
module.exports = { reply };
