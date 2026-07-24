# 当前旧前端已调整资产清单

本文用于前端 2.0 重建时识别旧项目中已经被反复调整、用户已认可或应重点保留的视觉与交互资产。

生成依据：

- `git status --short`
- `git log --since="2026-06-01"`
- 最近提交的文件修改频率
- `web/src/style.css` 中的全局 token 与公共样式
- 最近高频调整页面与组件的文件体积、更新时间

## 当前状态

当前业务代码工作区基本干净，主要调整已经进入提交历史，不是散落的未提交改动。

当前未跟踪文件主要是整理文档/草稿：

- `.codex-tokens.css`
- `.codex-ui-style-guide.md`
- `docs/frontend-ui-rules-from-current-project.md`

## 最近集中调整范围

2026-06-01 到 2026-06-06 期间，前端高频调整集中在：

- 系统设置 / AI 连接 / 空间配置
- 配置中心
- 用例中心 / AI 配置 / AI 生成记录 / AI 生成详情
- 缺陷管理
- 接口自动化工作台
- 全局 UI token、表格、弹窗、抽屉、空状态、加载态

后端同期也配套调整了：

- AI 生成与评审链路
- AI 任务流式事件
- AI 配置 `temperature` / `topP`
- 工作空间字段与成员相关能力

## 一、全局视觉体系

核心文件：

- `web/src/style.css`

这是当前旧前端最重要的视觉资产之一。它已经沉淀了较完整的全局 token 和公共类。

应保留的 token：

```css
--ath-primary: #2563eb;
--ath-primary-hover: #1d4ed8;
--ath-primary-active: #1e40af;
--ath-blue-soft: #eff6ff;
--ath-green: #16a34a;
--ath-green-soft: #f0fdf4;
--ath-orange: #ea580c;
--ath-orange-soft: #fff7ed;
--ath-red: #ef4444;
--ath-red-soft: #fef2f2;
--ath-purple: #9333ea;
--ath-purple-soft: #faf5ff;
--ath-bg-page: #f9fafb;
--ath-bg-panel: #ffffff;
--ath-bg-muted: #f3f4f6;
--ath-bg-subtle: #fbfcff;
--ath-border: #e5e7eb;
--ath-border-soft: #f3f4f6;
--ath-border-strong: #d1d5db;
--ath-text-strong: #111827;
--ath-text-main: #374151;
--ath-text-muted: #6b7280;
--ath-text-subtle: #9ca3af;
--ath-space-1: 4px;
--ath-space-2: 8px;
--ath-space-3: 12px;
--ath-space-4: 16px;
--ath-space-5: 20px;
--ath-space-6: 24px;
--ath-space-7: 28px;
--ath-space-8: 32px;
--ath-radius-sm: 6px;
--ath-radius-md: 8px;
--ath-radius-lg: 12px;
--ath-radius-xl: 16px;
--ath-control-height-sm: 32px;
--ath-control-height-md: 38px;
--ath-table-row-height: 54px;
```

应保留的公共样式类型：

- `ath-page-shell` / `ath-page-header` / `ath-page-title`
- `ath-card-section` / `ath-panel-card`
- `ath-stat-card`
- `ath-status-badge`
- `ath-priority-badge`
- `ath-provider-badge`
- `ath-toolbar`
- `ath-button`
- `ath-table-card` / `ath-table`
- `ath-modal`
- `ath-drawer-layout`
- `ath-field`
- `ath-empty-state`
- `ath-loading-state`
- `ath-feedback-banner`

前端 2.0 建议：

- 不直接复制 `style.css` 整体。
- 将 token 放入 `src/shared/styles/tokens.css`。
- 将公共类拆成 `shared/ui` 组件或更小的全局基础样式。

## 二、系统设置

核心文件：

- `web/src/views/SystemSettingsView.vue`
- `web/src/components/AiConnectionSettingsPanel.vue`

已调整内容：

- 系统设置从顶部 Tab 改为左侧设置分类 + 右侧内容区。
- 左侧分类包含 AI 连接、空间配置、通用设置、团队管理、通知设置、安全设置、外观设置等。
- 未实现页面统一用“页面建设中...”占位。
- 配置中心复用系统设置页的部分能力，但保持业务边界。
- 空间配置加入空间卡片、成员管理、新增空间弹窗等。

