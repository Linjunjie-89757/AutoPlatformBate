# Local Runner 交付清单

更新时间：2026-07-06

## 交付结论

Local Runner 主链路已经达到可交付试用状态。

当前版本聚焦“本地执行器 Runner + 服务端 + 平台入口”三段闭环，远程 Runner 暂不纳入近期开发计划。后续不再按“基础能力缺口”推进，而是按真实业务 UAT 中发现的长尾兼容问题做小包修复。

整体完成度按当前目标估算为 90% - 95%：

- Web UI 本地执行、录制、回放、文件上传、失败诊断、真实业务验收已经闭环。
- API 场景和套件本地执行已经闭环，支持 FORM_DATA multipart 和 artifact 文件下发。
- 剩余 5% - 10% 主要是长期真实页面跑出来的低频边界、安装分发体验和运维可观测增强。

## 已完成能力

### Runner 通用能力

- 支持本机 Node Runner 启动和健康检查。
- 支持平台任务轮询、任务领取、状态上报、步骤结果上报、日志上报和最终结果回写。
- 支持 Runner 注册、能力声明、资源槽位、任务取消、超时和会话释放。
- 支持 `artifact:<fileId>` 引用解析。
- 支持 artifactRefs 中的 `localPath` / `path` 文件上传。
- 支持 artifactRefs 中的 `contentBase64` 内联文件落盘后上传。
- 支持每个验收场景前后自动停止轮询和释放 session，避免本地残留任务串场。

### Web UI 本地执行

- 支持 `WEB_CASE_RUN` 本地执行。
- 支持 OPEN、CLICK、FILL、CLEAR、WAIT_FOR、ASSERT_VISIBLE、ASSERT_TEXT、SCREENSHOT。
- 支持 HOVER、DOUBLE_CLICK、RIGHT_CLICK、PRESS_KEY、SELECT。
- 支持 FILE_UPLOAD 和 FILE_PICKER。
- 支持 iframe、shadow DOM 上下文回放。
- 支持 DRAG_TO 和 DRAG_COORDINATES。
- 支持弹窗、新窗口 / 新标签页、下载归档等录制回放边界。
- 支持执行失败截图证据、步骤级报告和正式报告回写。
- 支持缺失上传 artifact 时给出明确错误。
- 服务端创建 Web UI 本地任务时，能从保存的 `uploadArtifactBinding` 自动生成 `artifactRefs`。
- 如果步骤引用 `artifact:<fileId>` 但没有保存绑定或请求传入 artifactRef，服务端会提前 400 拦截，避免创建必失败任务。

### Web UI 录制

- 支持平台侧开始、暂停、继续、撤销、结束录制。
- 支持输入防抖、重复点击去重、步骤栈维护。
- 支持点击、输入、选择、复选 / 单选、文件上传、弹窗、新标签、下载、拖拽等关键操作录制或回放覆盖。
- 支持录制步骤保存为平台标准用例。
- 支持保存后本地回放验证。
- 支持回放失败诊断、快速补断言、质量检查和修复建议。
- 支持浏览器悬浮控制面板基础控制。
- 支持录制上传文件时保存 `uploadArtifactBinding`，回放时转为 Local Runner artifact。

### API 本地执行

- 支持 `API_CASE_RUN`。
- 支持 `API_SCENARIO_RUN`。
- 支持 `API_SUITE_RUN`。
- 支持普通请求、变量提取、脚本变量、软失败继续、场景和套件报告回写。
- 支持 RESPONSE_CODE / STATUS_CODE 断言兼容。
- 支持 FORM_DATA multipart 请求执行。
- 支持 FORM_DATA 文件字段转 `artifact:<fileId>`。
- 服务端创建 API 本地任务时支持结构化 body 和 artifactRefs 下发。
- Runner 侧支持 multipart artifact upload 执行和结果上报。

### 平台入口和可观测

- 配置中心本地执行器入口已接入。
- Runner 节点列表、可选状态、资源不可用原因、任务详情视图已接入。
- Web UI 用例可创建本地 Runner 运行任务并查看正式报告。
- API 场景 / 套件本地运行入口和报告匹配已经接入。
- 本地真实业务验收脚本已经沉淀为正式 npm 命令。

## 常用验证命令

### 前置服务

```bash
npm run runner
```

```bash
server/run-local-server.cmd
```

前端可使用当前本地地址，例如：

```text
http://localhost:4173/
```

### Runner 和前端基础验证

```bash
npm run runner:test
```

```bash
npm run typecheck
```

### 录制回归

```bash
npm run runner:e2e:recording-regression
```

### 真实业务验收

如果登录页会出现，需要提供平台密码环境变量：

