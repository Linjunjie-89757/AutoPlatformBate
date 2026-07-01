# Local Runner 统一执行代理总设计

## 1. 文档目的

本文档用于记录自动化测试平台后续 Local Runner 的统一设计口径，避免后续开发 Web UI 本地执行、API 本地执行、执行机集群时遗忘关键约束。

本文不是替代 `Web UI元素智能采集Local Runner最终设计.md`。两者关系如下：

- `Web UI元素智能采集Local Runner最终设计.md`：专注 Web UI 元素智能采集、AI 候选、真机验证和元素库入库。
- 本文档：专注 Local Runner 作为统一执行代理的整体架构，覆盖 Web UI 元素采集、元素验证、Web UI 用例执行、API 用例/场景执行。

核心目标：

- 缓解平台服务器多人并发执行压力。
- 支持用户本机网络、VPN、内网、证书、代理、SSO、验证码、扫码等服务端难以处理的场景。
- 让平台后端从“执行者”升级为“调度中心 + 数据中心 + 报告中心”。
- 让 Runner 成为可本地执行、可指定执行机执行、可未来组成执行机池的统一执行代理。

## 2. 总体定位

Local Runner 是平台的本地执行代理，不是另一个业务后端。

职责边界：

```text
平台前端：
  发起任务、选择执行位置、展示进度、查看报告、操作调试入口

平台后端：
  用例管理、任务调度、权限控制、环境变量下发、状态流转、日志报告存储、附件管理

Local Runner：
  接收或拉取任务，在本机执行 API / Web UI / 元素采集 / 元素验证，并回传过程日志和结果
```

核心原则：

- 平台后端是唯一数据中心。
- Runner 只执行任务，不拥有业务数据最终状态。
- Runner 不直接决定用例、元素、报告的最终存储结构。
- 任务状态、幂等、取消、超时、重试、降级必须由确定性代码控制。
- AI 只能做增强分析，不能替代状态机和执行规则。

## 3. 总体架构

```text
平台 Web 前端
  |
  | 本地模式：调用 127.0.0.1 Runner
  | 服务端模式：调用平台后端
  v
平台后端
  |
  | 任务下发 / Runner 轮询 / 结果回传
  v
Local Runner
  |
  | Playwright / HTTP / 本机网络 / 登录态 / 代理
  v
被测系统
```

Local Runner 内部模块：

```text
Local Runner
├─ Core 公共内核
│  ├─ 健康检查
│  ├─ 版本信息
│  ├─ Token 鉴权
│  ├─ Origin 校验
│  ├─ 心跳上报
│  ├─ 任务队列
│  ├─ 并发限制
│  ├─ 日志脱敏
│  ├─ 附件上传
│  └─ 异常恢复
├─ Browser Engine 浏览器引擎
│  ├─ Playwright 启动
│  ├─ Chromium / Firefox / WebKit 预留
│  ├─ 有头 / 无头模式
│  ├─ 页面会话
│  ├─ 登录态快照
│  └─ 截图 / HAR 预留
├─ Web UI Element Collect 元素采集
│  ├─ DOM 采集
│  ├─ 页面截图
│  ├─ locator 初步生成
│  └─ 素材上传
├─ Web UI Element Validate 元素验证
│  ├─ locator 批量校验
│  ├─ 可见性 / 唯一性 / 可交互性判断
│  └─ 局部截图证据
├─ Web UI Case Runner 用例执行
│  ├─ 步骤解释器
│  ├─ Playwright 执行
│  ├─ 等待 / 断言 / 截图
│  └─ 步骤日志和报告上传
└─ API Runner 接口执行
   ├─ HTTP 客户端
   ├─ 变量上下文
   ├─ 断言
   ├─ 提取变量
   ├─ 前后置脚本预留
   └─ 报告上传
```

## 4. 支持的任务类型

建议统一任务类型：

```text
WEB_ELEMENT_COLLECT
WEB_ELEMENT_VALIDATE
WEB_CASE_RUN
API_CASE_RUN
API_SCENARIO_RUN
```

后续可扩展：

```text
APP_CASE_RUN
PERFORMANCE_RUN
DATABASE_STEP_RUN
```

第一阶段不要扩展过多任务类型，避免 Runner 过早变复杂。

## 5. 统一任务生命周期

任务状态建议统一：

```text
PENDING
ASSIGNED
RUNNING
PAUSED
SUCCESS
FAILED
CANCELED
DEGRADED
TIMEOUT
RUNNER_OFFLINE
```

状态含义：

| 状态 | 含义 |
| --- | --- |
| PENDING | 平台已创建任务，等待执行 |
| ASSIGNED | 已分配给某个 Runner |
| RUNNING | Runner 正在执行 |
| PAUSED | 调试模式下暂停，等待用户继续 |
| SUCCESS | 执行成功 |
| FAILED | 执行失败 |
| CANCELED | 用户取消或平台取消 |
| DEGRADED | 任务部分完成，但缺少关键验证或证据 |
| TIMEOUT | 执行超时 |
| RUNNER_OFFLINE | Runner 离线导致任务终止 |

统一链路：

```text
前端发起任务
-> 平台后端创建任务
-> Runner 领取任务或被前端本地调用
-> Runner 上报 RUNNING
-> Runner 分步上传日志 / 截图 / 请求响应
-> Runner 上传最终结果
-> 平台生成统一报告
```

## 6. 执行位置设计

执行入口建议统一增加“执行位置”：

```text
执行位置：
- 服务端执行
- 本地执行
- 指定 Runner 执行
- Runner 池执行，后续
```

### 6.1 服务端执行

适合：

- 无登录或统一登录态的 API / Web UI。
- CI 定时任务。
- 统一测试环境。
- 不需要用户本机网络的场景。

风险：

- 多人并发会压平台服务器。
- 服务端可能访问不了被测系统内网。
- 服务端难以处理扫码、验证码、SSO。

### 6.2 本地执行

适合：

- 用户本机才能访问被测系统。
- 需要本机代理、VPN、证书、内网。
- 需要用户手动登录、扫码、验证码。
- 需要可视化调试 Web UI。
- 希望把执行压力下沉到用户电脑。

### 6.3 指定 Runner 执行

适合：

- 团队共用执行机。
- 固定内网机器。
- 固定浏览器环境。
- 夜间回归。

### 6.4 Runner 池执行

适合后续分布式：

- 多 Runner 节点注册到平台。
- 平台按能力、空闲状态、标签、网络区域分配任务。
- 支持大批量回归和多团队共享。

## 7. Web UI 元素采集模块

作用：从真实登录后的页面采集按钮、输入框、表格、链接、弹窗元素，生成元素库候选。

流程：

```text
用户打开 AI 采集
-> Runner 打开本地浏览器
-> 用户手动登录并进入业务页面
-> Runner 采集 DOM / URL / title / 可见文本 / 截图
-> 上传后端创建采集任务
-> 后端规则 + AI 处理
-> 前端展示候选
-> 用户确认保存到元素库
```

Runner 负责：

- 打开页面。
- 复用本地登录态。
- 读取当前真实页面 DOM。
- 提取原始候选。
- 生成基础 locator。
- 截全局截图。
- 上传素材。

平台后端负责：

