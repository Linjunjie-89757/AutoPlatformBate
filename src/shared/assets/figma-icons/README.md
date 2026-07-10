# Figma SVG Icons

本目录维护从 Figma 设计稿提取并落地到项目内的 SVG 图标资产。

## 维护规则

- Figma MCP 已返回明确 SVG asset 的图标，优先下载到本目录维护，不在业务代码中直接引用 Figma 远程 asset URL。
- 页面迁移时不要用 Element Plus / lucide 图标近似替代 Figma SVG，除非设计稿没有提供对应 SVG asset。
- 页面专用图标按业务域分目录；跨页面复用后再上提到通用目录。
- 新增图标时，需要在对应目录 README 或本文件记录来源页面、Figma node-id 和使用位置。

## 当前资产

- `config-center/db/*`
  - 来源：Figma `自动化测试平台设计`，数据库配置页 `node-id=1:1155`
  - 使用位置：配置中心 / 数据库配置
  - 内容：数据库类型圆柱图标、数据库配置操作列图标
- `config-center/ai/*`
  - 来源：Figma `自动化测试平台设计`，AI 连接配置页 `node-id=1:2640`、服务商选择抽屉 `node-id=21:3536`、编辑抽屉 `node-id=21:4084`、模型管理抽屉 `node-id=21:4696`、测试结果弹窗 `node-id=21:5284`
  - 使用位置：配置中心 / AI 连接配置
  - 内容：AI 连接配置操作列图标、筛选图标、Key 状态图标、抽屉关闭/保存/测试/眼睛图标、用途配置图标、测试结果图标
