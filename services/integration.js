const db = require('../db');
const growth = require('./growth');
const politics = require('./politics');
function mount(app) {
  politics.mount(app);
  require('./english').mount(app);
  app.get('/api/incentive/state', (req, res) => {
    const state = growth.getState(), cfg = db.getAiConfig();
    res.json({ state, overview: growth.overview(state), config: { ...growth.defaults, ai_config: { endpoint: `${cfg.baseUrl}/chat/completions`, model: cfg.model, temperature: cfg.temperature, hasKey: Boolean(cfg.apiKey) } } });
  });
  app.get('/api/study/overview', async (req, res) => {
    const math = Object.values(db.getProgress().answered || {}), pol = politics.stats();
    const counts = { math: { answered: math.length, correct: math.filter(a => a.correct).length, favorites: db.getFavorites().length, notes: Object.keys(db.getNotes()).length,
      wrong: db.getWrongBook().filter(q => !q.mastered).length, due: db.getReviewCards().filter(c => !c.nextDue || c.nextDue <= Date.now()).length }, politics: pol, english: require('./english').stats() };
    res.json({ ...growth.overview(), subjects: counts, nickname: db.getProfile().nickname });
  });
  const actions = ['goals', 'session/start', 'session/end', 'session/cooling', 'points/adjust', 'tokens/adjust',
    'bank/loan', 'bank/loan/repay', 'bank/deposit', 'bank/deposit/claim', 'secondary_payment/add', 'secondary_payment/update',
    'store/buy', 'caterpillar/add', 'caterpillar/toggle', 'caterpillar/draw', 'pbl/add', 'pbl/milestone/toggle'];
  for (const action of actions) app.post('/api/incentive/' + action, (req, res) => {
    try {
      const key = req.get('Idempotency-Key');
      if (key && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error('请求标识无效');
      res.json(growth.mutate(action, req.body || {}, key));
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });
  app.post('/api/incentive/chat', async (req, res) => {
    try {
    if (typeof req.body.message !== 'string' || !req.body.message.trim() || req.body.message.length > 4000) return res.status(400).json({ error: '请输入有效汇报' });
    const state = growth.getState(), summary = growth.overview(state);
    const value = await require('./assistant').reply('你是温和务实的学习激励助手。根据实际学习记录复盘并建议下一步。积分只由后端规则核发，你不能修改积分、声称已经记账、生成操作指令或杜撰用户完成的成果。线下任务请建议用户明确记录并手动结算；疲劳时建议休息。',
      `今日记录：${JSON.stringify(summary.today)}\n目标：${JSON.stringify(summary.goals)}\n当前积分：${state.points}\n休息状态：${summary.cooling}\n用户汇报：${req.body.message}`,
      `【基于实际记录的复盘】\n今天已完成数学 ${summary.today.math} 题、政治 ${summary.today.politics} 题、英语 ${summary.today.english} 题、复习 ${summary.today.reviews} 次、笔记 ${summary.today.notes} 篇、模考 ${summary.today.exams} 套。学习联动已获得 ${summary.today.earned} 积分。\n\n${summary.cooling ? '目前处于休息保护期，先恢复精力。' : '选一个尚未达成的目标，从一小步开始；完成后回到这里查看积累。'}\n线下任务可以通过任务清单记录，积分可在「微调收支」中手动结算。`, req.body.imageIds || []);
    res.json({ reply: value.answer, mode: value.mode, action: null, state });
    } catch(e) {res.status(e.status || 400).json({error:e.message});}
  });
  app.get('/api/incentive/docs/list', (req, res) => res.json({ files: ['INTEGRATION.md'], docs: [{ file: 'INTEGRATION.md', title: '学习与成长', desc: '联动规则与功能说明' }] }));
  app.get('/api/incentive/docs/content', (req, res) => res.json({ content: '# 学习与成长\n\n数学、政治与英语使用同一浏览器访客身份，收藏、笔记与复习各自按学科保存。顶部统一 AI 设置适用于数学答疑、政治答疑和成长复盘。\n\n## 学习联动\n完成不同题目 +2，完成到期复习 +3，有效笔记（至少 10 字）+2，完整交卷 +20。同一天、同一学科、同一题目或试卷只计一次。模考不同时领取逐题积分，空白交卷不领取完成奖励。所有日期按北京时间计算。\n\n## 目标与打卡\n每日数学、政治、英语、复习和笔记目标均可调整。开始或重新开始打卡不会重置今日积累，结账后仍保留学习统计。成长里程碑随学习记录自动推进，行动契约可选择与学科练习联动。\n\n## 原系统功能\n保留六类代币、手动收支、行动契约、虚拟奖励兑换、代币预支/还款、积分存单、任务清单与项目里程碑。每个额外任务只提供一次奖励机会。所有收支都是个人虚拟奖励账本，不涉及实际付款。\n\n## 数据与 AI\n新云端访客从空账本开始，未上传原应用的个人记录或密钥。云端按浏览器 Cookie 隔离，清除 Cookie 后身份改变。AI 提供复盘建议，实际积分通过已完成的学习记录和手动结算写入，不自动执行 AI 文本里的记账指令。\n\n## 题库说明\n政治数据包含生成和整理题目，参考答案不代表独立核验的官方真题。数学完整标准答案库仍未补齐，未知答案不自动判分。' }));
}
module.exports = { mount };
