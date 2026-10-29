# 创建用例抽屉 Figma 对齐记录

- Design：`jSUUPxC4PVD9Kp2FUydfox:1044:24135`，首个画板 `1055:40601`，画板尺寸 `868 × 910`
- Design 截图：`output/playwright/api-case-drawer-create-20261023/design-1055-40601.png`
- Make 源码：`设计/figma-ai-make最新代码设计20261023/src/app/ApiCaseDrawer.tsx`
- Make 预览：Chrome 9222 当前显示 `Code layer isn’t working`；静态交互未能验证
- Vue 代码：`src/features/api-case-create-edit/ApiCaseDrawer.vue`、`src/features/api-case-create-edit/ApiCaseCreateEditDialog.vue`、`src/features/api-case-create-edit/model.ts`
- Git 基线：`984a16e`；工作区存在大量未提交改动，本记录只涵盖上述抽屉文件和本记录
- Vue 基线截图：`output/playwright/api-case-drawer-create-20261023/create-before.png`
- Vue 基线环境：Chrome 155，`1920 × 945`，DPR `1`，缩放 `100%`

## 范围

- 对齐：抽屉外壳、标题和接口上下文、用例基础信息、主 Tab 顺序、Params/Auth/Headers/Body 的外围布局、响应区与空态、页脚。
- 不改：前置处理、后置处理、断言、设置四个 Tab 的内容与业务逻辑。
- 保留：现有 Params 字段和扩展列、请求调试/保存逻辑、用例状态在编辑模式下的能力，以及现有执行结果数据。Binary 保留底层兼容处理，但不在新建用例的 Body 类型选择器中展示。

## 修改前差异矩阵

| 验收项 | Design / Make 目标 | Vue 基线 | 处理与验证 |
| --- | --- | --- | --- |
| 抽屉外壳 | Design 画板展示约 `820px` 宽、带画板边距的浮层；Make 源码为 `top/right/bottom:0` 的全高右侧抽屉 | 原实现人为加了上/下 `24px`、右侧 `20px` 留白，视觉上像浮动卡片 | 按用户最新意见采用全高、右侧贴边的系统抽屉，保留 `820px` 宽；将 Design 画板边距作为显式差异记录 |
| 顶部 | 高 `81px`，内部左右 padding `20px`，方法/路径/接口名在标题下方 | 组件内部高 `81px`，但外层 body padding 造成内容整体二次缩进 | 修正外层 body padding 与定位 |
| 基础信息 | 高约 `106.5px`；用例名与发送同一行，优先级/标签下一行；新建默认 P1 | 高 `106px`；当前新建默认为 P0 | 保留结构，修正新建默认级别为 P1 |
| 请求 Tab | `Params / Auth / Headers / Body / 前置操作 / 后置操作 / 断言 / 设置` | `请求头 / 请求体 / Params / Auth / 前置操作 / 后置操作 / 断言 / 设置` | 调整顺序，检查四个排除 Tab 仍可正常切换 |
| Tab 辅助信息 | 右侧显示“修改不影响接口定义” | 未显示 | 补充只读说明 |
| 请求区 | 主 Tab 高 `45px`；请求区与响应区按约 `3:2` 分配 | Tab 高 `45px`；因整抽屉贴边，高度比例虽接近但总体更高 | 调整整体高度后复测比例 |
| 响应区 | 未发送时也显示“响应体 / Headers / Cookies / 断言结果”Tab 和空状态 | 未发送时仅显示“响应内容”标题与空状态，响应 Tab 隐藏 | 始终显示响应 Tab；不发真实请求验证 |
| 页脚 | 高 `55px`，按钮在右侧 | 高 `55px`，但贴在视口底边 | 随外壳定位一并复验 |
| 预览交互 | Make 源码定义 Params/Auth/Headers/Body、响应 Tab、发送和创建行为 | Make 预览不可操作；本地可直接操作 | 以 Make 源码和本地业务规则实现；将预览操作列为未验证 |

## 已知来源冲突和未验证项

