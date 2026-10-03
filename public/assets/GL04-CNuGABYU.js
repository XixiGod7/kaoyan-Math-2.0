const n="由 scripts/pojue-content-build.py 生成，别手改——重跑会冲掉",e="GL04",t="随机变量的数字特征",$=[{code:"GL04-M01",title:"随机变量函数的期望",oneLiner:"不必先求 g(X) 的分布——直接拿 g(x) 去乘密度积分；只问期望走这条，问分布才走那条",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 要 $E[g(X)]$ 或 $E[g(X,Y)]$，**而 $g(X)$ 的分布本身没被问到**。

$$\\boxed{\\ E[g(X)]=\\int_{-\\infty}^{+\\infty}g(x)f(x)\\,\\mathrm dx\\quad\\text{或}\\quad\\sum_k g(x_k)p_k\\ }$$
$$E[g(X,Y)]=\\iint g(x,y)f(x,y)\\,\\mathrm dx\\mathrm dy .$$

⚠️ **这是本条与 GL02-M06 的分水岭**：
**只问期望走本条（不必求分布），问分布才走那条。**
先求 $g(X)$ 的分布再求期望不是错，**但那是绕远路**。

⚠️ **顺带说清整个域的分量**：随机变量的数字特征近十年去重 **31 道**，
**是概率七章里最多的一章**（其次是一维随机变量 28、随机事件 23）。
**数字特征是概率卷面上最稠密的一块。**`},{code:"GL04-M02",title:"期望与方差的运算性质",oneLiner:"D(X)=E(X²)−[E(X)]² 正反两向都要熟；不独立时别把 E(XY) 拆成 E(X)E(Y)",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 题里给的是 $E$、$D$ 而**不是分布本身**，要算另一个量；
或者要在 $E(X^2)$ 与 $D(X)$ 之间来回换。

⚠️ **本条在 2026 年出现得异常密集**：
**2026 年数字特征这一章的 5 道题（数一 3 道、数三 2 道），全部挂着本条。**
**它不是"性质罗列"，是真正的高频考点。**`},{code:"GL04-M03",title:"方差的线性组合与协方差的双线性展开",oneLiner:"交叉项的符号跟着 ab 走；协方差是双线性的，Cov(X+Y,X−Y)=D(X)−D(Y) 不需要独立",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 两种：

- 要 $D(aX+bY+c)$；
- 协方差里带着**线性组合**（$\\operatorname{Cov}(X+Y,\\ X-Y)$ 这种）。

⚠️ **判据是"两个变量"。**
$D(aX+b)=a^2D(X)$ 那种**单变量的线性变换**是 GL04-M02，不归这里。

近十年 10 道，**其中 2021 年数学一和数学三出了同一道题**。`},{code:"GL04-M04",title:"协方差与相关系数的计算",oneLiner:"Cov=E(XY)−E(X)E(Y)，ρ 的分母要开根号；E(XY) 难算时改用条件期望",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 要 $\\operatorname{Cov}(X,Y)$ 或 $\\rho_{XY}$。

$$\\boxed{\\ \\operatorname{Cov}(X,Y)=E(XY)-E(X)E(Y),\\qquad
\\rho_{XY}=\\frac{\\operatorname{Cov}(X,Y)}{\\sqrt{D(X)}\\sqrt{D(Y)}}\\ }$$

⚠️ **$\\rho$ 的分母是两个标准差之积，要开根号**；**别把 $\\rho$ 与 $\\operatorname{Cov}$ 混用**
（$\\rho$ 无量纲且 $|\\rho|\\le1$，$\\operatorname{Cov}$ 带量纲）。

⚠️ **近十年 15 道，是本域最高的一条**——
数字特征这一章近十年 31 道，**接近一半最后落在它身上**。`},{code:"GL04-M05",title:"不相关与独立的辨析",oneLiner:"独立⇒不相关，反过来只在二维正态里成立——不相关只管线性关系，函数关系照样可以很强",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 问「$X$ 与 $Y$ 是否独立」「是否不相关」「哪个是充分/必要条件」，
或者**一道大题里前一问算不相关、后一问追问独立**。

$$\\boxed{\\ \\textbf{独立}\\ \\Longrightarrow\\ \\textbf{不相关}\\ (\\operatorname{Cov}=0)，\\ \\textbf{反过来不成立}\\ }$$

$$\\boxed{\\ \\textbf{唯一的例外：二维正态，那里两者等价}\\ }$$

⚠️ **"不相关"只说明没有\\textbf{线性}关系。函数关系照样可以强到极点**（样板一）。`},{code:"GL04-M06",title:"用对称性与奇偶性简化数字特征",oneLiner:"密度关于 x=c 对称就意味着 E(X)=c 且所有奇数阶中心矩为零——一句话代替三个积分",status:"published",summaryMd:`## 什么时候用

**仅数学一、数学三。** 三个信号，见一个就该想到本条：

- 密度**关于某条竖线 $x=c$ 对称**（题面常写成 $f(c+x)=f(c-x)$）；
- 被积函数是**奇函数**且积分区间**关于原点对称**；
- 出现**正态**且要算奇数次幂的期望。

⚠️ **本条不是一种"算法"，是一次判断**：判对了，一个积分都不用算。`}],o={_generated:n,domain:e,domainName:t,entries:$};export{n as _generated,o as default,e as domain,t as domainName,$ as entries};
