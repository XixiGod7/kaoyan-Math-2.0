# 真题库项目综合审查与改进清单

> 后续实施：本报告保留 `510177b` 审查时的事实和待办状态。修复内容、逐项验收与剩余限制见 [改进实施记录](PROJECT-REVIEW-FIXES-2026-10-05.md)，请不要把下文历史缺陷视为当前版本仍全部存在。

审查日期：2026-10-05（北京时间）

审查基线：Git `510177b`

范围：数学、政治、英语、成长打卡；本地 Express 与 Cloudflare Worker；身份、存储、同步、AI、图片、前端、构建和测试。

变更边界：本轮只新增本报告，没有修改业务代码、依赖或部署配置，没有访问线上用户数据。

## 1. 结论和阅读方式

当前项目已有较好的基础保护：密码使用 scrypt，账号会话校验 epoch，线上 Cookie 设置 HttpOnly/Secure/SameSite，写接口有跨站检查，SQL 使用参数绑定，图片限制类型及单用户配额，通用同步操作核对内容摘要，部分页面已按需加载。现有测试通过不等于下面的问题不存在：不少问题位于异常输入、迁移、异步交互及资源边界，尚未纳入测试。

建议优先处理：

1. **服务端出站请求和资源边界**：SSRF、无累计配额、云端请求体先完整读入再限长。
2. **数据不丢失、不串状态**：英语存储结构校验、账号合并、离线覆盖、提交与奖励的原子性。
3. **用户正在感知的问题**：词频侧栏展开卡顿、AI 请求阻塞保存、英语首屏等待。
4. **持续维护成本**：增量同步、存储粒度、源码与构建可复现性、前端回归测试。

优先级不是对所有项目通用的漏洞等级：

| 标记 | 含义 |
| --- | --- |
| P1 | 优先修复：可能影响安全边界、资源可用性或数据可靠性 |
| P2 | 随后修复：功能一致性、明显性能问题、需要条件的风险 |
| P3 | 逐步改进：维护性、体验细节、工程效率 |
| 已复现 | 使用当前代码和隔离数据验证了描述的行为 |
| 代码确认 | 可直接由实现确认；未进行对应的完整浏览器/云端演练 |
| 条件风险 | 利用或影响依赖网络、部署、故障等外部条件 |
| 优化建议 | 有明确成本来源，但尚未测量实际收益 |

本报告包含上文全部改进方向，并补充本轮发现。相同根因合并记录，避免把一个问题重复计算成多项漏洞。

## 2. 本轮验证与边界

| 检查 | 结果 |
| --- | --- |
| `node --test test/*.test.js` | 50 项：48 通过、0 失败、2 跳过；跳过的是云端专用测试 |
| 英语 TypeScript `tsc -p apps/english/tsconfig.json --noEmit` | 通过 |
| 政治 TypeScript `tsc -p apps/politics/tsconfig.json --noEmit` | 通过 |
| `npm audit --json --ignore-scripts` | 本次返回 0 个已知漏洞；不代表业务代码无风险 |
| 隔离 API 验证 | 验证了非法结构存储、笔记累计长度、幂等内容不匹配、AI 阻塞保存、未知 Host 首访迁移 |
| 隔离函数验证 | 验证了 Markdown 死循环、政治笔记合并丢失、合并重算长期统计、成长同步白名单不匹配 |
| 工作区 | 审查前干净；仅新增本报告 |

验证使用系统临时目录、合成账号/记录和模型响应桩。没有调用真实付费模型，没有对内网、线上站点进行探测或压力测试。临时验证脚本通过标准输入执行，未作为项目测试文件写入。

为避免生成或覆盖构建产物，本次直接运行测试及无输出类型检查，没有执行带 `pretest` 的 `npm test`、UI 构建或部署。资源测试验证的是当前工作区已有产物，不能替代干净环境中的全量构建。

尚未做浏览器 Performance/React Profiler 录制、低端设备实测、真实 DNS 重绑定攻击、云端故障注入和多设备端到端测试。涉及这些内容时，下文明确保留验证边界。

## 3. 安全与资源边界

### S01 · P1 · AI 接口存在 SSRF 边界缺口

- **状态**：代码确认；测试接口出站配置已用桩验证，内网利用属于条件风险。
- **位置**：[server.js:731](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:731)、[server.js:773](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:773)、[ai-client.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/ai-client.js)。
- **问题**：`validAiUrl` 只检查初始 URL 的协议、域名文本等，不检查最终 DNS 解析地址。`/api/ai/test` 的 fetch 使用默认重定向策略；正式聊天虽有 `redirect: 'error'`，仍依赖域名文本校验。
- **影响**：匿名请求可提供自控地址和占位密钥，后端可能跟随跳转，或访问域名解析得到的非公网目标。可访问范围受宿主网络和运行时限制；不能据此声称已读到内网数据。测试接口最终返回内容还受其 JSON 结构处理约束。
- **建议**：统一出站请求模块；优先明确允许的提供商。确需自定义地址时，校验解析后的 IPv4/IPv6 地址、禁止重定向，并避免“检查一次、连接再次解析”的竞态；云端结合可用的出站策略实施。
- **验收**：测试接口与聊天接口采用相同规则；私网解析、特殊地址、重定向均被拒绝；正常自定义公网模型接口可用。