- Make 预览运行时当前不可用；截图静态目标和 Make 源码可用，运行时操作未验证。
- Design 节点包含多个同版式状态画板；当前视觉目标采用首个画板 `1055:40601`。
- 编辑态和只读态未作为本轮视觉验收变体；本轮只确认编辑态状态字段仍由现有 `showStatus` 条件控制。
- Design 画板显示的外边距与 Make 源码、系统 `AppDrawer` 的全高贴边行为不同。根据用户 2026-10-23 的明确意见“大小四周都是空的，不像是系统抽屉”，抽屉外壳采用全高贴右实现；这是 `user-decision`，引用本轮用户意见，不宣称与 Design 画板边距完全一致。

## 本轮复验

- Vue 浏览器：本地 Chrome Headless，视口 `868 × 910`，DPR `1`；通过登录账号进入 X-MAN 工作区，选择 `测试2 / orderSource` 后打开创建用例抽屉。
- 最终截图：`output/playwright/api-case-drawer-create-20261023/create-full-height-1440x900.png`、`output/playwright/api-case-drawer-create-20261023/create-full-height-868x910.png`
- 抽屉实测：`1440 × 900` 视口为 `x=620, y=0, right=0, bottom=0, width=820, height=900`；`868 × 910` 视口为 `x=48, y=0, right=0, bottom=0, width=820, height=910`。
- 创建态基础字段：名称输入、未保存提示、优先级 `P1` 默认选中、标签入口、发送按钮、创建按钮均显示；创建按钮现已补上 Make 中的 `Save` 图标。
- 请求区域交互：`Params`、`Auth`、`Headers`、`Body`、`前置处理`、`后置处理`、`断言`、`设置` 八个 Tab 均可切换。前置处理、后置处理、断言、设置内容未作改动。
- 响应区域交互：`响应体`、`Headers`、`Cookies`、`断言结果` 均可切换；“更多”菜单可打开，并可选择“控制台”和“实际请求”。
- 创建按钮和发送按钮未提交，避免新增数据或发送真实请求；保存/发送中状态未触发。
- 编辑态：本次测试工作区内所选接口没有已有用例，未能通过真实 UI 打开编辑态。代码调用仍传入 `show-status="mode === 'edit'"`，状态字段的编辑态行为仅做代码确认，未标记为浏览器验证。
- Make 预览：仍显示 `Code layer isn’t working`，因此 Make 运行时交互未验证；未将源码中的行为描述为预览已验证。

## 2026-10-23 参数表补充对齐

- Body 类型选择器移除 `binary` 展示项；`BINARY` 数据结构、文件选择和请求预览逻辑仍保留，用于兼容已有数据。
- Params、Headers、Body 表单模式统一采用 Make `ParamTable` 的紧凑方向：分区标题、`12px 16px` 表格外边距、较小的表头/行/添加行高度、浅灰表头和 6px 圆角。
- 本地 Params 的类型、必填、长度、编码、拖拽、批量添加和删除列属于业务扩展，继续保留；通过自适应列宽与 `700px` 最小宽度避免原来的 `1480px` 固定宽度导致抽屉内大面积横向溢出。Headers 和 Body 表单分别使用 `620px`、`680px` 最小宽度。
- 断言结果表不是 Make `ParamTable` 的同构表格，本轮未修改。
- 本轮构建通过，`git diff --check` 通过。真实浏览器当前落在登录页，未能取得登录后的三种表格截图和 bounding box，因此本轮不声明浏览器视觉验收完成。

## 2026-10-23 Params 表格对齐复核（Design 1055:41920）

