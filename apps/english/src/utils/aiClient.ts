import {AiConfig} from '../types/ai';
const activeRequests=new Set<AbortController>();
const announce=()=>window.dispatchEvent(new CustomEvent('study:ai-active',{detail:activeRequests.size}));
window.addEventListener('study:cancel-ai',()=>{for(const controller of activeRequests)controller.abort();});
window.addEventListener('pagehide',()=>{for(const controller of activeRequests)controller.abort();});
export function stripAiThinking(raw:string){return raw.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/<think>[\s\S]*$/gi,'').trim();}
export async function sendChatCompletion(_config:AiConfig,messages:Array<{role:'system'|'user'|'assistant';content:string}>,onComplete?:(chunk:string,fullText:string)=>void,signal?:AbortSignal):Promise<string>{
  if(document.querySelector('.study-images[data-uploading]'))throw new Error('图片正在上传，请稍候再发送');
  const controller=new AbortController();activeRequests.add(controller);announce();
  try{
  const response=await fetch('/api/ai/chat',{signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:'english',messages,imageIds:window.studyImageIds || []})});
  const data=await response.json();if(!response.ok)throw new Error(data.error || 'AI 批阅失败');const answer=stripAiThinking(data.answer);if(onComplete)onComplete(answer,answer);return answer;
  }catch(e){if((e as Error).name==='AbortError')throw new Error('已取消 AI 请求，尚未生成批阅记录');throw e;}finally{activeRequests.delete(controller);announce();}
}
export async function gradeTranslationSentence(
  config: AiConfig,
  params: {
    year: string;
    qNum: number;
    sentenceEn: string;
    userTranslation: string;
    standardTranslation?: string;
  },
  onComplete?: (chunk: string, fullText: string) => void
): Promise<string> {
  const { year, qNum, sentenceEn, userTranslation, standardTranslation } = params;

  const systemPrompt = `你是一位熟悉考研英语学习要求的英语学习辅导老师兼英语语言学专家。
你的任务是参照考研英语练习的评分要点，对考生的「英译汉 (Section II Part C)」作答进行专业、严谨、具有高度启发性的诊断批阅。

【评分标准】
- 本题满分 2.0 分。按采分点分段给分，每处关键得分点 0.5 分。
- 译文要求“忠实原文、通顺地道”。主要扣分项包括：核心实词错译/漏译、长难句定语从句/状语从句语序颠倒生硬、被动语态未汉化、代词指代不清、严重直译死译等。
- 严格客观，切勿盲目奉承或打过高虚分。

【请严格按以下清晰的 Markdown 结构输出，包含各级标题与项目符号】：
### 🎯 预估得分：X.X / 2.0 分
> 简明一句话总评，点出译文最大优点与最致命问题。

### 🔍 核心采分点与难点拆解
逐一列出本句的 2-3 个核心语法/词汇考查点，并指出考生译文是否命中：
- **考点 1（核心词/短语）**：原文词汇 -> 准确含义 -> 考生处理情况（得分/失分分析）
- **考点 2（从句/语法结构）**：结构解析 -> 推荐翻译策略 -> 考生处理情况（得分/失分分析）

### ⚠️ 译文问题诊断与失分原因
指出考生译文中具体的不通顺、漏译、错译或“翻译腔”浓厚的字词，并给出原由。

### ✨ 信达雅高分润色译文
提供兼顾精准与优美文采的推荐高分译文，并提供词汇拓展与句型解析。

### 💡 考研点拨与备考锦囊
提炼出适用于考研长难句翻译的 1-2 条黄金法则。`;

  const userPrompt = `【真题信息】${year} 年考研英语一 第 (${qNum}) 题 英译汉
【原卷划线英文句子】
${sentenceEn}

【资料参考译文】
${standardTranslation || '（未提供官方参考，请依据标准学术规范评判）'}

【考生作答译文】
${userTranslation.trim() || '（考生未作答）'}

请根据以上作答，输出专业规范的批阅报告！`;

  return sendChatCompletion(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    onComplete
  );
}

/**
 * Grade Section III Writing (Part A 小作文 10分 或 Part B 大作文 20分)
 */
