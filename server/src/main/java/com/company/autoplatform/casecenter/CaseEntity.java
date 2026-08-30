package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_case_info")
public class CaseEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("case_no")
    private String caseNo;

    private String title;

    @TableField("case_type")
    private String caseType;

    private String priority;

    @TableField("source_type")
    private String sourceType;

    @TableField("owner_id")
    private Long ownerId;

    @TableField("execution_status")
    private String executionStatus;

    @TableField("executor_id")
    private Long executorId;

    @TableField("execution_comment")
    private String executionComment;

    @TableField("execution_note")
    private String executionNote;

    @TableField("executed_at")
    private LocalDateTime executedAt;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;

    @TableField("case_directory_id")
    private Long caseDirectoryId;

    @TableField("review_status")
    private String reviewStatus;

    @TableField("review_comment")
    private String reviewComment;

    @TableField("reviewed_by")
    private Long reviewedBy;

    @TableField("reviewed_at")
    private LocalDateTime reviewedAt;

    private String precondition;

    private String steps;

    @TableField("expected_result")
    private String expectedResult;
}
