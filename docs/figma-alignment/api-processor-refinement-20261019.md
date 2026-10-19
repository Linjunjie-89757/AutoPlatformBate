# 处理器详情局部细节补齐

## 修改前差异（2026-10-19）

延续 `api-processor-details-20261019.md` 的 Design/Make 基线；仅处理用户本轮确认的下列四项，不重做整个模块。

| 项目 | 当前值 | 目标与处理依据 |
| --- | --- | --- |
| 局部纵向位置 | 等待说明输入约 y=236，提取表格约 y=124；标签行高 16.5/19.5px | 对照 Design 等待约 y=238、提取表格 y=125；调整局部标签行高，避免给整个区域增加补偿偏移 |
| 提取下拉框 | Element Plus 14px 浅色箭头、6px gap、省略号，文字显示较少 | 参考 Make 原生 select 深色箭头及直接裁切；保留现有组件，局部缩小箭头和间隙，不改变选项/禁用规则 |
| 滚动条占位 | 溢出时原生滚动条占约 15px，Design 没有表现占位 | Make 源码 overflow-y:auto，无自定义滚动条 CSS；先复核预览，不能仅因截图没画而隐藏滚动能力 |
| SQL 映射默认行 | 新增/空映射显示空状态 | 用户本轮明确要求默认显示一条可编辑映射行；前后置统一，空白变量名后端会跳过，不写入变量 |

修改前/后证据目录：`output/playwright/processor-refinement-20261019/`。
工作区有大量已有修改，不覆盖、不回退。范围外：执行语义、提取范围限制、格式化能力、全局下拉样式。

## 实施与复验

1. 标签行高局部调整为 17px，提取标题行高 20px。浏览器实测前置等待名称输入 y=37、说明输入 y=238；提取表格 y=125。前后置共七种组合重新采集截图及样式/几何数据。
2. 提取行的 Element Plus 下拉箭头调整为 10px、#4E5969，内部 gap 从 6px 改为 2px，选中文字由省略号改为裁切；文字区分别从 40/42/28px 扩至 48/50/36px。禁用状态仍保留浅色。未改全局下拉框或请求参数表。
3. SQL 映射归一化为空时补一条空白行，移除空提示模板。前后置真实浏览器验证：默认 1 行 → 添加后 2 行 → 删除最后一项后仍有 1 条空白行；已填映射值在增删其他行时保持不变。源码确认 ApiProcessorExecutor.writeSqlVariables 会跳过空变量名，不会生成空名变量。
4. 滚动条没有做隐藏或负边距补偿。线上 Make 刷新后再次等待超过一分钟，读取仍显示 `Code layer isn't working / Open code editor to review issues`；截图调用超时，未把该文件计入证据。Make 源码 overflow-y:auto 的原生行为与 Vue 一致，但在线占位宽度未能实测，因此该项保留为未验收。

证据：

- `before/measurements.json`、`after/measurements.json`：修改前后实测值。
- `before/`、`after/`：七种组合区域截图，前后置 SQL 映射表及提取下拉展开截图。
- `interactions.json`：SQL 增删、等待快捷选择、JSONPath/XPath/Regex 切换与禁用状态、键盘选择。
- `overlay-wait.png`、`overlay-extract-header.png`：同宽局部区域叠加审查，确认本轮目标位置；名称/数据与 Design 示例不同，不作为整页像素一致证据。
- `check-sql.cjs`：空数组/未定义映射、反复归一化、已有映射保留、添加、最后行删除测试通过；上一轮提取兼容性断言再次通过。

验证使用独立浏览器未保存请求；未发送请求或保存测试数据。复验 viewport 1920×1013、DPR 1，另检查了内容溢出下的滚动和底部操作可达性。

## 检查与结论

- typecheck、build、git diff --check：通过。构建仍有已有依赖注释与 chunk 大小警告。
- 本轮修改：ApiProcessorDetail.vue、styles/api-processor-detail.css、lib/useApiProcessorWorkspace.ts。
- 范围内四组事项：位置已修复；下拉已按局部组件保留方案调整并实测，但原生 select 与 Element Plus 不是同一渲染实现；SQL 默认行按用户决定实现；滚动条在线效果一项未验收。
- 结论：本轮局部修改已验证，整块仍为 partial-alignment。不能声称已完成在线 Make 滚动条对齐或整个模块完全一致。
- 与旧记录关系：旧记录 D03/D07/D08 中约 1–2px 的指定控件位置差异由本轮实测取代；D06 的 SQL 空态保留决定由本次用户要求“一条默认行”取代；D12 提取范围限制不在本轮改动范围内。

## SQL 添加行分隔线追加检查

- 修改前实测：前后置的单行/多行映射，最后一行 border-bottom=1px，添加按钮 border-top=1px，二者相邻形成双线。
- Make PreSqlDetail/PostSqlDetail：仅非末行设置下边框，添加按钮保留 1px 上边框。
- 局部修正：末行下边框设为 0，保留中间行边框和添加按钮上边框；目标单条 1px 分隔线。
- 证据：同目录 `border-before-*.png` / `border-after-*.png` 及 `border-before.json` / `border-after.json`，覆盖前后置、单行与两行。

## 用户确认的提取表格列宽优化

- 用户本轮确认“可以，你加上试试，我看看”，采用上一轮建议：变量名 128px、描述 104px、变量类型 104px、提取方式 104px、提取范围 92px、操作 68px，表达式占剩余空间。
- 前五列总计比 Make 原稿增加 72px，表达式相应减少 72px；表头和数据行同步调整。
- 这是用户明确接受的可用性调整（accepted-deviation，acceptance.type=user-decision，reference=本轮上述用户指令），不再以 Make 原列宽作为此项验收目标。
- 浏览器复验：1920/1440/1280px 三种视口表头与数据行列宽一致，表达式分别为 716/234/98px；1280px 时沿用现有横向滚动。JSONPath/XPath 切换正常，三种下拉选中文字均有足够空间完整显示。证据为同目录 `extract-columns-*.png`、`extract-columns.json`；git diff --check 通过。本次仅改列宽 CSS，未重复类型/构建检查。

## 提取处理器更多按钮局部调整

- 修改前：单独按钮包裹 Element Plus MoreFilled，没有以 moreSettingsVisibleKey 控制按钮打开态。
- 本次目标：仅当前提取处理器改用 Make App.tsx PostExtractItemRow 的 Lucide MoreHorizontal，按钮 26px、图标 14px、圆角 5px，默认 #86909C、打开 #165DFF 配 #165DFF10 背景。菜单功能仍使用原有 el-popover 与业务设置。
- Hover/键盘焦点使用本系统灰底和深灰图标反馈（用户已批准前述按钮样式调整方案）；Make 当前按钮源码没有独立 hover 处理，此差异明确保留，不作为已验证的 Make hover。
- 排除其他页面、公共组件抽取及全系统图标替换。
- 浏览器实测默认/hover/打开/关闭四态：按钮 26×26、图标 14×14、圆角 5px；打开态 rgb(22,93,255) + rgba(22,93,255,0.063)，关闭后恢复默认。点击外部、键盘 Enter 打开、复制提取项、指定索引 2 和 XPath XML/HTML 切换通过。
- 证据：`more-button.json`、`more-default.png`、`more-hover.png`、`more-open.png`、`more-closed.png`、`more-menu.png`；typecheck、build、git diff --check 通过。本次改动仅详情 Vue 和局部 CSS。
- 默认态/打开态尺寸及颜色按 Make 源码复验；线上 Make 预览此前代码错误仍未恢复验证，不能据本次局部验证宣称整个模块完全对齐。
