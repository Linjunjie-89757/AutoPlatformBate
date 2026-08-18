# 测试管理一期：领域规则与接口契约

## 1. 文档状态

- 阶段：第一阶段，规则与契约。
- 目标：在编写数据库迁移和后端代码前，统一版本、需求、测试计划、用例、缺陷和报告的业务语义。
- 适用范围：当前工作区内的测试管理功能。
- 设计依据：当前 Vue 演示页面、Figma/Make 已确认流程、现有 Spring Boot/MyBatis-Plus/Flyway/工作区权限实现。
- 本文冻结后，后端实现与 Figma 状态补稿可以并行进行。

## 2. 一期边界

### 2.1 一期必须形成的闭环

```text
创建版本
  -> 在版本下创建需求
  -> 需求关联用例库用例并完成评审
  -> 版本测试计划选择需求并自动带入用例
  -> 可补充用例库中的回归用例
  -> 开始计划并冻结用例快照
  -> 在计划中执行用例
  -> 失败用例创建缺陷并自动建立追溯关系
  -> 完成计划并生成报告
  -> 版本聚合需求、计划、执行和缺陷质量数据
```

### 2.2 一期不做

- 不增加独立的“覆盖度审批”流程。需求关联用例的评审结果就是一期覆盖门禁。
- 不实现复杂审批流、多人会签或可配置审批节点。
- 不实现测试计划定时启动、异步执行队列或自动分配执行人。
- 不允许临时测试计划在创建后自动转换成版本测试计划。
- 不实现 Jira/禅道双向回写，一期只做导入或同步读取。
- 不实现同一计划的多份报告版本；一期每个计划维护一份当前报告快照。

## 3. 核心关系

```text
工作区
  -> 版本
       -> 需求
            <-> 用例库用例
       -> 版本测试计划
            -> 选中的需求
            -> 测试用例快照
                 -> 执行记录
                 -> 缺陷
            -> 测试报告

工作区
  -> 临时测试计划
       -> 直接选择用例库用例
       -> 测试用例快照、执行记录、缺陷和报告
```

规则：

- 需求必须且只能属于一个版本。
- 一个版本可以包含多个需求和多个版本测试计划。
- 一个用例可以关联多个需求，一个需求可以关联多个用例。
- 一个版本测试计划可以选择同一版本下的多个需求。
- 一个计划中的同一个源用例只保留一条计划用例记录，禁止重复计数。
- 同一个计划用例可以追溯到多个需求。
- 临时测试计划不属于版本，也不强制关联需求。
- 缺陷可以独立创建；从计划用例创建时必须记录计划、计划用例、源用例、需求和版本追溯信息。

## 4. 评审与执行语义

### 4.1 用例库

用例库继续使用现有 `tb_case_info`，负责保存可复用的测试资产。测试管理不复制一套新的用例资产表。

现有 `tb_case_info.execution_status` 和用例执行历史不能作为测试计划执行结果。原因是同一个用例可以在不同计划中多次执行，每次执行必须相互隔离。

### 4.2 需求用例评审

一期评审发生在“需求与用例的关联关系”上，而不是直接修改用例库用例的全局状态。

这样可以表达：同一个用例覆盖需求 A 的方式已通过评审，但覆盖需求 B 的方式仍需要调整。

关联评审状态：

```text
PENDING -> REVIEWING -> PASSED
                     -> REJECTED -> REVIEWING
PASSED  -> REVIEWING 仅用于用例内容变化后的重新评审
```

规则：

- 新关联的用例默认为 `PENDING`。
- 驳回必须填写原因。
- 计划按需求自动带入用例时，只带入关联评审为 `PASSED` 的用例。
- 需求级评审状态不单独人工维护，由关联状态聚合：
  - 没有关联用例：`PENDING`
  - 存在 `REJECTED`：`REJECTED`
  - 存在 `PENDING` 或 `REVIEWING`：`REVIEWING`
  - 全部为 `PASSED`：`PASSED`

