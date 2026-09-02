# Figma 视觉还原实施指南

本文档用于指导后续把 Figma 生成的新前端视觉落地到当前项目。每次开始 Figma 视觉还原相关目标包前，先阅读本文档，避免偏离“保留 Vue3 + Element Plus、只还原视觉、不重写业务”的方向。

## 设计来源

- Figma 页面：后台管理系统界面设计 2
- Figma MCP：设计文件节点上下文、metadata 和截图的优先来源
- 本地参考代码：`设计/figma-code`
- 当前项目技术栈：Vue3 + Element Plus + Pinia + Vue Router
- Figma 生成代码技术栈：React + Tailwind + Radix/shadcn，局部包含 MUI

Figma 生成代码不能直接搬进当前项目。它只作为视觉规范、布局密度、组件状态和交互参考使用。

本文档是本项目 Figma 视觉还原的唯一权威准则。后续涉及 Figma 页面还原、Figma Make 代码迁移、全局视觉基线、页面视觉对齐的任务，默认先阅读本文档。

设计源优先级：

1. Figma Design 节点是最终像素裁判。颜色、透明度、字号、字重、行高、圆角、间距、宽高、坐标、表格列宽、图标尺寸和组件状态，优先以 design 节点 metadata / design context / 设计检查器中的精确值为准。
2. `设计/figma-code` 中的 Figma Make 源码用于确认组件结构、状态逻辑、字段、交互、Tailwind 原始意图和设计实现思路，但不能替代 design 节点的最终渲染尺寸。
3. 当 Design 节点与 Make 源码存在差异时，先说明差异来源；若目标是视觉 1:1，还原以 Design 节点为准。Make 源码仅作为结构和行为依据。
4. 截图只作为辅助复核，不作为单独决策依据。不能只根据截图、肉眼观感或个人经验调整颜色、尺寸、字重和间距。

Design / Make 双源差异强制记录：

- Design 节点与 Make Tailwind 参数不一致时，禁止只写“Design 优先”后直接宣称对齐。关键控件必须记录三组值：Make 原始 class / 运行意图、Design 节点最终尺寸、Vue 页面最终 computed style / bounding box。
- 对按钮、输入框、Tab、标签等可见控件，必须逐项核对水平与垂直 padding、固定宽高、圆角、相邻 margin / gap、字号、字重、行高和状态过渡。例如 Make 的 `px-3 py-1 rounded-md mr-1` 与 Design 节点的 `10.5px` 水平 padding、`25px` 高、`5px` 圆角不是同一组参数，迁移时必须明确采用哪一组及原因，不能把转换后的不同实现描述成“与 Make 一样”。
- 只有 Design 节点值、Make 的结构 / 交互意图和 Vue 最终浏览器结果均已分别核对，才允许使用“已对齐”。若三者仍有可见差异，必须说明差异及当前裁决，不得省略冲突信息。

交互源优先级：

- Figma Make 源码里的事件绑定也是迁移依据，必须逐项核对 `onClick`、`onMouseEnter`、`onMouseLeave`、展开 / 收起状态、复制反馈、筛选状态、行点击、按钮阻止冒泡等交互语义。
- 列表 / 表格不能只对齐静态字段和操作图标。若 Make 中整行可点击，例如 `TR onClick` 进入详情，Vue 落地必须补齐整行点击、hover 态和行内按钮 `stopPropagation` 边界；不能只让“查看”图标可点。
- 行内按钮需要区分真实业务交互和视觉入口。查看、分享等 Make 已明确触发页面切换的按钮要接入对应路由或状态；复制、删除、导出、立即执行等如果 Make 是空回调且当前项目没有接口，必须保留视觉入口但不伪造结果，并记录到 `设计/遗留问题.md`。

## 核心结论

不切换到 React，不做 React 到 Vue 的自动转换，不重写现有业务流程。

正确做法是：保留当前 Vue3 + Element Plus 架构，把 Figma 视觉拆成 token、组件规范、页面样板，再逐步映射到当前项目中。

“1:1 还原”的目标是视觉和体验还原，不是代码结构还原。可追求颜色、字体、间距、圆角、按钮高度、表格密度、页面层次接近 Figma，但必须保留现有路由、接口调用、状态管理、权限和业务交互。

视觉还原允许 `1px` 左右的微小偏差。若偏差来自 Element Plus 原生 DOM 结构限制，且继续修正会明显增加复杂度，需要在提交说明或目标包总结中说明原因，并保留截图；不允许为消除 `1px` 偏差滥用 `!important` 或超长多层选择器破坏样式稳定性。

## 还原原则

1. 先改全局视觉底座，再改单页细节。
2. 先做样板页，确认风格后再扩散到其他页面。
3. 优先使用现有 Element Plus 组件和项目已有共享组件，不新增第三方 UI / 样式运行时依赖，不引入 React、Radix、shadcn、Tailwind。
4. 不照搬 Figma 里的 mock 数据、业务状态和演示逻辑。
5. 不照搬 Figma 截图里的水印、演示品牌、无关菜单和临时内容。
6. 不为了视觉改动破坏现有功能、接口参数、数据加载和表单校验。
7. 每个阶段都要截图对比和最小功能回归。

Figma 数值还原纪律：

- Figma MCP 或设计检查器已经明确给出的颜色、透明度、圆角、间距、字号、行高、阴影数值，不得手写近似或为了“简洁”擅自四舍五入。
- 例如 Figma 给出 `rgba(..., 0.733)` 时，代码中必须保留 `0.733`，不能简化为 `0.73`。
- Figma / Tailwind 导出的尺寸通常按 `border-box` 理解，固定高度或宽度已经包含 padding 和 border。迁移到普通 CSS 时，凡是同时设置固定尺寸、padding、border 的容器，必须显式检查 `box-sizing: border-box`，不能让浏览器按 content-box 把边框额外叠加导致尺寸多出 1-2px。
- 不能只看源码中是否写了 Figma 数值，还必须检查最终浏览器 computed style。尤其在同一文件内存在旧样式和新样式叠加时，旧选择器可能因为优先级更高覆盖新规则，例如 `.xxx span` 会压过 `.xxx__value`，导致源码写了 `18px`，运行时实际仍是 `13px`。
- 对关键视觉元素，例如统计数字、标题、按钮文字、表格行高和卡片高度，完成后要用 DevTools 或 Playwright 读取 computed style / bounding box 做一次抽样验证，确认最终生效值与 Figma 对齐。
- 禁止把 CSS 声明值当成最终盒模型尺寸。表格使用 `border-collapse` 时，单元格的 `height`、border、内容最小高度和浏览器半像素分配会共同影响最终 `tr` 高度；必须直接读取 `tr.getBoundingClientRect()`。本项目曾出现 `td { height: 61.25px; }` 已写入源码，但浏览器最终行高为 `62.25px` 的错误。固定格式列表必须逐行检查最终行高、首行起点和后续行累积坐标，不能只抽查 CSS 规则。
- 截图比较前必须统一 CSS viewport、`deviceScaleFactor`、浏览器缩放、页面状态和字体加载状态，并记录原图像素尺寸。不得直接比较 2x Figma 截图与 1x 浏览器截图后据此修改字号或字重；若像素密度不同，应按同一 CSS 画布重新截图，或将两图归一到相同 DPR 后再判断。截图中的临时新增行、展开态、hover 态等也必须与 Design 状态一致。
- 对关键区域的验收记录至少包含“Design 目标值 / CSS 声明值 / 浏览器最终值”。如果三者不同，必须先解释盒模型、继承、字体 fallback、缩放或组件内部 DOM 的影响并修正，不能以源码中已经出现目标数字作为完成依据。
- 表单和操作区不能只验证大容器尺寸；输入框 `prefix` / `suffix`、密码显示眼睛、清空按钮、下拉箭头、关闭按钮、保存按钮内图标、表格操作列图标都必须逐项核对。Figma 使用图标按钮时，前端不得用“显示 / 隐藏”等文字按钮近似替代，除非设计稿明确如此。
- 表格字段内容本身也属于视觉还原范围。Figma 已明确给出的列名、字段文案、标签形态、按钮数量、按钮顺序和失败 / 成功状态展示，必须先按 Figma 对齐；当前接口或业务逻辑暂不支撑时，使用视觉兜底并记录到 `设计/遗留问题.md`，不能擅自改成旧项目字段或用“暂未接入”替代设计稿中的展示。
- 同一页面存在多个 Tab 表格时，不能套用一套旧项目通用列宽。必须按对应 Tab 的 Figma Make 代码或 Design metadata 单独核对表头文字位置、单元格 padding、行高和操作列按钮尺寸；例如通知渠道、通知规则、发送历史三张表需要分别定义列宽和文字样式。
- 列表迁移到共享 `el-table` / `AppFigmaTable` 后，操作列按钮必须始终可见，不保留旧页面或 Figma 原型中仅在 Hover 时显示操作按钮的实现。Hover 可以改变按钮背景色、文字色或图标色，但不得通过 `opacity`、`visibility`、`display` 等属性控制操作按钮是否可见。
- 只有当项目 token 已有明确等价语义，或 Element Plus 原生结构导致无法完全一致时，才允许偏离；偏离原因必须写在目标包总结或文档中。
- 视觉还原检查时，应优先对照 Figma 原始数值，而不是只凭肉眼判断“差不多”。