### S02 · P1 · 单次限长没有形成累计存储和匿名写入预算

- **状态**：已复现。
- **位置**：[笔记追加](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:470)、[数学草稿](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:957)、[examService.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/examService.js)、[images.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/images.js)、[worker.mjs](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/worker.mjs)。
- **证据**：两次追加 20,000 字符得到 40,001 字符笔记；前轮三次不同键的草稿写入得到约 2.1 MB 文件，均成功。数学试卷与提交历史、反馈列表也没有统一累计上限。
- **影响**：匿名访客能持续扩大自己的数据，并通过新访客身份绕过单用户图片上限，增加本地磁盘、云端存储和读写成本。图片已有 5 MB/张、100 张及 50 MB/用户限制，不能描述为完全不限量。
- **建议**：设置单记录最终大小、条目数、用户累计配额、单位时间写入预算和匿名身份创建预算；提供清理/归档入口及闲置访客生命周期。避免简单清理仍有待同步数据的记录。
- **验收**：连续小请求不能绕过总额度；超限明确返回 413/429；正常历史记录可导出、清理和继续使用。

### S03 · P2 · 数学 Markdown 占位符可触发无限循环

- **状态**：已复现。
- **位置**：[Md-k3-rmIqK.js:3](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/assets/Md-k3-rmIqK.js:3)。
- **证据**：提取实际渲染函数，在有超时保护的 VM 中执行；普通文字正常返回，单独的 `U+E000` 字符触发 `ERR_SCRIPT_EXECUTION_TIMEOUT`。
- **原因**：`while(e.includes(i))` 只检查起始标记存在，替换却只匹配完整数字占位符，无法匹配时字符串不变。
- **影响**：笔记、AI 输出等经过该组件时可能卡死主线程，持久化内容可能导致再次打开继续卡死。此项是可用性缺陷，不等同于已发现 XSS。
- **建议**：避免不受限的递归占位符还原；使用单次替换/结构化 token，必要时同时限制轮数和检查是否推进；恢复数学源码后从源码修复。
- **验收**：私用区字符、伪造索引、嵌套 token、长文本都在有界时间内渲染。

### S04 · P2 · 本地 Host 未校验，首访自动迁移扩大影响

- **状态**：未知 Host 接受与首访迁移已复现；浏览器 DNS 重绑定是条件风险。
- **位置**：[auth-local.js:19](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-local.js:19)、[auth-local.js:30](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-local.js:30)。
- **证据**：任意 Host 配合同值 Origin 的写请求被接受；在临时目录放置合成旧笔记后，使用未知 Host 的首个 `/api/notes` 请求获得该笔记。
- **影响**：默认仅监听回环地址是有效保护，但不能单独覆盖浏览器/网络允许的 DNS 重绑定情形；若开启局域网监听，首访归属风险更加直接。并非已登录账号可被任意远程接管。
- **建议**：本地增加可信 Host 白名单；可信代理明确配置；旧数据迁移通过本机初始化凭据或明确的归属流程触发。
- **验收**：未知 Host 在身份和文件迁移前拒绝；合法 localhost/回环入口正常；首次迁移可重试且不被无关访客领取。

### S05 · P2 · 云端账号请求在限长前完整读取

- **状态**：代码确认；未发送大体积请求进行压力测试。
- **位置**：[worker.mjs:85](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/worker.mjs:85)。
- **问题**：先 `await request.arrayBuffer()`，再判断 4096 字节上限。这限制了业务接受大小，却未限制读取过程占用的内存。
- **建议**：可信长度超限时提前拒绝，同时以带计数的流式读取覆盖没有长度头的请求；达到上限立即取消读取。不能仅依赖 Content-Length。
- **验收**：有无长度头的超限请求均在读取小量数据后结束；维持合法账号请求的行为。

### S06 · P2 · AI 测试响应未采用统一的大小限制和取消机制

- **状态**：代码确认。
- **位置**：[server.js:758](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:758)、[ai-client.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/ai-client.js)、[aiService.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/aiService.js)。
- **问题**：正式 AI 客户端已有输出长度保护，但测试接口直接 `.text()` / `.json()`，错误响应正文读取后也不使用。用户关闭页面后，后端模型请求未统一关联客户端取消信号。
- **建议**：共用带响应字节上限、超时、重定向策略的客户端；无需错误正文时取消流；将请求断开/用户取消传递到模型请求。
- **验收**：异常大响应被及时中止；取消答疑后不继续长时间占用请求和产生不必要调用。