### 4.3 测试计划执行

- 执行只发生在计划用例快照上。
- 用例库后续修改不改变已经开始的计划。
- 计划开始前，可以自由增删用例。
- 计划开始后，允许追加用例以满足回归补测场景，但必须记录操作者和原因。
- 计划开始后，只能移除尚未执行的用例，并且必须二次确认和记录原因。
- 已完成或已取消计划的用例集合和执行结果不可再修改。

## 5. 数据模型

后端包建议新增：

```text
server/src/main/java/com/company/autoplatform/testmanagement
```

所有写接口必须使用具体工作区，`X-Workspace-Code: ALL` 只允许聚合读取。

### 5.1 `tb_test_version`

保存版本基本信息。

```text
id
workspace_id
version_no
name
version_type
status
owner_id
start_date
test_date
release_date
goal
lock_version
archived_at
created_by
updated_by
created_at
updated_at
```

约束：

- `workspace_id + version_no` 唯一。
- `workspace_id + name` 唯一。
- `lock_version` 用于乐观锁。

### 5.2 `tb_test_requirement`

保存版本需求。

```text
id
workspace_id
requirement_no
version_id
title
priority
source_type
source_ref
assignee_id
description
lock_version
deleted_at
created_by
updated_by
created_at
updated_at
```

约束：

- `version_id` 非空。
- `workspace_id + requirement_no` 唯一。
- 需求没有独立存储的覆盖率和通过率字段，这些值根据关联和执行记录聚合。

### 5.3 `tb_test_requirement_case`

保存需求与用例的多对多关系及评审结果。

```text
id
workspace_id
requirement_id
case_id
review_status
review_note
reviewer_id
reviewed_at
case_updated_at_when_reviewed
created_by
created_at
updated_at
```

约束：

- `requirement_id + case_id` 唯一。
- 需求和用例必须属于同一个工作区。
- 用例在评审通过后发生内容更新时，接口返回 `reviewOutdated=true`，由用户决定是否重新评审。

### 5.4 `tb_test_plan`

保存版本测试计划或临时测试计划。

```text
id
workspace_id
plan_no
purpose
plan_type
status
version_id
name
owner_id
start_date
end_date
goal
min_execute_rate
min_pass_rate
allow_p0
max_p1
auto_report
owner_confirm_required
snapshot_frozen_at
started_at
completed_at
cancelled_at
cancel_reason
lock_version
deleted_at
created_by
updated_by
created_at
updated_at
```

约束：

- `purpose=VERSION` 时 `version_id` 非空。
- `purpose=TEMP` 时 `version_id` 必须为空。
- `workspace_id + plan_no` 唯一。

### 5.5 `tb_test_plan_requirement`

保存版本测试计划选择的需求。

```text
id
workspace_id
plan_id
requirement_id
created_by
created_at
```

约束：

- `plan_id + requirement_id` 唯一。
- 需求必须属于计划关联的版本。
- 临时测试计划不能写入该表。

### 5.6 `tb_test_plan_case`

保存计划用例快照和当前执行结果。

```text
id
workspace_id
plan_id
source_case_id
origin_type
snapshot_case_no
snapshot_title
snapshot_module
snapshot_priority
snapshot_precondition
snapshot_steps
snapshot_expected_result
source_case_updated_at
added_after_start
assignee_id
execution_status
execution_note
executed_by
executed_at
sort_order
lock_version
created_by
created_at
updated_at
```

`origin_type`：

```text
REQUIREMENT
MANUAL
```

`execution_status`：

```text
PENDING
PASSED
FAILED
BLOCKED
SKIPPED
```

约束：

- `plan_id + source_case_id` 唯一，从数据库层阻止重复用例。
- 快照字段是执行与报告的事实来源，不从用例库实时回读展示。

### 5.7 `tb_test_plan_case_requirement`

保存计划用例快照与需求的追溯关系。

