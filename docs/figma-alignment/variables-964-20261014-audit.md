# 变量配置逐项核对记录

## 范围

- Design：`jSUUPxC4PVD9Kp2FUydfox:964:2`，已保存截图 `output/playwright/variables/design-964-2-latest.png`、`design-global.png`、`design-set.png`、`design-builtin.png`
- Make 源码：`设计/figma_make代码最新20261013/src/imports/VarConfigModule.tsx`
- Make 预览：用户提供的全屏 Make 地址；已通过用户启动的 Chrome CDP `9222` 登录并进入应用，完成全局变量、变量集、内置函数三种视图核对
- Vue：`src/widgets/config-param-panel/ConfigVariableFigmaWorkspace.vue`、`ConfigVariableBuiltinPanel.vue`、`useConfigVariableActions.ts`
- 浏览器：本地 `http://localhost:4173`，登录 `superadmin`，工作区 `X-MAN`

## 差异清单

| 编号 | 变体 / 元素 | Design / Make 证据 | Vue 结果 | 状态 |
| --- | --- | --- | --- | --- |
| V-01 | 全局变量操作列 | Design 节点表格为编辑、删除；Make `VarRow` 为编辑、删除 | 2 个按钮，28x28；删除 hover 红色 | `verified` |
| V-02 | 变量集详情操作列复制 | Design 与 Make 当前实现为编辑、删除；本地已有复制能力 | Vue 为编辑、复制、删除；点击复制新增 `*_COPY`，持久化成功并可删除恢复 | `accepted-deviation`：用户明确决定保留本地复制能力；`acceptance.type=user-decision`，`acceptance.reference=本轮用户澄清` |
| V-03 | 敏感变量类型标签 | Design / Make 在类型列显示“文本 + 敏感” | Vue 已在类型列显示“文本 + 敏感”，变量名仍保留锁图标 | `resolved` |
| V-04 | 变量集标题适用类型 | Design / Make 为 API、Web UI、APP 独立标签 | Vue 已拆成独立标签并使用 Link2、Monitor、Smartphone 图标 | `resolved` |
| V-05 | 内置函数说明文案 | Make / Design：在变量值或请求体中使用函数语法 | Vue 已统一为“请求体” | `resolved` |
| V-06 | 内置函数搜索位置 | Design 画布显示搜索框位于内容区右侧；Make 源码和真实预览均显示搜索框左对齐 | Vue 左对齐 | `accepted-deviation`：用户已选择以 Make 源码与预览为准；`acceptance.type=user-decision`，`acceptance.reference=本轮 Figma 对齐方式确认` |
| V-07 | 变量筛选框高度 | Make 真实预览内容筛选框 `32px`；Vue 修复后实测 `32px` | 全局页和变量集页 `.figma-variable__filters input/select` 均为 `32px` | `resolved` |
| V-08 | 变量集筛选框宽度 | Make 真实预览变量集搜索框 `200px`；Vue 修复后实测 `200px` | 变量集页搜索框为 `200px`，全局页仍为 `220px` | `resolved` |
| V-09 | 表头及变量集顶部间距 | Make 表头 `37px`、数据行 `46px`、变量集表格起点 `y=262`；Vue 修复后实测相同 | Vue 表头 `37px`、数据行 `46px`、变量集表格内表格起点 `y=262` | `resolved` |
| V-10 | 加载、空态、错误、导入流程和弹窗 | Make 源码有 Skeleton、空态、导入/删除/编辑状态；Design 有对应画布状态 | Vue 已将加载态改为保留标题/筛选区并在列表位置显示表格骨架；搜索无结果、导入入口、删除确认、空值禁用和编辑弹窗已在浏览器复验；JSON 错误提示只完成代码核对，未触发提交路径；Make 预览对应状态证据仍为历史截图，未完成同视口配对叠加 | `unverified`：行为覆盖已补，四方视觉矩阵仍待完成 |

## 浏览器证据

- `output/playwright/variables/vue-current-global.png`
- `output/playwright/variables/vue-current-set.png`
- `output/playwright/variables/vue-current-builtin.png`
- `output/playwright/variables/vue-after-fix-set.png`
- `output/playwright/variables/vue-after-fix-set-cdp.png`
- `output/playwright/variables/vue-copy-verified.png`
- `output/playwright/variables/vue-loading-after-fix.png`
- `output/playwright/variables/vue-global-after-status-fix.png`
- `output/playwright/variables/vue-status-final.png`
- 全局操作列实测：2 个按钮，`编辑变量`、`删除变量`
- 变量集详情实测：3 个按钮，`编辑变量`、`复制变量`、`删除变量`
- 复制交互实测：行数 `1 -> 2`，副本名称追加 `_COPY`，收到 Toast `变量已复制`；清理副本后恢复 1 行
- Make 真实预览登录：`superadmin / superadmin123`；视口 `1920×945`，DPR `1`
- Make 全局页实测：内容筛选框 `220×32`，表头 `37px`，数据行 `46px`
- Vue 全局页修复后实测：内容筛选框 `220×32`，表头 `37px`，数据行 `46px`
- Make 变量集页实测：搜索框 `200×32`、表格内表头起点 `y=262`
- Vue 变量集页修复后实测：搜索框 `200×32`、表格内表头起点 `y=262`
- Make 内置函数页真实预览：搜索框 `240×32`，左对齐；搜索 `uuid` 后仅保留匹配函数，分组可折叠
- Vue 内置函数页真实浏览器：搜索框 `240×28`，左对齐；搜索和分组折叠逻辑可用
- Vue 编辑变量弹窗修复后：卡片 `520×542.5px`，内容区 `416.5px`，普通输入 `472×32px`，与 Make 实测一致；类型按钮保持 `26.5px`，启用行 `18px`
- Vue 变量集弹窗修复后：卡片 `480px` 宽，适用类型按钮 `139.3×40px`，描述 textarea `432×72px`
- Vue 状态复验：搜索无结果显示「未找到匹配的变量」；空值时保存按钮禁用；导入打开五步步骤条；测试导入变量 `ALIGNMENT_NEW_VAR` 已删除，列表恢复原有数据；JSON 错误提交路径未触发
- Vue 加载骨架：列表区域保留页面标题、筛选和操作区，表头 `37px`、骨架数据行 `46px`

## 结论

本轮确认用户启动的 Chrome 预览可用于真实核对，并完成了全局变量、变量集、内置函数三种视图的 Make/Vue 对照。复制按钮按用户决定保留；敏感标签、适用类型标签和内置函数文案已对齐。筛选框高度、变量集筛选框宽度、表头高度及变量集顶部间距已修复并通过同视口实测。加载/空态/错误/导入状态的本地行为已补齐并复验，但结构化矩阵和 Design/Make/Vue 同视口叠加仍为 `unverified`，因此本模块仍不能称为完全对齐。
