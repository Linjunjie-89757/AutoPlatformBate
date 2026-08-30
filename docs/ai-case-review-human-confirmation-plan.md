# AI 候选用例评审与人工确认实施方案
## 1. 背景

当前 AI 用例任务把生成结果保存在 `tb_ai_generation_task.generated_cases_json`。AI 评审返回 `OPTIMIZED` 时，后端会把优化稿直接覆盖到该 JSON，并把原内容临时放入 `originalCaseSnapshot`。这会造成以下问题：

- 原始生成稿、AI 建议稿和用户最终稿没有稳定的数据边界；
- AI 建议可能在用户确认前进入采纳流程；
- 评审结果、人工决定、采纳状态混在同一份展示数据中；
- 评审和采纳长期依赖数组下标，排序变化后无法稳定追溯；
- 刷新、重试、多人处理和历史审计缺少可靠的数据基础。

本方案把 AI 生成结果定义为“候选测试资产”，先完成可追溯的数据和接口基础，再接入 Figma 正在补充的交互设计。

## 2. 核心原则

> AI 生成原始用例，AI 评审只输出结论和建议稿；任何内容变更、排除、合并和采纳，都必须由用户确认，并且全程可追溯。

必须满足：

1. `originalCase` 创建后永久只读。
2. `suggestedCase` 是评审建议，只读且不能自动进入正式用例库。
3. `currentCase` 是人工确认后的待采纳版本，初始值等于原始稿。
4. AI 评审状态、人工处理状态、采纳状态分别存储。
5. 业务关联使用稳定的 `candidateCaseId`，`caseIndex` 只用于排序和旧数据兼容。
6. 所有修改接口使用内容版本和哈希进行乐观锁校验。
7. 正式采纳使用幂等键，重复请求不得创建重复用例。
8. 旧任务和旧接口在迁移期继续可读，已采纳正式用例不得被迁移回退。

## 3. 业务流程

```text
AI 生成候选用例
  → 保存不可变原始稿和初始当前稿
  → AI 评审输出结论、建议动作和可选建议稿
  → 人工保留原文 / 应用建议 / 编辑 / 排除 / 合并
  → 采纳当前确认版本
  → 幂等写入正式用例中心
  → 保存正式用例 ID 和完整审计记录
```

AI 评审可以补充候选用例，但补充项必须标记为 `REVIEW_SUPPLEMENTED`，默认进入待确认，不进入默认批量采纳。

## 4. 领域模型

### 4.1 内容版本

| 字段 | 用途 | 修改规则 |
|---|---|---|
| `original_case_json` | 生成模型的最初输出 | 永久只读 |
| `suggested_case_json` | 评审模型的建议版本 | 评审写入，用户只读 |
| `current_case_json` | 准备采纳的最终版本 | 人工操作修改 |
| `content_version` | 当前稿版本 | 每次修改递增 |
| `content_hash` | 当前稿 SHA-256 | 与版本共同校验 |
| `suggestion_source_version` | 建议基于的版本 | 应用建议时校验 |
| `suggestion_source_hash` | 建议基于的内容哈希 | 应用建议时校验 |

### 4.2 AI 评审状态

```text
APPROVED
CHANGE_SUGGESTED
CONFIRM_REQUIRED
NOT_RECOMMENDED
```

兼容规则：历史 `OPTIMIZED` 读取时映射为 `CHANGE_SUGGESTED`；历史 `SUPPLEMENTED` 转换为来源 `REVIEW_SUPPLEMENTED` 且评审状态 `CONFIRM_REQUIRED`。

### 4.3 AI 建议动作

```text
KEEP
MODIFY
EXCLUDE
MERGE
```

- `MODIFY` 必须包含完整 `suggestedCase`。
- `EXCLUDE` 必须包含明确原因。
- `MERGE` 必须包含目标候选 ID 和完整合并建议稿。
- 动作是建议，不自动改变 `currentCase` 和人工状态。

### 4.4 人工处理状态

```text
PENDING
KEEP_ORIGINAL
APPLIED_SUGGESTION
MANUAL_EDITED
EXCLUDED
MERGED
```

### 4.5 采纳状态

```text
PENDING → ADOPTING → ADOPTED
                    ↘ ADOPT_FAILED → 重试
```

已采纳不可撤销；已排除可恢复为待处理。采纳状态不替代人工处理状态。

## 5. 数据库设计

### 5.1 `tb_ai_case_candidate`

每行是一条稳定候选用例，主要字段：

- `candidate_id`：全局稳定 ID；
- `task_id`、`display_index`：任务归属和页面顺序；
- `origin`：`GENERATOR` 或 `REVIEW_SUPPLEMENTED`；
- 三份内容 JSON；
- 评审状态、建议动作、分数、置信度、原因和合并目标；
- 人工状态、内容版本、内容哈希和建议来源版本；
- 创建人、更新人和时间。

唯一约束：`candidate_id`、`(task_id, display_index)`。

### 5.2 `tb_ai_case_candidate_audit`

记录候选用例的关键状态变化：

- 操作类型；
- 操作前后版本；
- 变更前后内容 JSON；
- 变更元数据；
- 操作人和时间。