```text
id
workspace_id
plan_case_id
requirement_id
created_at
```

约束：

- `plan_case_id + requirement_id` 唯一。
- 手动补充且不覆盖当前版本需求的回归用例可以没有记录。

### 5.8 `tb_test_plan_case_execution`

追加保存每次标记或修改执行结果的历史记录。

```text
id
workspace_id
plan_id
plan_case_id
previous_status
execution_status
execution_note
executor_id
executed_at
created_at
```

`tb_test_plan_case` 保存当前结果，本表保存不可覆盖的历史过程。

### 5.9 `tb_test_plan_report`

保存计划完成时生成的报告快照和签署状态。

```text
id
workspace_id
plan_id
status
content_snapshot_json
generated_at
signed_by
signed_at
signature_revoked_by
signature_revoked_at
lock_version
created_at
updated_at
```

状态：

```text
GENERATED
SIGNED
```

约束：

- `plan_id` 唯一。
- 报告数据来自计划快照、执行历史和缺陷关系，不读取当前用例库内容。

### 5.10 `tb_test_activity_log`

保存版本、需求和计划详情页需要展示的业务时间线。

```text
id
workspace_id
entity_type
entity_id
action_code
action_name
detail
actor_id
created_at
```

现有 `tb_sys_operation_audit_log` 继续承担 HTTP 安全审计；`tb_test_activity_log` 承担用户可读的业务过程。两者用途不同，不互相替代。

### 5.11 缺陷表扩展

现有 `tb_bug_info` 增加：

```text
test_version_id
test_requirement_id
test_plan_id
test_plan_case_id
```

并在 `BugSourceType` 增加：

```text
TEST_PLAN
```

保留现有缺陷与用例多对多关系。上述字段保存缺陷产生时的主要追溯上下文，避免只依赖名称字段。

## 6. 状态机

### 6.1 版本状态

```text
PLANNING -> DEVELOPING -> TESTING -> PENDING_RELEASE -> RELEASED -> ARCHIVED
                ^           |
                |-----------|
                    退回开发

PENDING_RELEASE -> TESTING
PLANNING / DEVELOPING -> ARCHIVED
```

规则：

- 进入 `TESTING` 前至少存在一个需求。
- 进入 `PENDING_RELEASE` 前，所有未取消的版本计划必须完成。
- 进入 `PENDING_RELEASE` 时执行质量门禁。
- `RELEASED` 的业务内容只读，只允许继续执行归档状态变更；`ARCHIVED` 为完全只读状态。
- 退回开发、退回测试、归档和发布必须填写原因并记录活动日志。

版本质量门禁：

- 至少存在一个已完成版本测试计划。
- 所有必测用例均已执行。
- 聚合执行率达到计划要求。
- 聚合通过率达到计划要求。
- 未关闭 P0 缺陷为 0。
- 未关闭 P1 缺陷不超过计划阈值。
- 要求负责人确认的计划已经签署报告。

门禁失败返回具体失败项。具有 `test_management.release` 权限的用户可以强制推进，但必须填写原因。

### 6.2 测试计划状态

```text
DRAFT -> PENDING -> RUNNING -> COMPLETED
           |          |
           |          -> BLOCKED -> RUNNING
           |
           -> RUNNING

DRAFT / PENDING / RUNNING / BLOCKED -> CANCELLED
```

规则：

- `DRAFT`：允许缺少部分字段，但必须有名称才能保存。
- `PENDING`：字段完整，等待开始。
- `RUNNING`：已冻结快照，可以执行和按规则追加用例。
- `BLOCKED`：暂停执行，恢复后回到 `RUNNING`。
- `COMPLETED`、`CANCELLED`：终态，不允许修改执行结果和用例集合。
- 删除只允许 `DRAFT`，以及没有执行、缺陷和报告数据的 `CANCELLED` 计划。

开始计划必须满足：

