# Figma 视觉还原实施指南

本文档用于指导后续把 Figma 生成的新前端视觉落地到当前项目。每次开始 Figma 视觉还原相关目标包前，先阅读本文档，避免偏离“保留 Vue3 + Element Plus、只还原视觉、不重写业务”的方向。

## 设计来源

- Figma 页面：后台管理系统界面设计 2
- 本地参考代码：`设计/后台管理系统界面设计`
- 当前项目技术栈：Vue3 + Element Plus + Pinia + Vue Router
- Figma 生成代码技术栈：React + Tailwind + Radix/shadcn，局部包含 MUI

Figma 生成代码不能直接搬进当前项目。它只作为视觉规范、布局密度、组件状态和交互参考使用。

## 核心结论

不切换到 React，不做 React 到 Vue 的自动转换，不重写现有业务流程。

正确做法是：保留当前 Vue3 + Element Plus 架构，把 Figma 视觉拆成 token、组件规范、页面样板，再逐步映射到当前项目中。

“1:1 还原”的目标是视觉和体验还原，不是代码结构还原。可追求颜色、字体、间距、圆角、按钮高度、表格密度、页面层次接近 Figma，但必须保留现有路由、接口调用、状态管理、权限和业务交互。

## 还原原则

1. 先改全局视觉底座，再改单页细节。
2. 先做样板页，确认风格后再扩散到其他页面。
3. 优先使用现有 Element Plus 组件和项目已有共享组件，不引入 React、Radix、shadcn、Tailwind。
4. 不照搬 Figma 里的 mock 数据、业务状态和演示逻辑。
5. 不照搬 Figma 截图里的水印、演示品牌、无关菜单和临时内容。
6. 不为了视觉改动破坏现有功能、接口参数、数据加载和表单校验。
7. 每个阶段都要截图对比和最小功能回归。

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
| 字体 | Inter + PingFang SC + Microsoft YaHei | 映射到 `--app-font-family` |

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
| lucide-react | `@lucide/vue` |
| Tailwind class | 转换为项目 CSS token 和局部 scoped class |

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

## 页面级还原流程

1. 找到 Figma 对应模块代码和截图。
2. 提取当前页面真正需要还原的视觉点：布局密度、容器、按钮、表格、状态色、空状态。
3. 找到当前 Vue 页面和相关共享组件。
4. 优先通过 token 和共享组件解决共性问题。
5. 仅对当前页面做必要的 scoped 样式补充。
6. 运行构建或类型检查。
7. 使用浏览器截图对比。
8. 修正明显差异后再提交。

## 验收标准

每个视觉还原目标包完成后，至少检查：

- 页面背景、容器边框、卡片圆角是否统一。
- 按钮高度、图标尺寸、文字颜色是否一致。
- 表格表头、行高、分隔线、hover 状态是否轻量。
- 侧栏展开/收起后主内容是否正确贴齐。
- 弹窗/抽屉遮罩、圆角、标题区、底部操作区是否统一。
- 页面无明显文字溢出、按钮错位、卡片嵌套过重。
- 当前页面核心业务操作仍然可用。

## 附录 A：Figma 视觉值提取步骤

当前优先从本地 Figma 生成代码和截图中提取视觉值。如果后续可以使用 Figma MCP 或 Figma 桌面检查器，再以设计文件中的实际节点属性为准。

### 从本地代码提取

优先读取这些文件：

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

### 从 Figma 设计文件提取

如果能打开 Figma 设计文件，优先检查这些属性：

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

## 附录 C：局部页面样式规范

页面级样式必须有明确边界，避免污染其他模块。

推荐规则：

1. 每个页面或模块根节点加专属 class，例如 `.page-config-center`、`.api-interface-workspace`、`.web-ui-cases-page`。
2. 页面内覆盖 Element Plus 内部结构时，使用根 class + `:deep(.el-xxx)`。
3. 禁止写没有根 class 限定的页面级全局 class。
4. 禁止在多个页面复制同一段样式；出现两次以上，应上提到共享组件或模块样式文件。
5. 颜色优先使用 token；固定尺寸可以使用 token，也可以使用明确规格的 px，但必须和设计规范一致。
6. 不做无关格式化，不因为改样式整文件重排。

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

Figma 代码使用 `lucide-react`，当前项目使用 `@lucide/vue`。两者图标命名大多一致，迁移时只替换导入方式和模板使用方式。

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

建议颜色：

- 默认图标：`var(--app-text-muted)`
- 悬浮图标：`var(--app-text-secondary)`
- 激活图标：`var(--app-primary)`
- 危险操作：`var(--app-danger)`
- 模块强调：使用导航或模块自己的强调色 token

图标迁移时不要新增无关图标库。Figma 里找不到完全同名图标时，优先选择 lucide 中语义最接近的图标，并保持尺寸和线性风格一致。

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

## 不做事项

- 不迁移到 React。
- 不引入 Tailwind 作为项目主样式方案。
- 不引入 Radix/shadcn 运行时依赖。
- 不用 Figma mock 数据替换真实接口数据。
- 不把 Figma 生成的大 TSX 文件转成 Vue 大文件。
- 不一次性重写所有页面。
- 不为了视觉还原删除已有业务逻辑。

## 回滚策略

当前视觉还原工作从 checkpoint 提交 `e27b20ff` 之后的新分支开始。

如果视觉方向不满意：
- 可以切回原分支 `codex/ui-visual-polish`。
- 可以基于 checkpoint 提交重新拉分支。
- 可以只回滚视觉还原分支上的后续提交，不影响 checkpoint 之前的功能成果。

## 后续目标包建议

1. Figma 视觉基线包：tokens + Element Plus 覆盖 + AppLayout。
2. 配置中心样板页包：通知配置 / 本地执行器二选一作为样板。
3. 接口管理样板页包：目录树、请求工具栏、请求配置区、响应区。
4. 报告页视觉包：HTML 报告和平台报告统一配色。
5. 全站统一收口包：清理局部重复样式，补充视觉回归截图。
