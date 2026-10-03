const n="由 scripts/pojue-content-build.py 生成，别手改——重跑会冲掉",t="GS10",a="曲线曲面积分",m=[{code:"GS10-M01",title:"格林公式",oneLiner:"不闭合就补线，有奇点就挖掉——近十年一道都没有能直接套公式的",status:"published",summaryMd:`## 什么时候用

**仅数学一。** 平面上的**第二类曲线积分** $\\displaystyle\\int_LP\\,\\mathrm dx+Q\\,\\mathrm dy$。

$$\\oint_{L}P\\,\\mathrm dx+Q\\,\\mathrm dy=\\iint_D\\Bigl(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\Bigr)\\mathrm d\\sigma
\\qquad(L\\ \\text{是}\\ D\\ \\text{的\\textbf{正向}边界}).$$

⚠️ **公式有两个硬前提，而近十年的题恰恰都在破坏它们：**
- **$L$ 必须闭合** —— 不闭就**补线**；
- **$D$ 内 $P,Q$ 必须有连续偏导** —— 有奇点就**挖掉**。

**近十年这一条名下的 4 道题，没有一道能直接套公式**：两道补线、两道挖奇点。
**"能不能直接用"本身就是考点。**

⚠️ **顺带说清整个域的分量**：曲线曲面积分**只考数学一**，
近十年去重 21 道、**2017 到 2026 一年不落**，
而且**其中 12 道是解答题**——**是数一卷上最稳定的一块大题产地之一。**`},{code:"GS10-M02",title:"高斯公式",oneLiner:"不闭合就补面，算完减掉——补法和格林一模一样，只是升了一维",status:"published",summaryMd:`## 什么时候用

**仅数学一。** **闭曲面**上的第二类曲面积分。

$$\\oiint_{\\Sigma}P\\,\\mathrm dy\\mathrm dz+Q\\,\\mathrm dz\\mathrm dx+R\\,\\mathrm dx\\mathrm dy
=\\iiint_{\\Omega}\\Bigl(\\frac{\\partial P}{\\partial x}+\\frac{\\partial Q}{\\partial y}+\\frac{\\partial R}{\\partial z}\\Bigr)\\mathrm dV .$$

⚠️ **三个硬前提：闭曲面、取外侧、$P,Q,R$ 有连续偏导。**
内侧要加负号；不闭合要**补面**。

**它和格林公式是同一个逻辑，只是升了一维**——
不闭合就补、有奇点就挖，**两条一起记比分开记省事**。

近十年 5 道里 **3 道不闭合**（要补面，或改走投影）、**2 道本来就闭合**可以直接套。
**转化之后是三重积分，接 GS09-M09。**`},{code:"GS10-M03",title:"斯托克斯公式",oneLiner:"空间曲线积分化曲面积分；边界相同的曲面随便挑，挑最好投影的那张",status:"published",summaryMd:`## 什么时候用

**仅数学一。** **空间**的第二类曲线积分——曲线通常是**两个曲面的交线**。

$$\\oint_{\\Gamma}P\\,\\mathrm dx+Q\\,\\mathrm dy+R\\,\\mathrm dz=\\iint_{\\Sigma}\\operatorname{rot}\\boldsymbol F\\cdot\\boldsymbol n\\,\\mathrm dS,$$

$$\\operatorname{rot}\\boldsymbol F=
\\begin{vmatrix}
\\boldsymbol i & \\boldsymbol j & \\boldsymbol k\\\\[2pt]
\\dfrac{\\partial}{\\partial x} & \\dfrac{\\partial}{\\partial y} & \\dfrac{\\partial}{\\partial z}\\\\[6pt]
P & Q & R
\\end{vmatrix}.$$

⚠️ **$\\Sigma$ 的侧必须与 $\\Gamma$ 的方向成右手系。**

**最值钱的一句：$\\Sigma$ 可以随便挑。**
只要边界是同一条 $\\Gamma$，取哪张曲面都行——**挑最好投影的那一张**。
⚠️ 但**"挑平面"不是万能的**：近十年两道解答题里，
一道的 $\\Gamma$ 是球面与平面的交线（**取那个平面，一步塌成常数**），
另一道的 $\\Gamma$ 由三段圆弧拼成、**根本不共面，只能就用原曲面**。
**第一步永远是先看 $\\Gamma$ 在不在一个平面上。**`},{code:"GS10-M04",title:"第二类曲面积分的直接计算",oneLiner:"三个投影一次搞定——用法向量把 $\\mathrm dy\\mathrm dz$、$\\mathrm dz\\mathrm dx$ 全换成 $\\mathrm dx\\mathrm dy$",status:"published",summaryMd:`## 什么时候用

**仅数学一。** 曲面**不闭合、又不便补面**，只能老实投影硬算。

⚠️ 判据：**补面之后区域反而更难算**，或者被积式里含**抽象函数**（补面也消不掉）。
这时用投影法，尤其是**合一投影**。

近十年只有 2 道，但**这一招是别处的常备工具**——
高斯公式那边有一道抽象函数题，用它一步到位（见 GS10-M02 的样板三）。`},{code:"GS10-M05",title:"第一类曲线与曲面积分",oneLiner:"没有方向只有大小；先把曲线曲面的方程代进被积式，常常一步塌掉",status:"published",summaryMd:`## 什么时候用

**仅数学一。** 积分号里是 $\\mathrm ds$ 或 $\\mathrm dS$（**不带方向**）：

$$\\int_Lf\\,\\mathrm ds,\\qquad \\iint_{\\Sigma}f\\,\\mathrm dS .$$

⚠️ **与第二类的根本区别：第一类没有方向，只有大小。**
所以**不存在"侧"的正负号问题**，但也**不能用格林/高斯/斯托克斯**——那三个公式都是给第二类的。

典型问法：**曲线/曲面的质量、曲面的面积**，或者一个纯计算的 $\\displaystyle\\oint f\\,\\mathrm ds$。`},{code:"GS10-M06",title:"路径无关与二元全微分的原函数",oneLiner:'判据只有 $P_y=Q_x$，但"单连通"这个前提不能丢',status:"published",summaryMd:`## 什么时候用

**仅数学一。** 题面出现下面任意一句：

- "曲线积分**与路径无关**"；
- "对任意**闭曲线**积分为零"；
- "$P\\mathrm dx+Q\\mathrm dy$ 是某个函数的**全微分**"、"求原函数"。

⚠️ **这四句话是等价的**，判据只有一条：

$$\\boxed{\\ \\text{单连通区域内}\\quad \\frac{\\partial P}{\\partial y}=\\frac{\\partial Q}{\\partial x}\\ }$$

⚠️ **"单连通"这个前提不能丢**——区域里有奇点时结论不成立，
那正是格林公式那边要**挖奇点**的原因（GS10-M01）。**两条是同一件事的两面。**`},{code:"GS10-M07",title:"散度与旋度的计算",oneLiner:"纯套公式，没有技巧——但它是高斯与斯托克斯的被积式，会算这个才谈得上用那两个",status:"published",summaryMd:`## 什么时候用

**仅数学一。** 两类：

- 题面**直接出现** $\\operatorname{div}$、$\\operatorname{rot}$（或 $\\nabla\\cdot$、$\\nabla\\times$）——纯计算；
- 你要用**高斯公式**（被积式是散度）或**斯托克斯公式**（被积式是旋度）。

⚠️ **本条没有技巧，只有两个公式。**
但**它是那两大公式的入口**——散度旋度算错，后面全白搭。

近十年 5 道：**2 道是纯粹考公式的填空题**（一道求旋度在某点的值、一道先算叉积再求散度），
其余 3 道是高斯/斯托克斯题里的一步。
**纯考公式的那两道是本域最"送分"的题。**`},{code:"GS10-M08",title:"对称性化简与方程代入",oneLiner:"仅数学一。算之前先砍——奇偶消项、轮换配对，再加一条重积分没有的：曲线曲面的方程本身就是恒等式",status:"published",summaryMd:`## 什么时候用

⚠️ **仅数学一。**

$$\\boxed{\\ \\textbf{对称性}：\\textbf{第一类}\\ \\text{曲线/曲面积分（不带方向）}\\ }$$
$$\\boxed{\\ \\textbf{方程代入}：\\textbf{第一类第二类都能用}——\\text{只要点落在那条曲线/那张曲面上}\\ }$$

⚠️ **共同点是「先化简被积函数再算」**——**别上来就投影。**

**近十年 2 道，全库 8 道，是曲线曲面积分里最小的一条**；但它的三个动作每个都能把一道大题压成一行。`},{code:"GS10-M09",title:"第二类曲线积分的直接参数化",oneLiner:"仅数学一。三大公式都使不上时的兜底——写参数方程、由起终点定上下限、化成一元定积分",status:"published",summaryMd:`## 什么时候用

⚠️ **仅数学一。**

$$\\boxed{\\ \\int_L P\\,\\mathrm dx+Q\\,\\mathrm dy+R\\,\\mathrm dz\\ \\ \\textbf{（第二类，带方向）}\\ }$$

**曲线本身极好写参数方程**——圆、椭圆、直线段、两曲面的交线、分段折线；
或者**曲线不闭合又不便补线**，格林与斯托克斯都使不上。

⚠️ **这是第二类曲线积分的定义式，是其余各条走不通时的兜底。**

**全库 6 道，2009 年以来 3 道**（2015、2014、2010）——**近十年没有整道题考它，最近一次是 2015 年。**

⚠️ **低频，但没退休**：格林公式补线之后，**那条补线上的积分正是靠它算的**，2025、2008、2004 三道补线题都要用它收尾。
**它的考法是当零件。**`}],r={_generated:n,domain:t,domainName:a,entries:m};export{n as _generated,r as default,t as domain,a as domainName,m as entries};