- 名称、负责人、开始日期、结束日期完整且日期合法。
- 至少包含一个用例。
- 版本计划已关联版本，并且至少选择一个该版本需求。
- 自动带入用例均来自评审通过的需求用例关系。

完成计划必须满足：

- 没有 `PENDING` 用例。
- 执行率、通过率、P0/P1 缺陷符合计划阈值。
- 失败或阻塞用例可以存在，但必须通过质量门禁判断。
- 强制完成属于质量门禁越权操作，必须拥有 `test_management.release` 权限并填写原因；普通执行权限不能绕过门禁。

## 7. 指标口径

### 7.1 需求质量状态

```text
UNCOVERED：没有关联用例
PARTIAL：有关联用例，但存在未通过评审的关联
COVERED：全部关联用例评审通过，但尚未全部通过执行
PASSED：全部关联用例在当前版本有效计划中至少有一次通过结果
```

如果用例最新一次有效执行结果为 `FAILED` 或 `BLOCKED`，该用例不能计入需求通过数。

### 7.2 测试计划

```text
执行率 = 非 PENDING 用例数 / 计划用例总数
通过率 = PASSED 用例数 / 非 PENDING 用例数
```

分母为 0 时返回 0，不返回 `NaN` 或空字符串。

### 7.3 版本

- 需求数、计划数、用例数、执行数和通过数均通过版本关系聚合。
- 同一源用例出现在多个计划时，计划指标分别统计，版本用例范围按源用例 ID 去重。
- 版本缺陷统计使用 `test_version_id`，不通过名称匹配。

## 8. 权限契约

新增权限模块：

```text
test_management.view       查看版本、需求、计划、执行和报告
test_management.create     创建版本、需求和计划
test_management.edit       编辑、关联、分配执行人和追加用例
test_management.delete     删除草稿和允许删除的数据
test_management.review     需求用例评审、报告签署和撤回
test_management.execute    开始、阻塞、恢复、执行、完成和取消计划
test_management.release    推进版本状态以及强制越过计划或版本质量门禁
test_management.export     导出需求、计划和报告
```

默认角色建议：

| 角色 | 默认权限 |
| --- | --- |
| 测试负责人 | 全部测试管理权限 |
| 测试工程师 | view、create、edit、execute、export |
| 开发人员 | view |
| 只读访客 | view |

工作区管理员、工作区所有者和平台超级管理员继续沿用现有全权限覆盖规则。

后端拦截路径：

```text
/api/test-management/**
```

业务服务仍需进行对象级校验，拦截器不能替代以下检查：

- 对象是否属于当前工作区。
- 需求是否属于计划版本。
- 当前状态是否允许该操作。
- 操作者是否为负责人不作为权限替代条件。

## 9. API 契约

### 9.1 通用约定

- 所有接口继续返回统一 `ApiResponse<T>`。
- 列表使用现有 `PageResponse<T>`。
- 写请求必须携带具体 `X-Workspace-Code`。
- 更新和状态变更请求必须携带 `expectedVersion`。
- 导入采用“预览后提交”，避免解析错误时直接写入数据库。
- 状态变更使用动作接口，不允许通过普通 `PUT` 直接修改状态字段。

### 9.2 版本

```text
GET    /api/test-management/versions
POST   /api/test-management/versions
GET    /api/test-management/versions/{id}
PUT    /api/test-management/versions/{id}
POST   /api/test-management/versions/{id}/transition
GET    /api/test-management/versions/{id}/requirements
GET    /api/test-management/versions/{id}/plans
GET    /api/test-management/versions/{id}/defects
GET    /api/test-management/versions/{id}/report
GET    /api/test-management/versions/{id}/activities
GET    /api/test-management/versions/{id}/report/export
```

状态变更请求：

```json
{
  "targetStatus": "PENDING_RELEASE",
  "expectedVersion": 3,
  "force": false,
  "reason": null
}
```

### 9.3 需求