- 采集任务状态。
- 原始快照存储。
- 规则过滤。
- 去重合并。
- 稳定性评分。
- AI 命名、分组、解释。
- 最终候选生成。

## 8. Web UI 元素真机验证模块

作用：验证 locator 在真实页面中是否能找到、是否唯一、是否可见、是否可交互。

输入：

```text
taskId
runnerId
sessionId
locatorType
locatorValue
frameChain，后续
shadowPath，后续
```

Runner 验证动作：

```text
locator.count()
first().scrollIntoViewIfNeeded()
first().isVisible()
first().isEnabled()
first().isEditable()
first().screenshot()
```

输出：

```text
validationStatus: PASSED / FAILED / MULTIPLE / UNVERIFIED
matchCount
visible
enabled
editable
screenshotBase64
validationMessage
```

用途：

- AI 采集候选保存前验证。
- 元素库日常批量验证。
- 元素失效台账。
- 用例运行前的元素健康检查。

批量校验增强：

- 用户选择一个页面对象或模块。
- Runner 按页面打开目标页面。
- 批量验证页面下所有元素。
- 回写元素最近验证状态。
- 生成失效元素台账。

## 9. Web UI 用例本地执行模块

作用：让 Web UI 自动化用例在用户本机或指定 Runner 执行。

流程：

```text
用户点击运行 Web UI 用例
-> 选择本地 Runner / 指定 Runner
-> 平台创建 runId
-> Runner 拉取用例、环境、变量集、登录态配置
-> Runner 打开浏览器
-> 按步骤执行
-> 实时上传步骤日志和截图
-> 平台生成报告
```

步骤类型：

```text
OPEN
CLICK
FILL
CLEAR
HOVER
DOUBLE_CLICK
RIGHT_CLICK
PRESS_KEY
SELECT
FILE_UPLOAD
WAIT_FOR
ASSERT_VISIBLE
ASSERT_TEXT
ASSERT_URL
ASSERT_TITLE
ASSERT_ATTRIBUTE
ASSERT_COUNT
SCREENSHOT
```

执行规则必须和服务端 Web UI 引擎一致：

- 元素等待策略一致。
- 默认超时时间一致。
- 步骤重试策略一致。
- 断言规则一致。
- 失败截图时机一致。
- continueOnFailure 行为一致。
- 变量渲染规则一致。
- 报告字段一致。

运行模式：

| 模式 | 用途 |
| --- | --- |
| 调试模式 | 有头浏览器，可观察执行过程，失败可保留现场 |
| 无人执行模式 | 无头浏览器，适合批量回归 |

调试增强建议：

- 单步执行，后续。
- 断点暂停，后续。
- 失败自动暂停浏览器。
- 保留页面现场。
- 失败步骤重新运行。
- HAR 抓包，默认关闭，后续增强。

## 10. API 用例 / 场景本地执行模块

作用：让接口自动化可以在用户本机网络环境中执行，减轻服务端压力并支持内网接口。

流程：

```text
用户点击运行 API 用例 / 场景
-> 选择本地 Runner / 指定 Runner
-> 平台创建 runId
-> Runner 拉取接口定义、环境、变量集
-> Runner 发起 HTTP 请求
-> 执行断言、提取变量、链路上下文传递
-> 上传请求响应、步骤日志、报告
```

API Runner 能力：

- HTTP method / URL / query / headers / body。
- multipart / form / json / raw。
- 变量渲染。
- 断言。
- 提取变量。
- 场景上下文。
- 超时。
- 重试。
- 日志脱敏。
- 报告上传。

后续可扩展：

- 前置 / 后置 JS 脚本。
- SQL 步骤。
- Redis 步骤。
- Mock 规则同步。

谨慎点：

- SQL / Redis 涉及账号、权限、审计，不能一期就做重。
- 本地执行敏感变量必须只在内存使用，不写入明文日志。
- API 本地执行的变量、断言、脚本语义必须和服务端一致。

## 11. 执行一致性强约束

这是 Local Runner 最关键的企业落地约束。

同一条用例：

```text
服务端执行
本地 Runner 执行
指定 Runner 执行
```

结果语义必须一致。

### 11.1 API 执行一致性

必须统一：

- 变量渲染语法。
- 环境变量优先级。
- 变量集优先级。
- 运行时变量。
- 提取变量覆盖规则。
- 断言规则。
- 前置 / 后置脚本语义。
- 超时。
- 重试。
- 请求日志脱敏。
- 报告结构。

建议：

- 优先抽象统一执行协议。
- 如果 Java 后端和 Node Runner 无法共用代码，则必须通过一致性测试保证行为一致。
- 不强行为了“共用代码”引入过重 JS 引擎，避免架构复杂化。

### 11.2 Web UI 执行一致性

必须统一：

- locator 类型。
- 元素等待策略。
- 步骤超时。
- 点击 / 输入 / 清空 / 选择行为。
- 断言规则。
- 截图策略。
- 失败处理。
- continueOnFailure。
- 步骤日志字段。
- 报告字段。

建议：

- 后端和 Runner 都按同一份步骤协议解释。
- 用协议版本号控制兼容性。
- 用回归用例验证服务端执行和 Runner 执行结果一致。

## 12. 并发控制与任务隔离

Runner 必须有单机并发限制。

建议默认值：

```text
Web UI 浏览器任务最大并发：1
Web UI 浏览器任务可配置上限：2-3
API 任务最大并发：可配置，默认 5
```

隔离规则：

- Web UI 任务独占 browser context。
- 调试模式独占当前页面。
- API 任务使用独立线程池或队列。
- API 任务不能抢占 Web UI 调试任务资源。
- 同一个 browser context 同一时间只绑定一个 Web UI 任务。

优先级：

```text
手动调试任务 > 手动运行任务 > CI 触发任务 > 批量回归任务
```

队列策略：

- 超过并发上限时排队。
- 前端展示排队状态。
- 用户可取消排队任务。
- 长时间排队可自动超时。

## 13. 网络与安全

### 13.1 本地服务安全

Runner 本地服务：

- 仅监听 `127.0.0.1`。
- 不监听 `0.0.0.0`。
- 禁止局域网其他设备直接访问。
- 校验 Origin。
- 预留 `X-Web-Ui-Runner-Token`。
- 产品化阶段必须启用 Token 绑定。

### 13.2 Runner 与平台通信

生产环境要求：

- HTTPS。
- Token 鉴权。
- Runner 注册。
- Runner 版本校验。
- Runner 能力上报。
- Runner 心跳。

### 13.3 敏感数据

敏感数据包括：

- 环境密码。
- API Token。
- Cookie。
- 登录态 storageState。
- 数据库密码。
- 请求 Header 中的认证字段。
- 响应中的手机号、身份证、订单号等。

处理规则：

- Runner 内存中临时使用。
- 默认不写入本地日志文件。
- 上传报告前脱敏。
- 平台日志按脱敏规则展示。
- 会话快照加密存储，产品化阶段。

### 13.4 系统代理

Runner 需要支持：

- 继承本机系统代理。
- 手动配置 HTTP / HTTPS 代理。
- 不同环境使用不同代理，后续。

用途：

- 公司内网代理。
- VPN 场景。
- 抓包调试。

## 14. 浏览器会话与登录态

推荐主路径：