Figma 迁移遗留问题处理：

- 页面还原过程中，以下三类差异必须在当轮立即记录到 `设计/遗留问题.md`，不能只停留在对话、验收截图或最终总结中：
  1. Design / Make 已表达，但当前前端、后端、数据、权限、流程或业务逻辑不支持的能力。
  2. 当前系统已有功能、字段、状态或入口，但新版 Design / Make 删除、遗漏或没有表达的内容。
  3. 当前实现或 Make 已存在，但 Design 没有提供独立稿的 empty、loading、error、disabled、submitting、success、failed 等状态。
- 第一类差异可以在不伪造业务结果的前提下使用视觉兜底；第二类差异不得擅自删除现有功能，也不得自行塞回新版页面；第三类差异只能确认功能和可用性，不能宣称完成像素级验收。三类都应等待后续产品或 Figma 决策。
- 每条遗留问题至少写清页面 / 节点、差异方向、当前系统行为、Design / Make 表达、当轮临时处理、影响或风险、后续需要补设计还是补前后端能力，确保后续可以直接据此决策和实施。
- 页面存在差异但本轮不处理时，也必须记录到 `设计/遗留问题.md`，不能只停留在对话结论里。
- 未接入的功能入口必须按页面和按钮逐项记录，例如查询条件、批量导出、立即执行、复制、删除、导出 PDF、进入后台上下文恢复等；不能只笼统写“操作按钮待接入”。
- 遗留问题按页面名称归档，例如 `Figma 视觉迁移 - 选择工作区`，每条说明当前处理、风险和后续优化方向。
- 未经产品或 Figma 设计确认，不在前端自行新增设计稿没有表达的状态，例如“当前选择”“推荐工作区”等标签。
- 若为了贴近浏览器实际视觉而偏离 Figma 原始数值，例如将卡片 padding 从 `21px` 微调为 `20px`，也必须记录偏离原因和后续恢复条件。

## Figma 视觉基准

从本地 Figma 代码中提炼出的基础视觉值：

| 类型 | Figma 值 | 当前项目建议 |
| --- | --- | --- |
| 页面背景 | `#F4F6FA` | 映射到 `--app-bg-page` |
| 面板/卡片 | `#FFFFFF` | 映射到 `--app-bg-panel` / `--app-bg-card` |
| 主色 | `#165DFF` | 映射到 `--app-primary` |
| 成功色 | `#00B42A` | 映射到 `--app-success` |
| 警告色 | `#FF7D00` | 映射到 `--app-warning` |
| 危险色 | `#F53F3F` | 映射到 `--app-danger` |
| 紫色状态 | `#7816FF` | 映射到 `--app-running` / AI 类强调色 |
| 青色状态 | `#0FC6C2` | 映射到 Web UI 自动化强调色 |
| 主文字 | `#1D2129` | 映射到 `--app-text-primary` |
| 次级文字 | `#4E5969` | 映射到 `--app-text-secondary` |
| 弱文字 | `#86909C` | 映射到 `--app-text-muted` |
| 边框 | `#E5E6EB` | 映射到 `--app-border` |
| 弱背景 | `#F7F8FA` / `#FAFAFA` | 映射到表头、工具条、输入底色 |
| 字体 | Inter + 系统中文 UI 字体 fallback | 映射到 `--app-font-family`，不强求 Figma 字体族 1:1 |

字体基线说明：

- Figma 设计中声明的主要字体通常是 Inter，但 Inter 不包含中文字符，中文实际由 Figma 渲染环境自动 fallback。
- 当前项目采用产品级系统原生字体栈：英文和数字优先 Inter，中文优先系统 UI 字体，例如 macOS 的 PingFang SC、Windows 的 Microsoft YaHei / Microsoft YaHei UI、国产 Linux 的 WenQuanYi Micro Hei，Noto Sans SC 只作为兜底。
- 当前项目等宽字体优先使用 JetBrains Mono，并向后兜底到系统等宽字体，例如 Menlo、Consolas、DejaVu Sans Mono、WenQuanYi Zen Hei Mono。
- 后续视觉迁移不再追求 Figma 字体族完全一致，因为 Figma、macOS、Windows、Linux 的字体 fallback 和抗锯齿渲染天然存在差异。
- 必须对齐 Figma 的字体设计参数：`font-size`、`font-weight`、`line-height`、`color`、文字容器尺寸和文字周边间距。
- 禁止为了“看起来差不多”擅自把 Figma 的 `600` 改成 `500`，也禁止用字体族差异解释掉实际的字号、字重、行高偏差。若因 Element Plus 原生结构或可读性原因必须偏离，必须在目标包总结或遗留问题中说明。

当前字体栈：

```css
--app-font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei",
  "Hiragino Sans GB", "WenQuanYi Micro Hei", "Noto Sans SC", sans-serif;

--app-font-family-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular",
  Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono",
  "WenQuanYi Zen Hei Mono", monospace;
```

## 组件映射

| Figma / React | 当前 Vue 落地方式 |
| --- | --- |
| shadcn Button | Element Plus `el-button` + `element-overrides.css` |
| shadcn Input / Select | Element Plus 表单组件 + 全局输入框覆盖 |
| shadcn Card | `AppCard` / `AppSection` / 页面局部容器 |
| shadcn Table | `el-table` / `AppTable`，表头轻量化、行高统一 |
| shadcn Tabs | `el-tabs` 或现有自定义 Tab，保持 32-44px 高度 |
| Radix Dialog | Element Plus `el-dialog` |
| Radix Drawer / Sheet | Element Plus `el-drawer` |
| 删除确认 Dialog | `confirmDelete()` / `AppDeleteConfirmDialog`，禁止新增删除场景直接使用 `ElMessageBox.confirm` |
| lucide-react | `@lucide/vue` |
| Tailwind class | 转换为项目 CSS token 和局部 scoped class |

删除确认弹窗统一规则：

- 删除类确认必须优先使用 `confirmDelete()`，视觉按 Figma 红色图标、标题、说明、取消、确认删除按钮样式落地。
- 保留 `ElMessageBox.confirm` 仅限暂未迁移的历史代码、非删除类确认、输入型 `prompt` 或特殊业务确认；新增删除入口不得继续使用 Element Plus 默认确认框。
- 批量删除、删除附件、删除模块、删除接口 / 场景 / 用例 / 缺陷等，后续迁移时都应先替换为公共删除确认，再接原业务接口。
- 若当前删除入口只有视觉按钮但没有后端能力，保留入口样式并记录到 `设计/遗留问题.md`，不能伪造删除成功。