```text
GET    /api/test-management/requirements
POST   /api/test-management/requirements
GET    /api/test-management/requirements/{id}
PUT    /api/test-management/requirements/{id}
DELETE /api/test-management/requirements/{id}
PUT    /api/test-management/requirements/{id}/cases
POST   /api/test-management/requirements/{id}/review/start
POST   /api/test-management/requirements/{id}/cases/{caseId}/review
GET    /api/test-management/requirements/{id}/defects
GET    /api/test-management/requirements/{id}/activities
POST   /api/test-management/requirements/import/preview
POST   /api/test-management/requirements/import/commit
GET    /api/test-management/requirements/import/template
```

单条关联评审请求：

```json
{
  "decision": "PASSED",
  "comment": null,
  "expectedVersion": 2
}
```

### 9.4 测试计划

```text
GET    /api/test-management/plans
POST   /api/test-management/plans
GET    /api/test-management/plans/{id}
PUT    /api/test-management/plans/{id}
DELETE /api/test-management/plans/{id}
PUT    /api/test-management/plans/{id}/requirements
PUT    /api/test-management/plans/{id}/cases
POST   /api/test-management/plans/{id}/cases
DELETE /api/test-management/plans/{id}/cases/{planCaseId}
PUT    /api/test-management/plans/{id}/cases/{planCaseId}/assignee
POST   /api/test-management/plans/{id}/cases/{planCaseId}/results
POST   /api/test-management/plans/{id}/start
POST   /api/test-management/plans/{id}/block
POST   /api/test-management/plans/{id}/resume
POST   /api/test-management/plans/{id}/complete
POST   /api/test-management/plans/{id}/cancel
GET    /api/test-management/plans/{id}/defects
POST   /api/test-management/plans/{id}/cases/{planCaseId}/defects
GET    /api/test-management/plans/{id}/report
POST   /api/test-management/plans/{id}/report/generate
POST   /api/test-management/plans/{id}/report/sign
POST   /api/test-management/plans/{id}/report/revoke-signature
GET    /api/test-management/plans/{id}/report/export
GET    /api/test-management/plans/{id}/activities
```

标记执行结果请求：

```json
{
  "status": "FAILED",
  "note": "验证码过期后仍可提交",
  "expectedVersion": 4
}
```

完成或取消请求：

```json
{
  "expectedVersion": 7,
  "force": false,
  "reason": null
}
```

## 10. 错误响应契约

现有 `ApiResponse` 在第二阶段扩展可选 `code` 和 `details` 字段；已有 `success/data/message` 保持兼容。

```json
{
  "success": false,
  "data": null,
  "message": "测试计划未达到完成条件",
  "code": "TM_QUALITY_GATE_FAILED",
  "details": {
    "failedChecks": [
      { "key": "EXECUTION_RATE", "target": 90, "actual": 77.5 }
    ]
  }
}
```

HTTP 与业务码：

| HTTP | 业务码 | 场景 |
| --- | --- | --- |
| 400 | `TM_VALIDATION_FAILED` | 字段或关联参数不合法 |
| 403 | `TM_PERMISSION_DENIED` | 没有操作权限 |
| 404 | `TM_RESOURCE_NOT_FOUND` | 版本、需求、计划或快照不存在 |
| 409 | `TM_CONCURRENT_MODIFICATION` | 乐观锁版本不一致 |
| 409 | `TM_INVALID_TRANSITION` | 当前状态不允许目标操作 |
| 409 | `TM_DUPLICATE_CASE` | 同一计划重复添加用例 |
| 409 | `TM_SNAPSHOT_LOCKED` | 终态计划仍尝试修改快照 |
| 422 | `TM_QUALITY_GATE_FAILED` | 完成计划或发布版本门禁未通过 |
| 422 | `TM_REVIEW_REQUIRED` | 自动带入的需求用例尚未评审通过 |

并发冲突后，前端不得静默覆盖，应提示用户重新加载最新数据。

## 11. 事务与一致性规则

