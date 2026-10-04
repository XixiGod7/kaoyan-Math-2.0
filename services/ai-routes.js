const db = require('../db');
const images = require('./images');
const ai = require('./ai-client');
function mount(app) {
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, imageIds = [], subject = 'math' } = req.body;
      if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.some(m => !['user','assistant','system'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 20000)) return res.status(400).json({error:'对话内容无效'});
      if (!['math','politics','english','growth'].includes(subject)) return res.status(400).json({error:'学科无效'});
      const input = messages.map(m => ({role:m.role,content:m.content}));
      const last = input.findLast(m => m.role === 'user'); if (!last) return res.status(400).json({error:'请输入问题'});
      last.content = images.content(last.content,imageIds);
      input.unshift({role:'system',content:'提供学习辅导。图片看不清请说明，不得捏造识别结果。作文和翻译评分只是 AI 建议；不得声称代表官方阅卷员。不要返回隐藏思考过程。'});
      res.json({answer:await ai.complete(input),mode:'ai'});
    } catch (e) { res.status(e.status || (db.getAiConfig().apiKey ? 502 : 400)).json({error:e.name === 'TimeoutError' ? 'AI 请求超时，请重试' : e.message}); }
  });
  app.post('/api/custom/explain', async (req, res) => {
    try { const value = await require('./assistant').reply('你是数学学习助手。提供考点、思路和自查方法。', JSON.stringify(req.body), '先梳理已知条件，再按考点选择方法。', req.body.imageIds); res.json({explanation:value.answer,analysis:value.answer,mode:value.mode}); }
    catch(e) { res.status(e.status || 400).json({error:e.message}); }
  });
}
module.exports = { mount };
