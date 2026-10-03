const n="由 scripts/pojue-content-build.py 生成，别手改——重跑会冲掉",t="GL05",e="大数定律与中心极限定理",i=[{code:"GL05-M01",title:"切比雪夫不等式估计概率",oneLiner:"一个公式没有变化，全部工作量在算出那个方差",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 题面出现

$$P\\{|X-E(X)|\\ge\\varepsilon\\}\\le\\ ?\\qquad\\text{（要一个\\textbf{上界}，不是精确值）}$$

⚠️ **判据很硬：题目只给了期望和方差，没给分布**——**给不出精确概率，只能估一个界。**

⚠️ **这一整章（大数定律与中心极限定理）近十年只有 3 道题，而且全是选择题**——
**本条、大数定律、中心极限定理各 1 道。它是概率里最小的一章。**`},{code:"GL05-M02",title:"大数定律与依概率收敛",oneLiner:"辛钦大数定律：样本的平均依概率收敛到那个东西的期望——难点从来不在定律，在算那个期望",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 题面出现

$$\\frac1n\\sum_{i=1}^n g(X_i)\\ \\xrightarrow{\\ P\\ }\\ ?\\qquad(n\\to\\infty)$$

⚠️ **认法：出现"依概率收敛"四个字，或者问 $n\\to\\infty$ 时样本平均趋于什么。**`},{code:"GL05-M03",title:"中心极限定理的标准化近似",oneLiner:'把和标准化成 (ΣX−nμ)/(√n·σ) 再套 Φ——难点只有"算对 nμ 和 nσ²"',status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 题面出现

$$P\\Bigl\\{\\sum_{i=1}^nX_i\\le a\\Bigr\\}\\approx\\ ?\\qquad\\text{或}\\qquad \\text{求最小的 }n\\text{ 使某概率}\\ge\\text{某值}$$

⚠️ **认法有两个**：题里出现「**近似**」二字，或者答案选项里全是 $\\Phi(\\cdot)$。
**大数定律给的是极限值，本条给的是概率的近似值。**`}],a={_generated:n,domain:t,domainName:e,entries:i};export{n as _generated,a as default,t as domain,e as domainName,i as entries};