```text
Runner 自己打开受控 Chromium
-> 用户在 Runner 浏览器中登录
-> Runner 保存 storageState
-> 后续执行加载登录态快照
```

不建议一期直接接管用户日常 Chrome：

- 安全风险更高。
- 个人浏览器 Profile 复杂。
- 插件和缓存可能影响稳定性。
- Playwright 接管难以保证一致性。

执行模式：

| 模式 | 说明 |
| --- | --- |
| 调试模式 | 有头浏览器，适合人工观察、扫码、断点 |
| 无人执行模式 | 无头浏览器，适合回归、CI、批量执行 |

会话管理：

- 按 workspace + environment 保存登录态。
- 记录保存时间、来源 URL、有效期提示。
- 登录态过期时提醒重新保存。
- 支持清空登录态。
- 执行时显式选择是否加载登录态。

## 15. 心跳、断线与异常容错

### 15.1 心跳

Runner 定时上报：

```text
runnerId
runnerVersion
capabilities
currentTaskId
queueSize
browserAlive
pageAlive
currentUrl
cpu/memory，后续
lastActiveAt
```

建议频率：

```text
3-5 秒一次
```

平台处理：

- 超过阈值未收到心跳，标记 Runner 离线。
- Runner 离线时，运行中任务进入 `RUNNER_OFFLINE` 或 `FAILED`。
- 支持前端提示“客户端离线”。

### 15.2 断线续传

网络短暂断开时：

- Runner 继续本地执行。
- 日志暂存在内存或本地临时队列。
- 网络恢复后补传。
- 超过最大缓存或最大等待时间则任务失败。

### 15.3 浏览器崩溃

处理规则：

- 当前步骤标记失败。
- 截图无法获取时记录原因。
- 根据用例配置决定是否继续后续步骤。
- 自动清理残留进程。
- 不无限重启浏览器。

### 15.4 自动清理

任务结束后：

- 关闭临时 browser context。
- 保留调试模式失败现场，按用户选择。
- 清理临时截图、HAR、日志缓存。
- 防止大量 Chromium 进程驻留。

## 16. 环境与变量隔离

Runner 执行必须严格加载平台传入的环境和变量集。

变量来源优先级建议：

```text
内置变量
< 项目默认变量
< 环境变量
< 变量集变量
< 运行时变量
< 步骤提取变量
```

隔离规则：

- 不默认读取本机全局环境变量。
- 不混用上一次任务变量上下文。
- 每个任务创建独立执行上下文。
- 任务结束后销毁上下文。
- 报告保存执行时变量快照，敏感值脱敏。

## 17. 报告与附件统一

无论服务端执行还是 Runner 执行，报告格式必须统一。

Web UI 报告：

- runId。
- caseId。
- browserType。
- headless。
- runnerId。
- executionLocation。
- environmentId。
- variableSetId。
- stepResults。
- screenshotPolicy。
- failureScreenshot。
- errorMessage。
- duration。

API 报告：

- runId。
- caseId / scenarioId。
- runnerId。
- executionLocation。
- request。
- response。
- assertionResults。
- extractedVariables。
- duration。
- errorMessage。

附件：

- 截图。
- HAR，后续。
- 控制台日志，后续。
- 请求响应体。
- 脱敏后的执行上下文快照。

## 18. 版本与能力兼容

Runner 健康检查必须返回：

```text
runnerVersion
protocolVersion
capabilities
playwrightVersion
browserInstalled
browserVersions
platform
```

平台调度任务前检查：

- Runner 是否在线。
- Runner 版本是否满足任务要求。
- Runner 是否支持任务类型。
- Runner 是否支持浏览器内核。
- Runner 是否支持需要的协议版本。

不兼容时：

- 阻止任务下发。
- 前端提示升级 Runner。
- 给出升级方式。

## 19. 客户端产品形态

当前阶段：

```text
npm.cmd run runner
```

产品化目标：

```text
Web UI Runner.exe
```

Windows 托盘程序建议能力：

- 开机自启，可选。
- 启动 / 停止 Runner。
- 查看端口状态。
- 查看当前登录用户。
- 查看当前连接平台。
- 查看正在执行任务。
- 查看浏览器进程。
- 查看实时日志。
- 一键打开日志目录。
- 一键清理临时文件。
- 自动版本更新。

产品化前提：

- Runner 协议稳定。
- 健康检查稳定。
- 任务状态稳定。
- 日志和报告格式稳定。

## 20. 迭代阶段

### 20.1 一期：支撑 AI 元素库

目标：

- Local Runner 基础 HTTP 服务。
- 健康检查。
- Playwright Chromium 启动。
- 页面打开。
- 登录态保存和复用。
- DOM 采集。
- 元素 locator 生成。
- 元素真机验证。
- 采集任务状态。
- 候选保存到元素库。

当前项目已在这条线上推进。

### 20.2 二期：Web UI 用例本地执行

目标：

- Web UI 任务创建。
- Runner 拉取 Web UI 用例。
- 步骤解释器。
- Playwright 执行。
- 步骤日志上传。
- 失败截图。
- 报告和服务端执行格式统一。
- 调试模式 / 无人执行模式。

### 20.3 三期：API 本地执行

目标：

- API 任务创建。
- Runner 拉取 API 用例 / 场景。
- HTTP 执行引擎。
- 变量渲染。
- 断言。
- 变量提取。
- 场景上下文。
- 报告上传。
- 与服务端 API 执行语义一致。

### 20.4 四期：Runner 产品化

目标：

- Windows 托盘程序。
- 日志管理。
- 进程自动回收。
- 版本检查。
- 自动升级。
- Token 绑定。
- 安全加固。
- 单机并发配置。
- 网络代理配置。

### 20.5 五期：分布式执行机

目标：

- Runner 注册中心。
- Runner 节点池。
- 指定执行机器。
- 按标签调度。
- 按能力调度。
- 批量任务分发。
- 从个人本地执行升级为团队执行集群。

## 21. 必须采纳的设计约束

后续开发必须坚持：

1. 执行逻辑一致性优先于开发速度。
2. Runner 不是数据中心，平台后端才是。
3. Runner 必须有并发限制和任务隔离。
4. 敏感数据不能明文落地日志。
5. 本地服务只监听 `127.0.0.1`。
6. 生产通信必须 HTTPS + Token。
7. Runner 需要心跳、离线识别和异常恢复。
8. Web UI 任务独占浏览器会话。
9. API 任务和 Web UI 任务资源隔离。
10. 环境变量必须按平台上下文加载，不能污染。
11. 报告格式必须统一。
12. Runner 能力必须通过 `/health` 明确上报。

## 22. 谨慎采纳的能力

以下能力有价值，但不建议一期直接做：

- 直接接管用户日常 Chrome Profile。
- SQL / Redis 本地步骤。
- HAR 全量抓包默认开启。
- 自动登录识别和验证码处理。
- 性能测试本地执行。
- 复杂脚本引擎跨 Java / Node 强共用。

建议策略：

- 先统一协议和结果语义。
- 再用一致性测试约束行为。
- 最后按真实业务需要逐步扩展。

## 23. 通信模式：推送、轮询与兜底

Runner 和平台之间需要同时支持“拉模式”和“推模式”，不同执行场景使用不同主路径。

### 23.1 拉模式：Runner 主动轮询

适用场景：

