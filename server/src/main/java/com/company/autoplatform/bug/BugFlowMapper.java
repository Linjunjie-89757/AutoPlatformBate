package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

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
}