### S07 · P2 · 访客 scope 含实际访问凭据，进入本地备份

- **状态**：代码确认。
- **位置**：[auth-local.js:22](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-local.js:22)、[worker.mjs:72](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/worker.mjs:72)、[sync.js:84](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:84)。
- **问题**：匿名存储身份由 `mb_session` UUID 直接决定，接口又以 `guest:<UUID>` 暴露在 scope 中；本地备份直接包含 scope。该 UUID 不只是记录标签，知道它即可构造同一访客 Cookie。
- **影响**：分享匿名本地备份可能同时分享该访客云端访问能力。账号的 `account:<id>` 没有相同效果，不应混为一谈；服务端普通导出与本地备份也不是相同格式。
- **建议**：将公开同步标识与私密访客凭据分离，凭据验证后映射到存储；导出移除可复用凭据，恢复通过当前身份重新绑定。
- **验收**：拿到备份里的公开 ID 不能构造读取原访客资料的请求；正常匿名连续访问、迁移和恢复仍可用。

## 4. 数据正确性、同步与恢复

### D01 · P1 · 英语存储只校验 JSON 语法，未校验业务结构

- **状态**：已复现。
- **位置**：[english.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/english.js)、[DataBackupModal.tsx:60](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/DataBackupModal.tsx:60)、[App.tsx:139](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/App.tsx:139)。
- **证据**：保存 `kaoyan_favorite_sentences: '{}'` 返回 200；随后收藏档案接口返回 400，错误为 `values(...).map is not a function`，总览对应字段也失去正常值。
- **影响**：损坏备份、客户端错误或直接请求可把本账号数据写入无法正常消费的状态；当前合法 JSON 检查不足以保护后续 `.map()`、`.length` 等假设。
- **建议**：按 key 定义带版本的数据 schema，包括数组/对象、枚举、字段类型、条目数、字符串长度和有限数值；旧备份先完整校验并预览，成功后一次应用。限制导入文件大小，避免空对象被当作成功导入。
- **验收**：错误类型拒绝且不修改原记录；损坏导入不会部分成功；错误提示区分本地暂存、云端确认和失败。

### D02 · P2 · 成长操作未被通用离线队列覆盖

- **状态**：已复现白名单匹配结果，实际离线 UI 流程未演练。
- **位置**：[sync.js:9](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:9)、[study-sync.js:59](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:59)、[integration.js:18](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/integration.js:18)。
- **证据**：白名单匹配不存在的 `/api/incentive/actions`，不匹配实际 `/api/incentive/points/adjust` 等路径。
- **建议**：前后端共用真实操作清单；离线操作保留稳定幂等 ID，对金额、兑换等操作明确显示“待服务端确认”，不提前伪造入账结果。
- **验收**：断网提交、重连、刷新、重复重放后，只入账一次；错误与冲突有处理入口。

### D03 · P1 · 账号合并策略会丢弃访客政治笔记，并缩减长期总计

- **状态**：已复现。
- **位置**：[study-sync.js:6](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:6)、[study-sync.js:39](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:39)、[growth.js:45](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/growth.js:45)。
- **证据**：同题政治笔记为字符串值，合并器只有字段名 `text` 才拼接，结果仅保留账号笔记。长期 totals 从保留的 days 重算；合成的“总计已有记录、保留历史为空”场景合并后数学总计变为 0。
- **影响**：真实场景中 days 仅保留 400 天，长期累计与这段窗口本来可以不同，迁移重算可能丢失更早累计。通用“当前值优先”也未明确区分作答时间、尝试次数、复习阶段等语义。
- **建议**：按文档类型定义合并策略；同题笔记保留双方或生成冲突；累计总数保留窗口外基数，并仅对重叠事件去重；记录可审计的迁移结果。
- **验收**：政治/数学/英语笔记冲突不丢失；超过 400 天的累计不回退；重复导入不重复奖励；明确各类时间与计数字段的规则。

### D04 · P2 · 各模块幂等校验强度不一致

- **状态**：成长模块已复现；政治路径代码确认。
- **位置**：[growth.js:139](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/growth.js:139)、[politics.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/politics.js)、[study-sync.js:80](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:80)。
- **证据**：同一 `Idempotency-Key` 先提交 +1，后提交 +99，返回 200/duplicate，余额仍为 1，没有指出请求内容冲突。政治交卷直接按 key 返回旧结果，未绑定试卷路径和请求体。
- **影响**：重用标识或重试时内容变化会造成“请求成功但并未执行新内容”，政治还可能返回另一试卷的旧结果；这是可靠性问题，不是已经证实可重复刷积分。
- **建议**：统一绑定 method、规范化路径、请求体摘要和响应；不匹配返回 409；区分操作幂等期限与业务事件去重期限。
- **验收**：相同内容重放返回一致结果；不同内容或不同试卷使用同一 key 明确拒绝。

