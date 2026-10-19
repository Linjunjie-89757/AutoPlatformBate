# AI 测试用例生成与评审改进方案

## 1. 文档定位

本文是面向当前 AutoTest 系统的增量改造方案，重点解决以下问题：

- 需求文本过大，单次模型输入超出上下文或 Token 预算；
- 用例字段较多，单次生成输出过大；
- 生成结果较多，单次 AI 评审请求超时；
- 单个批次失败导致整个任务失败；
- 服务重启、网络中断或模型限流后无法从中间位置继续；
- 用户必须等待全部用例完成后才能查看可用结果。

本文不建议重新建设一套独立的测试用例中心，也不把 UI 自动化执行、MCP、自主 Agent 和复杂 RAG 作为第一阶段前置条件。

## 2. 结论摘要

推荐采用以下主路线：

```text
需求快照
  -> 需求单元拆分
  -> 场景清单生成
  -> 场景去重和覆盖检查
  -> 按 Token 预算分批生成用例详情
  -> 程序确定性校验
  -> 按 Token 预算分批 AI 评审
  -> 覆盖率和质量汇总
  -> 人工确认候选用例
  -> 正式采纳
```

核心设计原则：

1. 任务可以很大，但单次模型调用必须小。
2. 批次大小由 Token、请求体和时间预算共同决定，不能只按用例数量决定。
3. 先生成轻量场景，再生成完整用例详情，避免一开始为低价值场景输出大量字段。
4. 程序负责确定性校验、状态流转、重试、幂等、租约和恢复；模型只负责结构化内容建议。
5. 生成和评审结果按批次立即持久化，允许部分完成。
6. 当前用例候选资产继续作为草稿边界，正式用例只能经过人工确认后产生。

## 3. 与现有系统的关系

当前系统已有 AI 生成任务、任务事件、候选用例、候选版本、评审建议、候选审计和正式采纳能力。本方案建议沿用这些业务边界，新增批次执行和需求治理能力。

推荐的逻辑模型：

```text
AiGenerationTask                 总任务和需求快照
  |
  +-- AiGenerationBatch          生成批次
  |
  +-- AiReviewBatch              评审批次
  |
  +-- AiCaseCandidate            AI 候选用例/草稿
          |
          +-- 原始稿
          +-- 建议稿
          +-- 当前稿
          +-- 人工决定
          +-- 审计记录
```

第一阶段不新增独立的 `TestCaseDraft` 正式领域，也不复制现有正式用例表。候选用例表承担 AI 草稿资产职责，正式用例仍通过现有采纳链路写入。

## 4. 目标和非目标

### 4.1 目标

- 支持大需求拆分后持续生成；
- 支持大量用例的分批生成和分批评审；
- 单批超时只影响单批；
- 服务重启后能够恢复未完成批次；
- 支持失败批次单独重试；
- 支持取消任务但保留已完成结果；
- 支持查看部分结果和当前进度；
- 限制单任务、单项目、单模型的并发；
- 保留完整的模型、Prompt、输入快照、原始响应和校验信息；
- 让每条用例可以追溯到需求单元、场景和来源证据。

### 4.2 非目标

第一阶段不实现：

- 完整的企业知识库和通用向量 RAG；
- 多 Agent 自主规划；
- MCP 编排；
- 自动执行所有 UI 用例；
- 自动把 AI 结果直接发布为正式用例；
- 为所有需求强制生成固定数量的用例；
- 为所有用例执行同等强度的 AI 深度评审。

## 5. 问题模型

### 5.1 当前超时的主要来源

单次请求的成本可以近似表示为：

```text
总上下文
  = 系统 Prompt
  + 需求文本
  + 图片或附件描述
  + 历史用例
  + 当前全部用例
  + 评审规则

总输出
  = 用例数量
  x 单条用例字段数量
  x 每个字段长度
```

当生成和评审都把整份需求、全部候选和所有扩展字段放进一次模型调用时，以下任一因素都会造成超时：

- 输入上下文超过模型窗口；
- 输出 Token 过大；
- 请求处理时间超过服务超时；
- 流式响应中断；
- 模型供应商限流；
- JSON 结构不完整导致重试；
- 单个任务占用过多并发资源。

### 5.2 设计目标不是让单次调用更快