- 创建计划、选择需求和生成计划用例必须在同一事务中完成。
- 开始计划时，刷新并冻结全部快照必须在同一事务中完成。
- 标记执行结果时，同时更新当前结果、追加执行历史和活动日志。
- 从计划用例创建缺陷时，同时创建缺陷和全部追溯关系。
- 完成计划时，同时校验门禁、变更状态、生成报告和记录活动日志。
- 删除或解除关联前必须检查下游计划快照和缺陷引用。
- 聚合指标由查询实时计算；一期不维护容易漂移的手工计数字段。
- 所有关联写入前必须验证工作区一致，禁止跨工作区 ID 关联。

## 12. Figma 补稿清单

### 12.1 可以立即补充的通用状态

- 版本、需求、计划列表首次加载和局部刷新。
- 加载失败、超时、重试。
- 后端空态和搜索无结果。
- 保存中、导入中、导出中、报告生成中。
- 按钮提交中和禁用态。
- 无查看权限页面、无操作权限提示。
- 未保存表单关闭或切换页面确认。
- 并发冲突提示，操作项为“重新加载”和“取消”。

### 12.2 按本文规则补充的确认弹窗

| 场景 | 必须表达的信息 |
| --- | --- |
| 开始测试计划 | 用例将冻结为快照；显示需求数、用例数和计划周期 |
| 运行中追加用例 | 新用例按当前版本生成快照；要求填写原因 |
| 运行中移除用例 | 仅未执行用例可移除；展示对范围和通过率的影响 |
| 完成测试计划 | 显示质量门禁结果；失败时展示每个失败项 |
| 强制完成计划 | 仅有权限用户可见；原因必填 |
| 取消测试计划 | 执行记录和缺陷保留；原因必填 |
| 删除草稿计划 | 明确删除不可恢复 |
| 解除需求用例关联 | 展示受影响的计划；已冻结快照不随关联删除 |
| 驳回需求用例评审 | 原因必填，支持重新评审 |
| 标记版本待发布 | 展示版本聚合质量门禁 |
| 标记版本已发布 | 明确发布后版本只读 |
| 版本退回测试或开发 | 原因必填并说明已签报告是否保留 |
| 导入部分成功 | 展示成功、重复、失败数量和失败行下载入口 |
| 数据并发冲突 | 不覆盖他人修改，提供重新加载入口 |

### 12.3 Figma 文案需要使用的后端事实

- 剩余时间、失败数量、实际阈值和影响范围均由后端返回，不在前端写死。
- 门禁弹窗直接渲染 `failedChecks`，不要按固定数量设计。
- 删除、取消、强制完成和强制发布都需要原因时，输入区必须包含字段错误态。
- 所有提交弹窗应保持固定最小高度，异步加载和字段错误不能导致弹窗明显变形。

## 13. 第二阶段实现顺序

1. 新增 H2 和 MySQL 对等迁移，版本号从当前最新迁移之后继续。
2. 新增 `testmanagement` 包下的实体、Mapper、枚举和请求响应模型。
3. 扩展权限目录、权限拦截路径、默认角色权限和操作审计分类。
4. 实现版本、需求和测试计划基础查询及 CRUD。
5. 实现关系校验、状态机、乐观锁和稳定错误码。
6. 增加领域服务测试和权限接口测试，再开始前端替换 Demo 数据。

## 14. 第一阶段验收结论

第一阶段完成标准：

- 关系、评审位置和执行位置没有歧义。
- 版本计划与临时计划边界明确。
- 用例快照和重复用例规则明确。
- 状态流转、质量门禁和强制操作规则明确。
- 权限码和后端拦截范围明确。
- API、错误码和并发处理方式明确。
- Figma 可以根据清单补齐确认、失败和提交状态。

进入第二阶段前，如产品要改变“需求必须属于版本”“临时计划不属于版本”或“运行中允许追加用例”三项规则，需要先更新本文，再调整数据模型。