### D05 · P1 · 业务保存、奖励和重放记录缺少统一原子提交

- **状态**：代码确认的故障风险；未做进程崩溃/云端中断注入。
- **位置**：[server.js:459](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:459)、[examService.js:75](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/examService.js:75)、[study-sync.js:98](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:98)、[db.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/db.js)。
- **问题**：记录先保存，成长账本随后更新，响应时才保存 `sync_operations`；单文件原子替换不等于多文档事务，进程内排队也不等于持久化原子性。
- **影响**：步骤之间出错或中断时可能出现已保存未发奖励、客户端重放再次累加尝试次数/交卷历史等状态。
- **建议**：同一持久化事务提交业务变更、学习事件和幂等结果；文件模式可采用事务存储或可恢复日志；建立失败后的补偿/恢复流程。
- **验收**：分别在三个阶段注入失败并重试，最终只形成一份业务结果和一次奖励。

### D06 · P2 · 新备份格式缺少完整恢复闭环，导出字段不完全一致

- **状态**：代码确认。
- **位置**：[study-export.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-export.js)、[study-sync.js:4](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:4)、[platform.js:58](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/platform.js:58)、[sync.js:84](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:84)。
- **问题**：有服务端导出和本地含待同步队列的备份，界面只提供旧英语导入；未找到新格式的完整恢复入口。普通导出不含同步快照额外加入的 `favorite_tags`、`favorite_stars`、`exam_drafts`、`study_positions`。
- **建议**：明确“可读导出”与“可恢复备份”的区别；统一字段清单和版本迁移；提供预览、校验、合并/替换选择及回滚。恢复待同步操作时不得直接跨账号重放。
- **验收**：在全新隔离身份下导出→恢复，逐类对照数据；标签、星级、草稿不遗漏；密钥和身份凭据不进入可分享备份。

### D07 · P2 · 政治题卡异步结果未绑定当前题目生命周期

- **状态**：代码确认的竞态风险，待慢网络 UI 复现。
- **位置**：[QuestionCard.tsx:77](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/politics/src/components/QuestionCard.tsx:77)、[Practice.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/politics/src/pages/Practice.tsx)。
- **问题**：等待判分时可以导航下一题；同一 QuestionCard 实例切换 q 后，旧请求仍无条件 `setSubmission`、`setRevealed`。收藏响应也没有对应的当前题目校验。
- **影响**：服务器可以正确保存原题，而屏幕短暂或持续显示原题结果在新题上。不能把它夸大为后端题目记录必然串写。
- **建议**：请求关联题目 ID/版本，返回时仅更新匹配题目的状态；按题目维护状态或使用明确 key；导航/卸载取消仅用于读取的请求，写入结果仍正确归档。
- **验收**：慢网络下提交 A 后立即切到 B、连续收藏切换，B 不显示 A 的判分和收藏结果。

### D08 · P2 · 错误操作会阻塞全局待同步队列

- **状态**：代码确认。
- **位置**：[sync.js:31](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:31)、[sync.js:43](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:43)。
- **问题**：任一待处理项有冲突或永久错误，后续全部操作停止，包括不相关科目的记录。它能避免乱序，但阻塞范围过大。
- **建议**：按账号和记录/业务依赖分队列，保证同一记录顺序，不相关记录继续；永久无效操作单独隔离，提供导出和修正入口。
- **验收**：一条数学笔记冲突不会挡住独立英语作答；同一笔记的连续修改不能越序提交。

## 5. 前端性能与交互

### F01 · P2 · 英语词频侧栏展开卡顿：优先虚拟化与布局隔离

- **状态**：用户已观察到卡顿；成本来源代码确认，尚无性能轨迹证明各项耗时占比。
- **位置**：[WordFreqSidebar.tsx:107](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/WordFreqSidebar.tsx:107)、[WordFreqSidebar.tsx:349](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/WordFreqSidebar.tsx:349)、[ExamWall.tsx:126](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/ExamWall.tsx:126)。
- **原因链**：折叠分支不渲染词表；展开时一次挂载全部约 762 行及按钮/图标；侧栏从约 48px 到 320px 使用 `transition-all 300ms`，内容同时改变可用宽度并挤压试卷墙。收起时复杂子树立即移除，因此两方向负担不对称。
- **推荐实施顺序**：
  1. 虚拟列表仅挂载视口和缓冲区；当前标签可换行，需要测量行高或规范行布局。
  2. 外层只控制宽度并裁切，内部维持展开宽度，避免词条在每帧宽度下重新换行。
  3. 保持轻量组件结构稳定，保留列表滚动位置；隐藏内容需 `inert`/等效焦点隔离，不能只设透明度。
  4. 仅过渡 width，文字层按需过渡 opacity/transform；减负后再尝试 200–240ms，不靠缩短时长掩盖长任务。
  5. `Date.now()` 不应每次变更导致统计/筛选 useMemo 失效；按数据变化、定时刷新或明确时间边界更新。
  6. 折叠偏好保存放到较轻的持久化路径，避免操作瞬间保存整个学习快照。