目标是把一次不可控的大调用转换成多个可控的小调用：

```text
不可恢复的大调用
  -> 可预测的小批次
  -> 独立保存
  -> 独立重试
  -> 最终汇总
```

因此，“部分完成”是正常结果，不应被视为异常状态。

## 6. 领域模型

### 6.1 需求快照

一次任务必须冻结输入快照，避免任务运行过程中需求内容变化导致结果不可复现。

```json
{
  "requirementSnapshotId": "REQ-SNAP-001",
  "requirementVersion": 3,
  "title": "用户登录",
  "contentHash": "sha256...",
  "units": [
    {
      "unitId": "UNIT-LOGIN-AUTH",
      "title": "账号密码认证",
      "content": "...",
      "businessRules": ["RULE-001"],
      "constraints": ["RULE-002"],
      "risks": ["暴力破解"],
      "sourceRefs": ["DOC-001#3.2"]
    }
  ]
}
```

第一阶段允许需求单元由规则程序和 AI 辅助生成，但必须保存快照和版本。需求单元不是正式需求管理系统的替代品，而是生成任务的稳定输入边界。

### 6.2 场景清单

场景清单只描述测试点，不立即展开全部执行细节。

```json
{
  "scenarioId": "SCENE-LOGIN-001",
  "unitId": "UNIT-LOGIN-AUTH",
  "requirementRefs": ["RULE-001"],
  "scenarioType": "POSITIVE",
  "title": "正确账号密码登录成功",
  "priority": "P1",
  "riskLevel": "HIGH",
  "sourceRefs": ["DOC-001#3.2"],
  "generationStatus": "PENDING"
}
```

建议支持以下场景类型，但不得要求每个需求都具备全部类型：

```text
POSITIVE       正常流程
NEGATIVE       错误输入或失败流程
BOUNDARY       最小值、最大值、临界值
EMPTY          空值和缺失字段
PERMISSION     未登录和无权限
STATE          状态不允许
DUPLICATE      重复提交和幂等
TIMEOUT        超时和网络异常
SECURITY       越权和敏感信息
CONSISTENCY    数据一致性
NOT_APPLICABLE 不适用，必须填写原因
```

### 6.3 完整用例

完整用例采用分层字段：

**核心字段：**

- 标题；
- 用例类型；
- 优先级；
- 风险等级；
- 场景类型；
- 关联需求和场景。

**执行字段：**

- 前置条件；
- 测试数据；
- 步骤；
- 每步可观察预期；
- 总体预期结果。

**分析字段：**

- 风险说明；
- 生成原因；
- 来源证据；
- 假设；
- 评审意见；
- 置信度。

生成批次可以先返回核心字段，再补充执行字段。分析字段不得在每次评审中重复发送和重复生成，除非该字段本身是评审目标。

## 7. 任务和批次模型

### 7.1 总任务状态

```text
QUEUED
  -> PLANNING
  -> GENERATING
  -> VALIDATING
  -> REVIEWING
  -> PARTIAL
  -> WAITING_HUMAN
  -> COMPLETED

任意运行状态 -> CANCELED
任意运行状态 -> FAILED
```

状态含义：

- `QUEUED`：任务已创建，等待调度；
- `PLANNING`：正在冻结需求快照并规划需求单元、场景和批次；
- `GENERATING`：至少有一个生成批次运行；
- `VALIDATING`：批次结果正在执行程序校验；
- `REVIEWING`：至少有一个评审批次运行；
- `PARTIAL`：部分批次完成，仍有失败、待重试或未执行批次；
- `WAITING_HUMAN`：AI 阶段完成，等待人工处理候选；
- `COMPLETED`：所有计划批次完成且任务汇总成功；
- `CANCELED`：用户取消，已完成结果保留；
- `FAILED`：任务级输入或系统错误导致无法继续。

### 7.2 批次状态

```text
PENDING
  -> CLAIMED
  -> RUNNING
  -> VALIDATING
  -> SUCCEEDED

RUNNING -> RETRY_WAITING -> CLAIMED
RUNNING -> FAILED
PENDING/RUNNING/RETRY_WAITING -> CANCELED
```

只有批次结果、校验结果和状态在同一事务中持久化成功，批次才可以进入 `SUCCEEDED`。