- 用户本地执行。
- 本地 Runner 只监听 `127.0.0.1`，平台无法直接访问用户电脑。
- 用户网络环境复杂，平台不能稳定推送到 Runner。

基本流程：

```text
Runner 启动
-> Runner 定时向平台上报心跳和能力
-> Runner 按 runnerId / 用户 / workspace 拉取待执行任务
-> 平台返回已分配给该 Runner 的任务
-> Runner 执行并回传日志和结果
```

约束：

- 轮询频率可配置，默认 2 秒一次。
- 本地调试模式可适当缩短到 1 秒，降低等待感。
- 轮询必须携带 `runnerId`、`runnerVersion`、`protocolVersion`、`capabilities`。
- 平台只返回与 Runner 能力匹配、且已分配给该 Runner 的任务。
- Runner 拉取任务后，平台必须加任务锁，避免重复执行。

### 23.2 推模式：平台下发任务

适用场景：

- 指定 Runner 执行。
- Runner 池。
- 公司内执行机与平台之间有稳定连接。
- 后续 WebSocket / 长连接通道成熟后。

基本流程：

```text
平台选择 Runner
-> 校验 Runner 在线、版本、能力、空闲资源
-> 平台下发任务
-> Runner ACK
-> Runner 执行并持续回传日志和状态
```

约束：

- 下发前必须校验 Runner 版本和能力。
- 不兼容时直接阻断任务，并提示前端升级 Runner 或更换执行位置。
- 下发失败时，任务进入待重推队列。
- 待重推最多 3 次。
- 重推仍失败后，任务标记为 `RUNNER_OFFLINE` 或 `FAILED`。

### 23.3 兜底策略

建议最终形态：

```text
本地执行：Runner 轮询为主
指定 Runner / Runner 池：平台推送为主，Runner 轮询兜底
```

无论使用哪种模式，任务领取和结果回传都必须走同一套幂等规则。

## 24. 任务幂等与分布式锁

任务幂等是 Runner 产品化的核心约束，防止同一任务被重复执行、重复回传、重复生成报告。

### 24.1 全局幂等键

每次运行任务必须生成全局唯一：

```text
runId
```

`runId` 是任务执行全过程的幂等键。

适用范围：

- Web UI 用例运行。
- API 用例运行。
- API 场景运行。
- 元素采集任务。
- 元素验证任务。

### 24.2 任务领取幂等

Runner 拉取或接收任务后，必须先向平台上报：

```text
runId
runnerId
ASSIGNED
assignedAt
```

平台处理：

- 如果任务仍是 `PENDING`，更新为 `ASSIGNED`。
- 如果任务已分配给同一个 Runner，返回当前任务上下文。
- 如果任务已分配给其他 Runner，拒绝本次领取。
- 如果任务已终态，直接返回历史结果。

### 24.3 分布式锁

平台侧需要基于 `runId` 加锁。

锁粒度：

```text
runId
```

锁保护范围：

- 任务领取。
- 状态从 `PENDING` 到 `ASSIGNED`。
- 状态从 `ASSIGNED` 到 `RUNNING`。
- 最终结果写入。

### 24.4 结果回传幂等

Runner 回传结果时必须携带：

```text
runId
runnerId
attemptNo
stepId，步骤级结果
sequenceNo，日志流
```

平台处理：

- 同一个 `runId + stepId` 多次回传时，以最新结果为准，保留更新时间。
- 同一个 `sequenceNo` 的日志重复回传时直接忽略。
- 任务已终态后重复回传最终结果，返回已有结果，不重复生成报告。

## 25. 脱敏引擎

脱敏能力需要从 Core 中独立为：

```text
Masking Engine 脱敏引擎
```

原因：

- API 请求响应、Web UI 截图、环境变量、Cookie、登录态都可能包含敏感信息。
- 企业部署时，脱敏规则通常由平台统一配置。
- Runner 必须在上传日志和附件前完成本地脱敏。

### 25.1 脱敏规则来源

规则来源：

- 平台内置规则。
- workspace 级规则。
- 项目级规则。
- 用户自定义正则规则。

Runner 启动或执行任务前拉取脱敏规则。

### 25.2 脱敏范围

必须支持：

- 请求 Header。
- 请求 Body。
- 响应 Body。
- Cookie。
- 环境变量。
- 变量集。
- 步骤日志。
- 错误堆栈。
- 截图脱敏，后续增强。

### 25.3 脱敏方式

支持：

- 字段名匹配，例如 `password`、`token`、`authorization`。
- 正则匹配，例如手机号、身份证、银行卡。
- 路径匹配，例如 JSONPath。
- 自定义规则。

约束：

- 脱敏在 Runner 内存中执行。
- 本地临时日志默认也保存脱敏后内容。
- 敏感原文不写本地日志。
- 上传平台的数据必须已经脱敏。

## 26. 登录态生命周期

登录态是 Web UI 本地执行和元素采集的关键能力，需要明确生命周期和隔离规则。

### 26.1 存储隔离

登录态按以下维度隔离：

```text
workspaceId + environmentId
```

原因：

- 防止测试环境登录态污染生产环境。
- 防止不同空间、不同项目之间 Cookie 串用。
- 支持同一个用户在多个环境保存不同登录态。

### 26.2 有效性校验

Runner 执行任务前应做基础校验：

- storageState 文件是否存在。
- Cookie 是否存在。
- Cookie `expires` 是否已经过期。
- 保存时间是否超过建议刷新周期。

注意：

- Cookie 未过期不代表登录态一定有效。
- 最终仍以打开页面是否跳登录页为准。

### 26.3 清理策略

建议策略：

- 超过 7 天未使用的登录态可自动清理，具体天数平台可配置。
- 前端支持清空指定环境登录态。
- Runner 支持清空当前 workspace + environment 的登录态。
- 产品化后登录态文件建议加密存储。

### 26.4 使用规则

执行任务时必须显式说明：

```text
是否加载登录态
加载哪个 environmentId 的登录态
登录态来源 URL
登录态保存时间
```

报告中可记录登录态快照 ID，但敏感内容不入报告。

## 27. 多用户共用 Runner 隔离

指定 Runner 和 Runner 池阶段，会出现多用户共用同一台执行机。

必须增加隔离规则。

### 27.1 上下文隔离

不同用户、不同任务必须使用独立上下文：

- Web UI：独立 browser context。
- API：独立 HTTP 上下文。
- 变量：独立变量上下文。
- 登录态：按用户、workspace、environment 隔离。

禁止：

- 不同用户复用同一个 browser context。
- 不同用户共享 Cookie。
- 不同任务共享变量上下文。

### 27.2 资源配额

后续 Runner 池需要支持：

- 每个用户最大并发数。
- 每个 workspace 最大并发数。
- Web UI 浏览器任务最大并发数。
- API 任务最大并发数。
- 队列长度限制。

CPU / 内存硬限制可以后续做，不作为一期强约束。

### 27.3 审计记录

共用 Runner 必须记录：

```text
runnerId
userId
workspaceId
runId
taskType
startedAt
finishedAt
executionLocation
```

便于排查资源争用、权限问题和报告归属。

## 28. DEGRADED 判定规则

`DEGRADED` 表示任务主体链路完成，但关键证据、验证或附属结果不完整。

它不是普通失败的替代品。