```bash
LOCAL_RUNNER_ACCEPTANCE_PASSWORD=****** npm run runner:e2e:real-business
```

Windows PowerShell 示例：

```powershell
$env:LOCAL_RUNNER_ACCEPTANCE_PASSWORD='******'; npm.cmd run runner:e2e:real-business; Remove-Item Env:LOCAL_RUNNER_ACCEPTANCE_PASSWORD
```

该命令会在当前平台中临时创建两个 Web UI 用例：

- 普通点击和文本断言用例。
- 文件上传 artifact 用例。

两条用例都会等待 Runner 任务和正式报告都进入 SUCCESS。

### 后端重点测试

```bash
cd server
.\mvnw.cmd -Dtest=WebUiExecutionControllerIntegrationTests test
```

```bash
cd server
.\mvnw.cmd -Dtest=ApiExecutionDomainServiceLocalRunnerTests test
```

```bash
cd server
.\mvnw.cmd -Dtest=ApiExecutionSuiteDomainServiceLocalRunnerTests test
```

```bash
cd server
.\mvnw.cmd -Dtest=ApiLocalRunnerReportServiceTests test
```

## 最近验收记录

| 时间 | 验收项 | 结果 |
| --- | --- | --- |
| 2026-07-06 | Web UI 普通本地执行真实验收 | PASS，Runner SUCCESS，正式报告 3/3 |
| 2026-07-06 | Web UI 上传 artifact 真实验收 | PASS，artifactRefs 正确下发，正式报告 3/3 |
| 2026-07-06 | Web UI 上传 artifact 后端集成测试 | PASS |
| 2026-07-06 | Runner 录制边界回归 | PASS |
| 2026-07-06 | 前端类型检查 | PASS |

## 当前限制

- 当前交付目标只包含本地 Runner，不包含远程 Runner。
- 真实验收脚本会创建临时用例和正式报告，适合本地或测试环境，不建议直接对生产数据运行。
- 真实验收脚本默认使用有头浏览器；CI 中可以通过 `LOCAL_RUNNER_ACCEPTANCE_HEADLESS=true` 切换无头。
- 旧历史用例如果只有 `artifact:<fileId>`，但没有保存 `uploadArtifactBinding`，现在会被服务端提前拦截。需要重新选择文件并保存一次。
- 浏览器原生系统级文件选择窗口不作为自动化目标，文件上传使用 Playwright 的文件注入能力。
- 高度定制的 canvas、低代码画布、复杂拖拽排序、浏览器权限弹窗、跨域受限 iframe 仍可能需要按真实页面专项适配。
- 安装包、开机自启、自动升级、Runner 日志采集面板等偏运维体验的能力尚未作为主线完成。

## 后续目标包建议

### 目标包 A：UAT 长尾兼容池

触发条件：真实业务页面跑出稳定复现问题。

处理内容：

- 特殊控件定位失败。
- 复杂 iframe / shadow DOM 组合。
- canvas 或坐标级拖拽偏移。
- 下载文件内容归档规则补充。
- 浏览器权限、二次弹窗、特殊跳转等。

交付标准：每个问题都补最小复现页或回归脚本，不做泛化过度设计。

### 目标包 B：交付体验增强

触发条件：准备给更多非开发用户试用。

处理内容：

- Runner 启动检查和错误提示优化。
- 本地端口、浏览器安装、账号登录态的引导说明。
- Runner 日志位置和诊断包导出。
- 安装 / 升级 / 清理脚本。

交付标准：用户不需要开发同学现场协助，也能完成启动、登录、执行和问题反馈。

### 目标包 C：报告和证据增强

触发条件：测试同学开始把本地执行结果作为缺陷依据。

处理内容：

- 失败截图、下载文件、上传文件、控制台日志、网络摘要的报告聚合。
- Web UI 和 API 本地执行报告字段统一。
- 失败原因分类和修复建议继续细化。

交付标准：报告能解释“为什么失败”，而不是只显示失败。

### 目标包 D：录制体验二次增强

触发条件：用户高频使用录制生成用例。

处理内容：

- 悬浮面板体验继续打磨。
- 快速添加断言、批量步骤整理、步骤分组。
- 元素候选入库审核体验优化。
- 录制后自动质量检查和修复队列增强。

交付标准：录制从“可用”进入“高频好用”。

## 暂缓项

- 远程 Runner。
- WebSocket 实时通信替换 HTTP 轮询。
- 多浏览器完整矩阵。
- 大规模并发调度。
- AI 自动生成完整断言和自动修复全部失败。

这些能力不是当前 Local Runner 可交付的阻塞项，建议等真实试用反馈稳定后再重新评估优先级。
