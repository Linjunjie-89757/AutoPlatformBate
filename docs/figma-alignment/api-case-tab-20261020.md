# 接口管理测试用例 Tab 对齐记录

状态：partial-alignment。开始基线：984a16e，codex/development-feature2；修改前无 tracked 改动。

## 范围与来源

- Design：jSUUPxC4PVD9Kp2FUydfox / 984:14120；直接 frame 1043:22907（未保存）、1043:23062（错误）、1043:23217 / 23451 / 23685（三张重复无结果）、1043:23919（加载）。截图位于 output/figma-api-test-cases-984-14120/。不能把重复 frame 当成正常、空数据设计。
- Make：设计/figma-ai-make最新代码20261016/src/app/ApiCaseTab.tsx，工具栏 550 起、表格 674 起、状态 790 起。
- Make 预览：s6EkOuJNJHLFYP5CTAdQNf；Chrome 9222 iframe 已读取并依次切换 loading/empty/no-results/error/unsaved/loaded。2026-10-20，1920×896，DPR 1；区域 x306 y172 w1614 h724。AI 抽屉尚遮挡部分画面，不能以 DOM 测量代替最终截图审查。
- Vue：ApiCaseListPanel.vue、useApiDefinitionCases.ts、ApiDefinitionWorkspaceModule.vue、ApiRequestEditorMain.vue、api-request-editor-main.css。修改前未保存截图 output/playwright/cases-before-unsaved.png。
- 排除接口请求栏、其它 Tab、创建/编辑/AI 抽屉内部设计、后端元数据模型扩展。

## 修改前四方差异清单

|项|Design / Make|Vue 基线|决策及验收|
|---|---|---|---|
|工具栏|51px，搜索180×30，筛选86×30，刷新/列设置30×30，新建28px AI30px|仅新建/AI，外层12px，按钮后14px间距|实施并实测，待验收|
|表格|表头约40px、行49px、图标操作26px、列设置可用|表头31px、行34.5px，文字操作，设置无事件|实施并实测，待验收|
|未保存|橙色提示条+居中提示，创建禁用|普通空列表提示|实施，待验收|
|加载|6行53px skeleton|通用详情加载，无列表加载状态|接真实请求，待验收|
|错误|错误图标、实际错误和重试|仅 Toast|接真实请求，待验收|
|空列表|图标、标题、说明、创建/AI|虚线框一句话|实施，待验收|
|无搜索结果|居中搜索图标、清除筛选|无搜索|搜索名称/ID、结果筛选后分页，待验收|
|等级/类型/来源/创建人|模拟元数据|ApiDefinitionCaseItem 无字段|不伪造值；暂用 —，等级/来源筛选禁用说明；业务限制|
|批量启停|Make 修改模拟 enabled|无 enabled 持久化契约|不接假功能，遗留|
|分页|Make 固定1/2/3|真实分页|保留真实分页；business-constraint：实际列表页数|
|无结果演示|额外重复工具栏|无|仅渲染一条工具栏；登记原型冲突|

## 事件与状态

Make 有搜索 change/focus/blur、清空、结果/等级/来源筛选、刷新、列设置开关/勾选、行 hover、编辑/执行/更多、分页、选择/批量操作、创建/AI、错误重试、未保存 disabled。Vue 已复验有真实支持的入口；批量启停/元数据相关行为保留缺口。Make 执行及刷新使用计时器/随机模拟，不能移植。未知服务端失败、权限态在 Make 没有真实业务实现，不可宣称预览已验证。

## 本轮实现与验证

- 已实现：测试用例 Tab 文案、接口上下文工具栏、搜索名称/ID、执行结果筛选、刷新、列设置、图标化编辑/执行/更多操作、真实空状态、加载骨架、错误重试、未保存提示、过滤后分页。
- 实测：`npm run typecheck` 通过；`npm run build` 通过（仅现有依赖的 Vite 注释及大 chunk 警告）；`git diff --check` 无空白错误。
- Playwright 实测 1920×896：工具栏 1614×51px，搜索框 180×30px，筛选 86×30px，刷新/列设置 30×30px；受控响应验证 loading、error→retry、loaded 10/23 分页、跨页 ID 搜索、结果筛选 11 条、列设置、no-results 和 empty 均通过。截图位于 `output/playwright/cases-loading.png`、`cases-error.png`、`cases-loaded.png`、`cases-no-results.png`、`cases-empty.png`、`cases-local-final.png`。
- 当前真实 `page111` 无用例，空状态截图已验证；服务端请求失败日志中的 500 来自本轮受控错误验证，不是生产数据修改。

## 遗留与限制

- `ApiDefinitionCaseItem` 当前没有等级、类型、来源、创建人、enabled 等字段，因此表格默认以 `—` 展示等级/类型/来源/创建人，等级和来源筛选保持禁用并提供原因；没有扩展后端模型，也没有伪造 Make 演示数据。
- 当前列表没有后端批量启停契约，未添加 Make 原型中的假批量启用/停用；选择列也未移植。
- Make 的 Design/预览包含原型 DevBar，且 no-results frame 重复工具栏；生产实现已去掉 DevBar、只保留一条工具栏。Make 真实截图受 AI 抽屉遮挡，最终结论为 partial-alignment，不宣称像素级完全对齐。
