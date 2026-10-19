# 断言表格局部对齐记录（2026-10-19）

结论：`partial-alignment`。已处理已知差异 8 项，保留差异 4 项；已知差异未解决 0 项，另有 3 项未验收。数量由下述差异数组计算，不表示整个断言 Tab 已完整验收。

## 范围与基线

- 目标：接口管理 → 断言，响应头、响应体 JSONPath/XPath/Regex、变量表格；共用名称、开关和正文滚动。状态码、响应时间、脚本仅回归共用区域。
- 排除：其他页面表格、共享下拉组件、断言执行规则、保存权限、脚本格式化等既有功能。
- Git 基线：`7437daa535b8053a5386f0f484b0f37bd1759c00`。工作区已有大量未提交修改，未覆盖或回退；本次前备份在 `output/playwright/assertion-fix-20261019/before/`。
- 前置审查：`output/playwright/assertion-audit-20261019/measurements.json`、`table-0.png`、`table-1.png`、`table-2.png`、`scroll.png`。
- Design：文件 `jSUUPxC4PVD9Kp2FUydfox`，节点 `878:1399`；本轮 get_design_context / get_screenshot 成功。截图 `output/playwright/assertion-fix-20261019/design-878-1399.png`，自然尺寸1614×316，不能直接当作当前浏览器像素比例。
- Make：`设计/figma-ai-make最新代码20261016/src/app/App.tsx`，AssertDetailHeader:5534、HeaderAssertDetail:5787、BodyAssertDetail:5825、VarAssertDetail:5911、固定标题/滚动正文:6047附近。
- Make SHA256：`15a11e8da386238bba8f4e6132ac1a9afd671dfb54c6da0ab76262c07185024a`。
- Make 预览： https://www.figma.com/make/s6EkOuJNJHLFYP5CTAdQNf/?code-node-id=0-9&p=f&fullscreen=1 。本轮 CDP 连接超时，未完成在线复验。
- Vue：`src/widgets/api-interface-workspace/ApiAssertionPanel.vue`、新增局部样式 `styles/api-assertion-detail.css`。保留原有下拉箭头修改。第二个外部 scoped style 使用 @ 别名，已解决 Vite 对新相对路径的缓存解析错误。
- Vue SHA256：`6b7beac79a7599f444eea153672a663915295f86b17542f0654eba18dc3373bb`；新增 CSS SHA256：`4ef44abf3fe794a1820e096baee3c3b9b5be536164f04c7a5ddc62e47e1ceb86`。
- 浏览器：独立 Playwright 会话 assertion-fix，http://localhost:4173，1280×720、DPR1、缩放100%、字体loaded；补充1024×720窄屏。未动用户9222会话。
- 本次证据根目录：`output/playwright/assertion-fix-20261019/`。

## 差异逐项处理

| 编号 | 项目 | 原表现 | 目标及当前实测 | 状态 |
| --- | --- | --- | --- | --- |
| AS-01 | 底部添加项 | 响应头、变量右上角；响应体工具栏右侧 | 表格最后一行，全宽、8px 12px、灰色，hover 蓝色；五种表格变体均已移至底部；实测高35px，hover rgb(22,93,255) | Vue 已复验，跨来源验收见限制 |
| AS-02 | 表格圆角 | 7px | 12px；五种表格均12px | Vue 已复验，跨来源验收见限制 |
| AS-03 | 单元格留白 | 行级10.5px，输入框二次padding | 每列左右12px，表头和字段起点一致；行padding 6px 0，控件margin 0 12px，输入wrapper padding 0；运行前后截图复核 | Vue 已复验，跨来源验收见限制 |
| AS-04 | 操作按钮 | 20px，复制蓝色 | 24×24px，复制灰色，间隔2px；24×24px，复制#86909c；hover #f3f4f6；删除hover #fef2f2 | Vue 已复验，跨来源验收见限制 |
| AS-05 | 比较条件宽度 | 固定72px，长条件截断 | 容纳真实业务的六字条件；列148px，控件124px，文字可用94px；长度大于等于/长度小于等于均未截断 | Vue 已复验，跨来源验收见限制 |
| AS-06 | 名称输入框 | 28px/7px圆角 | 用户批准的最新Make 32px/8px；六类断言均32px/8px | Vue 已复验，跨来源验收见限制 |
| AS-07 | 开关 | 28×15px | 用户批准的处理器统一32×16px；左侧和详情开关32×16px；详情关闭同步左侧，重新开启恢复 | Vue 已复验，跨来源验收见限制 |
| AS-08 | 详情滚动 | 名称与正文一起滚动 | 名称固定，正文独立滚动，切换断言重置；正文scrollTop180时名称y保持222；切换后scrollTop0 | Vue 已复验，跨来源验收见限制 |

