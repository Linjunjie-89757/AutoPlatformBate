# 接口目录树阶段 6 上线清单

## 目标

阶段 6 只处理目录树优化的上线准备，不调整 Figma 视觉。验收目标是迁移可控、工作区隔离可靠、异常可恢复、性能可观测。

## 部署前

1. 备份业务数据库，并记录备份文件、数据库版本和 Flyway 当前版本。
2. 确认 `flyway_schema_history` 最新版本不高于 `88`，且没有失败记录。
3. 统计 `tb_api_definition`、`tb_api_definition_module` 行数，并保存以下校验结果：
   - `module_id IS NULL` 的接口数量。
   - 每个工作区的接口数量。
   - 每个工作区的目录数量。
4. 在测试环境先执行 `V89`、`V90`，确认索引和 `module_id` 字段创建成功。
5. 部署应用后触发一次目录根节点查询，确认旧数据目录绑定完成且总数不变。

## 迁移内容

- `V89`：增加接口目录和目录父子查询所需的复合索引。
- `V90`：增加 `tb_api_definition.module_id` 及其复合索引。
- 应用首次读取目录时，只为 `module_id IS NULL` 的旧数据补齐目录绑定，不覆盖已有绑定。

## 回滚

代码可以直接回滚到上一版本；数据库结构默认保留，因为旧代码会忽略新增字段和索引。

只有确认必须恢复数据库结构时才执行：

```sql
DROP INDEX idx_api_definition_workspace_module_updated ON tb_api_definition;
ALTER TABLE tb_api_definition DROP COLUMN module_id;
DROP INDEX idx_api_definition_workspace_directory_updated ON tb_api_definition;
DROP INDEX idx_api_definition_module_workspace_parent_sort ON tb_api_definition_module;
```

回滚前必须再次备份。删除 `module_id` 会丢失已补齐的目录绑定关系，因此优先采用“回滚代码、保留兼容字段”的方案。

## 监控

目录树相关接口会输出结构化耗时日志：

- 正常请求：`DEBUG`
- 超过阈值的慢请求：`WARN`
- 4xx 拒绝请求：`WARN`
- 5xx 或未处理异常：`ERROR`

默认慢请求阈值是 `500ms`，可以通过以下配置覆盖：

```properties
app.api-directory.observability.slow-request-ms=500
```

日志不记录搜索关键词，只记录长度；记录工作区、分页、模块 ID、父目录 ID、状态码和耗时。

建议告警线：

- 目录根节点、展开目录 P95 大于 `500ms`，持续 5 分钟。
- 全局搜索 P95 大于 `800ms`，持续 5 分钟。
- 目录树接口 5xx 比例大于 `1%`。
- 数据库慢查询超过 `1s`。

## 验收

- 首次进入只请求根目录和根级接口，不请求整棵树。
- 展开工作区不发请求；展开目录只请求直接子节点。
- 点击叶子目录只加载当前目录的接口。
- 快速连续搜索只展示最后一次搜索结果。
- 搜索结果打开后，清空搜索仍保留目标完整路径。
- 创建、重命名、删除目录后只局部刷新，不请求旧整树接口。
- 切换工作区后旧请求结果不能覆盖新工作区。
- 当前工作区不能读取其他工作区的目录、接口或搜索结果。
- 网络失败后可再次搜索或展开，不需要刷新页面。

## 数据量升级判断

当前方案以分层懒加载为主，不引入虚拟树。只有单个已展开分支稳定超过 500 个可见节点，并且浏览器渲染仍成为主要瓶颈时，再评估虚拟树组件。
