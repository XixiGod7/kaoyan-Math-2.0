# 考研数学真题题库与标签拓扑工具包 (1987 ~ 2026)

本题库收录了 1987 年至 2026 年（共 40 年）全国硕士研究生招生考试数学一、数学二、数学三的全部 **2,185 道真题**。全库数据经过深度清洗与结构化标注，建立了涵盖**卷种、年份、题型、难度、三级考纲知识点、199 种解题通法（破题诀）**的多维标签拓扑体系，支持即插即用到任意 Web 应用、移动端、小程序、教学科研系统或 AI 答疑 Agent 项目中。

---

## 一、 题库核心规模概览

| 统计维度 | 规模指标 | 详细说明 |
| :--- | :--- | :--- |
| **全量题目总数** | **2,185 题** | 覆盖 1987 ~ 2026 年历年完整考研真题 |
| **主线核心题库** | **912 题** | 近 18 年（2009 ~ 2026）真题，结构最契合现行考纲 |
| **早期归档题库** | **1,273 题** | 早期 22 年（1987 ~ 2008）经典题目与溯源考题 |
| **分卷题目分布** | 数一 895 题 / 数二 870 题 / 数三 881 题 | 支持公共题目多卷映射关联 |
| **题型分类覆盖** | 选择题 640 题 / 填空题 620 题 / 解答题 834 题 / 证明题 80 题 / 早期判断题 11 题 | 客观题均附标准化选项与答案结构 |
| **官方考纲知识点** | **123 个考点**（学科 → 章节 → 考点） | 高等数学、线性代数、概率论与数理统计全覆盖 |
| **破题招法体系** | **24 个专业领域、199 种解题通法** | 支持“举一反三”同招法强化推荐与思路切入 |

---

## 二、 目录结构与文件清单

```text
question-bank-package/
├── data/                         # 题库核心 JSON 数据目录
│   ├── all_questions.json        # 全量真题大表 (2,185 题，包含完整题干与选项)
│   ├── index-main.json           # 近 18 年核心主线真题索引 (912 题)
│   ├── index-all.json            # 40 年全量真题紧凑索引 (2,185 题)
│   ├── meta.json                 # 题库宏观元数据 (年份、卷种、题型等统计)
│   ├── syllabus.json             # 考纲三级知识树结构 (学科 - 章节 - 考点)
│   ├── pojue-methods.json        # 破题诀 199 种招法明细与归属领域
│   ├── pojue-graph.json          # 招法之间的关联拓扑图谱
│   ├── formulas.json             # 考研数学配套公式速查手册
│   ├── kp-notes.json             # 核心考点深度解析与备考笔记
│   └── kp-prereq.json            # 知识点前后置先修依赖关系链
├── index.js                      # Node.js / JavaScript 开箱即用检索工具库
├── helper.py                     # Python 开箱即用检索工具库
├── package.json                  # npm 包描述文件
└── README.md                     # 本说明文档
```

---

## 三、 题目数据模型规范 (Schema)

每道题目的标准 JSON 结构如下：

```json
{
  "id": 90101,
  "papers": ["数学一"],
  "year": 2026,
  "index": 1,
  "indexByPaper": {
    "数学一": 1
  },
  "type": "选择题",
  "has_figure": false,
  "stem": "设函数 $z = z(x, y)$ 由方程 $x - az = e^{y + az}$ ( $a$ 是非0常数)确定, 则( )",
  "options": {
    "A": "$\\frac{\\partial z}{\\partial x} - \\frac{\\partial z}{\\partial y} = \\frac{1}{a}$",
    "B": "$\\frac{\\partial z}{\\partial x} + \\frac{\\partial z}{\\partial y} = \\frac{1}{a}$",
    "C": "$\\frac{\\partial z}{\\partial x} - \\frac{\\partial z}{\\partial y} = 1$",
    "D": "$\\frac{\\partial z}{\\partial x} + \\frac{\\partial z}{\\partial y} = 1$"
  },
  "hasSolution": true,
  "difficulty": 3,
  "difficultyEst": 3,
  "skill": "多元函数微分学",
  "methods": ["多元隐函数偏导数求法"],
  "kps": [
    {
      "chapter": "五、多元函数微分学",
      "kp": "复合函数、反函数、分段函数和隐函数"
    }
  ]
}
```

### 字段字典说明

| 字段名称 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | Number / String | 全局唯一 ID。例如 `90101` 代表 2026 年数学一第 1 题；`80101` 代表 2025 年；以此类推 |
| `papers` | Array\<String\> | 出现此题目的试卷列表，例如 `["数学一"]` 或 `["数学一", "数学二"]` |
| `year` | Number | 考试所属年份，如 `2026` |
| `index` | Number | 默认试题题号 |
| `indexByPaper` | Object | 在对应卷种中的题号映射表，格式为 `{ "卷种名": 题号 }` |
| `type` | String | 题型：`选择题`、`填空题`、`解答题`、`证明题` |
| `has_figure` | Boolean | 是否包含配图标志 |
| `stem` | String | 题干内容，内置 LaTeX 公式（使用 `$...$` 行内包裹或 `$$...$$` 块级包裹） |
| `options` | Object | 仅选择题存在，键为 `A`, `B`, `C`, `D`，值为选项的 LaTeX 格式文本 |
| `difficulty` | Number | 难度等级（1~5 星），3 为典型中档综合题，4~5 为高难/压轴题 |
| `methods` | Array\<String\> | 所关联的“破题诀”解题通法名称 |
| `kps` | Array\<Object\|String\> | 关联的官方考纲知识点列表（包含所属章节与具体考点） |

