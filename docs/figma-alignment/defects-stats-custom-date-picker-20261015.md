# 缺陷统计自定义日期选择器对齐记录

## 范围

- 页面：缺陷管理 / 统计视图
- Design：`jSUUPxC4PVD9Kp2FUydfox:979-13102`
- Make 源码：`设计/figma_make代码最新20261013/src/app/BugsModule.tsx:1161-1190`
- 当前代码：`src/pages/defects/DefectsPage.vue`、`src/widgets/defect-filter-panel/DefectFilterPanel.vue`
- 明确保持不变：统计页左上角筛选项仍为「全部 / 本周 / 本月 / 自定义」；本轮只调整自定义日期选择器。

## 差异登记

- `DATE-001`：统计页自定义日期选择器此前未实现；缺陷列表已有 Element Plus 日期范围控件，但快捷项缺少「上月」。
- `DATE-002`：统计页日期选择器需要与列表控件保持同一宽度、尺寸、日期边界和快捷项。

## 实施

- 抽取 `src/entities/defect/lib/dateShortcuts.ts`，列表和统计页共用五项快捷日期：近 7 天、近 30 天、本月、上月、本年度。
- 统计页保留 Make 的四个时间范围按钮；选中「自定义」后显示同一日期范围控件配置。
- 统计接口接收 `createdFrom`、`createdTo`，状态、严重程度、负责人和趋势使用同一日期范围；请求结果按序号防止旧请求覆盖新选择。
- 「上月」使用自然月边界，例如当前为 2026 年 10 月时返回 `2026-09-01` 至 `2026-09-30`。

## 验证

- 浏览器：`http://localhost:4173/bugs`，viewport `1920x945`，DPR `1`。
- 默认统计按钮显示「全部 / 本周 / 本月 / 自定义」。
- 点击「自定义」后快捷项实际显示五项；点击「上月」后输入值为 `2026-09-01` 至 `2026-09-30`。
- 统计日期控件 bounding box：`236x32px`；缺陷列表日期控件 bounding box：`236x32px`。
- 请求证据：浏览器观察到 `/api/bugs/statistics?createdFrom=...&createdTo=...`。
- 截图：[defects-stats-custom-date-picker.png](../../output/playwright/defects-stats-custom-date-picker.png)
- `npm run typecheck`：通过。
- `npm run build`：通过；保留既有 `@vueuse/core INVALID_ANNOTATION` 和 bundle size 警告。
- `./mvnw.cmd -q -Dtest=BugControllerIntegrationTests#statisticsAggregatesBugCountsByStatus test`：通过。
- `git diff --check`：通过；输出仅包含仓库既有 LF/CRLF 警告。

## 限制

- 本地 8080 当前运行的是此前已打包的 `local-mysql` JAR，因此浏览器请求参数已验证，但正在运行的旧服务不会反映本轮新后端筛选逻辑；新逻辑已通过 H2 集成测试验证。
- Make 预览仍受此前 Figma 登录页阻塞，本轮使用 Make 源码的四项筛选定义和 Design 范围核对静态入口；未将预览阻塞描述为已验证。

## 结论

本轮自定义日期选择器的代码、快捷项、尺寸和请求参数已验证；Make 预览和新后端 JAR 的运行态复验仍未完成，因此结论为局部已验证，不宣称整页完全对齐。