## 推荐实施阶段

### 阶段 0：建立视觉参考

目标：
- 明确 Figma 本地代码和截图位置。
- 梳理需要对齐的页面类型：AppLayout、配置中心、接口管理、接口场景、报告、Web UI 工作台。
- 不修改业务代码。

产物：
- 本文档。
- 必要时补充截图对照清单。

### 阶段 1：全局视觉基线包

目标：
- 调整 `tokens.css` 中的颜色、字体、圆角、阴影、控件高度。
- 调整 `element-overrides.css` 中的按钮、输入框、表格、弹窗、抽屉、Tab、Tag。
- 调整 `global.css` 中的页面背景、滚动条、基础文本渲染。
- 调整 `AppLayout.vue` 的侧栏、顶部栏、菜单收缩态和图标视觉。

边界：
- 不改接口调用。
- 不改页面业务结构。
- 不改路由。
- 不重做页面功能。

验收：
- 登录后主布局不变形。
- 菜单展开/收起正常。
- 配置中心、接口自动化、Web UI 自动化至少各打开一个页面没有明显错位。

### 阶段 2：样板页还原

建议优先选择：
1. 配置中心 - 通知配置 / 本地执行器
2. 接口自动化 - 接口管理

选择原因：
- Figma 里有通知、Runner、设置、接口工作台等相近模块。
- 这些页面能覆盖表格、筛选栏、按钮组、弹窗、抽屉、目录树等核心组件。

目标：
- 以一个页面作为最终视觉样板。
- 保持现有功能不变，只调整视觉展示、密度、层次、颜色和状态样式。

验收：
- 页面截图和 Figma 参考截图进行人工对比。
- 页面主要操作能完成最小回归。

### 阶段 3：按模块扩散

建议顺序：
1. 配置中心
2. 接口自动化 - 接口管理
3. 接口自动化 - 接口场景
4. 接口自动化 - 执行套件 / 报告
5. Web UI 自动化
6. 用例中心 / 缺陷管理 / 其他模块

每个模块只在样板页标准稳定后再跟进，避免全系统同时改导致问题难定位。

多人并行开发约束：

- 同一模块同一时间只允许 1 人进行视觉还原，避免 scoped 样式和局部组件互相覆盖。
- 全局视觉基线文件由固定负责人维护，包括 `tokens.css`、`element-overrides.css`、`global.css`。
- 其他人如需调整全局 token，应先在目标包说明中提出，再由基线负责人统一合并。
- 提交页面视觉改动前，必须先同步最新视觉基线，避免本地旧 token 覆盖新规范。

全局基线变更流程：

1. 开发者在需求或目标包说明中写明新增 / 修改的 token、修改原因和 Figma 对应视觉参考。
2. 同步基线负责人评审，确认该视觉值属于全局、模块还是页面局部。
3. 基线负责人合并到全局样式文件，并用样板页验证视觉是否仍然成立。
4. 其他模块同步最新基线，只做局部适配，不反向覆盖全局规范。

## 页面级还原流程

1. 找到 Figma 对应模块代码和截图。
2. 提取当前页面真正需要还原的视觉点：布局密度、容器、按钮、表格、状态色、空状态。
3. 找到当前 Vue 页面和相关共享组件。
4. 优先通过 token 和共享组件解决共性问题。
5. 仅对当前页面做必要的 scoped 样式补充，禁止新增无命名空间的全局 class 污染全站。
6. 运行构建或类型检查。
7. 使用浏览器截图对比。
8. 修正明显差异后再提交。

## 验收标准

每个视觉还原目标包完成后，至少检查：

- 页面背景、容器边框、卡片圆角是否统一。
- 按钮高度、图标尺寸、文字颜色是否一致。
- 输入框前后缀图标、密码眼睛、清空按钮、下拉箭头、表格操作列图标是否与 Figma 类型、尺寸、位置一致。
- 表格表头、行高、分隔线、hover 状态是否轻量。
- 侧栏展开/收起后主内容是否正确贴齐。
- 弹窗/抽屉遮罩、圆角、标题区、底部操作区是否统一。
- 页面无明显文字溢出、按钮错位、卡片嵌套过重。
- 当前页面核心业务操作仍然可用。
- 页面无大量重复 scoped 样式，重复布局、卡片、工具栏已抽离到共享组件或公共样式。

## Figma 迁移待补逻辑记录

这些事项是为了先对齐 Figma 视觉而保留的临时视觉兜底，后续应统一补齐真实业务逻辑或让 Figma 重新设计状态。

### 工作区选择页

- Figma 工作区卡片展示了成员数、上次访问时间、角色标签和最近访问标签。
- 当前 `/workspaces/switchable` 已能支撑工作区名称、编码、描述、角色等基础信息，但成员数、上次访问时间、最近访问状态的字段契约还不完整。
- 为了先还原 Figma，前端在缺少字段时使用 Figma 示例值兜底：`8/12/5 名成员`、`今天 09:31/3 天前/7 天前`、`测试负责人/测试工程师/只读访客`。
- 后续需要后端补齐 `memberCount`、`lastAccessTime/lastAccessAt`、`roleName`、`current/isCurrent` 等字段后，再移除这些视觉兜底。
- 如果产品上需要显示“当前选择”“默认工作区”“推荐工作区”等状态，必须先让 Figma 补充对应标签样式，不在前端自行发挥。

## 附录 A：Figma 视觉值提取步骤

当前优先使用 Figma MCP 从 design URL 提取节点上下文、metadata 和截图。本地 Figma Make 代码只作为 MCP 不完整或需要补充实现细节时的参考。

### 从 Figma MCP 提取

有 Figma design URL 时，默认按以下顺序处理：

1. 从 URL 提取 `fileKey` 和 `node-id`，例如 `node-id=1-191` 转成 `1:191`。
2. 优先调用 `get_design_context` 获取节点结构、代码参考和设计上下文。
3. 必须调用 `get_screenshot` 获取视觉截图，截图作为最终肉眼对齐的源头。
4. 如 `get_design_context` 返回过大或不完整，调用 `get_metadata` 定位子节点，再按需读取具体节点。
5. 如 `get_design_context` 失败，例如提示“当前没有选中图层”，使用 `get_metadata + get_screenshot + 本地 Figma Make 代码` 兜底。
6. 实现完成后，用 Playwright 按接近 Figma 的视口尺寸截图，对比布局、字体参数、颜色、间距和组件状态。

如果 MCP 获取失败，目标包总结里必须说明实际使用了哪些依据，不能默认宣称已完整读取 Figma 结构化上下文。

### 从本地代码提取

MCP 信息不足时，再读取这些文件：

- `设计/后台管理系统界面设计/src/styles/theme.css`：全局颜色、字体、圆角、背景。
- `设计/后台管理系统界面设计/src/app/App.tsx`：主布局、侧栏、顶部栏、接口工作台示例。
- `设计/后台管理系统界面设计/src/app/NotifModule.tsx`：通知配置页面、表格、抽屉、状态标签。
- `设计/后台管理系统界面设计/src/app/RunnerModule.tsx`：本地执行器页面、统计卡片、表格、详情抽屉。
- `设计/后台管理系统界面设计/src/app/components/ui/*.tsx`：shadcn 基础组件尺寸和状态。
- `设计/后台管理系统界面设计/src/imports/*.png`：页面截图参考。

提取顺序：

1. 先取全局 token：颜色、字体、圆角、阴影、控件高度。
2. 再取组件规格：按钮高度、输入框高度、表格行高、Tab 高度、弹窗宽度。
3. 最后取页面密度：页面 padding、筛选栏间距、卡片内边距、操作栏高度。

### 从 Figma 设计文件检查器提取

如果能打开 Figma 设计文件或 MCP metadata，优先检查这些属性：