- **二阶段选择**：仍受试卷墙布局影响时，再评估一次布局后的位移动画；覆盖式抽屉会改变交互，需要单独确定。`React.memo` 不能消除浏览器宽度重排，折叠状态本来也不是父组件状态。
- **验收**：首次展开、反复开合、筛选后展开、滚动后展开、CPU 降速下录制 Performance/Profiler；没有明显停顿，搜索/选中/滚动保留，键盘焦点不进入隐藏区域。按目标设备刷新率评估帧预算，不预先承诺固定帧率。

### F02 · P2 · 英语首屏有串行依赖和全量词典等待

- **状态**：代码确认；收益待测量。
- **位置**：[main.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/main.tsx)、[App.tsx:242](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/App.tsx:242)、[sync.js:44](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:44)。
- **问题**：身份和全量学习快照完成后再 hydrate 英语存储/AI 配置，再挂载 App 加载公共试卷和约 2.01 MiB 原始词典；英语 storage 已可能存在于快照，却又单独请求。
- **建议**：先显示可用的页面框架；公共资源与身份流程独立加载；复用快照；词典按需加载。私人内容仍必须等当前身份确定，不能提前展示上一个账号缓存。
- **验收**：分别测量冷启动、热启动、弱网及身份过期；首屏不因可选 AI 配置阻塞，没有账号数据闪现。

### F03 · P2 · 全量快照和整块 IndexedDB 写入放大每次操作成本

- **状态**：代码确认。
- **位置**：[sync.js:8](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:8)、[sync.js:27](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:27)、[platformStorage.ts](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/utils/platformStorage.ts)。
- **问题**：save 写入整个 pending/local/positions/snapshot；GET 缓存也触发整体保存。首次 takeSnapshot 后又触发 drain，空队列仍取快照；之后可见页面每分钟取全量，成功写入也安排快照。
- **建议**：将快照、队列、查询缓存、浏览位置拆分对象存储；批量提交变更；服务端提供 revision/增量接口，未变更无需传输全量。公共题库不混入私人 GET 缓存的大对象。
- **验收**：一次计时/位置变化不重写整个账号数据；记录增长时本地写入耗时、网络字节量仍可控；断电/刷新不丢待同步项。

### F04 · P2 · 多层全局 fetch 包装使请求语义和副作用难追踪

- **状态**：代码确认。
- **位置**：[platform.js:83](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/platform.js:83)、[sync.js:55](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/shared/sync.js:55)、[politicsApi.ts](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/politics/src/services/politicsApi.ts)、[platformStorage.ts](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/utils/platformStorage.ts)。
- **问题**：通用同步、奖励提示和各学科封装都有请求/事件副作用；处理字符串、Request 对象、method、错误和取消的方式不同。
- **建议**：引入显式共享客户端，统一身份、超时、取消、重试、冲突和返回类型；迁移期保留适配层；同一次成功操作只触发必要刷新。
- **验收**：字符串/Request 形式行为一致；不丢原始请求语义；一次操作不重复提示或无谓刷新；本地暂存不被描述为云端成功。

### F05 · P3 · 按需加载与静态资源缓存仍有空间

- **状态**：代码确认；构建大小为当前产物、未压缩字节，不等于实际网络传输量。
- **位置**：[政治 App](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/politics/src/App.tsx)、[英语 App](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/App.tsx)、[_headers](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/_headers)、[本地静态服务](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:1016)。
- **问题**：政治全部页面静态导入；英语多个重型弹窗直接导入。现有主产物约 393 KiB（英语）和 216 KiB（政治）。本地静态资源禁用缓存；部分带 hash 的云端资源设置每次重新验证。
- **建议**：路由/弹窗延迟加载，配合局部加载错误重试；带内容 hash 的资源长期缓存，HTML/无 hash 脚本短缓存或重新验证，制定旧版本资源保留策略。
- **验收**：冷启动与二次访问分别测量；部署后 HTML 不引用已删除 chunk；AI 设置等无 hash 文件不会被长期锁在旧版本。

### F06 · P2 · 英语计时每秒驱动大组件更新和草稿序列化

