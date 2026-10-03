const db = require('./db');

// Only reviewed answers may drive scoring. Historical generated placeholders
// in data/solutions.json are deliberately excluded.
const verifiedSolutions = {};

function getSolutionForQuestion(q) {
  if (!q) return null;
  const id = String(q.id);
  if (verifiedSolutions[id]) {
    return { ...verifiedSolutions[id], verified: true };
  }
  const stored = db.getSolutions()[id];
  if (stored?.verified === true) {
    return stored;
  }

  // Generate a structured, mathematically sound solution
  const kps = (q.kps || []).map(k => k.kp || k).join('、') || '考研数学核心考点';
  const methods = (q.methods || []).join('、') || '常规解法与特征分析';
  const hasOptions = q.options && Object.keys(q.options).length > 0;

  // Determine standard answer
  let finalAnswer = '尚未核验';
  if (hasOptions) {
    // Deterministic selection based on ID for consistency if not specified
    const keys = Object.keys(q.options);
    finalAnswer = '尚未核验';
  } else if (q.type === '填空题') {
    finalAnswer = q.answer || '尚未核验';
  } else {
    finalAnswer = q.answer || '尚未核验';
  }

  let wrongOptions = {};
  if (hasOptions) {
    const keys = Object.keys(q.options);
    keys.forEach(k => {
      if (k !== finalAnswer) {
        wrongOptions[k] = `该选项在推导变形或条件判别中出现符号或范围偏差，不满足题意。`;
      }
    });
  }

  const analysisMd = `> 本题暂无经过核验的标准解析。以下仅提供通用研习方向，不能作为标准答案或判分依据。

#### 【核心考点】
本题重点考查 **${kps}**，涉及解题招法 **${methods}**。

#### 【解题推导与思路分析】
1. **审题定法**：
   观察题设条件，结合函数结构与定理判据，明确已知量与待求量之间的内在联系。
2. **公式运用与恒等变形**：
   依据相关运算法则与基本定理进行规范推导，注意自变量变化范围以及临界点取值情况。
3. **推导验证**：
   经逐步推导计算，消去中间变量或利用对立/对称性质化简，得出最终确定结论。

因此，正确答案为 **${finalAnswer}**。`;

  const solutionObj = {
    final_answer: finalAnswer,
    analysis_md: analysisMd,
    wrong_options: wrongOptions,
    pitfalls: [
      '注意极限保号性与连续可导的前提条件。',
      '在复合函数链式求导与多重积分换元时切勿遗漏雅可比行列式或符号变动。'
    ],
    key_point: `【要诀】抓住主干特征，善用奇偶对称与基本公式简化计算。`,
    figures: []
  };

  solutionObj.verified = false;
  solutionObj.wrong_options = {};
  return solutionObj;
}

// Pre-fill well-known answers for 90101 (2026 Math 1 Q1)
verifiedSolutions['90101'] = {
  final_answer: 'A',
  analysis_md: `#### 【核心考点】
本题考查**多元隐函数求偏导数**。

#### 【详细推导】
设隐函数由方程 $F(x, y, z) = x - az - e^{y + az} = 0$ 确定。
分别对 $x, y, z$ 求一阶偏导数：
$$F_x = 1$$
$$F_y = -e^{y + az}$$
$$F_z = -a - a e^{y + az} = -a(1 + e^{y + az})$$

由隐函数存在定理与求导公式：
$$\\frac{\\partial z}{\\partial x} = -\\frac{F_x}{F_z} = \\frac{1}{a(1 + e^{y + az})}$$
$$\\frac{\\partial z}{\\partial y} = -\\frac{F_y}{F_z} = \\frac{-e^{y + az}}{a(1 + e^{y + az})}$$

将两者相减：
$$\\frac{\\partial z}{\\partial x} - \\frac{\\partial z}{\\partial y} = \\frac{1 - (-e^{y + az})}{a(1 + e^{y + az})} = \\frac{1 + e^{y + az}}{a(1 + e^{y + az})} = \\frac{1}{a}$$

故正确答案选 **A**。`,
  wrong_options: {
    B: '两式相加时分子为 $1 - e^{y+az}$，不能与分母 $1 + e^{y+az}$ 约分。',
    C: '计算符号出错，缺少负号的抵消。',
    D: '求偏导时符号计算错误，导致式子无法化简为常数。'
  },
  pitfalls: [
    '隐函数求偏导公式 $\\frac{\\partial z}{\\partial x} = -\\frac{F_x}{F_z}$ 前面有一个关键的负号，切勿漏掉。',
    '对 $z$ 求偏导时注意 $az$ 项外层系数 $a$ 的链式求导。'
  ],
  key_point: '牢记隐函数偏导公式，分母 $F_z$ 中的负号与隐函数求导公式自身的负号相抵消。',
  figures: []
};

// Persist any updates periodically or on exit
// No background filesystem writes: Workers storage is scoped to each visitor.

module.exports = {
  getSolutionForQuestion
};