### 7.3 批次类型

```text
PLAN          需求单元和场景规划
GENERATION    生成完整用例
ENRICHMENT    补充执行字段
REVIEW        AI 评审
SUPPLEMENT    根据覆盖缺口补充场景或用例
```

第一阶段可以先实现 `GENERATION` 和 `REVIEW`。`PLAN` 可以使用轻量确定性拆分加一次小模型调用，`ENRICHMENT` 在生成字段已经足够时可以暂缓。

## 8. 动态 Token 和批次策略

### 8.1 批次不能只按数量切分

每个批次必须同时满足：

```text
估算输入 Token <= maxInputTokens
估算输出 Token <= maxOutputTokens
估算总 Token   <= maxTotalTokens
请求体大小     <= maxRequestBytes
预计执行时间   <= maxBatchDurationSeconds
```

如果任一条件不满足，继续拆分，不发送原请求。

### 8.2 Token 估算

```text
estimatedInputTokens
  = systemPromptTokens
  + requirementUnitTokens
  + scenarioTokens
  + retrievedContextTokens
  + outputSchemaTokens

estimatedOutputTokens
  = scenarioCount
  x averageCaseOutputTokens

estimatedTotalTokens
  = estimatedInputTokens + estimatedOutputTokens
```

实际使用量以供应商返回值为准。没有供应商 Token 统计时，使用项目级估算器，并记录 `estimated` 标记。

### 8.3 推荐初始值

以下只是初始配置，必须通过真实调用指标调整：

```text
生成批次：复杂用例 3-8 条，简单用例 5-15 条
评审批次：5-10 条完整用例
单批最大执行时间：120 秒
生成批次最大重试：2 次
评审批次最大重试：2 次
单项目并发：2 个批次
单模型并发：按供应商限制配置
单用户运行中任务：1 个
```

配置必须在任务创建时冻结，避免任务运行中修改配置造成结果不可复现。

### 8.4 自适应批次

批次执行器应根据最近成功批次动态调整建议大小：

- 连续成功且耗时低于预算：逐步增加批次大小；
- 接近 Token 或时间预算：减少批次大小；
- 超时或输出截断：下一批次立即减半；
- JSON 结构不完整：保留原始响应，减少输出规模并进行一次受控重试；
- 连续失败：暂停该模型或任务，等待人工处理或更换模型。

自适应只改变尚未领取的批次，不修改已经持久化的批次输入。

## 9. 生成流程

### 9.1 任务创建

创建接口只负责：

1. 校验工作空间、目录和输入；
2. 保存需求快照；
3. 计算任务幂等键；
4. 创建任务记录；
5. 创建规划批次或排队事件；
6. 返回任务 ID。

接口不得等待模型生成完成。

建议响应：

```json
{
  "taskId": "TASK-001",
  "status": "QUEUED",
  "statusUrl": "/api/cases/ai/tasks/TASK-001",
  "eventUrl": "/api/cases/ai/tasks/TASK-001/events/stream"
}
```

### 9.2 需求单元和场景规划

规划阶段输出：

- 需求单元；
- 业务规则引用；
- 场景类型；
- 优先级和风险等级；
- 来源引用；
- 不适用场景及原因；
- 预计生成字段和 Token 预算。

规划结果必须先经过程序去重和引用校验，再创建生成批次。

### 9.3 用例生成

生成批次只携带：

- 一个需求单元或少量相邻场景；
- 必要的规则和来源片段；
- 输出 Schema；
- 当前批次策略；
- 必要的历史相似用例摘要。

禁止每个批次重复携带整份 PRD、全部历史用例和全部已生成用例。

模型返回后按顺序执行：

```text
保存原始响应
  -> 提取结构化 JSON
  -> Schema 校验
  -> 字段和枚举校验
  -> 敏感信息扫描
  -> 重复检测
  -> 来源和需求引用校验
  -> 写入候选用例
  -> 更新批次状态
```

### 9.4 生成失败处理

- 网络错误、429、临时 5xx：指数退避重试；
- 连接或读取超时：降低下一批次规模后重试；
- Token 超限：拆分批次，不重发原请求；
- JSON 解析失败：保留原始响应，最多进行一次受控修复；
- 字段校验失败：标记为待人工处理，不能无限重试；
- 敏感信息命中：阻断正式采纳，按安全策略脱敏或隔离；
- 达到重试上限：批次进入 `FAILED`，其他批次继续。

