# 接口请求设置对齐记录（2026-10-19，实施前基线）

范围：设置Tab正常、加载中、保存中，以及实际编辑权限、输入校验、恢复默认交互。按模块级流程核对；保留已有未提交工作。不修改环境配置或其他请求Tab。

来源：
- Design画布984:14120，本次为最新内容：正常1042:19571；加载1042:19626（image 1）；保存中1042:19628。均已取得context及1614×294原尺寸截图，证据在output/playwright/settings-20261019/。
- Make源码：设计/figma-ai-make最新代码20261016/src/app/ApiWorkbenchExtras.tsx，TimeoutStepper:1490附近，SettingsPanel:1599附近；App.tsx使用该组件。
- Make预览：s6EkOuJNJHLFYP5CTAdQNf，9222发现未获得可操作页面，本轮在线状态暂未验证。
- Git基线7437daa535b8053a5386f0f484b0f37bd1759c00；目标文件存在历史修改时按当前内容增量编辑。
- 当前Vue截图before.png：旧元信息表单，只有超时时间字段；没有连接超时、重定向和局部三态。
- Vue浏览器基线：独立Playwright assertion-fix，1280×720，DPR1；计划按Design内容宽1614另采配对截图。
- 目标：ApiRequestSettingsPanel.vue及专属样式，配置面板与主编辑器状态透传，类型/序列化/请求默认值，后端请求配置和执行透传，针对新增执行行为的测试。
- 新字段落在既有request JSON内，无需数据库schema迁移。旧数据缺失连接字段保留原10秒连接超时，缺失跟随开关保留原NORMAL行为。新请求/恢复默认采用Make的30秒连接、60秒响应、跟随开启。响应超时继续沿用timeoutMs，不新增同义字段。

## 实施前差异清单

| ID | 项目 | 当前 | Design / Make目标 |
| --- | --- | --- | --- |
| SET-01 | 信息布局 | 大号元信息表单/外框 | 16px内边距；超时/重定向/恢复默认紧凑分组，无外框 |
| SET-02 | 超时 | 单个180px输入框 | 连接、响应两个120×28px步进框，间隔24px，1000ms步长/下限 |
| SET-03 | 字体和色彩 | 大标题、说明、标签等 | 分组标题12px灰，字段12px深灰，重定向13px黑，说明11px浅灰 |
| SET-04 | 重定向 | 无控件，执行固定NORMAL | 14px复选框，开启/关闭实际生效 |
| SET-05 | 恢复默认 | 无 | 行内按钮→确认/取消，确认后恢复三个默认值 |
| SET-06 | 加载 | 整体通用骨架 | 设置专属骨架：72×12、两条120×28、48×12、110×16 |
| SET-07 | 保存中 | 未接入局部状态 | 字段/步进/复选框/恢复按钮禁用，无额外保存按钮 |
| SET-08 | 无权限/校验 | 无局部限制 | 复用实际编辑权限，不设计环境强锁；数值blur提交，低于1000归一化 |
| SET-09 | 数据/执行 | 仅总超时，连接/跳转写死 | JSON保存回读、草稿调试、前置处理后仍保留两个新字段 |

Make状态代码：Hover（步进按钮/恢复默认变蓝）、Focus（步进外框蓝）、Blur（提交数值）、Active（复选框/步进）、Disabled（saving/no-permission）、Loading（骨架）均有表达；Success/Failure没有设置组件专属分支，实际沿用现有保存反馈，不引入假成功/演示状态按钮。预览未验证的部分保留未验收。

真实保存沿用接口编辑器现有保存入口；设置改变即写入当前草稿并参与发送，持久化由现有接口保存完成。本次不把Make演示数组当自动保存接口，也不增加另一套保存请求。

## 实施结果与最终验收

结论：`partial-alignment`。已处理已知差异9项，明确保留3项；已知差异未解决0项，另有2项未验收。数量来自相邻audit.json的数组，不表示整个接口编辑器已完整验收。

### 浏览器复验