- **AS-A1 旧Design与最新Make的尺寸冲突**：878:1399是旧脚本断言截图，名称28/7、开关28×14；本次使用32/8、32×16。依据：`user-decision`，用户在本次前的审查建议后回复：可以 对齐这些差异；该建议明确包含名称32px/8px和开关32×16。
- **AS-A2 删除默认红色**：Make默认灰色、hover红色；Vue始终红色。依据：`user-decision`，此前用户确定接口表格删除按钮默认红色的统一风格，本次未撤销。
- **AS-A3 删除最后一项保留空白行**：Make可删除至零项；Vue沿用真实编辑器的至少一行规则。依据：`business-constraint`，src/widgets/api-interface-workspace/lib/useApiAssertionWorkspace.ts 中 removeAssertionItem 的 fallback 规则；本次只做视觉修改。
- **AS-A4 响应体行快速提取**：保留真实业务入口，未运行禁用，有响应启用并可打开抽屉。依据：`user-decision`，用户明确更正：操作列的快速提取按钮我没说去掉啊；本次仍保留。

## 变体与实际验证

以下8行覆盖6类断言；三个响应体方式分别验证。数值详见 `measurements-final.json`。

| 变体 | 名称 | 表格/条件框 | 行操作 | 截图 |
| --- | --- | --- | --- | --- |
| 响应头断言 | 32px / 8px | 12px / 124px | 新增、复制、删除末行保留1行 | 响应头断言.png |
| 响应体断言 · JSONPath | 32px / 8px | 12px / 124px | 新增2行→复制3行→删除2行 | body-JSONPath.png |
| 响应体断言 · XPath | 32px / 8px | 12px / 124px | 新增2行→复制3行→删除2行 | body-XPath.png |
| 响应体断言 · Regex | 32px / 8px | 12px / 124px | 新增2行→复制3行→删除2行 | body-Regex.png |
| 变量断言 | 32px / 8px | 12px / 124px | 新增、复制、删除末行保留1行 | 变量断言.png |
| 状态码断言 | 32px / 8px | 非表格变体 | 共用名称/开关回归 | 状态码断言.png |
| 响应时间断言 | 32px / 8px | 非表格变体 | 共用名称/开关回归 | 响应时间断言.png |
| 脚本断言 | 32px / 8px | 非表格变体 | 共用名称/开关回归 | 脚本断言.png |

- 运行前后5种表格布局均复验；运行后截图 `current-final-响应头断言 1.png`、`current-final-JSONPath.png`、`current-final-XPath.png`、`current-final-Regex.png`、`current-final-变量断言 3.png`。1280宽下表头clientWidth/scrollWidth均674，无隐式溢出列。
- 1024宽窄屏：表格局部clientWidth434、scrollWidth580，横向滚动局限表格；整页clientWidth/scrollWidth均1024。
- 新增/复制/删除按钮、三种方式切换、最长比较条件、开关双向切换、正文滚动和切换重置均实际操作；数据见 `interactions.json`、`measurements-final.json`。
- 键盘 Enter 可触发底部添加项。程序focus时实测outline仍由系统重置为none，不把新CSS声明当成独立焦点视觉已生效。
- 快速提取：无响应时禁用；真实响应后启用，点击可打开原有抽屉。仅确认入口/打开，未修改其确认回填逻辑；截图 `quick-extraction.png`。
- 输入值经过 blur/切换断言后仍参与真实发送。后端8080调用临时Python本地HTTP服务返回200；响应头当前值application/json、JSONPath当前值[\"0\"]可见。使用新建未保存草稿，没有保存接口定义或修改环境。
- 初次运行使用空行/长度条件导致断言FAILED，之后补上明确Header和JSONPath并重发返回SUCCESS；未伪造成功响应。临时服务器仅用于本次验证，验证完关闭。
- Hover/Focus/Blur/Active/Disabled：以上Vue状态已按实际操作记录，Make在线状态均未验证。Loading/Success/Failure：Make表格组件没有异步保存或加载分支；Vue仍由上层真实发送流程负责，未新增模拟状态。因为预览不可用，不把这些源状态登记为已完整验证的not-expressed。

## 检查与限制

- `npm run typecheck`：通过。
- `npm run build`：通过（包含vue-tsc）；已有VueUse PURE annotation和chunk体积警告。
- 目标增量 `git diff --check`：通过；UTF-8解码通过，修改文件无BOM、无U+FFFD，关键中文文案完整。
- 修复样式加载后浏览器控制台Errors0/Warnings0。
- 默认态和运行后截图已人工查看；缺少当前Make在线配对截图，不把Vue实测或源码目标值视为四方叠加验收。

- **AS-U1 Make在线预览当前状态**：连接用户Chrome CDP 9222超时；本轮未刷新或重启用户浏览器，因此不能确认在线预览与所给本地源码一致。
- **AS-U2 表格变体Design/Make/Vue同视口配对与叠加验收**：本轮成功取得878:1399脚本断言节点和截图，节点不含三组表格；其余表格依据最新Make源码实施，未取得本轮配对预览截图，不声明像素级完整验收。
- **AS-U3 XPath、Regex、变量非空实际值的完整后端执行**：本次真实本地HTTP验证覆盖响应头application/json和JSONPath [\"0\"]；XPath/Regex及未配置变量在当前值列仅检查了—的布局，不代表其表达式解析与变量解析已完成回归。

机器可读局部差异和自动汇总见 `assertion-tables-20261019.audit.json`；该文件是本次人工审查数据，不是alignment-check v2模板，不用于宣称自动像素验收通过。