- **状态**：代码确认；尚未测量 React commit 耗时。
- **位置**：[QuizMode.tsx:227](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/QuizMode.tsx:227)、[QuizMode.tsx:347](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/QuizMode.tsx:347)、[quizProgress.ts](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/utils/quizProgress.ts)。
- **问题**：每秒 setElapsedSeconds；草稿 effect 依赖 elapsedSeconds，因而每秒 JSON.stringify 和本地保存。网络端约 10 秒合并不能消除前端每秒开销。
- **建议**：计时显示独立组件，以开始时间/累计暂停时间计算经过时长；作答立即持久化，计时按适度间隔和离开页面时合并保存；统一试卷尝试 ID，避免跨设备计时混合。
- **验收**：切到后台再回来计时合理；输入/滚动不卡顿；刷新恢复时长误差在明确容忍范围内；答案保存不被计时节流延迟。

### F07 · P3 · 动画、弹窗与列表的可访问性需要专项验证

- **状态**：部分代码确认，完整键盘/屏幕阅读器体验待验证。
- **位置**：[WordFreqSidebar.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/WordFreqSidebar.tsx)、[DataBackupModal.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/DataBackupModal.tsx)。
- **问题**：侧栏展开轨道使用 clickable div；缺少明确的 aria-expanded/关联面板信息，多个数值硬编码 762。部分自绘弹窗没有原生 dialog 的默认焦点管理。
- **建议**：按钮语义、键盘操作、焦点归还/限制、关闭时隐藏区禁用交互；支持 prefers-reduced-motion；统计展示从真实列表生成。
- **验收**：仅键盘可完成展开、筛选、标记和关闭；减少动态效果设置生效；数据变化后数量正确。

### F08 · P3 · 英语 AI 的流式接口形状与实际行为不一致

- **状态**：代码确认。
- **位置**：[aiClient.ts:3](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/utils/aiClient.ts:3)、[ai-routes.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/ai-routes.js)。
- **问题**：前端接受 onDelta，但等待完整 JSON 后只回调一次；config 参数实际不参与请求配置。容易让调用方误以为支持流式输出或使用传入配置。
- **建议**：明确整段响应契约并简化接口，或实现可取消 SSE；统一各科等待、失败、重试和输出长度体验。先解决 B01 的长请求锁问题。
- **验收**：接口类型与行为一致；用户能取消；失败不会把不完整批阅当成正式完成记录。

## 6. 后端性能与架构

### B01 · P1 · 用户写锁覆盖整个 AI 网络请求

- **状态**：已复现。
- **位置**：[study-sync.js:66](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/study-sync.js:66)、[ai-client.js:11](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/ai-client.js:11)。
- **证据**：以可控模型响应桩暂停 AI，随后同账号发笔记请求；AI 未结束前笔记未完成，放行 AI 后两者完成。
- **原因**：所有非安全方法 API 均入同一 scope 队列，锁在响应 finish/close 时释放，包含最长约 90 秒的模型请求。断开响应可能提前释放锁，但异步业务不一定已取消。
- **建议**：模型网络调用放在写锁外；只对读取版本—校验—持久化部分加短锁/事务；AI 会话保存用版本或合并策略，防止并发消息覆盖。
- **验收**：AI 进行中仍可保存笔记/草稿；并发答疑历史不丢失；断开连接不会破坏互斥边界。

### B02 · P2 · 本地同步文件 I/O 和整份认证注册表阻塞事件循环

- **状态**：代码确认；大规模实际耗时未测量。
- **位置**：[auth-local.js:8](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-local.js:8)、[db.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/db.js)。
- **问题**：频繁 readFileSync/writeFileSync；每次认证 store.get 都解析整份 registry，set 还遍历清理并整份写回。
- **建议**：认证及高频数据优先采用带索引的事务存储；保留本地/云端适配接口。若引入缓存，明确并发、过期与撤销一致性，避免旧会话继续有效。
- **验收**：账户和历史增加后，普通读取的 p95 和事件循环延迟可控；登录、恢复和会话撤销语义不变。

### B03 · P2 · 云端文档粒度过大，统计与检索重复扫描

- **状态**：代码确认。
- **位置**：[db.js:15](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/db.js:15)、[politics.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/politics.js)、[integration.js:12](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/integration.js:12)。
- **问题**：SQLite 中存大 JSON，分片解决行大小不解决小修改整份重写；政治题册/章节统计反复对全部 answers 过滤，总览每次读取多类完整记录。
- **建议**：先一次遍历建立 bank/chapter 统计索引；再按需要拆分作答、笔记、草稿、账本事件，维护可重建摘要。按测量结果迁移，不必一次重做全部表。
- **验收**：每新增一条记录的写入放大下降；增量统计与全量重算一致；较大历史下总览延迟稳定。

### B04 · P2 · 公共题库与私人状态请求链路耦合