- Vue最终证据视口1920×796、DPR1、缩放100%、字体loaded；截取目标区域均为1614×294，与三张Design原尺寸一致。三态源码修改后均重新采集。
- `vue-states.json`记录了正常/加载/保存各元素实际box、color、background、font、disabled和aria-busy。
- 三张`overlay-*.png`、`difference-*.png`已人工查看。加载骨架实测与Design主要形状位置一致，数值/文本采用实际控件。
- Figma导出PNG带#F5F5F5画布背景，Design context根节点本身透明，Vue实际面板为白色；差异图仅排除了“source纯245灰且Vue纯255白”的公共空白像素，没有改动原图或删除控件差异。其余非零像素保留，详见visual-comparison.json；这不是零差异证明。
- Make当前在线预览可通过OOPIF CDP读取并点击状态预览：正常8个控件可操作、加载无控件、保存8个控件禁用。代码行号比本地Make导出偏后；目标Settings规则核对一致，在线DOM和实测值另存make-states.json及make-*.html，不把本地版本当成线上完整文件一致的证据。
- Make进一步实测：plus hover蓝、增加连接超时至31000、取消恢复保留31000、取消重定向后checkbox=false、确认恢复回到30000/60000/true。结果make-interactions.json。
- 预览截图尝试超时后，恢复了原先记录的预览viewport1920×896（顶层1920×945，含49px预览工具栏）和原“加载中”演示态，未刷新预览页面、未动用户本地页面草稿。
- Vue loading通过临时延迟真实GET触发，saving通过延迟真实PUT触发；没有给产品加入“状态预览”按钮。
- Vue已验证：1000ms下限、步进、blur/Enter提交、无效文本回退、恢复默认确认/取消、hover、focus动画完成后蓝边、成功解除禁用。
- 保存失败验证使用**仅测试浏览器**的HTTP500拦截；保留32000输入、aria-busy=false、控件重新启用，未伪造真实后端故障或成功。
- 真实本地HTTP调试：开启跟随得到200、关闭保留302；保存后GET回读31000/61000/false。没有改任何用户已有接口。
- 临时测试接口1588和后续截图接口均已删除，删除HTTP200；接口列表查询剩余0。临时Python服务器已关闭。

### 逐项处理

| ID | 项目 | 最终结果 | 证据 |
| --- | --- | --- | --- |
| SET-01 | 紧凑布局 | 16px；三态同尺寸1614×294，周边请求栏和响应区保持 | vue-states.json / overlay-normal.png |
| SET-02 | 双超时步进框 | 两个120×28px，x16/x160、y68；步长和下限已验证 | vue-states.json / interaction-results.json |
| SET-03 | 字体/颜色/间距 | 采用Make对应字体和行高，灰/黑/浅灰及disabled色实测 | make-states.json / vue-states.json / overlay-normal.png |
| SET-04 | 自动跟随重定向 | 开200，关302，配置走实际debug-run和真实本地HTTP | interaction-results.json |
| SET-05 | 恢复默认 | 取消保留34567，确认恢复三值；hover蓝 | interaction-results.json / make-interactions.json |
| SET-06 | 加载骨架 | 五块尺寸/位置匹配，真实GET延迟时呈现，响应区保留 | vue-states.json / overlay-loading.png / difference-loading.png |
| SET-07 | 保存中 | 真实PUT pending时8个控件均disabled，成功/失败后解除 | vue-states.json / overlay-saving.png / interaction-results.json |
| SET-08 | 权限透传/输入提交 | 保存中及canEdit=false禁用，新草稿按创建权限；blur/Enter/无效值回退已实测，未新建角色模型 | ApiRequestEditorMain.vue / ApiRequestSettingsPanel.vue / ApiRequestTimeoutInput.vue / interaction-results.json |
| SET-09 | 保存与执行字段闭环 | JSON存储回读及执行链路透传；9项后端测试通过；响应超时继续用既有timeoutMs | ApiRequestExecutionSupportTests / ApiRequestSettingsIntegrationTests / interaction-results.json |

