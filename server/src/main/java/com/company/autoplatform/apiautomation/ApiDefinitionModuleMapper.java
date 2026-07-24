package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ApiDefinitionModuleMapper extends BaseMapper<ApiDefinitionModuleEntity> {

    @Select("""
            WITH RECURSIVE module_tree (id) AS (
                SELECT id
                FROM tb_api_definition_module
                WHERE id = #{moduleId}
                  AND workspace_id = #{workspaceId}
                UNION ALL
                SELECT child.id
                FROM tb_api_definition_module child
                INNER JOIN module_tree parent ON child.parent_id = parent.id
                WHERE child.workspace_id = #{workspaceId}
            )
            SELECT id FROM module_tree
            """)
    List<Long> selectSubtreeIds(
            @Param("workspaceId") Long workspaceId,
            @Param("moduleId") Long moduleId
    );

    @Select("""
            <script>
            WITH RECURSIVE roots (id, workspace_id, parent_id, module_name, sort_order) AS (
                SELECT id, workspace_id, parent_id, module_name, sort_order
                FROM tb_api_definition_module
                WHERE workspace_id IN
                <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                    #{workspaceId}
                </foreach>
                <choose>
                    <when test="parentId != null">AND parent_id = #{parentId}</when>
                    <otherwise>AND parent_id IS NULL</otherwise>
                </choose>
            ), module_tree (root_id, module_id, workspace_id) AS (
                SELECT root.id AS root_id, root.id AS module_id, root.workspace_id
                FROM roots root
                UNION ALL
                SELECT tree.root_id, child.id, child.workspace_id
                FROM module_tree tree
                INNER JOIN tb_api_definition_module child
                    ON child.workspace_id = tree.workspace_id
                   AND child.parent_id = tree.module_id
            ), module_counts (root_id, definition_count) AS (
                SELECT tree.root_id, COUNT(definition.id) AS definition_count
                FROM module_tree tree
                LEFT JOIN tb_api_definition definition
                    ON definition.workspace_id = tree.workspace_id
                   AND definition.module_id = tree.module_id
                GROUP BY tree.root_id
            )
            SELECT root.id,
                   root.workspace_id AS workspaceId,
                   root.parent_id AS parentId,
                   root.module_name AS moduleName,
                   root.sort_order AS sortOrder,
                   COALESCE(counts.definition_count, 0) AS definitionCount,
                   (SELECT COUNT(*)
                    FROM tb_api_definition direct_definition
                    WHERE direct_definition.workspace_id = root.workspace_id
                      AND direct_definition.module_id = root.id) AS directDefinitionCount,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM tb_api_definition_module child WHERE child.parent_id = root.id
                   ) THEN TRUE ELSE FALSE END AS hasChildren
            FROM roots root
            LEFT JOIN module_counts counts ON counts.root_id = root.id
            ORDER BY root.workspace_id, root.sort_order, root.id
            </script>
            """)
    List<ApiDefinitionModuleNodeRow> selectChildNodes(
            @Param("workspaceIds") List<Long> workspaceIds,
            @Param("parentId") Long parentId
    );

    @Select("""
            WITH RECURSIVE ancestors (id, parent_id, module_name, depth) AS (
                SELECT id, parent_id, module_name, 0 AS depth
                FROM tb_api_definition_module
                WHERE id = #{moduleId}
                UNION ALL
                SELECT parent.id, parent.parent_id, parent.module_name, child.depth + 1
                FROM tb_api_definition_module parent
                INNER JOIN ancestors child ON child.parent_id = parent.id
            )
            SELECT module_name FROM ancestors ORDER BY depth DESC
            """)
    List<String> selectAncestorNames(@Param("moduleId") Long moduleId);

    @Select("""
            <script>
            WITH RECURSIVE ancestors (
                id, workspace_id, parent_id, module_name, sort_order, created_at, updated_at
            ) AS (
                SELECT id, workspace_id, parent_id, module_name, sort_order, created_at, updated_at
                FROM tb_api_definition_module
                WHERE id IN
                <foreach collection="moduleIds" item="moduleId" open="(" separator="," close=")">
                    #{moduleId}
                </foreach>
                  AND workspace_id IN
                <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                    #{workspaceId}
                </foreach>
                UNION ALL
                SELECT parent.id,
                       parent.workspace_id,
                       parent.parent_id,
                       parent.module_name,
                       parent.sort_order,
                       parent.created_at,
                       parent.updated_at
                FROM tb_api_definition_module parent
                INNER JOIN ancestors child ON child.parent_id = parent.id
                WHERE parent.workspace_id IN
                <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                    #{workspaceId}
                </foreach>
            )
            SELECT DISTINCT id, workspace_id, parent_id, module_name, sort_order, created_at, updated_at
            FROM ancestors
            ORDER BY workspace_id, sort_order, id
            </script>
            """)
    List<ApiDefinitionModuleEntity> selectAncestorModules(
            @Param("workspaceIds") List<Long> workspaceIds,
            @Param("moduleIds") List<Long> moduleIds
    );
}