- **状态**：代码确认。
- **位置**：[worker.mjs:103](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/worker.mjs:103)、[datasets.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/datasets.js)、[server.js:148](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:148)。
- **问题**：一般 API 统一经过身份/个人 Durable Object 并 no-store，纯数学题库读取也在其中；政治章节接口把公共题目和个人状态混在同一响应。
- **建议**：版本化公共题库走公共资产/缓存，私人作答另取并组合；保持含个人字段接口 private/no-store，避免把优化变成缓存泄露。
- **验收**：不同账号可共用同版本公共缓存，但笔记、答案记录不互相出现；题库更新能通过版本准确失效。

### B05 · P3 · 本地和云端账号流程重复实现

- **状态**：代码确认。
- **位置**：[auth-local.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-local.js)、[worker.mjs](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/worker.mjs)、[auth-core.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/services/auth-core.js)。
- **问题**：核心密码逻辑已有共享，但认证入口、Cookie、异常身份、迁移和响应在两个环境分别编排；迁移还需要与正常写入统一协调，防止多步骤过程与账号写请求交错。
- **建议**：抽取共享的账号用例与契约测试，环境只负责请求/响应和存储适配；迁移采用事务或持久化进度，避免失败留下不可解释的半合并状态。
- **验收**：相同账号场景在本地和 Worker 测试中响应一致；迁移中断可恢复；不覆盖同期新记录。

## 7. 工程、构建与长期维护

### E01 · P2 · 数学前端缺少清晰的源码构建闭环

- **状态**：仓库内检视确认现有入口主要依赖提交的数学编译产物；外部源码来源未核实。
- **位置**：[public/index.html](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/index.html)、[package.json](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/package.json)、[数学 Markdown 产物](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/public/assets/Md-k3-rmIqK.js)。
- **问题**：现有构建脚本只重建政治和英语；数学修复若直接改带 hash 的 JS，不易审查、回归和保证下次发布保留。
- **建议**：确认数学源码仓库/版本与授权，纳入可复现构建；记录产物来源，限制直接手工改编译文件。不要在源码来源未确定前启动大规模重写。
- **验收**：干净 checkout 可重建数学页面；源码修改可通过构建生成新 hash；安全修复有源码级测试。

### E02 · P3 · 大组件、长路由文件和压缩式业务代码增加修改风险

- **状态**：代码确认。
- **位置**：[server.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js)、[QuizMode.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/QuizMode.tsx)、[EbbinghausNotebookModal.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/components/EbbinghausNotebookModal.tsx)、[App.tsx](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/apps/english/src/App.tsx)。
- **证据**：约 1,044 行 server、2,481 行模考组件、1,271 行背词弹窗、666 行英语 App；共享同步和认证也有密集单行代码。
- **建议**：按用例拆 route/service/storage、按题型和职责拆组件与 hooks；共享 DTO 替代关键 `any`；格式化高风险逻辑，保持行为不变并逐步提交。
- **验收**：可独立测试计时、判分、保存和迁移；不会为调整一个弹窗牵动整个模考状态。

### E03 · P2 · 输入校验和对象键访问需要统一规则

- **状态**：代码确认；不代表已证明任意代码执行或完整原型污染利用链。
- **位置**：[server.js:113](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:113)、[server.js:431](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:431)、[server.js:957](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/server.js:957)、[examService.js:42](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/examService.js:42)。
- **问题**：标签/星级、草稿键和若干 ID 未统一校验；普通对象索引可能命中继承属性；部分数值仅 Number 转换，没有有限数/整数/业务范围约束。试卷名称更新也未沿用创建时的长度限制。
- **建议**：统一 schema、Object.hasOwn/Map 或无原型字典，校验记录是否真实存在；拒绝危险键及不合理数值；错误响应保留稳定错误码，对客户端不暴露内部异常细节。
- **验收**：特殊键、数组代替对象、null、超长键、无穷数值字符串、负时长等输入不会损坏持久化数据或修改继承对象。

### E04 · P3 · 构建链重复执行，生成目录可能保留已删除资源

- **状态**：代码确认；实际云端 Builds 配置未从控制台核实。
- **位置**：[package.json](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/package.json)、[verify.yml](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/docs/workflows/verify.yml)、[prepare-english.cjs](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/scripts/prepare-english.cjs)、[prepare-politics.cjs](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/scripts/prepare-politics.cjs)。
- **问题**：模板先 npm test（pretest 构建 UI），再 npm run build（再次构建 UI）；题库复制/生成覆盖已有目录但未清理删除的源文件。仓库只跟踪 docs/workflows 模板，不应声称已启用 GitHub Actions；README 提到的 Cloudflare Builds 属独立配置。
- **建议**：一次生成/构建后复用产物测试与打包；在隔离 staging 目录生成、校验后切换，避免不安全的大范围清理；干净环境与增量构建对比文件清单。
- **验收**：删除源题库后产物不残留对应可访问文件；一次流水线只构建必要次数；部署确实使用已验证产物。

### E05 · P2 · 测试和观测尚未覆盖真实高风险边界