重建保留点：

- 左侧分类菜单结构。
- 右侧卡片化内容布局。
- 页面建设中占位样式。
- 系统设置与配置中心的边界。

注意：

- `SystemSettingsView.vue` 当前体积较大，前端 2.0 不应照搬成一个大文件。
- 建议拆为 `pages/system-settings` + `widgets/settings-sidebar` + `widgets/ai-connection-pool` + `widgets/workspace-config-panel`。

## 三、配置中心

核心文件：

- `web/src/views/ConfigCenterView.vue`
- `web/src/views/SystemSettingsView.vue`

已调整内容：

- 新增配置中心模块。
- 放入环境配置、参数配置、数据库连接。
- 左侧菜单去掉“配置分类”标题，直接展示分类。
- 各配置页按 Figma 方向调整成卡片化/列表化布局。
- 新增/编辑弹窗样式统一。

重建保留点：

- 配置中心属于公共配置，不混入个人 AI 连接。
- 左侧分类 + 右侧内容。
- 环境、参数、数据库连接三类页面的统计卡、列表、弹窗样式。

## 四、AI 连接池

核心文件：

- `web/src/components/AiConnectionSettingsPanel.vue`
- `web/src/assets/ai-providers/*`
- `web/src/assets/ai-providers/custom-options/*`

已调整内容：

- AI 连接从表格改为卡片化连接池。
- 顶部说明文案优化。
- 新增供应商网格。
- 支持 OpenAI、Anthropic、Google、DeepSeek、Qwen、Azure、小米、智谱、Kimi、MiniMax、Ollama、自定义等供应商。
- 替换/调整供应商图标。
- 自定义供应商图标改为取连接名称首字作为视觉标识。
- 添加连接弹窗做成两步式：选择供应商 -> 配置模型。
- 去掉用户不需要配置的协议、超时、启用状态等字段方向。
- 获取模型列表、测试连接、删除连接反馈做了多轮调整。
- 删除连接时仅对 AI 生成/评审配置使用场景做提示，不强阻断。

重建保留点：

- 卡片式 AI 连接池。
- 供应商识别与统一中文供应商名称。
- 连接名称 + 模型名称 + 彩色供应商标签的展示格式。
- 供应商选择弹窗视觉。
- 测试连接反馈不要被弹窗遮罩挡住。
- 连接列表按创建时间正序展示。

## 五、用例中心 AI 配置

核心文件：

- `web/src/views/CaseAiConfigView.vue`
- `web/src/types/api.ts`

已调整内容：

- 生成模型与评审模型双卡片配置。
- 模型展示从“兼容接口”等协议文本改成连接名称、模型名称、彩色供应商标签。
- 配置缺失时要明确显示缺少哪一项。
- 保存配置逻辑区分不同卡片，避免整个页面刷新影响另一个卡片操作。
- 温度参数调整：生成模型约 `0.7`，评审模型约 `0.5`。
- Top-p 被恢复到 UI，并补充后端字段与保存链路。
- Prompt 区域多轮调整：默认卡片首屏可见；点击编辑后展开完整内容。

重建保留点：

- 生成/评审双角色卡片。
- 每张卡片独立保存。
- 模型展示格式统一为：连接名称、模型名称、供应商标签。
- Prompt 默认预览，编辑时展开。
- Temperature / Top-p 都保留。

## 六、AI 生成用例与记录详情

核心文件：

- `web/src/views/CaseAiGenerateView.vue`
- `web/src/views/CaseAiRecordsView.vue`
- `web/src/views/CaseAiRecordDetailView.vue`
- `web/src/utils/caseAiGenerationRecords.ts`

已调整内容：

- 上传文档图片能力提示固定文案。
- 文档含图片但模型不支持时，创建任务前校验并允许取消或忽略图片继续。
- 生成记录加载态优化，避免“暂无生成记录”闪现。
- AI 输出板成功后保留。
- 输出板自动滚动到最新事件。
- 生成事件即使降级完整输出也有日志。
- 用例详情抽屉改为“用例详情 / AI 分析”双 Tab。
- AI 分析展示测试角度、生成依据、生成原因、评审意见、优化原因、补充原因、覆盖缺口、原始版本对比。
- 评审不只是打标，应支持通过、优化、补充、建议确认、不推荐。
- 批量采纳选中状态被取消的问题已修复。

