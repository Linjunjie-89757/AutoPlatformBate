package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ApiDefinitionMapper extends BaseMapper<ApiDefinitionEntity> {

    @Select("""
            <script>
            SELECT workspace_id AS workspaceId,
                   directory_name AS directoryName,
                   COUNT(*) AS definitionCount
            FROM tb_api_definition
            WHERE directory_name IS NOT NULL
              AND TRIM(directory_name) &lt;&gt; ''
              AND module_id IS NULL
              AND workspace_id IN
              <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                  #{workspaceId}
              </foreach>
            GROUP BY workspace_id, directory_name
            </script>
            """)
    List<ApiDefinitionDirectoryCountRow> selectDirectoryCounts(@Param("workspaceIds") List<Long> workspaceIds);

    @Select("""
            <script>
            SELECT module_id AS moduleId,
                   COUNT(*) AS definitionCount
            FROM tb_api_definition
            WHERE module_id IS NOT NULL
              AND workspace_id IN
              <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                  #{workspaceId}
              </foreach>
            GROUP BY module_id
            </script>
            """)
    List<ApiDefinitionModuleCountRow> selectModuleCounts(@Param("workspaceIds") List<Long> workspaceIds);

    @Update("""
            UPDATE tb_api_definition
            SET module_id = #{moduleId}
            WHERE workspace_id = #{workspaceId}
              AND module_id IS NULL
              AND directory_name = #{directoryName}
            """)
    int bindUnassignedDirectoryToModule(
            @Param("workspaceId") Long workspaceId,
            @Param("directoryName") String directoryName,
            @Param("moduleId") Long moduleId
    );
}