## 10. 评审流程

### 10.1 三层评审策略

不是所有用例都执行同等强度的 AI 评审。

**确定性校验：**

- JSON 和字段完整性；
- 枚举值；
- 必填步骤和预期；
- 精确重复和相似重复；
- 敏感信息；
- 来源引用；
- 需求和场景关联；
- 文本长度和请求体大小。

**AI 轻量评审：**

- 场景与需求是否基本匹配；
- 是否存在明显低价值或不可执行表述；
- 是否覆盖对应场景。

**AI 深度评审：**

- 高风险用例；
- 权限、安全、金额、状态迁移、数据一致性；
- 程序校验失败或警告；
- 覆盖缺口相关用例；
- 重复候选；
- 人工编辑后的用例；
- 需求存在歧义或矛盾的用例。

### 10.2 评审批次输入

评审批次默认只发送：

- 用例 ID；
- 需求单元和场景引用；
- 当前稿核心字段；
- 执行字段；
- 程序校验结果；
- 相关来源片段。

不重复发送与当前评审无关的原始响应、完整历史事件和其他批次的全部内容。

### 10.3 评审结果

AI 评审只能写入：

- 评审状态；
- 分数和置信度；
- 问题和建议；
- 建议稿；
- 覆盖缺口；
- 建议来源版本和哈希。

AI 评审不能直接修改原始稿、当前稿或正式用例。建议稿必须经过人工确认才能应用。

### 10.4 评审顺序

默认顺序：

1. 程序失败和安全风险；
2. 高风险和 P0/P1 用例；
3. 覆盖缺口相关用例；
4. 低风险普通用例。

如果任务在低风险批次执行前已经达到可接受的覆盖和质量门槛，可以进入 `WAITING_HUMAN`，不必为了形式上的全部评审阻塞用户。

## 11. 数据库设计建议

### 11.1 `tb_ai_generation_batch`

```text
id
batch_id                         唯一批次 ID
task_id                         所属任务
batch_type                      PLAN / GENERATION / ENRICHMENT
batch_index                     批次顺序
requirement_snapshot_id         需求快照
unit_id                         需求单元
scenario_ids_json               场景 ID 列表
input_snapshot_hash             输入快照哈希
prompt_version
prompt_hash
model
request_payload_hash
status
attempt_count
max_attempts
lease_owner
lease_token
lease_until
heartbeat_at
next_retry_at
raw_output
parsed_result_json
validation_result_json
result_count
error_code
error_message
started_at
finished_at
created_at
updated_at
```

### 11.2 `tb_ai_review_batch`

```text
id
review_batch_id
task_id
review_run_id
batch_index
candidate_ids_json
input_snapshot_hash
status
attempt_count
max_attempts
lease_owner
lease_token
lease_until
heartbeat_at
prompt_version
prompt_hash
model
raw_output
result_json
validation_result_json
error_code
error_message
started_at
finished_at
created_at
updated_at
```

### 11.3 来源和覆盖模型

首期可以使用 JSON 字段保存，但结构必须固定：

```json
{
  "sourceType": "REQUIREMENT_TEXT",
  "documentId": "DOC-001",
  "documentVersion": 3,
  "section": "3.2",
  "quote": "用户名和密码正确时允许登录",
  "verified": true,
  "assumption": false
}
```

覆盖项必须能够关联：

```text
requirement unit
  -> business rule
  -> scenario
  -> candidate case
```

只有引用可验证、覆盖关系可解释的结果，才能被统计为已覆盖。模型自己声称“已覆盖”不能直接作为程序结论。

## 12. 幂等、租约和恢复

### 12.1 任务幂等

任务幂等键建议由以下内容计算：

```text
workspace
requirement_snapshot_hash
generation_strategy_version
prompt_version
model
generation_options
```

同一幂等键且输入快照未变化时，返回已有任务，不重复创建任务。

### 12.2 批次幂等

批次幂等键建议由以下内容计算：

```text
task_id
batch_type
unit_id
scenario_ids
input_snapshot_hash
prompt_version
model
strategy_version
```