- Fill：背景色、卡片色、状态色。
- Stroke：边框颜色和粗细。
- Effects：阴影偏移、模糊、透明度。
- Auto Layout：padding、gap、对齐方式。
- Typography：字体、字号、字重、行高。
- Corner radius：圆角。
- Size：按钮、输入框、表格行、侧栏、顶部栏尺寸。

提取后不要直接散落写进页面，先判断是否属于全局规范：

- 全站通用：写入 `tokens.css` 或 `element-overrides.css`。
- 模块通用：写入模块级样式文件。
- 单页特有：写入页面根 class 下的 scoped 样式。

统一判定规则：

- 同一色值、圆角、阴影、间距、控件高度在 3 个及以上页面出现，提升到全局 token。
- 仅在单个模块内多处出现，放入模块公共样式或模块专属 token。
- 仅当前页面独有，例如专属弹窗宽度、特殊状态块高度，留在页面 scoped 样式。
- 禁止同一视觉规格在全局、模块、页面三处重复定义。
- 如果现有 token 已覆盖该语义，优先复用现有 token，不新增同义变量。

## 附录 B：Element Plus 覆盖示例

全局覆盖写在 `src/shared/styles/element-overrides.css`。覆盖时优先使用 `--app-xxx` token，不要每个页面重复写 Element Plus 内部样式。

示例：

```css
:root {
  --el-color-primary: var(--app-primary);
  --el-font-family: var(--app-font-family);
  --el-border-radius-base: var(--app-radius-md);
  --el-border-color: var(--app-border);
  --el-text-color-primary: var(--app-text-primary);
  --el-text-color-regular: var(--app-text-secondary);
}

.el-button {
  min-height: var(--app-control-height-md);
  border-radius: var(--app-radius-md);
  font-weight: 500;
}

.el-button--small {
  min-height: var(--app-control-height-sm);
}

.el-input__wrapper,
.el-select__wrapper,
.el-textarea__inner {
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.el-table {
  --el-table-header-bg-color: var(--app-table-header-bg);
  --el-table-row-hover-bg-color: var(--app-table-row-hover-bg);
  font-size: var(--app-font-size-md);
}

.el-table th.el-table__cell {
  height: 44px;
  font-weight: 600;
}

.el-table .el-table__row {
  height: var(--app-table-row-height);
}

.el-dialog,
.el-drawer {
  border-radius: var(--app-radius-xl);
}
```

注意：

- 全局覆盖只能写通用规则，不能把某个业务页面的特殊样式写进去。
- 如果覆盖会影响全站，需要先在样板页验证，再扩散。
- 如果只影响某个页面，用页面根 class + `:deep()` 限定作用域。

禁止全局覆盖场景：

- 某一个业务页面独有的特殊尺寸、配色、布局，不能写进 `element-overrides.css`。
- 弹窗、表格、输入框的差异化样式，必须限定页面根 class + `:deep()`。
- 不通过全局覆盖修改 Element Plus 的交互逻辑，例如点击行为、禁用逻辑、校验触发时机。
- 不使用高权重选择器强行压制所有页面，例如 `body .el-table *` 这类无限扩散写法。
- 不用 `!important` 作为常规手段；只有第三方内联样式或 Element Plus 权重无法规避时，才允许局部、带注释使用。

`!important` 使用示例：

```css
/* 允许：Element Plus 内部权重过高，仅当前页面局部使用，并说明原因 */
.page-demo :deep(.el-input__inner) {
  padding: 6px 12px !important; /* 适配 Figma 输入框内边距，原生变量无法调整 */
}

/* 禁止：无命名空间、全局大范围覆盖 */
.el-table td {
  padding: 8px !important;
}
```

## 附录 C：局部页面样式规范

页面级样式必须有明确边界，避免污染其他模块。

推荐规则：

1. 每个页面或模块根节点加专属 class，例如 `.page-config-center`、`.api-interface-workspace`、`.web-ui-cases-page`。
2. 页面内覆盖 Element Plus 内部结构时，使用根 class + `:deep(.el-xxx)`。
3. 禁止写没有根 class 限定的页面级全局 class。
4. 禁止在多个页面复制同一段样式；出现两次以上，应上提到共享组件或模块样式文件。
5. 颜色优先使用 token；固定尺寸可以使用 token，也可以使用明确规格的 px，但必须和设计规范一致。
6. 不做无关格式化，不因为改样式整文件重排。

样式复用阈值：

- 相同样式代码出现在 2 个及以上页面，必须考虑抽离。
- 多页面通用卡片、工具栏、筛选栏，优先抽成共享组件或共享 class。
- 同模块多页面通用样式，放到模块公共 `.css` 文件。
- 跨页面复制大段 scoped 样式前，先判断是否应该上提到 `AppCard`、`AppSection`、`AppTable` 或模块样式。
- 抽离只处理真实重复，不为了“可能复用”提前设计复杂抽象。

示例：

```vue
<template>
  <section class="page-config-notification">
    ...
  </section>
</template>

<style scoped>
.page-config-notification {
  min-height: 100%;
}

.page-config-notification :deep(.el-table th.el-table__cell) {
  background: var(--app-table-header-bg);
}

.page-config-notification__toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}
</style>
```

## 附录 D：图标迁移规范

图标迁移优先级：

1. Figma MCP 返回了明确的 SVG asset：必须下载到本地项目维护，并通过 `src/shared/assets/figma-icons` 模块统一导出使用。
2. Figma 只表达了 lucide 图标组件，例如 `lucide-react`，且没有人工二次修改：转换为当前项目的 `@lucide/vue`。
3. Figma 没有明确 SVG asset，也没有明确图标库组件：才允许选择语义最接近的 lucide 图标，并在目标包总结中说明。

强制本地维护 SVG 的情况：

- Figma MCP 输出 `const imgIcon = "https://www.figma.com/api/mcp/asset/..."` 并通过 `<img src={imgIcon}>` 使用。
- 品牌 Logo、产品识别图形、模块专属识别图形。
- 多 path 组合、渐变、剪切蒙版、特殊底色块、非单色线性图标等组合图形。
- 即使 MCP 输出 `lucide-react`，但设计师对图标做过二次修改，例如改线宽、改路径、缩放、调整视觉重心、搭配专属底色块。
- 样板页或核心验收区域中，使用图标库后肉眼和 Figma 有明显差异。

可以使用图标库的情况：

- Figma 明确使用 `lucide-react`，且图标没有被二次修改。
- 图标只是普通辅助语义，例如加号、搜索、关闭、刷新、箭头、筛选。
- 图标不属于品牌识别、核心验收区域或页面独有视觉资产。
- 使用 `@lucide/vue` 后，尺寸、线宽、留白和 Figma 基本一致。
- 如果 Figma 代码中控件内部使用图标组件，例如密码框 `Eye / EyeOff`、输入框搜索图标、按钮内 `Save` / `Send`，迁移后必须保持同类图标按钮形态，不得替换成文字按钮或 Element Plus 默认图标，除非设计稿没有明确图标形态。

禁止在业务代码中直接引用 `https://www.figma.com/api/mcp/asset/...` 这类远程临时资源。Figma asset URL 只用于开发期提取，生产代码必须引用本地资产。

本地维护目录：

```text
src/shared/assets/figma-icons/
  README.md
  index.ts
  config-center/
    db/
      db-cylinder-blue.svg
      action-edit.svg
```

新增 Figma SVG 时需要记录来源页面、Figma node-id、使用位置和命名含义。页面专用图标先按页面/模块归档，多个页面复用后再上提到通用目录。

SVG 预处理规则：

- 不一刀切清除 Figma SVG 内部颜色。Figma 1:1 专用图标、品牌 Logo、渐变图标、多色图标可以保留设计稿导出的固定 `stroke` / `fill`。
- 通用可复用的单色线性图标，才优先改成 `currentColor`，方便 hover、active、disabled 和主题色控制。
- 保留 Figma 明确给出的 `viewBox`、路径、线宽、圆角、clipPath 等结构，不为了“简洁”重画或改路径。
- SVG 不直接散落在页面目录里；必须进入 `src/shared/assets/figma-icons`，并从 `index.ts` 导出。