重建保留点：

- SSE/事件流输出板。
- 成功任务仍可回看输出板。
- 详情抽屉双 Tab。
- 每条用例可追溯生成依据和 AI 分析。
- 生成前图片能力校验与“忽略图片继续”分支。

## 七、用例管理与用例执行

核心文件：

- `web/src/views/CaseManagementView.vue`
- `web/src/components/CaseEditorDrawer.vue`
- `web/src/views/CaseExecutionView.vue`
- `web/src/views/CaseCenterView.vue`

已调整内容：

- 用例中心 Tab 样式和页面容器统一。
- 用例管理筛选区与表格区间距微调。
- 表格换页大小后滚动问题修复。
- 操作列固定时视觉遮挡问题修复。
- 用例编号列颜色调整，不再误导为可点击入口。
- 用例编辑抽屉/详情抽屉样式统一。
- 用例执行页做轻量视觉统一。

重建保留点：

- 左侧目录树 + 右侧列表的用例管理结构。
- 筛选区和表格区间距。
- 表格固定操作列轻边界。
- 用例抽屉统一样式。

## 八、缺陷管理

核心文件：

- `web/src/views/BugManagementView.vue`
- `web/src/views/BugCreateView.vue`
- `web/src/views/BugDetailView.vue`
- `web/src/components/BugEditorForm.vue`
- `web/src/components/BugDetailDrawer.vue`
- `web/src/components/BugDetailContent.vue`
- `web/src/components/BugAttachmentPanel.vue`
- `web/src/components/BugActivityTimeline.vue`
- `web/src/components/BugCaseAssociateDialog.vue`
- `web/src/components/BugLinkDrawer.vue`

已调整内容：

- 缺陷管理页面整体视觉统一。
- 缺陷新建/编辑页面统一。
- 缺陷详情页统一。
- 缺陷关联弹窗/抽屉统一。
- 缺陷列表移除不符合 Figma 的“更新于多少”副文本方向。
- 列表行高向 Figma/样板靠齐。

重建保留点：

- 缺陷列表、详情、编辑、关联弹窗的统一视觉。
- 状态、优先级、严重程度标签语言。
- 附件、活动时间线、关联用例等详情模块结构。

## 九、接口自动化

核心文件：

- `web/src/components/ApiAutomationWorkspace.vue`
- `web/src/components/ApiAssertionEditor.vue`
- `web/src/components/ApiProcessorEditor.vue`
- `web/src/views/AutomationView.vue`
- `web/src/components/MonacoCodeEditor.vue`

已调整内容：

- 接口自动化工作台从最早接口模块开始持续多轮调整。
- 请求参数、请求体、响应内容、目录树、抽屉、断言、前后置处理器、数据库提取、场景步骤、执行历史、AI 生成接口用例等都在同一个大组件里累积。
- 执行 tab 是当前用户满意样板。
- 报告和设置 tab 暂时替换为统一占位页。
- 执行页 tab 中间的“最近执行任务”已去掉。
- 接口自动化弹窗/抽屉、步骤编辑区、参数表格做过视觉统一。

重建保留点：

- 执行 tab 的工具型工作台布局。
- 左侧目录树、中间请求编辑、响应/执行结果区域的密度和层级。
- 参数表格、断言编辑器、处理器编辑器的细节。
- 报告/设置 tab 暂时用占位页。

重要风险：

- `ApiAutomationWorkspace.vue` 当前约 695KB，是旧前端最典型的大组件风险。
- 前端 2.0 必须拆为多个 widgets/features/processes，不能复制这个组织方式。

## 十、占位页

核心文件：

- `web/src/views/DashboardView.vue`
- `web/src/views/AutomationView.vue`
- `web/src/views/SystemSettingsView.vue`

已调整内容：

