# 响应区页签颜色核对（2026-10-19）

范围：接口管理响应内容区域的响应体、Headers、Cookies、断言结果，仅修改默认/选中/悬停颜色。使用小范围对齐流程。

来源：`设计/figma-ai-make最新代码20261016/src/app/App.tsx:6338`。选中项文字及底边框使用 `T.warning=#FF7D00`，未选中项使用 `T.t3=#86909C`。Make在线get_design_context可返回源码资源列表；本轮未取得该区域独立Design节点，也未操作在线预览，不宣称完整四方验收。

目标文件：`src/widgets/api-interface-workspace/ApiResponsePanel.vue:380`。变更前该文件无本地修改，本次仅增量修改3行；同目录其他未提交工作均保留。现有tokens.css已提供同色的app-warning、app-text-muted，直接复用。

| 项目 | 修改前 | 来源目标/浏览器实测 |
| --- | --- | --- |
| 选中文字 | #165DFF | #FF7D00 / rgb(255,125,0) |
| 选中下划线 | #165DFF | #FF7D00 / rgb(255,125,0) |
| 未选中悬停 | #4E5969 | #86909C / rgb(134,144,156) |
| 未选中默认 | #86909C | #86909C，保留 |

浏览器逐个切换四个页签，检查选中颜色、底边框和未选中hover，均符合上述Make源码。实测1280×720、DPR1；字号12px、字重500、原有尺寸及切换事件保持。四个页签截图及修改前对照位于 `output/playwright/response-tabs-20261019/`。断言结果裁剪截图已人工查看。

检查：`npm run typecheck`通过；`git diff --check`通过。只改scoped CSS，未新增测试或修改后端。

限制：当前结论为源码与Vue颜色局部已验证；Make在线预览、独立Design颜色及共享编辑器在用例抽屉入口的单独浏览器复验未完成。本次不覆盖响应区整体尺寸/布局，也不宣称整页已对齐。
