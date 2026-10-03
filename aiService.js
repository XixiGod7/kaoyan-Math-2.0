const db = require('./db');
const { getSolutionForQuestion } = require('./solutionEngine');

// In-memory question lookup map
let allQuestionsMap = null;
function getQuestionsMap() {
  if (!allQuestionsMap) {
    try {
      const list = require('./datasets').allQuestionsList;
      allQuestionsMap = new Map(list.map(q => [String(q.id), q]));
    } catch (e) {
      allQuestionsMap = new Map();
    }
  }
  return allQuestionsMap;
}

function resolveQuestion(qOrId) {
  if (!qOrId) return null;
  if (typeof qOrId === 'object' && qOrId.stem) return qOrId;
  const map = getQuestionsMap();
  return map.get(String(qOrId)) || null;
}

function formatQuestionContext(question) {
  if (!question) return '';
  let ctx = `【当前学生正在研习的考研真题】\n`;
  ctx += `- 题号：#${question.id} (${question.year || ''}年 ${(question.papers || []).join('/')} 第${question.index || question.id}题 · ${question.type || '试题'})\n`;
  ctx += `- 完整题干：${question.stem}\n`;
  if (question.options && Object.keys(question.options).length > 0) {
    ctx += `- 选项列表：\n${Object.entries(question.options).map(([k, v]) => `  ${k}. ${v}`).join('\n')}\n`;
  }
  if (question.kps && question.kps.length > 0) {
    ctx += `- 考纲考点：${question.kps.map(k => k.kp || k.chapter || k).join('、')}\n`;
  }
  if (question.methods && question.methods.length > 0) {
    ctx += `- 破题招法：${question.methods.join('、')}\n`;
  }
  if (question.answer) {
    ctx += `- 参考答案：${question.answer}\n`;
  }
  return ctx;
}

function getSystemPrompt(question) {
  let prompt = `你是一位专业、耐心的考研数学辅导名师，拥有深厚的数学专业功底与历年考研数学命题规律认知。
【教学与作答准则】：
1. 启发式教学：重点讲清楚“为什么要这样设想”、“突破口在哪”、“同类型题目的通用破题法”，引导学生理解数学本质；
2. 数学规范：严谨准确，所有数学公式必须使用标准 LaTeX 语法排版（行内公式用 $...$，行间公式用 $$...$$）；
3. 紧扣题目：学生的所有提问都是严格针对【当前钻研的考研真题】提出的，题目的全部信息已经明确提供。绝对不可声称“我没看到题目”或向学生索要题干！
4. 语言亲切专业、层次分明，解答条理清晰；
5. 【思考精炼与防循环】：内部思考（Thinking）请全程使用中文，保持精炼聚焦，旨在快速理清解法主线（控制在 300 字以内），严禁在内部思考中做冗长无休止的发散或自我辩驳；当学生询问“换个思路”时，考研数学中的“另一思路”指不同视角的切入（如：定义法、变量代换构造辅助函数、或不同定理路径），选定 2 个清晰角度后迅速结束思考！
6. 【解答必须完整】：思考完毕后，必须输出正式解答内容（Answer），绝不能只有思考过程没有回答！正式解答必须详尽全面回答学生的提问。`;

  if (question) {
    prompt += `\n\n${formatQuestionContext(question)}`;
    prompt += `\n【核心指令】：请务必将上方真题作为本次辅导的唯一载体，直接引用题目中的具体函数、已知等式或积分限开展讲解。`;
  }

  return prompt;
}

/**
 * Generate hints for "讲讲思路" (POST /api/why)
 */