已成功批次可以复用结果。输入快照变化时必须创建新批次，不能覆盖旧批次结果。

### 12.3 租约领取

批次领取必须使用数据库条件更新：

```text
只有 status = PENDING 或 RETRY_WAITING
且 next_retry_at <= now
的批次才可领取。
```

领取成功后写入 `lease_owner`、`lease_token` 和 `lease_until`。所有结果写入必须携带租约令牌，旧 worker 过期后不得覆盖新 worker 的结果。

### 12.4 服务重启

恢复调度器定期处理：

- `PENDING`：正常领取；
- `RETRY_WAITING` 且到时间：重新领取；
- `RUNNING` 或 `CLAIMED` 且 `lease_until < now`：标记为可重试；
- `SUCCEEDED`：不重复调用模型；
- `FAILED`：根据重试策略等待人工或重试。

## 13. 并发和限流

必须同时限制：

- 全局模型并发；
- 工作空间或项目并发；
- 用户运行中任务数量；
- 单任务批次并发；
- 评审和生成是否共享模型配额。

建议初始规则：

```text
同一用户同时运行生成任务：1 个
同一任务同时运行批次：2 个
同一工作空间同时运行批次：2-4 个
同一模型并发：由连接配置决定
```

超过限制时排队，不直接失败。人工重试优先级高于后台补充生成。

## 14. 接口建议

保留现有任务接口，新增批次和进度接口：

```text
GET  /api/cases/ai/tasks/{taskId}/progress
GET  /api/cases/ai/tasks/{taskId}/generation-batches
GET  /api/cases/ai/tasks/{taskId}/review-batches
POST /api/cases/ai/tasks/{taskId}/retry-failed-batches
POST /api/cases/ai/tasks/{taskId}/continue-pending-batches
POST /api/cases/ai/tasks/{taskId}/cancel
```

进度响应至少包含：

```json
{
  "taskId": "TASK-001",
  "status": "PARTIAL",
  "totalBatches": 20,
  "pendingBatches": 3,
  "runningBatches": 1,
  "succeededBatches": 15,
  "retryWaitingBatches": 1,
  "failedBatches": 0,
  "generatedCaseCount": 120,
  "validatedCaseCount": 116,
  "reviewedCaseCount": 80,
  "coveragePercent": 86,
  "lastError": null
}
```

已有候选操作继续使用内容版本和哈希，不能改成基于数组下标的写操作。

## 15. 前端交互建议

任务详情页应显示：

- 总进度和分阶段进度；
- 已完成、运行中、待重试、失败批次数；
- 已生成、已校验、已评审、待人工确认数量；
- 覆盖率和未覆盖项；
- 最近错误和批次详情；
- 部分结果入口；
- 仅重试失败批次；
- 继续未完成批次；
- 取消任务但保留结果。

候选审核页应支持按以下条件筛选：

- 风险等级；
- 场景类型；
- 校验失败；
- 重复候选；
- 无来源；
- 覆盖缺口；
- AI 建议状态；
- 人工处理状态。

前端显示“已完成”时必须区分：

- AI 生成完成；
- 自动校验完成；
- AI 评审完成；
- 人工确认完成；
- 正式采纳完成。

## 16. 分阶段实施计划

### 阶段一：批次基础和可恢复执行

目标：先解决超时、失败全盘重来和服务重启恢复。

工作内容：

1. 新增生成批次和评审批次表；
2. 实现批次状态机；
3. 实现 Token 和时间预算；
4. 实现租约领取和过期恢复；
5. 实现批次级重试；
6. 生成和评审结果即时持久化；
7. 增加进度和失败批次接口；
8. 保留现有候选用例和采纳流程。

阶段一完成后，单批超时只影响单批，任务可以显示部分结果。

### 阶段二：需求单元、场景清单和字段分层

目标：降低输入和输出规模，提高生成质量。

工作内容：

1. 增加需求快照和需求单元；
2. 生成轻量场景清单；
3. 对场景去重和覆盖检查；
4. 将用例字段分为核心、执行、分析三层；
5. 只对必要批次补全完整执行字段；
6. 支持场景不适用及原因。

### 阶段三：分级评审和质量门禁

目标：减少不必要的 AI 深度评审，并提高结果可采纳性。

工作内容：

