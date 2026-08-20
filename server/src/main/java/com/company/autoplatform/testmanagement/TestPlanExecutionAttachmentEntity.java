package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_plan_case_execution_attachment")
public class TestPlanExecutionAttachmentEntity extends BaseEntity {
    @TableField("workspace_id") private Long workspaceId;
    @TableField("plan_id") private Long planId;
    @TableField("plan_case_id") private Long planCaseId;
    @TableField("execution_id") private Long executionId;
    @TableField("file_name") private String fileName;
    @TableField("stored_path") private String storedPath;
    @TableField("content_type") private String contentType;
    @TableField("file_size") private Long fileSize;
    @TableField("created_by") private Long createdBy;
}