- **状态**：现有测试结果确认；浏览器与云端覆盖不足是审查边界。
- **位置**：[test/accounts.test.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/test/accounts.test.js)、[test/api.test.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/test/api.test.js)、[test/integration.test.js](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/test/integration.test.js)、[wrangler.jsonc](/D:/PersonalFiles/Agents_test/kaoyan-Math-2.0/wrangler.jsonc)。
- **问题**：大部分验证是接口正常流程和本地存储；云端两项跳过；缺少本报告新增反例、真实离线恢复、跨标签页、动画性能、故障注入和恢复备份演练。当前有 Worker observability 配置，但不能据此认为已有业务指标闭环。
- **建议**：为具体缺陷补反例测试；增加真实浏览器关键流程；在隔离 Worker 环境验证契约、并发和迁移。记录请求 ID、路由耗时、队列等待、快照字节数、模型耗时及失败类别，日志脱敏。
- **验收**：每个 P1/P2 修复都有对应回归；云端测试明确环境和结果；性能指标能区分网络慢、排队慢、渲染慢，日志不含密钥、密码或完整私人内容。

## 8. 上文建议覆盖索引

| 上文提出的主题 | 本报告位置 |
| --- | --- |
| SSRF、重定向、域名校验 | S01、S06 |
| 匿名写入与累计配额 | S02 |
| Markdown 死循环 | S03 |
| 本地 Host 与 DNS 重绑定 | S04 |
| 成长离线队列缺口 | D02 |
| 英语首屏与词典加载 | F02 |
| 全量快照、整块 IndexedDB | F03 |
| 多层 fetch、统一请求层 | F04 |
| 政治路由/英语弹窗延迟加载 | F05 |
| AI 请求持有写锁 | B01 |
| 本地同步 I/O 和认证文件 | B02 |
| 云端 JSON 粒度、统计开销 | B03 |
| 公共题库与私人数据分离 | B04 |
| 本地/云端账号逻辑复用 | B05 |
| 大组件和数学源码 | E01、E02 |
| 回归测试与性能指标 | E05 |
| 侧栏虚拟化、固定内层宽度、稳定 DOM、精确动画、统计缓存和保存时机 | F01 |

## 9. 实施顺序与依赖

### 第一阶段：保护安全与资料

- [ ] S01/S06：统一出站请求安全、响应上限与取消。
- [ ] S02/S05：补齐写入、存储和请求体资源预算。
- [ ] S03：修复有界渲染；先确认 E01 数学源码路径。
- [ ] S04/S07：补本地可信入口，分离访客公开标识与凭据。
- [ ] D01/D03：阻止无效结构入库，修复合并丢失；修复前保留可恢复副本。
- [ ] D05：定义业务提交的原子边界，并做中断恢复测试。

### 第二阶段：优先改善学习体验

- [ ] B01：模型调用不阻塞普通保存。
- [ ] D02/D04/D07/D08：离线覆盖、幂等一致性、异步题卡隔离和局部冲突队列。
- [ ] F01：针对用户反馈，先测量再实施虚拟化与布局隔离。
- [ ] F02/F06：缩短首屏等待，隔离计时更新。
- [ ] D06：新备份格式建立可验证的恢复闭环。

### 第三阶段：按规模优化成本与维护

- [ ] F03/B02/B03：先获取基线，再按热点拆分存储和增量同步。
- [ ] F04/F05/B04/B05：统一请求、适配和公共缓存策略。
- [ ] F07/F08/E02/E03/E04：交互、接口契约、结构与构建整理。
- [ ] E05：把风险回归和指标贯穿各阶段。

不建议为了这些问题直接重写全站，也不建议只添加 memo、延长动画或升级所有依赖就宣告优化完成。每项改动应有清晰触发场景、验收条件和回退方式。

## 10. 建议记录的验收基线

| 场景 | 指标或断言 |
| --- | --- |
| 英语冷启动/热启动 | 首个可用界面时间、加载请求瀑布、公共/私人数据字节数 |
| 侧栏首次与反复展开 | React commit、长任务、Layout/Paint、掉帧及滚动位置 |
| AI 同时保存笔记 | 笔记不等待模型；队列等待与持久化耗时分开记录 |
| 模考持续计时 | 每秒渲染范围、IndexedDB 写入量、后台恢复计时 |
| 账号迁移 | 各科冲突笔记、长期统计、积分和图片配额不丢失、不重复 |
| 断网/刷新/账号切换 | 操作留在正确账号，重复重试不重复记账 |
| 异常输入 | 被拒绝且原数据不变；特殊文本渲染有界 |
| 大历史记录 | 总览 p50/p95、请求体和快照大小、磁盘/云端写入放大 |
| 备份恢复 | 新身份恢复后字段逐类一致，凭据与密钥不随备份泄露 |

以上是审查和改进清单，不表示修复已经实施。当前交付物仅为本 Markdown 报告。