async function getWhyHint(questionOrId, solution) {
  const config = db.getAiConfig();
  const question = resolveQuestion(questionOrId);
  if (!question) {
    return { ok: false, error: "未找到该题目数据" };
  }

  const kpsText = (question.kps || []).map(k => k.kp || k.chapter).join('、') || '考研数学核心考点';
  const methodsText = (question.methods || []).join('、') || '特征分析与标准变形';

  // If user configured an API key, call the LLM
  if (config.apiKey && config.apiKey.trim().length > 0) {
    try {
      const qContext = formatQuestionContext(question);
      const messages = [
        {
          role: 'system',
          content: `你是一位专业、耐心的考研数学辅导名师。
【核心宗旨】：重在点拨解题切入点、定理联想与第一步动笔方向，【严禁剧透后续演算与最终答案】！
你的目标是给做题卡壳的学生一盏指路明灯，点透题目本质，启发他自己在草稿纸上算下去，而不是替他做完全部推导和解答。

【严格红线】：
1. 绝对严禁给出全套具体运算、代数化简过程、微分方程通解以及最终数值答案！
2. 绝对严禁在「第一步动笔」或「避坑提醒」里顺带把第(2)问解出或给出最终答案！
3. 「第一步动笔」仅限草稿纸落笔的第 1 步起手动作（例如：指出令什么变量代换，或指出对哪个等式求偏导/展开），到此立即打住，引导学生自主计算！
4. 「避坑提醒」聚焦于易错概念、符号陷阱、分母非零、定义域或定理适用前提，绝不借提醒之名给出计算结果！`
        },
        {
          role: 'user',
          content: `${qContext}

请按以下 4 项结构给出「讲讲思路」点拨（总字数控制在 180-260 字，精炼、启发性强，多用标准 LaTeX 公式，【严禁直接给出答案或完整解答】：
💡 **核心切入点**：题干最关键的条件特征与观察方向（已知与未知之间的桥梁）
🎯 **关键招法**：联想到的考研数学定理或破题通法（说明为什么想到用此招法）
🚀 **第一步动笔**：仅建议草稿纸落笔的第 1 步起手动作（点到为止，绝不往下算，留给学生自己算）
⚠️ **避坑提醒**：学生自主演算时最容易踩的概念陷阱或边界条件限制`
        }
      ];

      const requestPayload = {
        model: config.model || 'deepseek-chat',
        messages,
        temperature: config.temperature !== undefined ? config.temperature : 0.6,
        max_tokens: 1000,
        thinking: { type: 'disabled' }
      };

      let res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      if (res.status === 429) {
        console.log('SenseNova 429 in getWhyHint, waiting 4s for cooldown retry...');
        await new Promise(r => setTimeout(r, 4000));
        res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify(requestPayload)
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = errText;
        try {
          const errObj = JSON.parse(errText);
          errMsg = errObj.error?.message || errText;
        } catch (e) {}
        return { ok: false, error: `大模型 API 请求失败 (HTTP ${res.status}): ${errMsg}` };
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const hintText = (msg?.content && msg.content.trim()) || (msg?.reasoning_content && msg.reasoning_content.trim());
      if (hintText && hintText.trim()) {
        return { ok: true, hint: hintText.trim() };
      } else {
        return { ok: false, error: "大模型未返回有效思路提示" };
      }
    } catch (err) {
      console.error('getWhyHint API error:', err);
      return { ok: false, error: `连接大模型接口失败: ${err.message}` };
    }
  }

  // Fallback: Intelligent heuristic math hint engine (ONLY when no API key configured)
  let firstStepHint = '观察表达式的形式特征，先进行必要的因式分解、变量代换或恒等变形。';
  let trapHint = '注意题目给出的定义域、符号限制以及极限保号性等边界条件。';

  const stem = question.stem || '';
  if (/极\s*限|\\lim/.test(stem)) {
    firstStepHint = '先判别极限的未定式类型（如 $\\frac{0}{0}$、$\\frac{\\infty}{\\infty}$ 或 $1^\\infty$），优先考虑等价无穷小代换与泰勒公式展开。';
    trapHint = '若分子分母存在相加减项，不可随意局部使用等价无穷小替换，必须展开至同阶非零项。';
  } else if (/导数|切线|可导|极值|拐点/.test(stem)) {
    firstStepHint = '明确函数的可导性与定义域，对隐函数或参数方程根据链式法则两边求导，注意中间变量的求导法则。';
    trapHint = '切勿忽略驻点与不可导点的区别，极值点必须是导数变号的充分条件。';
  } else if (/积分|\\int/.test(stem)) {
    firstStepHint = '观察被积函数的奇偶性、周期性或积分区域对称性；尝试换元法或分部积分法 $u\\,dv = uv - \\int v\\,du$。';
    trapHint = '在二次积分或重积分中，交换积分次序时务必精确画出积分区域草图，防止积分限错设。';
  } else if (/特征值|特征向量|相似|对角化/.test(stem)) {
    firstStepHint = '根据特征多项式 $|\\lambda E - A| = 0$ 或矩阵迹 $\\sum \\lambda_i = \\text{tr}(A)$、行列式 $\\prod \\lambda_i = |A|$ 快速建立等式。';
    trapHint = '矩阵可对角化的充要条件是对于每个重特征值，线性无关的特征向量个数必须等于其重数。';
  } else if (/概率|密度|随机变量|期望|方差/.test(stem)) {
    firstStepHint = '画出二维联合密度的支撑集区域，利用全概率公式或二维连续型分布的边缘密度积分公式推进。';
    trapHint = '边缘分布积分时，内层积分限必须由二维支撑集边界确定，切勿简单写为常数区间。';
  }

  const hint = `💡 **核心切入点**：
本题重点考查 **${kpsText}**。解题的关键在于识别题设中的条件结构，抓住 **${methodsText}** 的破题招法。

🎯 **解题思路要诀**：
- 第一时间联想核心工具公式，将未知条件与目标函数形式对齐；
- 若出现复合或隐函数形式，优先寻找不变量或利用对称性降低自由度。

🚀 **第一步方向**：
${firstStepHint}

⚠️ **避坑提醒**：
${trapHint}`;

  return { ok: true, hint };
}

/**
 * Handle multi-turn streaming QA
 */
async function streamChat({ content, sessionId, questionId, history = [], onDelta, onDone, onError, anchorQuestion }) {
  const config = db.getAiConfig();
  const sessions = db.getQaSessions();
  let currentSession = null;

  if (sessionId) {
    currentSession = sessions.find(s => s.id === sessionId);
  }

  if (!currentSession) {
    const newId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    currentSession = {
      id: newId,
      title: content.slice(0, 20) + (content.length > 20 ? '…' : ''),
      questionId: questionId ? Number(questionId) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    sessions.unshift(currentSession);
  } else {
    currentSession.updatedAt = new Date().toISOString();
  }

  // Ensure questionId is remembered on session
  const effectiveQId = questionId || (currentSession && currentSession.questionId) || (anchorQuestion && anchorQuestion.id);
  if (effectiveQId && !currentSession.questionId) {
    currentSession.questionId = Number(effectiveQId);
  }
  const resolvedQ = anchorQuestion || resolveQuestion(effectiveQId);

  // Append user message to session history
  currentSession.messages.push({
    role: 'user',
    content: content,
    createdAt: new Date().toISOString()
  });

  // Check if API key is provided
  if (config.apiKey && config.apiKey.trim().length > 0) {
    try {
      const messages = [
        { role: 'system', content: getSystemPrompt(resolvedQ) }
      ];

      function cleanAssistantHistory(text) {
        if (!text) return '';
        if (text.includes('\n\n---\n\n')) {
          const parts = text.split('\n\n---\n\n');
          return parts.slice(1).join('\n\n---\n\n').trim();
        }
        return text.replace(/^> 💭[\s\S]*?\n\n---\n\n/, '').trim();
      }

      // Append up to last 8 turns of history
      // Filter out any polluted local template assistant responses so LLM won't be misled
      const recent = currentSession.messages.slice(-9, -1);
      for (const m of recent) {
        if (m.role === 'assistant') {
          if (m.content.includes('题型通法与母题归纳') || m.content.includes('你好！针对本题') || m.content.includes('你好！关于你的数学提问') || m.content.includes('⚠️ **大模型')) {
            continue;
          }
          messages.push({ role: 'assistant', content: cleanAssistantHistory(m.content) });
        } else {
          messages.push({ role: 'user', content: m.content });
        }
      }

      // Format current user turn with explicit question context
      let userQueryPayload = content;
      if (resolvedQ) {
        const isFirstTurn = recent.length === 0;
        const qSummary = `【当前研习真题：#${resolvedQ.id} (${resolvedQ.year || ''}年 ${(resolvedQ.papers || []).join('/')} 第${resolvedQ.index || resolvedQ.id}题 · ${resolvedQ.type || ''})】\n【完整题干】：${resolvedQ.stem}\n` +
          (resolvedQ.options && Object.keys(resolvedQ.options).length > 0 ? '【选项】：' + Object.entries(resolvedQ.options).map(([k, v]) => `${k}. ${v}`).join('  ') + '\n' : '') +
          `【考点】：${(resolvedQ.kps || []).map(k => k.kp || k.chapter).join('、')}\n` +
          `【破题招法】：${(resolvedQ.methods || []).join('、')}`;

        if (isFirstTurn) {
          userQueryPayload = `${qSummary}\n\n【学生向你提问】：${content}`;
        } else {
          userQueryPayload = `【研习真题 #${resolvedQ.id}】题干：${resolvedQ.stem}\n【学生针对本题追问】：${content}`;
        }
      }
      messages.push({ role: 'user', content: userQueryPayload });

      const enableThinking = config.enableThinking !== false;
      const streamPayload = {
        model: config.model || 'deepseek-chat',
        messages,
        temperature: config.temperature !== undefined ? config.temperature : 0.6,
        stream: true,
        max_tokens: enableThinking ? 6000 : 4000,
        thinking: enableThinking ? { type: 'enabled', budget_tokens: 1500 } : { type: 'disabled' }
      };

      let response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(streamPayload)
      });

      if (response.status === 429) {
        console.log('SenseNova 429 in streamChat, waiting 4s for cooldown retry...');
        await new Promise(r => setTimeout(r, 4000));
        response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify(streamPayload)
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = errorText;
        try {
          const errJson = JSON.parse(errorText);
          errorDetail = errJson.error?.message || errJson.message || errorText;
        } catch (e) {}

        let userErrMsg = '';
        if (response.status === 429) {
          userErrMsg = `⚠️ **大模型接口调用频繁 (HTTP 429)**：${errorDetail}\n\n触发了 API 服务商的 TPM/RPM 频率限制。请稍候 10~15 秒后再试一次。`;
        } else if (response.status === 401) {
          userErrMsg = `⚠️ **大模型 API 认证失败 (HTTP 401)**：${errorDetail}\n\n请在右上角「⚙️ AI 设置」中重新核对您的 API Key。`;
        } else {
          userErrMsg = `⚠️ **大模型 API 请求失败 (HTTP ${response.status})**：${errorDetail}`;
        }

        onDelta(userErrMsg);
        currentSession.messages.push({
          role: 'assistant',
          content: userErrMsg,
          createdAt: new Date().toISOString()
        });
        db.saveQaSessions(sessions);
        onDone({ sessionId: currentSession.id, done: true, fullText: userErrMsg });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let hasStartedThinking = false;
      let hasEndedThinking = false;
      let contentLen = 0;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle AI reasoning/thinking (深度思考)
            if (delta.reasoning_content) {
              if (!hasStartedThinking) {
                hasStartedThinking = true;
                const thinkStart = ':::think\n';
                fullText += thinkStart;
                onDelta(thinkStart);
              }
              fullText += delta.reasoning_content;
              onDelta(delta.reasoning_content);
            }

            // Handle final answer content
            if (delta.content) {
              if (hasStartedThinking && !hasEndedThinking) {
                hasEndedThinking = true;
                const thinkEnd = '\n:::\n\n';
                fullText += thinkEnd;
                onDelta(thinkEnd);
              }
              fullText += delta.content;
              onDelta(delta.content);
              contentLen += delta.content.length;
            }
          } catch (e) {
            // ignore JSON parse errors in stream
          }
        }
      }

      // If reasoning finished and stream ended before delta.content was emitted
      if (hasStartedThinking && !hasEndedThinking) {
        hasEndedThinking = true;
        const thinkEnd = '\n:::\n\n';
        fullText += thinkEnd;
        onDelta(thinkEnd);
      }

      // GUARANTEED FORMAL ANSWER: If reasoning exhausted tokens or ended without content,
      // immediately generate the complete formal answer so user is never left without answer!
      if (contentLen === 0) {
        try {
          console.log('Reasoning finished without content, triggering guaranteed formal answer...');
          const directRes = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              model: config.model || 'deepseek-chat',
              messages: [
                ...messages,
                { role: 'assistant', content: '（思考梳理完毕）' },
                { role: 'user', content: '请立即输出正式、详尽、步骤分明的数学解答与思路剖析，切勿再输出思考过程。' }
              ],
              temperature: 0.6,
              max_tokens: 3500,
              thinking: { type: 'disabled' },
              stream: true
            })
          });

          if (directRes.ok) {
            const dReader = directRes.body.getReader();
            const dDecoder = new TextDecoder();
            let dBuffer = '';
            while (true) {
              const { done: dDone, value: dVal } = await dReader.read();
              if (dDone) break;
              dBuffer += dDecoder.decode(dVal, { stream: true });
              const dLines = dBuffer.split('\n');
              dBuffer = dLines.pop();
              for (const dl of dLines) {
                const dt = dl.trim();
                if (!dt.startsWith('data:')) continue;
                const ds = dt.replace(/^data:\s*/, '');
                if (ds === '[DONE]') continue;
                try {
                  const dp = JSON.parse(ds);
                  const dc = dp.choices?.[0]?.delta?.content;
                  if (dc) {
                    fullText += dc;
                    onDelta(dc);
                    contentLen += dc.length;
                  }
                } catch (e) {}
              }
            }
          }
        } catch (err) {
          console.error('Guaranteed answer fallback error:', err);
        }
      }

      currentSession.messages.push({
        role: 'assistant',
        content: fullText,
        createdAt: new Date().toISOString()
      });
      db.saveQaSessions(sessions);

      onDone({ sessionId: currentSession.id, done: true, fullText });
      return;
    } catch (err) {
      console.error('LLM stream error:', err);
      const netErrMsg = `⚠️ **无法连接到大模型接口**：${err.message}。请检查您的网络连接或右上角「⚙️ AI 设置」中的接口地址（Base URL）。`;
      onDelta(netErrMsg);
      currentSession.messages.push({
        role: 'assistant',
        content: netErrMsg,
        createdAt: new Date().toISOString()
      });
      db.saveQaSessions(sessions);
      onDone({ sessionId: currentSession.id, done: true, fullText: netErrMsg });
      return;
    }
  }

  // Fallback: built-in responsive math tutor streaming (ONLY when no apiKey configured)
  const tutorChunks = generateTutorReply(content, resolvedQ);
  let fullText = '';
  let i = 0;

  const timer = setInterval(() => {
    if (i < tutorChunks.length) {
      const chunk = tutorChunks[i];
      fullText += chunk;
      onDelta(chunk);
      i++;
    } else {
      clearInterval(timer);
      currentSession.messages.push({
        role: 'assistant',
        content: fullText,
        createdAt: new Date().toISOString()
      });
      db.saveQaSessions(sessions);
      onDone({ sessionId: currentSession.id, done: true, fullText });
    }
  }, 40);
}