### 28.1 Web UI 元素验证

可判定为 `DEGRADED` 的情况：

- locator 主体验证完成，但局部截图上传失败。
- Runner 离线导致部分候选未验证，但规则候选仍可展示。
- AI 分析超时，但规则候选已经生成。
- 过滤恢复项未能完成真机验证。

必须判定为 `FAILED` 的情况：

- 页面无法打开。
- 采集素材为空且无法恢复。
- Runner 无法读取当前页面。

### 28.2 Web UI 用例执行

可判定为 `DEGRADED` 的情况：

- 用例核心步骤执行成功，但截图或日志附件上传部分失败。
- 报告生成成功，但 HAR / 控制台日志等非核心附件缺失。
- 非阻断步骤失败，且用例配置允许继续执行。

必须判定为 `FAILED` 的情况：

- 核心断言失败。
- 必需步骤失败且未配置继续。
- 浏览器崩溃导致用例无法继续。
- 登录失败导致后续步骤无法执行。

### 28.3 API 用例执行

谨慎使用 `DEGRADED`。

必须判定为 `FAILED` 的情况：

- 核心断言失败。
- 请求失败且无可接受降级规则。
- 变量提取失败导致后续必需步骤无法执行。

可判定为 `DEGRADED` 或 `WARNING` 的情况：

- 软断言失败。
- 非核心耗时检查失败。
- 请求执行和核心断言成功，但部分日志附件上传失败。

原则：

```text
核心断言失败不能随便降级。
只有明确标记为软断言或非核心证据缺失时，才允许 DEGRADED。
```

## 29. 脚本沙箱

API 本地执行后续必然会涉及前置 / 后置脚本，必须提前约束安全边界。

### 29.1 沙箱目标

脚本可以做：

- 读取和写入平台允许的变量。
- 构造请求参数。
- 处理响应数据。
- 执行断言辅助逻辑。
- 调用平台开放的有限工具函数。

脚本禁止：

- 读取本地文件。
- 写本地文件。
- 执行系统命令。
- 访问 Runner 进程环境变量。
- 访问非授权网络资源。
- 修改 Runner 内部状态。

### 29.2 引擎选择

对外协议不锁死具体实现，但一期 Local Runner 已按 Node `vm` MVP 落地，用于验证 API 前置 / 后置脚本的执行语义。

候选方案：

- QuickJS。
- Node `vm` 加强隔离，一期 MVP。
- isolated-vm。
- 其他受限 JS 沙箱。

设计约束：

- 先统一脚本协议和能力边界。
- 再选择具体引擎。
- 不为了“代码共用”牺牲安全边界。

一期 Node `vm` 边界：

- 不注入 `process`。
- 不注入 `require`。
- 不注入文件系统、系统命令、任意网络请求客户端。
- 每次脚本执行受 `timeoutPolicy.scriptTimeoutMs` 控制，默认 1000ms。
- 只暴露 `variables`、`request`、`response`、`utils` 四类上下文对象。

### 29.2.1 API 脚本协议

API 用例快照统一使用：

```json
{
  "preScript": "variables.set('TOKEN', variables.get('USERNAME') + '-token');",
  "postScript": "const data = response.json(); variables.set('ORDER_ID', data.orderId);"
}
```

可用 API：

- `variables.get(name)`：读取运行时变量、变量集、环境变量。
- `variables.set(name, value)`：写入运行时变量，后续模板可使用。
- `variables.unset(name)`：删除运行时变量。
- `variables.toObject()`：返回当前变量快照。
- `response.status`、`response.headers`、`response.body`、`response.text()`、`response.json()`：仅 postScript 可使用。
- `utils.upper/lower/trim/jsonParse/jsonStringify/now`：纯工具函数。

执行顺序：

1. 加载环境快照、变量快照、运行时变量。
2. 执行 `preScript`。
3. 渲染请求模板并发送请求。
4. 执行断言和提取器。
5. 执行 `postScript`。
6. 回传 `scriptResults`、步骤结果和最终运行时变量。

失败策略：

- preScript 失败：请求不发送，当前步骤失败。
- postScript 失败：请求证据保留，当前步骤失败。
- API_CASE_RUN 脚本失败：任务失败。
- API_SCENARIO_RUN 脚本失败：遵守 `continueOnFailure` 和 `stopOnFirstFailure`。
- 脚本超时：按脚本失败处理。

### 29.3 一致性要求

服务端执行和 Runner 执行必须保持脚本语义一致。

如果后端是 Java、Runner 是 Node，无法直接共用执行代码，也必须通过一致性测试保证：

- 变量输入一致。
- 脚本输出一致。
- 异常处理一致。
- 超时处理一致。

## 30. 产品化托盘细节

Runner 产品化为 Windows 托盘程序时，需要补充以下体验。

### 30.1 状态可视化

托盘面板展示：

- Runner 在线 / 离线。
- 当前连接平台。
- 当前登录用户。
- Runner 版本。
- 端口状态。
- 正在执行任务。
- 排队任务数量。
- Web UI 浏览器进程数量。
- 最近错误。

任务进度：

```text
Web UI 用例：第 5 步 / 共 10 步
API 场景：第 3 个接口 / 共 12 个接口
元素验证：已验证 80 / 120
```

### 30.2 通知

支持 Windows Toast 通知：

- Runner 离线。
- 平台连接失败。
- 任务失败。
- 任务完成。
- 浏览器崩溃。
- 登录态过期。

通知需要可关闭，避免干扰用户。

### 30.3 日志

日志分级：

```text
INFO
WARN
ERROR
```

支持：

- 按任务 ID 筛选。
- 按时间筛选。
- 一键打开日志目录。
- 一键复制诊断信息。
- 日志自动脱敏。

### 30.4 配置迁移

支持导出 / 导入：

- 平台地址。
- 代理配置。
- 并发配置。
- 日志级别。
- Runner 本地配置。

不导出：

- Token 明文。
- 登录态明文。
- 环境密码。

### 30.5 进程清理

Runner 只能清理自己启动和管理的浏览器进程树。

禁止：

- 扫描并强杀用户自己的 Chrome。
- 按浏览器进程名粗暴杀进程。

调试模式下：

- 可允许失败后保留浏览器现场。
- 超过配置的无操作时间后提醒用户清理。
- 默认 30 分钟无操作可提示关闭，而不是直接强杀。

## 31. 量化默认值与可配置项

以下值作为建议默认，不应写死在业务逻辑中。

| 配置项 | 建议默认值 | 说明 |
| --- | --- | --- |
| Runner 轮询频率 | 2 秒 | 本地调试可缩短到 1 秒 |
| Web UI 步骤默认超时 | 30 秒 | 平台可配置 |
| Web UI 步骤重试 | 0-2 次 | 按步骤类型和用例配置决定 |
| Web UI 最大并发 | 1 | 本地电脑默认保守 |
| API 最大并发 | 5 | 可按机器性能配置 |
| 网络断连缓存上限 | 100 MB | 超出后停止缓存并标记风险 |
| 登录态建议清理周期 | 7 天未使用 | 平台可配置 |
| 任务下发重推次数 | 3 次 | 推模式适用 |

Playwright 和浏览器版本：

