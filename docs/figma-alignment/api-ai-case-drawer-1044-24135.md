# AI 生成接口用例抽屉对齐记录

- Design：`jSUUPxC4PVD9Kp2FUydfox:1044:24135`
- Design 截图：`output/figma-ai-case-drawer-1044-24135.png`
- Make 源码：`设计/figma-ai-make最新代码20261016/src/app/ApiAiGenerationDrawer.tsx`
- Vue 组件：`src/widgets/api-interface-workspace/ApiAiGenerationDrawer.vue`
- 关联宿主：`src/widgets/api-interface-workspace/ApiAiCaseModule.vue`
- 记录时间：2026-10-20 Asia/Shanghai

## 差异与处理

| 项目 | Make / Design 目标 | Vue 处理 | 状态 |
| --- | --- | --- | --- |
| 抽屉标题 | AI 图标、标题、方法/路径/名称上下文、关闭按钮 | 增加标题图标、方法颜色标签、路径与接口名称 | implemented, browser-unverified |
| 类型选择 | 顶层全选、已选/总数；四组分组卡片、两列复选框 | 增加顶层全选和计数；分组卡片、分组全选、两列布局 | implemented, browser-unverified |
| AI 模型 | 加载中、无模型和正常选择分支 | 无模型/加载时不渲染可选下拉框，显示对应提示 | implemented, browser-unverified |
| 补充要求 | 可选标记、输入提示、字数限制 | 增加可选标记、1000 字限制、字数统计 | implemented, browser-unverified |
| 操作区 | 生成按钮固定在抽屉底部 | 使用 drawer footer，正文单独滚动 | implemented, browser-unverified |
| 失败态 | 错误提示和重新生成语义 | `generationStatus === 'failed'` 显示错误 banner，按钮显示重新生成 | implemented, browser-unverified |

## 业务保留

- 仍由 `ApiAiCaseModule` 的真实 `submit` 事件创建生成任务。
- 仍要求已保存接口、已选择类型和可用 AI 模型，未改变 `canGenerate` 约束。
- 未移植 Make 的演示状态切换器或模拟模型数据。

## 验证

- `npm run typecheck`：通过。
- `git diff --check`：通过；仅报告既有文件的换行转换提示。
- 4173 端口：已有 Vite 进程监听。
- 真实浏览器：访问 4173 时当前会话停在登录页，未取得登录凭据，抽屉默认/加载/失败状态暂未完成浏览器截图复验；不得据此宣称像素级完成。
