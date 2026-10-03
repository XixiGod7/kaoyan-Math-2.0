const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('data/ai_config.json', 'utf-8'));
const list = JSON.parse(fs.readFileSync('public/api/real/all_questions.json', 'utf-8'));
const q = list.find(x => x.id === 14);

const systemPrompt = `你是一位专业且富有耐心的考研数学辅导名师。
【重要教学准则】：
1. 学生当前正在钻研这道考研数学真题。题目的完整信息已全部在下方明确提供。
2. 学生的提问严格针对这道具体真题。你必须结合本题的具体函数表达式、积分区间、已知条件进行深度剖析，严禁声称“没看到题目”或向学生索要题干！
3. 请将思考重点集中在启发式引导与通法归纳上，思考过程保持简练，把最详实的内容留在正式解答中。
4. 所有数学公式必须使用 LaTeX 格式（行内用 $...$，行间用 $$...$$）。`;

const userMsg = `【当前正在钻研的考研数学真题】
- 来源：${q.year}年 ${q.papers.join('/')} 第${q.index}题 (${q.type})
- 题干：${q.stem}
- 核心考点：${q.kps.map(k => k.kp || k.chapter).join('、')}
- 核心破题招法：${q.methods.join('、')}

【学生向你提问】：这类题型有什么通法？`;

async function test() {
  console.log('Sending request to SenseNova...');
  const res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      stream: true,
      max_tokens: 3500
    })
  });

  console.log('Fetch status:', res.status);
  if (!res.ok) {
    console.log('Error text:', await res.text());
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let thinking = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const dataStr = line.replace(/^data:\s*/, '').trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const d = parsed.choices?.[0]?.delta;
        if (d?.reasoning_content) {
          thinking += d.reasoning_content;
          process.stdout.write('.');
        }
        if (d?.content) {
          content += d.content;
          process.stdout.write('*');
        }
      } catch (e) {}
    }
  }

  console.log('\n\n--- THINKING PREVIEW --- (' + thinking.length + ' chars)');
  console.log(thinking.slice(0, 300) + '...');
  console.log('\n--- CONTENT PREVIEW --- (' + content.length + ' chars)');
  console.log(content.slice(0, 500) + '...');
}

test();