封装规则：

- 单页面少量图标，可以通过 `figmaIcons` 映射 + `<img>` 使用。
- 多页面复用、需要 hover / active / disabled 状态、或需要统一尺寸控制时，再封装为共享图标组件。
- 不为了一个页面的一两个静态图标提前过度封装。

当 Figma 代码使用 `lucide-react` 且没有额外 SVG asset 时，当前项目使用 `@lucide/vue`。两者图标命名大多一致，迁移时只替换导入方式和模板使用方式。

React 示例：

```tsx
import { Bell, Plus } from "lucide-react";

<Bell size={16} />
<Plus size={14} />
```

Vue 示例：

```vue
<script setup lang="ts">
import { Bell, Plus } from '@lucide/vue'
</script>

<template>
  <Bell class="icon-md" />
  <Plus class="icon-sm" />
</template>
```

建议尺寸：

| 使用场景 | 尺寸 |
| --- | --- |
| 表格行内操作 | 14px |
| 普通按钮图标 | 14px / 16px |
| 菜单图标 | 16px / 18px |
| 卡片统计图标 | 20px / 24px |
| 空状态主图标 | 32px / 40px |

全局图标 class 建议写入 `global.css` 或共享样式文件：

```css
.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-md {
  width: 16px;
  height: 16px;
}

.icon-lg {
  width: 18px;
  height: 18px;
}

.icon-xl {
  width: 20px;
  height: 20px;
}

.icon-xxl {
  width: 32px;
  height: 32px;
}
```

建议颜色：

- 默认图标：`var(--app-text-muted)`
- 悬浮图标：`var(--app-text-secondary)`
- 激活图标：`var(--app-primary)`
- 危险操作：`var(--app-danger)`
- 模块强调：使用导航或模块自己的强调色 token

图标迁移时不要新增无关图标库。Figma 里找不到完全同名图标且没有 SVG asset 时，优先选择 lucide 中语义最接近的图标，并保持尺寸和线性风格一致。

图标禁用规则：

- 默认不写非标准尺寸，例如 `22px`。确有设计依据时允许使用，但需要在目标包说明中解释。
- 手写或自建 SVG 禁止直接写死 `fill="#xxx"` 或 `stroke="#xxx"`；优先使用 `currentColor` 和 CSS token 控制颜色。Figma 原始 SVG asset 可以保留设计稿导出的固定色值。
- 不混用多套风格；Figma SVG asset 和 lucide 图标并存时，优先保证单个页面内同一功能区图标风格统一。
- 不为了某个页面引入新的图标库。

## 附录 E：特殊场景验收清单

后台管理系统常见复杂场景，需要在样板页阶段额外检查：

| 场景 | 检查点 |
| --- | --- |
| 超长弹窗内容 | 标题固定、内容区滚动、底部按钮固定、不撑出视口 |
| 抽屉详情 | 宽度合理、标题/内容/底部操作分区清晰、关闭按钮不漂移 |
| 表格固定列 | 固定列阴影、边框、hover 状态不突兀 |
| 大数据表格 | 行高稳定、分页位置稳定、滚动不卡顿 |
| 树形目录 | 缩进、展开图标、计数、选中态、hover 态统一 |
| 分页组件 | 总数、页码、每页条数、跳转输入框在一行内对齐 |
| 空状态 | 图标、标题、辅助文案、主按钮层级清楚 |
| 加载态 | 骨架屏或 loading 不遮挡关键操作，不造成布局跳动 |
| 错误态 | 错误文案可读，重试按钮位置固定 |
| 表单禁用 / 只读态 | 输入框灰度、按钮置灰透明度、文字弱色、光标状态统一 |
| Tag 状态标签 | 成功、警告、危险、运行中四类色值与 token 匹配，圆角统一 |
| Steps 步骤条 | 已完成、进行中、未开始三种状态配色和图标尺寸统一 |
| Tooltip 悬浮提示 | 背景、文字色、圆角、偏移距离统一，不遮挡关键操作 |
| 深色模式 | 当前项目若未完整支持，视觉还原阶段不扩展深色模式 |
| 响应式 | 后台桌面端优先；窄屏至少不能文字重叠、按钮溢出 |

## 附录 F：截图验收建议

截图对比是视觉还原的关键验证方式。

建议流程：

1. 从 Figma 本地截图或设计文件导出参考图。
2. 启动当前 Vue 页面，保持相同浏览器宽度和缩放比例。
3. 使用 Playwright 或浏览器截图保存当前页面。
4. 对比页面背景、边距、控件高度、表格密度、字体颜色和操作区对齐。
5. 把截图存到 `output/playwright/` 或目标包约定目录。

截图命名建议：

- `figma-config-notification-reference.png`
- `vue-config-notification-before.png`
- `vue-config-notification-after.png`
- `vue-api-interface-after.png`

如果视觉差异来自业务数据不同，不必强行做像素级一致；如果差异来自组件尺寸、颜色、层次，则应继续调整。

## 附录 G：样式冲突排查与兼容排坑

### scoped 样式不生效

常见原因：

- 目标 DOM 在 Element Plus 子组件内部，scoped 选择器无法直接命中。
- 目标 DOM 由弹窗、下拉、Tooltip 挂载到 `body` 下，不在当前组件根节点内。
- 组件被二次封装，实际 class 不在当前文件 template 中。

处理方式：

- 当前页面内部的 Element Plus 子结构，用页面根 class + `:deep(.el-xxx)`。
- 挂载到 `body` 的弹窗、下拉、Tooltip，优先使用 Element Plus 的 `popper-class`、`modal-class`、`custom-class` 等能力加命名空间。
- 不为了命中样式写过长选择器；选择器超过 4 层时，优先给组件补明确 class。

### Element Plus 权重冲突

优先级建议：

1. 全局 token 和 Element Plus CSS 变量。
2. `element-overrides.css` 通用覆盖。
3. 共享组件内部样式。
4. 页面根 class + `:deep()` 局部覆盖。

如果局部页面覆盖和全局覆盖冲突，以样板页验收通过的全局视觉基线为准，页面自行适配新 token。

### 页面挤压与最小宽度

后台页面优先保证桌面端体验：

- 工具栏按钮过多时，优先收进更多菜单，不压缩主要按钮文字。
- 筛选项过多时，允许换行或折叠高级筛选，不让输入框窄到不可用。
- 表格列过多时，优先横向滚动或固定关键列，不让内容互相遮挡。
- 工作台类页面可以设置合理 `min-width`，但不能导致主布局收缩态错位。

### 滚动条统一