export async function gradeWritingEssay(
  config: AiConfig,
  params: {
    year: string;
    type: 'writing_clinical' | 'writing_essay';
    qid: number;
    directions?: string;
    userEssay: string;
    referenceEssay?: string;
  },
  onComplete?: (chunk: string, fullText: string) => void
): Promise<string> {
  const { year, type, qid, directions, userEssay, referenceEssay } = params;
  const isEssay = type === 'writing_essay';
  const totalScore = isEssay ? 20 : 10;
  const essayTitle = isEssay ? 'Section III Part B 大作文' : 'Section III Part A 小作文';

  const systemPrompt = `你是一位拥有多年考研英语一命题与阅卷经验的权威阅卷专家。
请严格按照《全国硕士研究生入学统一考试英语（一）考试大纲》写作评分细则对考生的作文进行全方位、专业深度批阅。

【考研英语一写作评分档次与原则】
${isEssay ? `
- 本题满分为 20 分（图画/图表短文写作，要求 160-200 词）。
- 档次划分：
  * 第五档 (17-20分)：很好地完成了试题规定的任务。包含所有要点，语言丰富流畅，语法词汇准确，论证严密，行文自然。
  * 第四档 (13-16分)：较好地完成了试题规定的任务。包含所有或绝大多数要点，句式较多样，有少许非系统性语言错误。
  * 第三档 (9-12分)：基本完成了试题规定的任务。包含大部分要点，语言错误稍多但能表达核心思想，有中式英语痕迹。
  * 第二档 (5-8分)：未能妥善完成试题规定的任务。漏掉重要要点，词不达意，语法错误较多且影响理解。
  * 第一档 (1-4分)：明显未完成试题规定的任务。字数严重不足或完全偏题，通篇语法词汇混乱。
` : `
- 本题满分为 10 分（应用文写作：信件/通知/便条，要求 100 词左右）。
- 档次划分：
  * 第五档 (9-10分)：格式完全规范，语气得体，涵盖全部要点，表达地道丰富，语法准确。
  * 第四档 (7-8分)：格式基本规范，涵盖绝大多数要点，有少量次要语言错误。
  * 第三档 (5-6分)：格式有欠缺，漏掉个别要点，语言表达生硬中式。
  * 第二档 (3-4分)：格式错误严重，要点遗漏较多，语言错误密集。
  * 第一档 (1-2分)：未完成规定任务，格式混乱，字数不足。
`}

【输出格式要求，严格按以下 Markdown 标题层级输出】：
### 🎯 预估得分：XX / ${totalScore} 分（属于第X档）
> 一句话总评：明确指出作文的最大亮点与核心提分瓶颈。

### 📊 四大核心阅卷维度详细诊断
- **1. 内容与要点涵盖 (Content & Task Fulfillment)**：是否完整回应题干要求，图画寓意阐述是否深刻/书信目的要点是否全面。
- **2. 篇章结构与逻辑衔接 (Organization & Cohesion)**：三段式布局、段落主题句、连接词 (Cohesive Devices) 使用情况。
- **3. 词汇多样性与语域 (Lexical Resource & Tone)**：用词准确度、高级考研词汇、近义替换、语域语气是否恰当。
- **4. 语法句式丰富度 (Grammatical Variety & Accuracy)**：长短句交替、强调句/从句/倒装句运用情况及错误率。

### 📝 逐句语法与病句精修 (Sentence-by-Sentence Diagnostics)
列举考生作文中 2-4 处最具代表性的语法、拼写或表达生硬的句子：
- **【原句】** ...
- **【病因诊断】** 明确指出语法病因（如主谓不一致、介词误用、中式思维直接拼凑）
- **【推荐修改】** 提供地道纯正的考研高分表达

### 🌟 考研满分级升华范文 (Polished Essay)
基于考生的核心立意与行文思路，润色重构出一篇 100% 符合考研高分标准的精美范文，便于考生对比诵读。

### 💎 提分亮点词汇与闪光句型积累
提炼 3-5 个本文涉及的黄金写作词汇/短语与万能亮眼句式。`;

  const wordCount = (userEssay.match(/[a-zA-Z0-9'-]+/g) || []).length;

  const userPrompt = `【真题试卷】${year} 年考研英语一 第 (${qid}) 题 · ${essayTitle}
【题目要求与说明】
${directions || '请参考历年真题标准写作题目要求'}

【官方参考范文】
${referenceEssay || '（官方参考范文见题库原卷）'}

【考生作答（字数统计：约 ${wordCount} 词）】
${userEssay.trim() || '（考生未作答）'}

请对以上作文进行深度专业批阅！`;

  return sendChatCompletion(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    onComplete
  );
}

/**
 * Helper to extract predicted numeric score from AI markdown response if present
 */
export function extractScoreFromMarkdown(markdown: string, maxScore: number): number | undefined {
  const match = markdown.match(/预估得分[：:]\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*[0-9]+/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 0 && val <= maxScore) {
      return val;
    }
  }
  return undefined;
}