function generateTutorReply(userQuery, question) {
  const chunks = [];
  const qTitle = question ? `针对本题（#${question.id}）` : '关于你的数学提问';

  chunks.push(`你好！${qTitle}，我们来做进一步的深入分析。\n\n`);

  if (/突破口|思路|怎么做|怎么解|第一步/.test(userQuery)) {
    chunks.push(`### 🎯 突破口与解题路径\n\n`);
    chunks.push(`1. **辨析已知形态**：\n`);
    chunks.push(`   首先明确题目的核心约束。数学解题最怕“盲目下笔”，先在草稿纸上圈出未知量与已知量的对应关系。\n\n`);
    chunks.push(`2. **招法对齐**：\n`);
    if (question && question.methods && question.methods.length) {
      chunks.push(`   本题归属于 **${question.methods.join('、')}**。这一类问题的通法是：优先寻找导数/积分/矩阵特征值的基本公式或等价结构。\n\n`);
    } else {
      chunks.push(`   此类经典题型的主流解法通常包括“恒等变形法”、“代换法”与“定理反推法”。\n\n`);
    }
    chunks.push(`3. **推荐第一步**：\n`);
    chunks.push(`   尝试将条件写成标准方程形式，观察是否具备对称性或可以先化简消元。\n`);
  } else if (/为什么|这一步|原因/.test(userQuery)) {
    chunks.push(`### 🔍 步骤原理解析\n\n`);
    chunks.push(`在这一步推导中，最核心的逻辑依托是**充要性与等价变换**：\n\n`);
    chunks.push(`- **理论依据**：定理的使用必须完全满足其前置假设条件；\n`);
    chunks.push(`- **化简动机**：为了消除非线性项或降低多项式阶数，使得原式转化为我们熟知的基本模型；\n`);
    chunks.push(`- **自查验证**：反向代入特值（如 $x=0$ 或 $n=1$）检验是否产生矛盾。\n`);
  } else if (/通法|归纳|套路|总结/.test(userQuery)) {
    chunks.push(`### 📚 题型通法与母题归纳\n\n`);
    chunks.push(`考研数学中此类题型具有高度的规律性：\n\n`);
    chunks.push(`1. **正向推导**：按部就班利用运算法则与微分/积分学基本定理；\n`);
    chunks.push(`2. **逆向分析**：由结论倒推所需满足的充要条件；\n`);
    chunks.push(`3. **排除法与特值法**：在客观选择题中，构造简单符合题意的具体函数（如 $f(x)=x$）常常能在 1 分钟内锁定选项！\n`);
  } else {
    chunks.push(`### 💡 解答指引\n\n`);
    chunks.push(`对于你的问题：「*${userQuery}*」：\n\n`);
    chunks.push(`考研数学考查的是**概念的深度理解与计算的绝对准确性**。\n\n`);
    chunks.push(`- **基本概念**：复习本考点的定义与几何/代数背景；\n`);
    chunks.push(`- **关键技巧**：注意在推导中保持等价性，谨防增根或失根；\n`);
    chunks.push(`- **举一反三**：做完这道题后，建议点击下方的「🔁 举一反三」做 3 道同招法题目自查巩固。\n`);
  }

  chunks.push(`\n你可以继续追问细节，或者拍照发图，我们一步步拆解！`);
  return chunks;
}

module.exports = {
  getWhyHint,
  streamChat,
  resolveQuestion
};