滚动条属于全局视觉，可在 `global.css` 中统一，但必须保持克制：

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--app-border-strong) transparent;
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--app-border-strong);
}
```

### 热更新后样式不生效

排查顺序：

1. 确认样式文件已被入口导入。
2. 确认目标 class 是否真实渲染到 DOM。
3. 关闭浏览器缓存或强刷页面。
4. 重启 Vite dev server。
5. 检查是否被更高权重样式覆盖。

## 不做事项

- 不迁移到 React。
- 不引入 Tailwind 作为项目主样式方案。
- 不引入 Radix/shadcn 运行时依赖。
- 不用 Figma mock 数据替换真实接口数据。
- 不把 Figma 生成的大 TSX 文件转成 Vue 大文件。
- 不一次性重写所有页面。
- 不为了视觉还原删除已有业务逻辑。
- 不直接复制 Figma 生成的 Tailwind 类名、shadcn 组件 DOM 结构到 Vue 页面。
- 不修改共享组件内部业务逻辑；共享组件只允许按视觉目标调整样式、token 和展示层结构。

## 附录 H：嵌套组件与锚定区域强制验收

以下规则来自接口场景详情页复核中发现的漏检问题，后续所有 Figma 视觉迁移必须执行：

1. 外层容器尺寸、背景和边框与 Figma 一致，不得作为“该区域已对齐”的结论。标题区、标签、原生输入/下拉框、图标、说明文字、辅助文字等每个直接子元素，必须分别核对 `getBoundingClientRect()`、`font-size`、`font-weight`、`line-height`、颜色、边框、圆角和内边距。
2. Figma 中由普通 `div` / Dropdown / Text 组合出来的区域，迁移到 Vue3 + Element Plus 或原生表单控件时，必须检查浏览器最终渲染。不得把原生 `select` / `input` 的默认箭头、默认基线、行高或内边距当作 Figma 组件的等价实现。
3. 带“贴底”“固定在右侧栏底部”“占满剩余空间后展示”等布局语义的区域，必须在父级显式建立正确的 `flex` 或 `grid` 上下文，并验证目标元素的最终 `top`、`bottom` 和高度。仅给子元素写 `margin-top: auto` 但未验证父级布局，不视为完成。
4. 每个已迁移页面在宣布对齐前，至少需要同时保留：Figma Design 节点截图、实际页面同尺寸截图、关键嵌套元素的 computed style / bounding box 记录。验收范围必须包含页面首部、主要内容、侧栏或底栏、hover/选中态以及设计稿明确给出的空态或控制器态。
5. 验收结论只能覆盖已逐项检查的状态。未核对的 Tab、抽屉、弹窗、hover 态或固定区域必须明确标为“未验收”，不得使用“已对齐”“完全一致”等笼统结论。
6. 同一页面存在“通用控件规则 + 节点级尺寸规则”时，必须检查规则叠加后的最终值。接口场景详情页曾因 `.figma-api-scenarios__run-config select { margin-top: 3.5px; }` 泄漏到顶部环境选择器，导致该控件偏离 Figma `3.5px`；步骤方法标签又因沿用内容自适应宽度、并被旧全局 `b` 内边距覆盖，未达到节点固定 `49px` 与 `5.25px` 水平内边距。标题、标签等内容自适应元素还必须区分展示态和编辑态，不得用固定宽度 input 替代展示态文本并据此宣称图标锚定正确。后续应在交付前针对每类控件记录 selector、computed style 与节点尺寸；不能只验证外层容器或只凭 CSS 意图判断。
7. `Dropdown`、Select、DatePicker 等具备选择语义的组件，即使 Figma 元数据未展开箭头子节点，也必须结合设计截图和 Make 的事件/组件结构验证可交互提示。不得为了贴近静态截图而使用 `appearance: none`、隐藏箭头或移除展开入口；视觉验收必须确认用户可以一眼识别该控件可选择。

## 附录 I：防漏检强制门禁

以下规则来自实际视觉还原中的漏检复盘。后续任务必须把它们作为交付门禁执行，不能只作为建议。

### 1. 图标必须核对 glyph 和 SVG path

- 图标名称或外观相近不代表同一个图标。使用 Lucide 等图标库时，必须同时核对组件名、`viewBox`、SVG `path d`、path 数量、`stroke-width`、线帽、线连接、最终宽高和颜色。
- Figma 使用 `CircleCheckBig` 时，不得用外观相近的 `CircleCheck` 代替；语义一致但 path 不一致仍属于未对齐。
- Figma MCP 返回了 SVG asset 时，必须使用该 asset；只有确认设计稿使用的是未修改的标准图标库 glyph，才允许映射到项目图标组件。
- 验收截图中出现的每个核心状态图标都要单独核对，不能因为默认态图标正确就推断成功、失败、运行中等状态图标也正确。

### 2. 必须先建立状态矩阵，再宣称组件对齐

- 对按钮、任务卡、列表项、Tab、开关、步骤条、表单控件、弹窗和抽屉，开始实现前必须列出设计稿存在的状态，例如：默认、hover、active / selected、focus、disabled、loading、empty、running、success、failed 和 error。
- 当前数据库只有某一种状态时，不能只验证现有数据。必须使用安全的前端测试夹具、可逆交互或已有测试数据分别呈现设计稿明确给出的状态；不能用“数据库里暂时没有”跳过视觉验收。
- 每个状态必须检查容器和直接子元素。至少包括：背景、边框、阴影、标题颜色、说明文字颜色、图标、按钮、标签、透明度和光标。
- 选中态不能只核对外层边框与背景。例如输出模式选中后，除蓝色边框和浅蓝背景外，还必须核对标题是否切换为主色；内部文字未检查时不得结论为“选中态已对齐”。
- 验收结论必须按状态给出。只验证“已完成”任务时，只能写“已完成状态已验收”，不得扩展为整个任务列表已对齐。

### 3. 通用 CSS 重置和选择器覆盖必须用 computed style 排查

- 页面中存在 `.page button { border: 0; }`、全局字体、通用 `span`、`strong`、`svg` 等规则时，必须检查它们是否覆盖组件状态规则。源码里写了目标值不等于浏览器最终生效。
- 禁止在页面级高权重选择器中用 `font: inherit` 重置按钮和表单控件。`font` 是会同时覆盖 `font-size`、`font-weight`、`line-height` 等属性的简写；例如 `.page button { font: inherit; }` 会压过较低权重的按钮尺寸规则，导致 12px 按钮实际继承成 14px，并在固定宽度下把 SVG 挤窄。页面级重置应只写 `font-family: inherit`，控件字号、字重和行高必须由组件规则显式定义并用 computed style 验证。
- 对边框、文字颜色、背景、尺寸和 padding 等关键属性，必须读取最终 computed style；对固定尺寸和位置还必须读取 `getBoundingClientRect()`。
- 当目标 class 规则被元素选择器加 class 的组合规则覆盖时，应通过准确、局部的组件选择器修正权重，例如 `button.component-state` 或 `.component.is-active > strong`，不得默认使用 `!important`。
- 按钮验收必须检查实际边框。曾出现通用 `button { border: 0; }` 覆盖“查看结果”“重试”按钮边框，使其退化成文字链接；此类问题仅看模板和 CSS 声明无法发现。
- 每次新增或修改状态样式后，要在浏览器中切换至少一次前后状态，分别记录关键子元素最终值，确认旧状态能够恢复，避免单向样式残留。

### 4. 页面高度必须验证完整父级链路

- Figma 编辑器自身的顶部工具栏、文件标题栏和侧边栏不属于设计画布。对齐前必须确认 Design frame 的原始宽高，不能把 Figma 编辑器 chrome 计入应用页面高度。
- 出现底部空白、内容截断或组件漂移时，必须从 `AppLayout`、主内容、页面壳、Tab 内容区一直检查到目标页面根节点，逐级记录 `display`、`flex`、`height`、`min-height`、`overflow` 和 bounding box。
- 不能只给最内层页面写 `height: 100%`。父级任意一层没有确定高度或正确 flex / grid 上下文时，百分比高度不会按预期撑满。
- 外层页面负责自适应填满剩余视口；Figma 明确给出固定尺寸的内部卡片、弹窗和控件仍保持设计尺寸。额外高度应由工作区背景、弹性空白或滚动区域承接，不能通过拉伸内部组件消除空白。
- 至少验证两档高度：Figma 原始 frame 高度和当前实际浏览器高度。需要记录页面根节点的 `top`、`bottom`、`height`，以及工作区的 `clientHeight`、`scrollHeight`、`overflow`。
- 曾出现页面父级未撑满导致底部空出 68px。此类问题必须先修复高度链路，再单独核对内部组件尺寸，不能把空白归因于 Figma 工具栏或直接拉高上传卡片。

### 5. “已对齐”结论的证据要求

- “已对齐”“完全一致”“像素级一致”只能用于已逐项验证的节点和状态，不得根据外层容器、单张截图或单一数据库状态推断整个页面。
- 每个核心控件至少保留三类证据：Design / Make 目标值、Vue CSS 规则、浏览器 computed style / bounding box。涉及交互时还要保留状态切换前后的截图或数值。
- 验收表应细分到直接子元素，例如“选中卡片边框”“选中标题颜色”“说明文字颜色”“状态图标 path”“操作按钮边框”，不能只写“卡片已对齐”。
- 如果尚未核对某个状态、弹窗、抽屉或响应式尺寸，交付说明必须明确写“未验收”，不得省略。

### 6. 本项目已发生问题的交付前复查项

设计来源与范围：

- [ ] 是否取得准确的 Design 节点、同状态截图和 Make 源码；无法取得结构化上下文时，是否明确记录证据限制。
- [ ] 是否列出本轮允许修改的页面、弹窗、抽屉和共享组件，避免局部规则误伤同页面其他状态或其他页面。
- [ ] 是否逐项核对 Design 中存在的字段、标签、按钮数量和顺序；没有设计依据的角色标签、状态说明或业务字段不得自行新增。

状态与交互：

- [ ] 是否先建立状态矩阵，并分别验证 default、hover、active / selected、focus、disabled、loading、empty、success、failed 和 error 中设计实际存在的状态。
- [ ] 当前实现或 Make 存在、但 Design 没有提供独立节点的状态，是否已经立即登记到 `设计/遗留问题.md` 并标记为“未完成像素级验收”，而不是等到页面交付后只在对话中说明。
- [ ] 是否逐项检查 Make 中的 `onClick`、`onMouseEnter`、`onMouseLeave`、`onFocus`、`onBlur`、`onDragOver`、`onDragLeave`、`onDrop`、文件读取回调和 Tab 切换逻辑。
- [ ] active / selected / dragging / disabled 状态是否同时核对容器、标题、说明、图标、边框、背景、文字颜色、光标和 transition，而不是只看外层背景。
- [ ] Make 没有 transition 时是否避免自行添加过渡；有 transition 时是否核对属性、时长和 easing。最终颜色一致不能替代交互过程验收。
- [ ] 表单错误是否核对错误文案位置、输入框边框、焦点态、输入后清除和提交阻断；不得用 Toast 近似替代 Design / Make 明确给出的字段级校验。
- [ ] 状态切换后是否验证能够恢复默认样式，避免 hover、dragging、loading 等临时样式残留。

字体、图标与控件：

- [ ] 每段关键文字是否核对 `font-size`、`font-weight`、`line-height`、颜色、容器宽高和上下间距，且没有用字体栈差异解释实际参数偏差。
- [ ] 图标是否核对组件名、SVG path、path 数量、尺寸、`stroke-width`、颜色及各状态；不得只凭名称或肉眼相似选取。
- [ ] 图标是否分别核对外层点击容器、SVG 画布和可见 path 包围盒；不得把容器尺寸或 SVG 的 `width` / `height` 当成可见图形尺寸。对开关、单选、复选、状态图标等精细控件，还要核对胶囊、圆点、勾线等内部 path 的实际宽高、位置和描边。
- [ ] 通用 `button { border: 0; }`、`font: inherit`、通用 `span` / `strong` / `svg` 等规则是否覆盖局部控件。
- [ ] 输入框前后缀、关闭按钮、操作列按钮、文件上传图标和禁用图标是否分别验收，而不是只验收控件外框。

盒模型与布局：

- [ ] 是否同时记录 Design 目标值、CSS 声明值和浏览器 `getBoundingClientRect()` 最终值；源码中出现目标数字不等于最终尺寸正确。
- [ ] 固定宽高是否包含 padding 和 border，是否显式核对 `box-sizing`、半像素边框、DPR 和浏览器像素取整。
- [ ] flex / grid 子项是否因默认 `flex-shrink`、`min-width`、内容长度或边框宽度发生压缩、扩张或整组位移。
- [ ] 固定高度父容器内的子项高度、margin、gap、padding 和 border 总和是否超过可用空间；需要保持固定尺寸的按钮或图标是否设置了正确的 shrink 规则。
- [ ] 列表行出现错误原因、说明、二级标签等条件内容时，是否分别核对“无条件内容 / 首条有条件内容 / 非首条有条件内容”的行高、条件 margin、边框和整张卡片累计高度；不得用默认行对齐结果推断条件行也正确。
- [ ] 比较 Hug Content、标签或自适应按钮宽度时，Design、Make 和浏览器是否使用完全相同的文案、空格和标点；先排除测试数据差异，再判断字体 fallback 或盒模型问题。
- [ ] 页面根节点和完整父级高度链路是否撑满，是否存在未解释的空白、裁切、滚动条或内容漂移。
- [ ] 内部固定尺寸组件是否保持 Figma 尺寸，额外空间是否由页面背景或滚动区承接，而不是拉伸内部组件。
- [ ] 修改共享弹窗标题栏、底部栏或通用按钮规则后，是否重新检查同页面其他弹窗；专属尺寸必须使用页面 / 组件变体选择器限定作用域。

业务边界与交付证据：

- [ ] Design / Make 与真实后端能力不一致时，是否保留真实业务语义并记录到 `设计/遗留问题.md`；不得通过改文案、假成功态或仅前端入口伪造邮件、文件格式和持久化能力。
- [ ] 是否完成双向功能差异核对：Design / Make 有而系统缺少的能力，以及系统已有但 Design / Make 删除、遗漏或未表达的功能，是否都已登记到 `设计/遗留问题.md` 并等待产品或 Figma 决策。
- [ ] 每条遗留问题是否包含页面 / 节点、差异方向、当前行为、设计表达、临时处理、影响或风险和后续动作，而不是只写“待接入”或“待补设计”。
- [ ] 是否使用真实数据、可逆交互、安全测试夹具或网络拦截覆盖关键状态，且未为了截图污染正式数据。
- [ ] 是否保留同视口、同 DPR、同页面状态的 Design 与实际页面截图，以及关键节点的 computed style / bounding box 记录。
- [ ] 是否运行类型检查、构建和浏览器控制台检查，并复核中文编码、无关格式化和样式作用域。
- [ ] 最终结论是否严格限定在实际验收过的节点和状态；任何未验收的 Tab、弹窗、抽屉、响应式尺寸或业务链路都必须明确列出。

### 7. 原生表单控件不得凭经验二次重绘

- Make 源码直接使用未定制的原生 `input`、`select`、`textarea` 或 `input[type="range"]` 时，必须先在目标 Chromium 环境记录其原生最终外观，再决定是否需要局部样式。不得因为 Design metadata 只暴露外层尺寸，就自行补写伪元素轨道、滑块、箭头或焦点环。
- `input[type="range"]` 必须单独核对 `appearance`、`accent-color`、轨道、滑块、焦点态、禁用态、最终宽高和垂直基线。Make 使用浏览器原生实心滑块时，不得改成白心描边滑块，即使轨道宽度和主色看起来接近。
- 对浏览器原生控件的验收，需要同时保留 Make 源码、Design 外层节点尺寸和同浏览器引擎下的实际截图。只有确认设计存在定制轨道或定制滑块时，才允许使用 `::-webkit-slider-runnable-track`、`::-webkit-slider-thumb` 等伪元素重新绘制。

### 8. 跨页面漏检原因与强制规则

以下规则适用于所有 Figma 对齐任务，包括列表、详情页、表单、Tab、弹窗、抽屉、上传区、编辑器和状态页面。规则来源于账号管理页及此前多个页面的实际漏检，不得只在案例页面中执行。

1. **不得遗漏 Make 事件。** 必须逐项迁移和验证 hover、transition、focus、blur、字段级校验、拖拽状态、文件读取回调、Tab 切换、展开收起和按钮阻止冒泡等交互；只迁移模板结构和默认态样式不算完成。
2. **不得只检查 CSS 声明。** 固定尺寸仍可能被父容器、border、padding、gap、`box-sizing`、`flex-shrink`、`min-width`、内容长度和浏览器像素取整改变。必须读取浏览器最终 computed style 和 bounding box，不能因为源码中写了目标数字就判断已对齐。
3. **不得把现有业务字段或后端枚举当成设计依据。** 后端存在某个身份、状态或字段，不代表页面必须展示对应标签；Design 没有表达的内容不得自行加入。业务确需新增展示时，应先补 Design 状态或取得明确产品确认。
4. **不得让局部修复影响共享组件和其他变体。** 修改通用标题栏、底部栏、按钮、输入框、表格、弹窗或抽屉规则后，必须重新验证所有受影响变体；页面专属尺寸和状态必须使用局部选择器限定作用域。
5. **不得用近似交互代替明确交互。** 字段下方错误不能替换为 Toast，图标变色不能只改容器背景，Design 中的图标按钮不能替换为文字按钮，选中态不能只对齐边框而遗漏标题、说明和图标状态。
6. **不得只验收当前数据碰巧出现的状态。** 数据库只有成功态、启用态或空态时，仍需使用安全测试夹具、可逆交互或网络拦截验证 Design 明确提供的其他状态。
7. **不得伪造后端能力。** Design / Make 表达但后端尚未实现的邮件、文件格式、持久化、执行或审计能力，必须保持真实业务语义并记录遗留问题，不能为了视觉一致宣称功能已支持。
8. **不得把单张截图接近作为整个页面完成依据。** 必须逐项验收直接子元素、全部关键状态和 Make 交互，并明确列出未验收的 Tab、弹窗、抽屉、响应式尺寸和业务链路。
9. **不得遗漏条件内容造成的累计高度变化。** 错误原因、审批说明、展开详情、辅助标签等条件节点会改变相邻 margin、列表行高和父卡片总高度；必须分别测量首条与非首条状态，并核对 Make 中的条件 spacing 表达式。
10. **不得自行美化 Make 没有的动效。** focus、hover、active、展开和提交状态的 transition 是否存在、作用属性、时长和 easing 都属于交互还原范围；最终静态颜色相同不代表过程已对齐。
11. **缺少 Design 状态必须立即登记。** 当前代码或 Make 已包含 empty、loading、error、disabled、success 等状态而 Design 未提供独立节点时，必须在本轮写入 `设计/遗留问题.md`，说明当前临时依据和补稿清单，不得只在最终回复中口头保留。
12. **内容宽度比较必须使用同一份文本。** Hug Content 标签、时间、邮箱、按钮等自适应内容要先统一空格、标点、数字和示例数据，再比较最终宽度；数据不同造成的宽度变化不能误判为 CSS 偏差，字体 fallback 的自然字宽差异也不得用硬编码逐条补偿。
13. **功能差异必须双向登记。** 不仅要记录 Design / Make 已设计但系统缺少后端或前端支持的能力，也要记录当前系统已有、但新版 Design / Make 删除、遗漏或没有表达的功能、字段、状态和入口。前者不得伪造成功，后者不得在没有产品结论时擅自删除或强行保留；两类都必须写入 `设计/遗留问题.md`，由后续产品和 Figma 补稿或确认取舍。
14. **图标容器尺寸不能代替可见路径验收。** 必须区分控件外层点击区域、SVG viewport 和 path 实际像素包围盒；同名 Lucide 图标也可能因版本或导出归一化产生不同 path、圆点半径和描边视觉。Design 已提供导出资产且现有组件可见轮廓不一致时，应使用 Design 原始 SVG；若继续复用图标库，必须在相同 viewport、DPR 和页面缩放下测量可见 path 包围盒及内部关键图形，不能只验证 DOM 属性和 `getBoundingClientRect()` 外框。

任何页面只有在“字段清单、状态矩阵、Make 事件清单、关键节点最终尺寸、图标可见路径、双向功能差异和缺稿状态登记”七项均完成核对后，才允许进入“已对齐”结论。

## 回滚策略

当前视觉还原工作从 checkpoint 提交 `e27b20ff` 之后的新分支开始。

如果视觉方向不满意：
- 可以切回原分支 `codex/ui-visual-polish`。
- 可以基于 checkpoint 提交重新拉分支。
- 可以只回滚视觉还原分支上的后续提交，不影响 checkpoint 之前的功能成果。

如果多人并行修改 `tokens.css`、`element-overrides.css`、`global.css` 产生冲突，以样板页验收通过的视觉基线为准。其他页面分支不反向覆盖全局基线，只做局部适配。

## 后续目标包建议

1. Figma 视觉基线包：tokens + Element Plus 覆盖 + AppLayout。
2. 配置中心样板页包：通知配置 / 本地执行器二选一作为样板。
3. 接口管理样板页包：目录树、请求工具栏、请求配置区、响应区。
4. 报告页视觉包：HTML 报告和平台报告统一配色。
5. 全站统一收口包：清理局部重复样式，补充视觉回归截图。

## 附录 J：对齐执行速查

本附录把页面对齐方法收口到本指南中。它是执行清单，不改变前文的视觉、交互和业务边界。

### J.1 三条裁决线

```text
视觉：Design 的最终节点结果 > Make 的视觉实现意图 > 当前代码
交互：Design 的动态说明 / Make 的事件和状态 > 当前代码
业务：真实业务规则、权限、接口、数据安全和审计 > Design / Make 的演示逻辑
```

- Design 决定颜色、尺寸、字体、字重、间距、图标、布局和最终静态外观。
- Make 用于确认点击、Hover、Focus、Loading、Tab、筛选、展开、拖拽、提交和错误恢复等行为。
- 当前项目的业务规则不能被演示代码覆盖。缺少后端能力时保留正确的界面表达，但不得伪造成功、持久化或权限结果。
- Design 与 Make 不一致时，记录差异来源和最终裁决；业务与设计不一致时，记录为业务差异或遗留问题。

### J.2 开始前的页面盘点

实现前同时确认：

- Design 节点、同状态截图和精确尺寸。
- Make 本地代码、事件绑定、条件渲染和状态切换。
- 当前页面入口、路由、组件、CSS、公共组件、接口、权限和用户已有修改。
- 页面所有区域：标题、Tab、筛选、表格、分页、目录树、操作列、弹窗、抽屉、空态、加载态、错误态和无权限态。

必须建立 `Design / Make / 当前代码 / 处理方式` 对照表，避免只修复一个明显控件后误判整页完成。

### J.3 差异处理顺序

发现问题后按以下顺序处理：

1. 先修复 Design 明确表达的视觉差异：尺寸、位置、字体、字重、颜色、间距、圆角、阴影和图标。
2. 再补齐 Make 明确表达且当前代码遗漏的交互和状态。
3. 最后处理后端、权限、数据、并发和审计缺口；不能用本地数组或假成功替代真实能力。
4. 双向登记差异：既记录 Design / Make 有而系统缺少的能力，也记录系统已有但设计删除或未表达的内容。

### J.4 交付前证据

每个核心区域和状态至少保留：

- Design 同状态截图或节点数据。
- Make 代码路径和关键事件说明。
- Vue 页面同视口截图。
- 关键元素的 computed style 与 `getBoundingClientRect()`。
- 接口响应、权限结果和状态切换结果。

涉及状态时，必须分别核对设计实际提供的默认、Hover、Focus、选中、Loading、Disabled、空态、成功、失败和重试状态；未核对的状态只能标记为“未验收”。

### J.5 对齐记录模板

```markdown
# Figma 对齐记录

## 本次范围
- 页面 / 组件：
- Figma 节点：
- Make 代码目录：
- 当前项目文件：
- 明确不处理：

## 已修复
- 视觉：
- 交互：
- 状态：

## 保持不变
- 已确认的业务逻辑：
- 用户已有修改：
- 暂不接入的后端能力：

## 验证结果
- 类型检查 / 构建 / 测试：
- 页面截图和 computed style：
- 关键状态和边界：

## 遗留问题
- 页面 / 节点：
- 当前行为与设计表达：
- 影响或风险：
- 后续动作：补设计 / 补前端 / 补后端 / 产品确认
```