- Runner 上报 Playwright 版本和浏览器版本。
- 平台记录最低兼容版本。
- 不兼容时阻断任务并提示升级。
- 不在文档中写死某个固定版本，避免后续升级困难。

## 32. 工件管理器：测试数据与文件上传

Runner 不应依赖用户本机绝对路径来执行上传文件、测试数据读取等步骤。

需要新增：

```text
Artifact Manager 工件管理器
```

### 32.1 解决的问题

典型场景：

- Web UI `FILE_UPLOAD` 需要上传 `avatar.jpg`。
- API 用例需要上传 `test.csv`。
- API 场景需要读取 JSON 测试数据。
- 数据驱动任务需要 Excel / CSV 文件。

错误做法：

```text
C:\Users\某用户\Desktop\data.csv
```

原因：

- 其他用户电脑没有这个路径。
- 指定 Runner 执行机没有这个路径。
- CI / Runner 池无法复现。
- 报告不可追溯。

### 32.2 正确设计

平台维护统一工件：

```text
fileId
fileName
fileType
fileSize
checksum
workspaceId
uploadedBy
createdAt
```

Runner 执行前：

```text
读取任务中引用的 fileId
-> 从平台下载工件
-> 校验 checksum
-> 保存到 Runner 临时目录
-> 执行步骤引用临时路径
```

执行后：

```text
任务完成 / 失败 / 取消
-> 清理本次 runId 的临时目录
```

### 32.3 临时目录规则

建议目录：

```text
%USERPROFILE%\.auto-web-ui-runner\runs\{runId}\artifacts
```

约束：

- 每个 `runId` 独立目录。
- 不复用其他任务文件。
- 不把平台敏感文件复制到公共目录。
- 任务结束后自动清理。
- 调试模式可短时间保留，但需要超时清理。

## 33. executionToken 与任务有效性栅栏

网络断开时，Runner 可能仍在本地继续执行。平台在这期间可能已经取消任务、重新分配任务或标记失败。

因此需要增加：

```text
executionToken
```

也叫任务有效性栅栏。

### 33.1 基本规则

平台分配任务时生成：

```text
runId
runnerId
executionToken
tokenIssuedAt
tokenExpiresAt
```

Runner 所有上报都必须携带：

```text
runId
runnerId
executionToken
```

平台校验：

- Token 有效：接受日志、步骤结果、最终报告。
- Token 失效：返回任务已取消或已失效。
- Token 不匹配：拒绝写入，避免旧 Runner 污染新任务。

### 33.2 取消任务时

用户取消任务后：

```text
平台将任务标记为 CANCELED
-> 平台使 executionToken 失效
-> Runner 下一次上报或心跳时收到失效响应
-> Runner 立即停止本地执行
```

建议响应语义：

```text
HTTP 410 Gone
```

或平台统一业务码：

```text
TASK_TOKEN_EXPIRED
TASK_CANCELED
```

### 33.3 断线续传时

Runner 网络恢复后：

- 先校验 executionToken。
- Token 有效才补传日志和附件。
- Token 失效则停止补传非必要数据，只回传本地终止确认。

这样避免平台已取消任务后，Runner 继续浪费资源。

## 34. 资源槽与资源调控器

单纯配置“Web UI 并发 1、API 并发 5”不够精细。

建议新增：

```text
Resource Governor 资源调控器
```

### 34.1 资源槽模型

用资源槽估算任务成本：

| 任务类型 | 建议槽位 | 说明 |
| --- | --- | --- |
| API 用例 | 1 | IO 密集型 |
| API 场景 | 1-2 | 根据步骤数和并发配置 |
| Web UI 元素验证 | 3 | 需要浏览器，但通常短时 |
| Web UI 元素采集 | 4 | 需要浏览器和截图 |
| Web UI 用例执行 | 5 | 浏览器长时间运行，截图多 |

Runner 启动时根据本机配置估算总槽位。

一期可以简单配置：

```text
totalSlots = 用户配置值
```

后续再根据 CPU 核数和内存自动估算。

### 34.2 调度规则

执行前检查：

```text
已占用槽位 + 新任务槽位 <= totalSlots
```

如果资源不足：

- 任务进入等待队列。
- 前端显示排队原因。
- 不直接失败。

### 34.3 优先级

优先级建议：

```text
手动调试任务
> 手动运行任务
> CI 触发任务
> 批量回归任务
```

实现上可以先用简单优先级字段，不急着拆多队列。

### 34.4 监控指标

后续 Runner 可上报：

- CPU 使用率。
- 内存使用率。
- 浏览器进程数。
- 当前占用槽位。
- 队列长度。

是否启用熔断、阈值多少，不在设计中写死，由产品化阶段按实际运行数据决定。

## 35. 登录态保鲜与跳登录页处理

登录态不只是保存和清空，还要考虑执行前有效性和执行中失效。

### 35.1 执行前检查

Runner 执行前做 best-effort 检查：

- storageState 是否存在。
- Cookie 是否已过期。
- Cookie 剩余时间是否低于预估执行时长。
- localStorage / sessionStorage 中是否存在明显 token。
- 登录态保存时间是否过久。

注意：

- Cookie 剩余时间只能作为参考。
- 很多系统使用服务端 session 或 localStorage token，无法仅靠 Cookie 判断。
- 最终仍以页面是否跳登录页为准。

### 35.2 临界过期策略

如果登录态剩余时间小于预估执行时长：

```text
调试任务：提示用户重新保存登录态，可继续执行
无人执行任务：建议阻断，提示登录态即将过期
CI / 批量任务：默认阻断，避免跑到一半失败
```

预估执行时长初期可用默认值，后续根据历史运行耗时估算。

### 35.3 执行中跳登录页

Web UI 执行中检测到疑似登录页：

```text
调试模式：
  暂停任务
  保留浏览器窗口
  提示用户手动登录后继续

无人执行模式：
  截图
  标记当前步骤 FAILED
  根据 continueOnFailure 决定是否继续

元素采集：
  提示需要重新登录并重新采集
```

### 35.4 静默刷新

如果业务系统支持 refresh token 或固定刷新接口，后续可扩展静默刷新。

一期不承诺自动刷新所有系统登录态。

## 36. iframe / Shadow DOM 支持边界

现代 Web UI 中 iframe、微前端、Shadow DOM 会直接影响元素采集和执行可靠性。

这类能力需要提高优先级，但边界必须说清楚。

### 36.1 一期必须做

一期元素采集至少需要记录：

- 元素是否在 iframe 内。
- frame 层级。
- frame URL。
- 元素是否在 open shadow root 内。
- shadow host 信息。

一期验证至少支持：

- 同源 iframe 基础定位。
- open shadow DOM 基础定位。
- 自动滚动到目标元素。

### 36.2 后续增强

P1 / P2 增强：

- 多级 iframe。
- 微前端 iframe 套 iframe。
- frameChain 精确恢复。
- Shadow DOM 多级路径。
- 跨域 iframe 的可操作范围识别。

### 36.3 明确不承诺

不承诺：

- closed shadow root 穿透。
- 浏览器安全策略禁止访问的跨域内容强行读取。
- 第三方插件内部不可见 DOM 的采集。

原则：

```text
能记录上下文就先记录。
能验证就验证。
不能穿透时要清楚提示原因。
```

## 37. 脚本与配置快照

