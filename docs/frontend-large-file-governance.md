# 前端大文件治理基线

## 目标

避免新前端继续形成上万行单文件。历史大文件允许短期存在，但后续只允许两类改动：

- 修复当前问题的最小增量改动。
- 从大文件中抽取稳定边界到独立组件、composable 或工具模块。

## 扫描命令

```bash
npm run quality:large-files
```

默认阈值：

- 单文件行数大于等于 800 行。
- 或单文件体积大于等于 80 KB。

可在命令前通过环境变量临时调整：

```bash
MAX_LARGE_FILE_LINES=1000 MAX_LARGE_FILE_KB=120 npm run quality:large-files
```

## 治理规则

1. 不再向超阈值文件新增大块功能。
2. 需要改超阈值文件时，先备份目标文件，再做最小增量改动。
3. 抽取顺序优先选择边界清楚、状态输入输出明确的区域。
4. 每次抽取只做一个职责边界，抽取后必须跑类型检查或构建。
5. 中文源码和文案文件禁止整文件重写，优先使用小范围 patch。

## 当前优先级

1. `src/widgets/api-interface-workspace/ApiDefinitionWorkspaceModule.vue`
2. `src/widgets/api-scenario-workspace/ApiScenarioWorkspace.vue`
3. `src/widgets/web-ui-case-workspace/WebUiElementLibraryPanel.vue`
4. `src/widgets/api-execution-workspace/ApiExecutionWorkspace.vue`

## 接口工作区拆分方向

接口定义工作台已经从 `ApiInterfaceWorkspace.vue` 迁出，后续治理重点从“父文件瘦身”转为“定义页模块内部二次拆分”：

- 已完成目录、编辑器、用例、AI、运行环境、弹窗、断言、处理器、提取器等逻辑域拆分。
- 已完成 `ApiDefinitionWorkspaceModule.vue` 样式外置和弹窗/抽屉挂载区组件化，主文件已降到约 1032 行。
- `ApiDefinitionWorkspaceModule.vue` 当前应定位为组装容器，不再承接新的大块业务逻辑。
- 后续优先治理外置 CSS 文件和 `ApiRequestEditorMain` 内部结构，避免新增低价值纯透传组件。
- 具体拆分进度以 `设计/接口定义工作台拆分方案.md` 为准。

## 接口场景工作台拆分方向

接口场景工作台阶段一治理已完成，目标从“先降主文件体积”转为“继续拆模板和状态边界”：

- 已完成表头设置、步骤请求配置、运行结果展示等低耦合逻辑抽取。
- 已完成 `ApiScenarioWorkspace.vue` 样式外置，主文件已从约 8974 行降到约 4777 行。
- 已完成导入抽屉、步骤配置抽屉、报告步骤详情抽屉、软输入 / 确认弹窗组件化，主文件已继续降到约 4088 行。
- 已完成步骤树、场景详情 Tab、当前场景报告列表组件化，主文件已继续降到约 3944 行。
- 已完成右侧属性面板组件化，主文件已继续降到约 3814 行。
- 已完成设置页、CI/CD 占位页、独立报告 Tab 页和场景列表页组件化，主文件已继续降到约 3509 行。
- 已完成 `ApiScenarioStepConfigDrawer.vue` 内部主要视图拆分，脚本步骤、控制器步骤、系统请求只读配置视图和自定义 / 复制请求编辑视图已组件化，抽屉文件已从约 770 行降到约 342 行。
- 已完成步骤配置抽屉及 4 个子面板的主要 props 类型边界收紧，相关类型集中在 `src/widgets/api-scenario-workspace/lib/apiScenarioStepConfigTypes.ts`。
- 已抽取步骤调试响应展示组件 `ApiScenarioStepResponsePanel.vue`，系统请求和自定义请求共用响应指标、响应 Tab 和断言结果表格。
- 已抽取自定义请求 Headers / Params 参数表格组件 `ApiScenarioKeyValueGrid.vue`，Body Form 专用表格组件 `ApiScenarioBodyFormGrid.vue`。
- 已按处理器类型拆分 `ScenarioProcessorEditor.vue` 右侧详情面板，脚本 / SQL / 等待 / 提取处理器已组件化。
- 已按断言类型拆分 `ScenarioAssertionEditor.vue` 右侧详情面板，状态码 / 响应头 / 响应体 / 响应时间 / 变量 / 脚本断言已组件化。
- `ApiScenarioWorkspace.vue` 当前仍是场景编辑器主容器，后续不应继续新增大块业务逻辑。
- 下一阶段再评估高级编辑器共享左侧列表和共享样式是否值得抽取，不再对已稳定的响应区和参数表格做低价值再拆。
- 具体拆分进度以 `设计/接口场景工作台拆分方案.md` 为准。