- **SET-A1 旧数据保持原行为**：旧记录没有connectTimeoutMs时仍按10秒连接、followRedirects缺失仍NORMAL；已有响应超时原值保留。新建和恢复默认才使用30秒/60秒/true。 接受依据：`business-constraint`；原ApiRequestExecutionSupport的10秒连接和Redirect.NORMAL默认，以及已有requestConfig.timeoutMs；不批量改写真实配置。
- **SET-A2 数值上限**：输入上限2147483647，超范围归一化；Make示例没有该上限。 接受依据：`business-constraint`；ApiAutomationModels.ApiRequestConfigInput 的两个超时字段类型为Java Integer。
- **SET-A3 原生文本与控件渲染**：Design由Copy design生成的文字/控件轮廓与浏览器真实输入、checkbox有抗锯齿差异；已按Make实际字体、颜色、布局渲染，未把静态图贴到UI代替功能。 接受依据：`business-constraint`；设置必须保持真实可编辑、可聚焦、可禁用；本项目要求保留真实业务组件与控件，Design get_design_context返回该区域大量vector/mask而非可编辑文本。

响应超时继续对应既有`timeoutMs / HttpRequest.timeout`语义，不额外引入流式读取空闲超时设置。沿用接口上方保存入口：设置写入当前草稿即可参与调试，持久化随接口保存；本次没有另造设置自动保存接口，也没有在设置区域添加保存按钮。既有元信息不再堆在设置Tab，其原数据仍保留在detail及保存payload中。

### 修改文件

- UI：ApiRequestSettingsPanel.vue；新增ApiRequestTimeoutInput.vue；专属api-request-settings-panel.css；ApiRequestConfigurationPanel.vue和ApiRequestEditorMain.vue透传saving/权限，加载时保留响应区；api-request-editor-main.css取消设置Tab额外padding。
- 前端数据：entities/api-automation/model/types.ts、api/apiAutomationApi.ts、lib/useApiRequestDraftWorkspace.ts。
- 后端：ApiAutomationModels.java、ApiExecutionRuntimeModels.java、ApiExecutionEngineSupport.java、ApiRequestExecutionSupport.java、ApiScenarioDomainService.java。
- 测试：ApiRequestExecutionSupportTests.java新增4个行为测试；新增ApiRequestSettingsIntegrationTests.java。

旧.api-settings-panel样式保留给既有只读用例详情；新UI用.api-request-settings命名，避免改动另一个页面。

### 代码/服务检查

- `npm run typecheck`通过；最终`npm run build`通过，只有既有VueUse注解/chunk体积警告。
- 后端`ApiRequestExecutionSupportTests`8项，`ApiRequestSettingsIntegrationTests`1项：全部通过，无失败/错误/跳过；前者含原有4项和新增4项。
- 新测试覆盖所有5类认证路径的重定向开关、客户端连接超时、旧字段默认值、实际慢响应中止、处理器映射透传、配置持久化更新。
- 后端compile/package通过。Windows原JAR占用导致首次repackage失败，确认8080进程是本项目JAR后停止，重新打包并恢复local-mysql服务。后端8080、前端4173、MySQL3306恢复正常。重启导致旧登录会话失效，测试浏览器重新登录后继续验证。
- 本次目标git diff --check通过；UTF-8解码、无BOM、无U+FFFD、关键中文均检查通过；未做整文件格式化或回退已有修改。

### 未验收

- **SET-U1 Make在线同视口截图**：已通过CDP读取并操作真实Make三态、hover事件、加减、重定向及恢复默认，但顶层Page.captureScreenshot超时，未取得最新Make配对PNG。Design/Vue的三态配对、叠加及差异图已查看；不能据此宣称四方像素完全一致。
- **SET-U2 Make原型原生Focus与实际只读账户**：Make CDP element.focus未出现源码所写蓝边，不能把该触发认定为真实Focus通过；Vue在150ms动画结束后蓝边已实测。canEdit=false逻辑已接入，未用另一真实只读账户做端到端权限回归（本次Design仅要求正常/加载/保存三态）。

后续若要求“四方完全对齐”，需要补齐上述在线截图及Focus/只读账户回归；现有结果只针对本次三态UI和已测真实保存/调试链路。