API 前后置脚本、公共脚本、变量配置如果实时读取最新版本，会导致报告不可复现。

必须按 `runId` 保存执行快照。

### 37.1 快照内容

任务创建时固化：

- 用例定义版本。
- 场景定义版本。
- 环境配置版本。
- 变量集版本。
- 前置脚本内容。
- 后置脚本内容。
- 公共脚本内容。
- Mock 配置版本，后续。
- 文件工件引用版本。

Runner 执行时使用任务快照，不读取平台最新草稿。

### 37.2 好处

- 同一个 `runId` 可复盘。
- 报告可解释。
- 服务端执行和本地执行可对比。
- 不会出现任务执行中脚本被修改导致结果漂移。

### 37.3 与脚本沙箱关系

脚本快照解决“执行哪个版本”。

脚本沙箱解决“脚本能做什么”。

两者都必须有。

## 38. Runner 升级与回滚

产品化 Runner 不能在执行长任务时直接重启升级。

### 38.1 蓝绿升级策略

建议：

```text
当前版本目录：current/
新版本目录：new/
上一版本目录：previous/
```

流程：

```text
检测到新版本
-> 下载到 new/
-> 校验签名和 checksum
-> 等待 Runner 空闲
-> 切换启动路径
-> 重启 Runner
-> 健康检查通过后标记升级成功
```

### 38.2 空闲升级

Runner 满足以下条件才升级：

- 无运行中任务。
- 无调试暂停任务。
- 队列为空。
- 空闲超过配置时间，例如 5 分钟。

如果用户正在执行长任务，只提示有新版本，不强制重启。

### 38.3 回滚

升级失败时：

- 自动回滚到 `previous/`。
- 保留失败日志。
- 前端或托盘提示升级失败。
- 不影响已有任务报告。

## 39. 附件与临时文件生命周期

附件会持续增长，必须从设计上定义生命周期。

### 39.1 Runner 本地临时附件

包括：

- 上传文件临时副本。
- 执行截图。
- 局部截图。
- HAR，后续。
- 控制台日志，后续。
- 请求响应缓存。
- 断线时待上传日志。

建议目录：

```text
%USERPROFILE%\.auto-web-ui-runner\runs\{runId}
```

清理规则：

- 任务成功：上传完成后立即清理。
- 任务失败：上传完成后清理。
- 任务取消：停止后清理。
- 调试模式：可保留 30 分钟，之后提醒或自动清理。
- 断线缓存：达到上限后停止缓存并标记风险。

### 39.2 平台长期附件

包括：

- 失败截图。
- 步骤截图。
- 元素验证截图。
- 全局采集截图。
- HAR，后续。
- 请求响应附件。

平台存储需要记录：

```text
workspaceId
runId
taskType
attachmentType
storagePath
size
checksum
createdAt
expireAt
```

访问权限：

- 按 workspace 隔离。
- 按用户权限访问报告。
- 公开报告链接只访问被授权的附件。

清理策略：

- 默认保留周期由平台配置。
- 例如 30 天、90 天、永久保留。
- 删除报告时同步清理附件，或进入异步清理队列。

## 40. 环境变量白名单映射

Runner 既要隔离本机环境变量，避免污染自动化执行上下文，又要支持公司代理、证书等本机网络配置。

因此需要增加：

```text
envAllowlist
```

### 40.1 默认隔离规则

默认规则：

- 不读取本机全部环境变量。
- 不把 `PATH`、`JAVA_HOME`、`NODE_ENV`、用户自定义杂项变量注入用例执行上下文。
- API / Web UI 执行只使用平台下发的环境、变量集、运行时变量和任务快照。

原因：

- 防止本机变量污染报告。
- 防止同一用例在不同机器结果不一致。
- 防止敏感本机变量被脚本读取。

### 40.2 白名单变量

允许通过白名单读取少量本机变量。

默认建议：

```text
HTTP_PROXY
HTTPS_PROXY
NO_PROXY
CUSTOM_CERT_PATH
SSL_CERT_FILE
```

用途：

- 公司 HTTP / HTTPS 代理。
- VPN / 内网代理。
- 抓包调试工具。
- 自定义证书路径。

### 40.3 配置方式

Runner 配置中预留：

```json
{
  "envAllowlist": ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "CUSTOM_CERT_PATH"]
}
```

约束：

- 白名单变量只注入 Runner 网络层或明确允许的执行上下文。
- 不进入普通脚本沙箱，除非平台任务显式允许。
- 报告中只记录变量名，不记录敏感值。

## 41. 定位上下文链与 Portal 组件策略

Web UI 元素采集不能只保存一个简单 CSS selector，否则后续用例执行可能无法稳定复现。

尤其需要考虑：

- iframe。
- Shadow DOM。
- Element Plus / Ant Design 弹窗、下拉、日期选择器等 Portal 到 `body` 的组件。
- 动态列表和虚拟滚动。

### 41.1 采集即锁定原则

一期采集时必须尽量生成并保存多种 locator 候选，而不是只保存一个简易 selector。

建议保存：

```text
primaryLocator
alternativeLocators
locatorChain
framePath
shadowPath
portalRootHint
roleLocator
testIdLocator
cssLocator
xpathLocator，兜底
nthMatchInfo
```

### 41.2 locator 优先级

推荐优先级：

```text
Test ID
> Role
> Label
> Placeholder
> Text，谨慎
> 稳定 CSS
> XPath，兜底
```

如果存在 `data-testid`、`data-test`、`data-qa`，优先采集。

如果可生成 Playwright 语义定位，也应保存：

```text
getByRole
getByLabel
getByPlaceholder
getByText
```

### 41.3 iframe / Shadow DOM 元数据

对于 iframe 和 open shadow root，采集时必须记录完整上下文链。

示例：

```json
{
  "framePath": ["iframe[name='main']", "iframe[data-module='order']"],
  "shadowPath": ["app-shell", "order-form"],
  "locatorChain": ["frame:main", "shadow:app-shell", "css:[data-testid='submit']"]
}
```

如果无法穿透：

- 记录无法穿透原因。
- 前端提示该元素需要人工确认。
- 不把它伪装成已验证元素。

### 41.4 Portal 组件

Portal 组件常见表现：

- DOM 不在当前表单内部。
- 弹窗、下拉浮层挂载在 `body` 下。
- 点击输入框后才渲染候选列表。

采集策略：

- 记录触发元素和浮层元素的关联。
- 保存 `portalRootHint`。
- 对下拉、日期选择器等交互型元素，后续验证时需要先触发再定位。

## 42. Runner 身份注册与设备绑定

Runner 首次启动时，平台需要知道“它是谁”，但不建议依赖敏感硬件序列号。

### 42.1 推荐注册方式

首次启动：

```text
Runner 生成 installId
-> 用户在平台获取配对码
-> Runner 提交配对码 + installId
-> 平台生成 runnerId 和 runnerToken
-> Runner 本地安全保存 runnerToken
```

后续启动：

```text
Runner 使用 runnerId + runnerToken 注册心跳
```

### 42.2 machineHint

Runner 可以上报脱敏设备提示：

```text
hostnameHash
os
arch
runnerVersion
userDefinedDeviceName
```

约束：

- 不强制读取 MAC 地址。
- 不强制读取 CPU 序列号。
- 不上传明文主机名，优先 hash。
- 用户可在平台修改设备显示名。

