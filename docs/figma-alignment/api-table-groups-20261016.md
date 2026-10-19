# 接口管理表格局部对齐记录

日期：2026-10-16

范围：Body 表单参数表、Headers/Cookies、接口定义与请求体 Schema 表。Params 已有样式不在本次修改范围内，断言和前后置处理器不在范围内。

## 修改前差异

| 区域 | 当前 Vue 实测 | Make 源码观察 | 处理 |
| --- | --- | --- | --- |
| Body 表单 | 表头 31px、数据行 34.5px、添加行 32px；容器 342px，单行后仍被撑满 | 与 Params 同属参数表，内容行结束后不应保留无意义空白 | 采用 Params 的 33px / 37.5px / 34px 节奏，容器内容自适应并保留超出滚动 |
| Headers | 表头 31px、数据行 34.5px、添加行 32px；容器 387px | Make 参数表为紧凑表格，添加行紧跟数据 | 采用 Params 的基础表格节奏和内容自适应 |
| Cookies | 与 Headers 共用参数表结构，仍为旧节奏 | 与 Headers 使用同一表格语言 | 与 Headers 同步 |
| 请求体 Schema | 表头 31px、数据行 34.5px | Make Schema 表格使用稳定的表头和行高，不使用字段背景标签 | 同步表头/行高和复选框尺寸，不改变字段列和编辑能力 |
| 接口定义 Schema | 表头 31px、数据行 34.5px | Make 定义表使用同一紧凑表格节奏 | 同步表头/行高，保留只读结构和字段语义 |

## 验收矩阵

| 变体 | 表头 | 数据行 | 添加/边界 | 交互 |
| --- | --- | --- | --- | --- |
| Body form-data | verified | verified | verified | 切换、添加、删除已操作 |
| Body x-www-form-urlencoded | verified | verified | verified | 切换已操作，尺寸一致 |
| Headers | verified | verified | verified | 添加已操作；删除和启用沿用原事件 |
| Cookies | verified-by-shared-component | verified-by-shared-component | verified-by-shared-component | 与 Headers 共用 ApiKeyValueTable，未单独存在请求 Cookies 编辑页 |
| 请求体 Schema | verified | verified | n/a | Schema 切换和字段编辑结构保留 |
| 接口定义 Schema | verified | verified | n/a | 定义页已实测无字段时保持空状态 |

浏览器验证：Chromium，localhost:4173，2026-10-16。Body 表单实测表格为 `33 / 37.5 / 34px`，Headers 无数据时为 `69px`、有一行时为 `106.5px`；请求体 Schema 与接口定义 Schema 表头/数据行为 `33 / 37.5px`。截图证据：`output/playwright/api-schema-after.png`。

限制：Make 预览本轮通过源码和现有浏览器基线核对，未重新获取远程预览的每个动态状态；大量数据滚动仅以 CSS `max-height: 100%` 和 `overflow: auto` 保留，未生成大数据集逐行截图。
