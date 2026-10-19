package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface BugFlowMapper extends BaseMapper<BugFlowEntity> {

    @Select("""
            <script>
            SELECT f.*
            FROM tb_bug_flow_record f
            WHERE f.bug_id IN
              <foreach collection="bugIds" item="bugId" open="(" separator="," close=")">
                  #{bugId}
              </foreach>
              AND NOT EXISTS (
                  SELECT 1
                  FROM tb_bug_flow_record newer
                  WHERE newer.bug_id = f.bug_id
                    AND (newer.created_at &gt; f.created_at
                      OR (newer.created_at = f.created_at AND newer.id &gt; f.id))
              )
            </script>
            """)
    List<BugFlowEntity> selectLatestByBugIds(@Param("bugIds") List<Long> bugIds);

    @Select("""
            <script>
            SELECT DATE(f.created_at) AS stat_date, COUNT(*) AS item_count
            FROM tb_bug_flow_record f
            INNER JOIN tb_bug_info b ON b.id = f.bug_id
            WHERE f.to_status = 'CLOSED'
              AND f.created_at &gt;= #{from}
              AND f.created_at &lt; #{to}
            <if test="workspaceId != null">
              AND b.workspace_id = #{workspaceId}
            </if>
            <if test="workspaceIds != null and !workspaceIds.isEmpty()">
              AND b.workspace_id IN
              <foreach collection="workspaceIds" item="workspaceId" open="(" separator="," close=")">
                  #{workspaceId}
              </foreach>
            </if>
            GROUP BY DATE(f.created_at)
            </script>
            """)
    List<Map<String, Object>> selectClosedCountsByDate(
            @Param("workspaceId") Long workspaceId,
            @Param("workspaceIds") List<Long> workspaceIds,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );
}