### 42.3 重装与僵尸 Runner

重装系统或重新安装 Runner 后：

- 用户可通过平台配对码重新绑定。
- 平台可合并同名设备，需要人工确认。
- 长时间无心跳 Runner 标记为离线。
- 超过保留期的离线 Runner 可归档，不直接物理删除历史报告。

## 43. 截图上传策略

Web UI 每步截图会带来明显带宽和存储压力，必须按运行模式区分策略。

### 43.1 调试模式

调试模式目标是排查问题。

建议：

- 可以上传全量步骤截图。
- 失败时保留浏览器现场。
- 可上传控制台日志和 HAR，后续。
- 附件保留时间可短一些，避免长期占用。

### 43.2 无人执行 / CI 模式

无人执行目标是稳定回归和低成本运行。

默认建议：

- 只上传失败截图。
- 成功步骤只上传结构化日志。
- 成功步骤可选上传 DOM 摘要或关键 HTML 片段。
- 不默认上传全量截图。

### 43.3 图片压缩

截图上传前可以压缩：

```text
WebP / JPEG
quality: 70-80
maxWidth: 可配置
```

PNG 适合局部小图或需要无损比对的场景，不适合作为所有步骤默认格式。

### 43.4 上传策略字段

任务 DTO 中建议包含：

```text
screenshotPolicy
screenshotUploadMode
screenshotFormat
screenshotQuality
uploadOnFailureOnly
```

示例：

```json
{
  "screenshotPolicy": "ON_FAILURE",
  "screenshotUploadMode": "FAILURE_ONLY",
  "screenshotFormat": "WEBP",
  "screenshotQuality": 75
}
```

## 44. 开发入口与回归验证清单

本章作为开发和回归时的固定入口。后续新增 Runner 能力时，优先更新本章命令，避免不同会话、不同开发者使用不一致的验证方式。

### 44.1 日常启动

后端：

```powershell
cd server
.\run-local-server.cmd
```

前端：

```powershell
npm run dev
```

Local Runner：

```powershell
npm run runner
```

Runner 默认监听：

```text
http://127.0.0.1:39118
```

健康检查：

```powershell
curl http://127.0.0.1:39118/health
```

如果本机 PowerShell 禁止执行 npm 脚本，可使用：

```powershell
npm.cmd run runner
npm.cmd run runner:test
npm.cmd run typecheck
```

### 44.2 前端联调注意事项

前端页面访问平台时，建议统一使用 `localhost`；Runner 本地服务使用 `127.0.0.1`。

原因：

- 平台登录态依赖浏览器 cookie，`localhost` 和 `127.0.0.1` 混用可能导致 `/auth/me` 返回 401。
- Runner 是本机 HTTP 服务，只监听 `127.0.0.1`，避免局域网访问。
- 前端访问 Runner 需要 Runner 正确返回 CORS 头。

### 44.3 Runner 回归测试

统一使用：

```powershell
npm run runner:test
```

该命令必须串行执行 Node Runner / Playwright 集成测试：

```text
node --test --test-concurrency=1 ...
```

原因：

- Web UI 集成测试会启动本地 HTTP 服务、Runner 进程和 Playwright 浏览器。
- 并行执行容易出现端口、浏览器进程、系统资源竞争。
- 并发超时通常是假失败，不代表 Runner 链路本身失败。

当前 `runner:test` 覆盖：

```text
Web UI 元素采集
Web UI 元素真机验证
Web UI 用例本地执行
API 用例本地执行
API 场景本地执行
API 套件本地执行
Runner 健康检查
Runner 会话 TTL
Runner 能力识别
Runner 资源槽快照
前端 Runner 客户端契约
API Local Runner 报告证据视图
脚本沙箱基础约束
iframe / Shadow DOM 定位链路
登录态缺失、过期、跳登录页
取消、超时、失败截图
```

### 44.4 前端类型检查

```powershell
npm run typecheck
```

前端 UI、类型、实体辅助函数、Runner 视图模型改动后必须跑。

### 44.5 后端目标测试

Local Runner 相关后端回归优先跑：

```powershell
cd server
mvnw.cmd "-Dtest=WebUiExecutionControllerIntegrationTests,ApiExecutionDomainServiceLocalRunnerTests,ApiExecutionSuiteDomainServiceLocalRunnerTests,ApiLocalRunnerReportServiceTests,LocalRunnerNodeQueryTests,LocalRunnerResourceSchedulingTests,LocalRunnerHeartbeatTests" test
```

覆盖范围：

```text
Web UI 本地执行接口
API 用例本地执行任务创建
API 套件本地执行任务创建
API Local Runner 正式报告回写
Runner 节点查询
Runner 能力筛选
Runner 资源槽调度
Runner 心跳
```

### 44.6 Diff 与编码检查

修改后必须跑：

```powershell
git diff --check
```

中文源码、中文 Markdown、Vue 文件修改时要注意：

- 不使用 PowerShell `Get-Content` / `Set-Content` 做整文件替换。
- 小范围修改优先使用 `apply_patch`。
- 若出现 LF/CRLF warning，只代表 Git 换行提示，不等同于 diff check 失败。
- 发现中文乱码时，先停止继续改动，确认编码后再处理。

### 44.7 当前最小手工验收链路

Web UI 本地执行：

```text
启动后端
启动前端
启动 Runner
打开 Web UI 用例编辑
选择“运行于：本地执行器”
点击本地运行
查看正式报告
确认执行位置显示 Local Runner
```

API 场景 / 套件本地执行：

```text
启动后端
启动前端
启动 Runner
进入接口自动化执行页
场景或套件选择“运行于：本地执行器”
点击运行
查看运行记录 / 正式报告
确认执行位置显示 Local Runner
```

AI 采集 / 元素验证：

```text
启动 Runner
打开 AI 采集入口
检查 Runner 连接状态
打开或复用目标页面
开始采集
进入采集工作台
查看候选、过滤日志、真机验证状态
保存元素后回到元素库详情
```

### 44.8 回归失败排查顺序

优先按下面顺序排查：

```text
1. Runner 是否启动：/health
2. 前端是否能访问 Runner：浏览器控制台是否有 CORS / ERR_FAILED
3. 后端是否能创建 Local Runner 任务
4. Runner 是否轮询到任务
5. Runner 是否上报 status / logs / steps / result
6. 后端是否写入正式报告或元素验证结果
7. 前端是否刷新到最新任务 / 报告
```

不要在没有定位到层级前直接改执行逻辑。

## 45. 最终结论

Local Runner 最终应从“AI 采集辅助工具”升级为“统一执行代理”。

它应支持：

```text
Web UI 元素采集
Web UI 元素真机验证
Web UI 用例本地执行
API 用例 / 场景本地执行
```

它必须具备：

```text
健康检查
版本兼容
Token 鉴权
心跳
任务队列
并发限制
环境隔离
日志脱敏
附件上传
异常恢复
统一报告
```

这样平台后续才能同时支持：

```text
服务端执行
本地执行
指定 Runner 执行
Runner 池执行
```

这条路线能解决服务器并发压力、企业内网访问、本机登录态、浏览器调试和未来分布式执行扩展问题，是自动化测试平台后续演进的核心基础设施之一。
