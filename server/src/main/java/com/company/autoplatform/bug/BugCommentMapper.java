package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface BugCommentMapper extends BaseMapper<BugCommentEntity> {

    @Select("""
            <script>
            SELECT c.*
            FROM tb_bug_comment c
            WHERE c.bug_id IN
              <foreach collection="bugIds" item="bugId" open="(" separator="," close=")">
                  #{bugId}
              </foreach>
              AND NOT EXISTS (
                  SELECT 1
                  FROM tb_bug_comment newer
                  WHERE newer.bug_id = c.bug_id
                    AND (newer.created_at &gt; c.created_at
                      OR (newer.created_at = c.created_at AND newer.id &gt; c.id))
              )
            </script>
            """)
    List<BugCommentEntity> selectLatestByBugIds(@Param("bugIds") List<Long> bugIds);
}
