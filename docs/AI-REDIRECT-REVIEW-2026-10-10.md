# AI 出站请求修复审查（2026-10-10）

## 结论

本次修改可以发布。`services/outbound.js` 使用 `redirect: "manual"`，在返回响应后拒绝所有 3xx 和 `opaqueredirect`，保留官方域名白名单、取消信号、请求超时和响应大小限制。调用方传入 `redirect: "follow"` 也不能覆盖此策略。

Cloudflare 的 Request 文档目前仍列出 `error`，因此不能把本次运行时错误概括为 Fetch 标准不支持该值。这里采用经本项目 Workers 运行时验证的 `manual`，并由应用显式拒绝跳转。按照官方安全说明，自动跟随重定向可能把 Authorization 等头部转发到其他域名，故没有改成 `follow`。

来源：[Cloudflare Request / redirect](https://developers.cloudflare.com/workers/runtime-apis/request/)。

## 商汤预设核对

已在商汤官方文档页面核对以下内容：

- DeepSeek V4.1 Flash 的模型 ID 为 `deepseek-flash`，接口为 `https://token.sensenova.cn/v1/chat/completions`。
- 支持图像输入，采用 `content` 数组中的 `image_url`。
- Chat 接口的 `reasoning_effort: "none"` 可关闭思考；现有客户端传入的 `medium` 会兼容映射为 `high`。

来源：[商汤 DeepSeek V4.1 Flash 文档](https://platform.sensenova.cn/docs#model-deepseek-flash)。

新增预设保留。审查补充修改了图片模型的提示，使其与服务端一致：商汤接口的图片模型留空仍使用 `sensenova-6.8-flash-lite`；要使用 DeepSeek V4.1 Flash 识图，须在图片模型中填写 `deepseek-flash`。本次未改变现有用户配置或默认模型路由。

## 回归验证

| 验证 | 结果 |
| --- | --- |
| 针对性测试：review、ai-client、outbound-worker | 32 / 32 通过 |
| `npm run verify`：两科前端类型检查与构建、Workers 打包、全站测试 | 构建通过；104 项中 102 通过、2 项仅云端测试跳过 |
| 新数据目录下实际 Wrangler Worker 集成测试 | 45 / 45 通过，无跳过 |
| 英语页面 AI 设置及新增预设点击 | 弹窗居中正常打开，自动填入正确地址与模型 |

新增 `test/outbound-worker.test.js` 将真实出站模块打包到 workerd，在与项目一致的兼容日期下测试。仅替换数据库请求上下文及网络上游，不替换 Worker 的 Fetch 实现。正常请求返回 200；301、302、303、307、308 都被拒绝；只访问官方原始地址，未把测试占位密钥转发到跳转目标。此测试会随常规测试执行。

Node 回归测试还覆盖 300、304、399、响应流取消、取消失败不覆盖重定向错误，以及 `opaqueredirect`。AI 客户端测试覆盖 `deepseek-flash` 的文字请求、显式图片模型、推理开关和正式答案输出。

### 本地集成测试环境说明

最初多个测试文件并行共用 Wrangler 开发服务器时，政治并发答题有一个请求由开发代理返回 `Network connection lost`；重复使用同一数据目录还触发了账号限流测试的累计影响。这些失败未被计为通过。

随后使用全新的隔离数据目录，并以 `--test-concurrency=1` 顺序执行测试文件，45 项全部通过。政治答题测试内部的 5 个并发提交保持原样，仍检查仅奖励一次。没有修改业务实现、取消并发断言或增加自动重试。

本地命令：

```powershell
npx wrangler dev --local --port 8812 --persist-to artifacts/ai-redirect-worker-clean-20261010 --show-interactive-dev-session=false --log-level error
$env:TEST_BASE_URL = 'http://127.0.0.1:8812'
node --test --test-concurrency=1 test/api.test.js test/accounts.test.js test/integration.test.js test/review-contract.test.js
```

## 验证边界与产物

未使用真实商汤密钥或消耗模型额度。模型 ID 与参数依据官方文档核对；运行时与错误处理通过隔离上游验证。真实账号额度、模型调用权限和外部服务可用性仍需用户在设置页测试连接确认。

本地详细日志与截图存放于被 Git 忽略的 `artifacts/`：

- `ai-redirect-focused-20261010.log`
- `ai-redirect-verify-20261010.log`
- `ai-redirect-worker-suite-clean-20261010.log`
- `ai-redirect-preset-20261010.jpg`