---

## 四、 快速上手指南

### 1. Node.js / JavaScript 环境使用

本工具包自带 `index.js`，无需安装任何额外 npm 依赖，开箱即用：

```javascript
const {
  getQuestionById,
  queryQuestions,
  getPaper,
  getSimilarQuestions,
  getSyllabus
} = require('./index.js');

// 1. 获取单道题目详情
const q = getQuestionById(90101);
console.log('题干:', q.stem);
console.log('选项:', q.options);

// 2. 组合条件筛选 (如: 筛选近五年数一中涉及“无穷级数”的4星解答题)
const questions = queryQuestions({
  paper: '数学一',
  type: '解答题',
  difficulty: 4,
  kp: '无穷级数',
  limit: 10
});
console.log(`检索到 ${questions.length} 道高难度级数真题`);

// 3. 拉取 2026 年数学一整套试卷 (自动按试卷 1~22 题原始顺序排序)
const paper2026 = getPaper('数学一', 2026);
console.log(`2026数学一共有 ${paper2026.length} 道题目`);

// 4. “举一反三”：针对指定题目推荐 3 道同招法巩固题
const similar = getSimilarQuestions(90101, 3);
console.log('同招巩固题 ID:', similar.map(item => item.id));

// 5. 获取考纲体系
const math1Syllabus = getSyllabus('数学一');
console.log('数学一考纲知识考点数:', math1Syllabus.length);
```

### 2. Python 环境使用

本工具包自带 `helper.py`，支持 Python 3.7+，可在 Django, FastAPI, Flask 或数据分析脚本中直接导入：

```python
from helper import bank

# 1. 查询单道题目
q = bank.get_question_by_id(90101)
print(f"题干: {q['stem']}")
print(f"选项 A: {q['options']['A']}")

# 2. 多维度筛选
# 筛选 2024 年以后的数学二选择题
results = bank.query(
    paper="数学二",
    qtype="选择题",
    year=2025,
    limit=5
)
for item in results:
    print(item['id'], item['stem'][:30] + '...')

# 3. 整卷拉取
paper_questions = bank.get_paper(paper="数学一", year=2026)
print(f"2026年数一整卷题目数: {len(paper_questions)}")

# 4. 举一反三推荐
similars = bank.get_similar_questions(90101, count=3)
for s in similars:
    print(f"推荐题: {s['id']} | 年份: {s['year']} | 招法: {s.get('methods')}")

# 5. 获取招法分类
methods = bank.get_methods(domain="函数、极限、连续")
print(f"该领域包含招法数: {len(methods)}")
```

---

## 五、 核心应用场景与设计实践

### 1. 历年真题整卷模考系统
- 使用 `getPaper(paper, year)` 即可瞬间还原指定年份的试卷全卷；
- 每题通过 `indexByPaper` 字段精确锁定卷面序号（例如数一第 1~10 题选择、11~16 题填空、17~22 题大题）；
- 结合前端倒计时即可实现真题限时全真模考。

### 2. 知识点专题突破与考点透视
- 根据 `data/syllabus.json` 渲染前端知识树（如“一元函数积分学” → “定积分的性质”）；
- 点击考点节点后，调用 `queryQuestions({ kp: '定积分的性质' })`，聚合历年涉及该知识点的所有考题。

### 3. “举一反三”与同招法自查
- 考研数学命题强调“通性通法”。本题库打上了 199 种标准化招法标签（保存在 `data/pojue-methods.json`）；
- 当学生做错或做完某一题时，调用 `getSimilarQuestions(qid, 3)`，算法自动根据招法相似权重在全库筛选 3 道同类型题目推荐给学生，避免盲目题海战术。

### 4. 阶梯递进训练
- 根据 `difficulty`（1~5 星）构建新手练习区（2 星题）、基础巩固区（3 星题）与高分冲刺拔高区（4~5 星题）。

---

## 六、 前端公式渲染排版建议

题库中的题干 `stem` 与选项 `options` 均使用标准的 LaTeX 语法存储。在前端展示时，推荐使用 **KaTeX** 或 **MathJax** 进行渲染：

1. **KaTeX 渲染配置示例 (JavaScript)**：
   ```javascript
   import katex from 'katex';
   import 'katex/dist/katex.min.css';

   function renderMath(text) {
     if (!text) return '';
     // 匹配行内公式 $...$ 并替换渲染
     return text.replace(/\$([^\$]+)\$/g, (match, expr) => {
       try {
         return katex.renderToString(expr, { throwOnError: false });
       } catch (err) {
         return match;
       }
     });
   }
   ```
2. **文本预处理**：
   - 数据中对于乘号使用了 `\times` 或 `\cdot`，对于分数使用了 `\frac{...}{...}`，均符合通用排版规范；
   - 若使用 Markdown 引擎（如 `marked`、`markdown-it`），请将公式提取或转义前置，避免下划线 `_` 被错误解析为斜体标签 `<em>`。

---

## 七、 授权与声明

本题库所收录之试题均为全国统考历史公开真题，所建立的知识拓扑、招法分类体系与数据解析接口供个人学习、考研复习与教学研究使用。