- 工作台改为统一“页面建设中...”占位。
- Web UI 自动化、APP 自动化改为统一占位。
- 系统设置未实现分类使用统一占位。
- 接口自动化报告/设置 tab 使用统一占位。

重建保留点：

- 占位页不要做营销风大页面。
- 保持轻量、居中、文案克制、和全局空状态一致。

## 十一、后端配套能力

这些不是前端视觉资产，但前端 2.0 对接时必须保留接口语义。

核心方向：

- AI 生成任务 SSE + 持久化事件。
- 降级完整输出也写事件。
- AI 生成用例智能数量：初次最多 50，评审补充最多 30，最终最多 80。
- 评审支持自动优化和补充。
- 每条用例保留测试角度、生成依据、生成原因、评审意见、优化/补充原因。
- 图片能力校验：文档含图片但模型不支持时可取消或忽略图片。
- AI 配置支持 `temperature` 和 `topP`。
- 工作空间支持 profile 字段、删除当前空间后的切换逻辑。

## 前端 2.0 迁移优先级

## 任务中心迁移遗留问题

当前 Figma 已提供任务中心主页面设计，前端 2.0 已新增任务中心菜单与页面入口。

已按 Figma 先行对齐的内容：

- 顶部“任务列表”页签。
- 任务统计卡片。
- 搜索与筛选行。
- 任务列表字段、状态标签、启用开关、操作图标。
- 任务列表已接入公共 `AppFigmaTable`、服务端分页、固定操作列和字段展示抽屉，默认每页 10 条；Figma 默认字段及视觉样式保持不变。
- 字段展示抽屉额外提供后台已有但 Figma 默认列表未展示的任务 ID、工作空间编码和原始任务状态，以上字段默认隐藏。
- 右侧任务详情面板：基本信息、执行历史、AI 分析三个 Tab。

当前数据/逻辑暂未完整支撑的内容：

- 任务接口当前主要提供任务名称、引擎类型、状态、摘要、工作空间等基础字段。
- Figma 表格中的环境、调度方式、启用状态、最近执行时间、耗时、创建人等字段暂按 Figma 示例数据做视觉兜底。
- 任务名称关键字已进入服务端分页查询；任务类型、启用状态、最近结果和运行环境仍只过滤当前服务端页，数据超过一页时筛选总数和分页结果可能不准确，后端需补充对应查询参数。
- 右侧基本信息中的下次执行、创建时间、Cron 表达式、失败策略、通知机器人、日志保留暂按 Figma 示例数据做视觉兜底。
- 右侧执行历史中的近 10 次趋势图、历史列表、报告入口、总/过/败统计暂按 Figma 示例数据做视觉兜底。
- 右侧 AI 稳定性分析、近期通过率、高频失败步骤、调度建议暂按 Figma 示例数据做视觉兜底。
- 编辑任务抽屉已按 Figma `101:909` 先行复刻视觉；任务类型、执行环境、Cron 解析、下次执行、通知配置、失败策略、测试执行、保存修改当前仍是视觉兜底或关闭抽屉交互，真实选项、校验、保存接口、测试执行接口后续需要补齐。
- 新建任务、立即执行、查看、删除等操作按钮仅完成视觉入口，真实交互流程后续需要补齐。
- 任务详情面板当前点击列表“查看”图标打开，后续如需路由级详情页、独立抽屉状态保持或报告跳转，需要补充产品交互与接口。

后续处理建议：

- 后端补齐任务中心列表字段或提供任务详情聚合接口后，再替换页面中的视觉兜底数据。
- 若任务新增流程需要完整落地，应补充 Figma 抽屉或按统一抽屉规范实现，并继续记录非 Figma 原图部分。

## Web UI 用例管理列表迁移遗留问题

当前用例管理列表已接入公共 Figma 表格、服务端分页、固定操作列和字段展示抽屉，默认视觉字段保持 Figma 设计不变。

当前后端数据/查询能力仍存在以下差异：

