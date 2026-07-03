# Web UI 录制一期验收记录

验收日期：2026-07-03

## 结论

Web UI 录制一期可以按“平台侧控制 + HTTP 轮询 + Local Runner 录制引擎”的范围视为功能闭环。

本阶段已经覆盖录制开始、暂停、继续、撤销、结束、步骤生成、草稿恢复、保存后本地回放、失败诊断、断言补充、质量检查、录制元素候选采集与重新匹配。浏览器悬浮面板、WebSocket 实时同步、更多复杂操作类型和 AI 智能优化不属于一期验收范围，继续放到后续目标包。

## 已验证能力

| 能力 | 结论 | 验收依据 |
| --- | --- | --- |
| 开始录制 | PASS | `recording.integration.test.mjs` 覆盖页面输入、下拉和点击录制 |
| 暂停 / 继续 | PASS | `recording.integration.test.mjs` 覆盖 pause/resume 后继续追加步骤 |
| 撤销上一步 | PASS | `recording.integration.test.mjs` 覆盖 undo 后步骤栈正确回退 |
| 停止并保留步骤 | PASS | 录制会话释放中断后步骤仍可取回 |
| 输入防抖和重复点击去重 | PASS | `deduplicates noisy input and repeated clicks while recording` |
| 草稿恢复 | PASS | `web-ui-recording-draft.test.ts` 覆盖版本匹配、过期和回放入口判断 |
| 保存兼容步骤 | PASS | `web-ui-recorded-steps.test.ts` 覆盖录制步骤到用例步骤的映射和非法步骤过滤 |
| 元素候选采集 | PASS | 未匹配录制定位器可转换为采集候选，重复和无效候选会被过滤 |
| 已有元素重匹配 | PASS | 按定位器上下文精确匹配，避免跨页面误绑定 |
| 保存后本地回放入口 | PASS | 只对存在录制改动的有效草稿提供本地回放 |
| 回放失败诊断 | PASS | `web-ui-recording-replay-diagnostics.test.ts` 覆盖失败步骤定位和问题分类 |
| 回放修复建议 | PASS | 定位问题生成候选，等待问题生成超时调整建议 |
| 快速补断言 | PASS | `web-ui-recording-assertions.test.ts` 覆盖可见、文本和 URL 断言 |
| 质量检查 | PASS | `web-ui-recording-quality.test.ts` 覆盖断言、元素绑定、脆弱定位器、等待风险和回放结果 |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `node --test tests/web-ui-recording-quality.test.ts tests/web-ui-recording-assertions.test.ts tests/web-ui-recording-replay-diagnostics.test.ts tests/web-ui-recording-draft.test.ts tests/web-ui-recorded-steps.test.ts tests/local-runner-client.test.ts` | PASS，34 tests |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run runner:test` | PASS，118 tests |

## 非无头冒烟记录

执行时间：2026-07-03

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| Runner 有头录制状态机 | PASS | Runner 打开可见 Chromium 测试页，`START -> PAUSE -> RESUME -> UNDO -> STOP` 通过；停止后保留 `FILL / SELECT / CLICK` 三步 |
| 暂停期间不新增步骤 | PASS | 暂停前 3 步，暂停状态查询仍为 3 步 |
| 平台用例列表加载 | PASS | 当前仓库后端 `8080` + 前端 `5174` 下，Web UI 用例列表正常展示 4 条用例 |
| 平台详情录制控制台 | PASS | 用例详情可见“打开目标页 / 开始录制 / 撤销上一步 / 同步状态 / 停止并生成步骤 / 采集当前页 / 候选入库 / 重新匹配” |
| 平台侧开始 / 停止录制 | PASS | 选择带起始地址的用例，平台点击“打开目标页”后可“开始录制”，状态进入录制中，“停止并生成步骤”启用，停止后回到停止/空闲状态 |

本次冒烟中发现机器上同时存在两个后端进程：`8081` 指向旧目录 `D:\自动化测试平台开发\backend`，会导致 Web UI API 返回 404；当前仓库后端在 `8080`，前端需要使用 `VITE_API_BASE_URL=http://localhost:8080/api`。这不是录制功能问题，但后续本地验收要注意端口指向。

## 一期边界

一期重点是让录制从“能录”进入“可控、可恢复、可回放、可判断质量”的状态。当前闭环仍然基于平台侧按钮控制和 Runner HTTP 接口轮询，不包含浏览器内悬浮控制面板，也不要求 WebSocket 实时推送。

本阶段默认用户录完后仍需要在平台侧做一次确认，包括补充必要断言、检查候选元素是否应入库、确认本地回放结果是否可信。系统已经提供质量检查和诊断提示，但不会替代用户对业务流程本身的判断。

## 剩余风险

| 风险 | 影响 | 建议 |
| --- | --- | --- |
| 未做真实业务页面人工全流程验收 | 自动化测试覆盖录制引擎和前端工具逻辑，但不能覆盖所有业务页面交互差异 | 用一个真实登录后流程做一次可视化冒烟 |
| 复杂控件录制仍需扩展 | 文件上传、hover、弹窗、复杂 iframe 组合等场景可能需要专项适配 | 放入二期“操作类型扩展包” |
| 无浏览器悬浮面板 | 暂停、撤销需要回平台操作，连续录制体验不如浏览器内控制 | 放入二期“悬浮面板体验包” |
| HTTP 轮询存在轻微延迟 | 一期可接受，但大量并发录制时体验可能下降 | 用户量上来后再升级 WebSocket |

## 下一步建议

1. 做一次真实业务页面的录制人工冒烟，确认平台页面、Runner 浏览器窗口和保存后回放的实际体验。
2. 进入二期前，优先补“复杂操作类型扩展包”：文件上传、hover、弹窗确认、复选框 / 单选框细节。
3. 体验增强再做浏览器悬浮面板，提供浏览器内暂停、继续、结束、撤销和快速加断言。
