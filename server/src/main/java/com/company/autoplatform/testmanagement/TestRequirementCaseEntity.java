package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_requirement_case")
public class TestRequirementCaseEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("requirement_id")
    private Long requirementId;

    @TableField("case_id")
    private Long caseId;

    @TableField("review_status")
    private RequirementReviewStatus reviewStatus;

    @TableField("review_note")
    private String reviewNote;

    @TableField("reviewer_id")
    private Long reviewerId;

    @TableField("reviewed_at")
    private LocalDateTime reviewedAt;

    @TableField("case_updated_at_when_reviewed")
    private LocalDateTime caseUpdatedAtWhenReviewed;

    @TableField("created_by")
    private Long createdBy;
}