- Design 来源：`jSUUPxC4PVD9Kp2FUydfox:1055:41920`；截图 `output/playwright/api-case-drawer-create-20261023/design-1055-41920.png`，画板 `868 × 910`。
- Make 源码：`设计/figma-ai-make最新代码设计20261023/src/app/ApiCaseDrawer.tsx` 的 `ParamTable`；Make 预览当前显示 `Code layer isn’t working`，运行态无法操作验证。
- Vue 截图：`output/playwright/api-case-drawer-create-20261023/params-aligned-868x910.png`；浏览器视口 `868 × 910`，DPR `1`。抽屉相对边界 `820 × 910`，Query 表格相对抽屉 `x=16, y=276, width=788`；Design 表格相对画板抽屉 `x=16, y=276, width=788`。外层抽屉边距是既有用户决策差异，不属于本次表格范围。
- Vue 实测 Query 表头 `28px`、数据行 `33px`、添加行 `30px`、圆角 `6px`；Headers 表头 `28px`、添加行 `30px`；Body 表单表格宽 `788px`，未超出抽屉内容边界，表头 `28px`、数据行 `33px`、添加行 `30px`。
- 修改覆盖 Query Params、Headers 和 Body 表单表格：对齐表头字号/字重/颜色、紧凑控件与行高、整行添加按钮及图标、表格边框色和停用行视觉；实测停用行背景 `#FAFAFA`、文字 `#C9CDD4` 并划线，启用开关可往返。
- 保留本地已有的拖拽、全选、类型、必填、长度、编码、批量添加和删除能力。Make 样例中的“来源”列未加入：当前 `ApiKeyValueInput` 不包含来源字段，Make 中该列使用演示用 `src` 值；这是遵循用户此前明确要求“保留我们的 Params 字段这些”的内容差异，不伪造来源数据。
- 浏览器操作已验证添加行、启用状态切换、Headers/Body 表格切换和 Body 表单布局；关闭并重开创建抽屉以清理临时测试行。未触发请求发送或保存。Make 预览运行行为及 Design 与 Vue 的像素叠加审查未完成，结论为目标表格主要几何与样式已对齐，整体不宣称完全验收。

## 验收结论

- 已在 Vue 浏览器验证创建态全高贴右外壳、基础信息、请求 Tab 切换、响应 Tab 切换和“更多”菜单交互。
- 尚未验证：Make 预览动态交互、编辑态真实 UI、保存/发送中状态、窄屏布局，以及与 Design 的最终叠加差异审查。
- 外壳保留一项已接受差异：Design 画板呈现边距，当前按用户决定实现系统抽屉的全高贴边行为。
- 因上述未验收项，本任务结论为局部范围已实现并完成创建态主要交互复验，不声明完全对齐。

## 2026-10-26 Body 控件与 JSON 编辑区复核

- Make 源码目标：`设计/figma-ai-make最新代码设计20261023/src/app/ApiCaseDrawer.tsx`。Body 类型按钮使用 `#165DFF`，参数复选框使用原生 `accentColor: #165DFF`；JSON 编辑器使用 `13px / 20px`、上下 `10px` 内边距、`40px` 行号栏。
- Vue 调整：发送/创建按钮主色改为 `#165DFF`；表格 Element Plus 复选框改为 `13 × 13px`、选中色 `#165DFF`；Body 类型按钮保留 Make 的蓝色 active 状态并移除普通点击的黑色浏览器 outline，键盘焦点保留 `focus-visible` 提示。
- JSON 编辑器新增 `figma-light` Monaco 主题，仅由创建用例 Body 使用：正文 `#1D2129`、背景 `#FFFFFF`、行号 `#C9CDD4`、字体 `13px`、行高 `20px`，行号栏实测 `39px`（与 Make `40px` 的边界差异来自 Monaco 内部 1px 布局边界）。
- 滚动修复：请求区外层改为 `overflow:hidden`，滚动职责移到各 Tab 面板；隐藏 Monaco 原生编辑上下文滚动条，避免 JSON 内容只有一行时外层 `15px` 滚动条占位和闪烁。
- 浏览器复验：Chrome CDP `9222`，本地 `4173`，创建用例 Body/JSON 状态；5 次连续采样均为外层 `scrollHeight=clientHeight=395`、`overflow:hidden`，Monaco 滚动条透明度为 `0`、原生编辑上下文 `scrollbar-width:none`；正文实测 `13px / 20px / #1D2129`，行号栏 `39px / #C9CDD4`，按钮背景 `rgb(22,93,255)`。
- 验证：`npm run build` 通过；`git diff --check` 通过。Make 预览仍显示 `Code layer isn’t working`，因此本轮交互仍以 Make 源码、Design 静态截图和本地真实浏览器为证据，不宣称 Make 运行态已验收。