1. 确定性校验前置；
2. 高风险用例优先评审；
3. 普通用例使用轻量评审或人工抽查；
4. 引入来源引用验证；
5. 引入敏感信息扫描；
6. 引入覆盖项到候选用例的可追溯关系；
7. 引入版本化 Schema。

### 阶段四：质量反馈和检索增强

目标：使用历史数据改善生成质量。

工作内容：

1. 人工修改反馈；
2. 执行结果反馈；
3. 历史缺陷和历史用例的权限过滤检索；
4. 关键词检索；
5. 在检索权限和文档版本稳定后，再评估向量检索。

## 17. 验收标准

### 17.1 超时和大任务

1. 创建任务接口在几秒内返回任务 ID，不等待模型完成。
2. 需求规模增加时，单次模型请求的输入和输出仍在预算内。
3. 单个批次超时不会导致已成功批次丢失。
4. 评审不会把全部用例一次性放入一个 Prompt。
5. Token 超限会拆批，不会静默截断。

### 17.2 恢复和重试

1. 服务重启后可以找回未完成批次。
2. 过期租约不会被旧 worker 覆盖。
3. 用户可以只重试失败批次。
4. 相同输入快照和幂等键不会重复创建草稿。
5. 取消任务后已完成结果仍可查看。

### 17.3 质量和审计

1. 每条候选用例可以追溯到需求单元和场景。
2. 原始稿、建议稿和当前稿边界不变。
3. AI 建议不会自动覆盖当前稿。
4. 来源引用无法验证时标记为未验证，不统计为确定覆盖。
5. 敏感信息不会直接进入正式用例。
6. 批次保存模型、Prompt、输入哈希、输出、Token 和错误信息。
7. 正式用例只能由人工确认后的当前稿产生。

### 17.4 可观测指标

至少记录：

- 每批输入 Token、输出 Token、总 Token；
- 每批执行耗时；
- 超时次数；
- 429 和 5xx 次数；
- JSON 解析失败次数；
- 平均批次大小；
- 批次重试次数；
- 任务部分完成率；
- 覆盖缺口数量；
- 重复候选数量；
- 人工修改率；
- AI 建议采纳率。

## 18. 关键风险和取舍

### 风险一：批次太小导致总耗时增加

解决方式：使用动态批次和有限并发，记录每批耗时，逐步调大稳定批次，而不是固定极小批次。

### 风险二：批次之间缺少全局上下文

解决方式：规划阶段先生成需求单元和场景清单；每个批次携带规则、场景和去重指纹；最终由程序做全局去重和覆盖汇总。

### 风险三：模型重复生成相似用例

解决方式：批次内去重、任务内去重、正式库去重三层处理。相似候选先标记，不自动删除，交给人工决定。

### 风险四：模型调用可能在结果落库前中断

解决方式：保存 request hash、调用开始时间、租约和原始响应；供应商支持 request id 时传递稳定请求标识。即使无法保证供应商只执行一次，也必须保证系统草稿和正式用例不重复。

### 风险五：来源证据被模型编造

解决方式：来源引用必须绑定需求快照，服务端验证引用片段；无法匹配时标记 `UNVERIFIED` 或 `ASSUMPTION`。

## 19. 推荐决策

建议评审会议重点确认以下事项：

1. 第一阶段是否同意只增加批次执行层，不新建第二套正式用例中心；
2. 任务是否允许 `PARTIAL` 作为正常可用状态；
3. 初始 Token、时间和并发预算；
4. 普通用例是否允许轻量评审或人工抽查；
5. 原始模型响应的敏感信息存储策略；
6. 需求单元由用户维护、规则拆分还是 AI 辅助生成；
7. 评审批次失败后的自动重试次数和人工接管规则；
8. 是否允许任务运行过程中继续未执行批次；
9. 第一阶段是否先支持文本和 Markdown，PDF、Excel 是否延后。

## 20. 最终建议

本方案的第一阶段应聚焦一个目标：

> 让大需求和大量用例变成可控、可恢复、可部分完成的小批次任务。

第一阶段完成后，再逐步加入结构化需求、来源验证、分级评审和反馈检索。这样可以直接解决生成和评审超时，同时避免因为引入完整知识库、复杂 Agent 和新用例中心而扩大项目风险。
