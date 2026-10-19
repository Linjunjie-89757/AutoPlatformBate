# 接口管理处理器详情对齐（2026-10-19）

## 范围与来源

- 范围：前置脚本、SQL、等待；后置脚本、SQL、等待、提取。保留执行语义、Monaco 编辑能力和用户确认的默认红色删除按钮。
- 不包含：目录、请求栏、其他请求 Tab 的重新设计、数据源接入、实际脚本/SQL 执行引擎。
- Git 基线：`7437daa535b8053a5386f0f484b0f37bd1759c00`，开始时已有大量未提交工作，本次增量修改，未回退原有内容。
- Design：`jSUUPxC4PVD9Kp2FUydfox` / `984:14120`，脚本 `1028:15441`、SQL `1028:16049`、等待 `1028:16602`、提取 `1028:17248`。本轮已获取四张独立截图及 design context。
- Make：`设计/figma-ai-make最新代码20261016/src/app/App.tsx`，PreScriptDetail / PreSqlDetail / PreWaitDetail / PostDetailHeader / PostExtractDetail 及对应后置组件。
- Make 预览：`https://www.figma.com/make/s6EkOuJNJHLFYP5CTAdQNf/?code-node-id=0-9&p=f&fullscreen=1`。Chrome 9222 中原页面此前显示 Code layer isn't working，本轮再次读取超时；不能标记其交互已验证。
- 修改前清单及截图：`output/playwright/processor-audit-20261019/audit.md`、同目录 Design/Vue 图片及 JSON。
- 修改后证据：`output/playwright/processor-fix-20261019/`。独立真实 Chrome，最终采样 viewport 1920×1013、DPR 1；详情区域 1350×520。也在 1920×945 下检查了较短详情区和滚动。
- Design 截图为 1350×357 的局部画布，不强制将响应式详情区写死为 357px。`overlay-*.png` 使用 Vue 顶部 1350×357 裁剪与 Design 叠加，**不是整页同视口或同数据的像素验收**。

## 差异处理

| 编号 | 处理 | 本轮验证与限制 |
| --- | --- | --- |
| D01 | 名称/说明输入改为高 32px、圆角 8px、内边距 12px | 七种组合实测名称输入 32px；说明区截图复核 |
| D02 | 顶部复制改灰色，补 1×14px 分隔线、操作间距；删除仍红色 | 七种组合启停、复制、删除验证通过；红色遵循用户此前统一决定 |
| D03 | 前置内边距 16px、常规区块间距 12px，等待 16px | computed style 已确认；字体渲染及基线仍约 1–2px 差异，未作完全像素一致结论 |
| D04 | 脚本区域高 258px、工具栏 32px，补 CodeXml 图标与间距 | 前后置实测通过；保留 Monaco 行号/高亮和已有格式化按钮，与 Make textarea 存在已记录差异 |
| D05 | SQL 区域高 158px、工具栏 30px，独立蓝黑主题；超时输入高 32px | 前后置实测通过，切换回 Body 的浅色编辑区正常 |
| D06 | 前置映射列统一为列名/写入变量名/操作；添加列移至表格底部 | 前后置新增映射行及滚动截图通过；保留真实业务空提示 |
| D07 | 等待输入高 36px、约 299px 宽；快捷按钮高 24px、间距 6px | 前后置点击 2s 后值为 2000；说明输入位置复核，字体基线仍有约 1–2px 差异 |
| D08 | 提取添加行移到表格底部，恢复标题至表格间距 | 表格顶部相对详情 y=124px，Design 约 125px；保留这 1px 为未消除差异 |
| D09 | 提取列宽改为 116/90/88/90/76/剩余/68，每格左右 8px；表头 #F8F9FC | 实测表头 31px、数据行 41px；列宽和表头位置复核；Element Select 截断/箭头与原生 select 仍有区别 |
| D10 | 后置名称条固定，正文单独滚动；前置沿用 Make 整体滚动 | 七种组合分别截顶部/底部，后置名称条滚动后 y 不变；前后置均不再挂 api-request-body 类 |
| D11 | 删除最后一条提取项后显示空状态，不强制补行 | 删除后 0 行、新增后 1 行、再新增 2 行；兼容旧式单条提取数据；局部逻辑断言通过 |
| D12 | JSONPath/XPath 范围限制保持原业务逻辑，Regex 可选择范围 | 未按 Make 放开，属于未解决的业务差异；后端范围语义和前端归一化需要独立确认，不能仅取消 disabled |

## 状态验证

- 七种组合：截图、computed style、bounding box、滚动、启停、复制、删除；见 `measurements.json`、`interactions.json`。
- 提取：空状态、添加一条/多条、JSONPath/XPath/Regex 切换、更多设置弹层；保留 XPath 的业务格式选项和索引语义。
- 等待：快捷值与选中态；SQL：底部添加映射行。
- 回归：Params / Body / 断言保留 api-request-body；Body 浅色编辑器与响应区仍正常显示。
- 未完整验收：全部控件的键盘焦点/失焦与 hover、发送后的快速提取抽屉、真实保存重载及 SQL/脚本执行结果。Make 没有对应完整加载/错误流程，不能把 Vue 运行时状态算作与 Make 已验证一致。
- 源码未表达的状态不作完成推定；在线预览不可验证时，未将任何新状态登记为 not-expressed/verified。

## 检查与结论

- `npm run typecheck`：通过。
- `npm run build`：通过，保留现有依赖注释与 chunk 体积警告。
- `node output/playwright/processor-fix-20261019/check-extract.cjs`：通过（旧数据迁移、最后项删除、无自动复活、添加/复制）。
- `git diff --check`：通过，Git 提示已有文件 LF/CRLF 自动转换警告，无空白错误。
- 未运行可选 alignment-check；本记录不以自动完整性检查替代视觉验收。
- 本轮使用独立浏览器中的未保存请求验证，未发送或保存测试接口；开发服务已恢复到前端 4173、后端 8080（现有 MySQL 配置）。
- 结论：主要尺寸、布局及可达空状态已修复，状态为 **partial-alignment**。Make 在线验证、上述字体/原生控件/滚动条差异和 D12 未完成，不能称完全对齐。
- 滚动条补充：Vue 在内容溢出时使用 Windows 原生纵向滚动条，占约 15px；Copy Design 没表达此占位，叠加图在右缘存在宽度差异。未隐藏滚动条或强制扩展容器掩盖差异，需 Make 可操作预览复核。

## 本轮代码文件

- `src/widgets/api-interface-workspace/ApiProcessorDetail.vue`
- `src/widgets/api-interface-workspace/ApiCodeEditor.vue`
- `src/widgets/api-interface-workspace/lib/useApiProcessorWorkspace.ts`
- `src/widgets/api-interface-workspace/styles/api-processor-panel.css`
- `src/widgets/api-interface-workspace/styles/api-processor-detail.css`（新增，详情组件局部样式）