典型操作：`GENERATED`、`REVIEWED`、`SUGGESTION_APPLIED`、`ORIGINAL_KEPT`、`MANUALLY_EDITED`、`EXCLUDED`、`RESTORED`、`MERGED`、`ADOPTED`、`ADOPT_FAILED`。

### 5.3 采纳表增强

在现有 `tb_ai_case_adoption` 上增加：

- `candidate_id`；
- `adopted_content_version`；
- `adopted_content_source`；
- `idempotency_key`。

迁移期继续保留 `case_index`，以兼容现有接口和历史记录。新调用优先使用 `candidate_id`。

## 6. AI 评审契约

评审输入的每条候选必须携带：

```json
{
  "candidateCaseId": "AIC-...",
  "caseIndex": 0,
  "contentVersion": 1,
  "contentHash": "sha256...",
  "case": {}
}
```

评审输出的每条决定必须携带：

```json
{
  "candidateCaseId": "AIC-...",
  "caseIndex": 0,
  "reviewStatus": "CHANGE_SUGGESTED",
  "suggestedAction": "MODIFY",
  "score": 72,
  "confidence": 0.86,
  "reason": "预期结果缺少可验证断言",
  "suggestedCase": {},
  "mergeTargetCaseIds": [],
  "sourceVersion": 1,
  "sourceContentHash": "sha256..."
}
```

后端校验规则：

- 候选 ID 必须属于当前任务；
- 候选 ID 与兼容下标同时存在时必须指向同一条数据；
- 状态、动作和必要字段组合必须合法；
- 建议来源版本和哈希必须等于评审输入；
- 无法匹配或结构不完整时降级为 `CONFIRM_REQUIRED`，不得猜测映射；
- `suggestedCase` 只写入建议列，绝不覆盖原始稿或当前稿。

## 7. 后端接口

本阶段新增候选详情与人工操作接口，并保留旧任务接口：

```text
GET  /api/cases/ai/tasks/{taskId}/candidates
GET  /api/cases/ai/tasks/{taskId}/candidates/{candidateId}
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/keep-original
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/apply-suggestion
PUT  /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/current-case
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/exclude
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/restore
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/merge
POST /api/cases/ai/tasks/{taskId}/candidates/{candidateId}/adopt
```

所有改变当前稿或人工状态的请求都传 `expectedVersion` 和 `expectedContentHash`。冲突时返回明确错误，前端刷新后重新操作。

## 8. 批量采纳规则

默认可直接处理项仅包括：

- AI 状态为 `APPROVED`；
- 人工状态不是排除或合并；
- 采纳状态不是已采纳或采纳中。

存在建议优化、待确认、不建议采纳或 AI 补充项时，确认弹窗必须明确显示未纳入数量，不能静默跳过。全部成功使用轻提示；部分失败和全部失败使用可滚动结果摘要并只重试失败项。

## 9. 历史兼容与迁移

不在 SQL 中解析复杂历史 JSON，采用兼容式惰性物化：

1. 新任务在生成完成时直接创建规范候选记录。
2. 旧任务首次读取详情或首次操作时，由 Java 服务读取旧 JSON 并创建候选记录。
3. 有 `originalCaseSnapshot` 且未采纳：原始稿取 snapshot，建议稿取旧当前内容，当前稿恢复为原始稿。
4. 已采纳：当前稿保留当时实际采纳内容，并标记历史自动应用，不修改正式用例。
5. 无 snapshot：原始稿和当前稿都取旧内容，建议稿为空。
6. 旧 JSON 在过渡期继续写入兼容展示快照；待新前端完成迁移和生产数据验证后再单独移除。

## 10. Figma 接入边界

不统一抽屉宽度等场景参数。公共组件只沉淀遮罩、圆角、标题、按钮、状态色、间距和交互状态；业务抽屉保留独立宽度和内容结构。

Figma 新稿交付后再完成：

- 原始版/建议版差异展示；
- 排除、合并、补充、建议过期状态；
- 批量采纳范围确认和部分失败结果；
- 列表筛选、统计和人工操作入口。

本阶段前端只补领域类型和 API，不提前改变尚未确认的布局。

## 11. 发布与回滚

按兼容增量发布：

1. 先发布新表和兼容读取，不改变旧前端行为。
2. 再发布停止自动覆盖的新评审链路和人工接口。
3. Figma 验收后迁移前端页面。
4. 观察历史物化、并发冲突和采纳幂等指标。
5. 最后评估停止写旧 JSON 字段。

回滚时保留新表数据，不删除候选和审计记录；旧 JSON 仍可支撑旧页面读取，因此后端和前端可以分别回滚。

## 12. 验收标准

- AI 评审绝不自动修改原始稿和当前稿；
- 原始稿、建议稿和当前稿可分别读取；
- 每条候选具有稳定 ID，刷新和排序后不变；
- AI 建议必须由用户显式确认；
- 建议过期时不能直接应用；
- 所有状态刷新后仍存在；
- 已排除项不会被默认批量采纳；
- 采纳接口幂等，不产生重复正式用例；
- 每条正式用例可追溯到候选、评审、人工决定和采纳记录；
- 历史任务可正常打开，已采纳正式用例内容不变化；
- 后端测试、前端类型检查、构建和 `git diff --check` 全部通过。