- `WebUiCaseItem` 暂无优先级字段，列表中的 P0/P1/P2 仍沿用现有前端视觉兜底；后续需要后端补充真实优先级并纳入新增、编辑、列表查询链路。
- `WebUiCaseItem` 暂无创建人字段，列表“创建人”当前沿用已有工作空间名称兜底；后续需要后端返回真实创建人信息。
- 优先级和浏览器筛选尚未进入列表接口查询参数，目前只过滤服务端返回的当前页数据；数据超过一页后，筛选总数和分页结果可能不准确。
- 左侧目录节点由当前页用例数据归纳，根节点总数来自服务端总数，但子目录及子目录数量不是全量统计；后续需要目录聚合接口或列表接口返回目录统计。

本轮未修改以上接口契约，避免为了表格结构迁移擅自改变后台行为。

## 缺陷管理列表迁移遗留问题

当前缺陷列表已接入公共 Figma 表格、服务端分页、固定操作列和字段展示抽屉，默认视觉字段及其顺序保持 Figma 设计不变。

当前后端查询能力仍存在以下差异：

- 负责人筛选尚未进入缺陷列表接口查询参数，目前只过滤服务端返回的当前页数据；数据超过一页后，筛选总数和分页结果可能不准确。
- 在“全部工作空间”范围浏览时，工作空间筛选同样只作用于当前服务端页；后续需要后端支持工作空间查询参数，或提供具备相同语义的全量筛选接口。
- 列表总数和总页数现已恢复使用服务端分页结果，不再用当前页客户端过滤后的条数覆盖；上述两个筛选能力补齐前，不能把当前页过滤结果当作全量统计。

本轮未虚构新的后端查询参数，避免表格结构迁移改变现有接口契约。

### P0：必须保留

- 技术栈若追求旧前端 1:1，应保持 Element Plus。
- 全局 token 和 `ath-*` 视觉语言。
- 系统设置 AI 连接页。
- 配置中心。
- 接口自动化执行 tab。
- AI 配置双模型卡片。
- AI 生成记录详情的输出板和双 Tab 抽屉。
- 用例/缺陷/接口自动化表格、弹窗、抽屉统一规则。

### P1：重点复刻

- 供应商图标和供应商标签体系。
- 空间配置页面和新增工作空间弹窗。
- 缺陷详情页、关联弹窗、附件、时间线。
- 用例执行页轻量统一后的样式。
- 占位页、加载态、错误态。

### P2：迁移后逐步细化

- Hover、focus、loading、disabled 等细节。
- 不同视口下的截图回归。
- 文案微调。
- 统计卡强调规则。

## 建议的新前端目录映射

```text
src/
  app/
  shared/
    styles/
      tokens.css
      element-overrides.css
      global.css
    ui/
      app-page/
      app-card/
      app-table/
      app-dialog/
      app-drawer/
      app-empty-state/
      app-loading-state/
      app-status-badge/
      app-provider-badge/
  entities/
    workspace/
    ai-model/
    case/
    bug/
    api-definition/
    config/
  features/
    ai-connection-create/
    ai-connection-edit/
    ai-connection-test/
    case-create/
    case-edit/
    case-adopt/
    bug-create/
    bug-edit/
    api-send-request/
    api-save-definition/
  widgets/
    settings-sidebar/
    config-sidebar/
    ai-connection-pool/
    workspace-config-panel/
    config-env-panel/
    config-param-panel/
    config-db-panel/
    case-table/
    case-detail-drawer/
    ai-case-config-panel/
    ai-generation-record-table/
    ai-generation-detail/
    bug-table/
    bug-detail-panel/
    api-workspace/
    api-request-editor/
    api-response-panel/
  processes/
    ai-generation-flow/
    api-execution-flow/
  pages/
```

## 迁移验收方式

每迁移一个页面，固定：

- 路由
- 账号/权限
- 工作空间
- 数据状态
- 浏览器缩放 100%
- 视口 `1366x768` 和 `1920x1080`

对比：

- 页面外边距
- 卡片宽高和间距
- 字号/字重/行高
- 按钮高度、圆角、hover
- 表格行高、表头、固定列
- 弹窗/抽屉 header/body/footer
- 空状态/加载态/错误态
- 横向/纵向滚动行为

结论：

旧前端已经值得迁移的不是“大文件代码”，而是这些被反复调过的视觉规则、交互状态、业务链路和页面验收标准。前端 2.0 应该复刻结果，而不是复刻旧代码组织。
