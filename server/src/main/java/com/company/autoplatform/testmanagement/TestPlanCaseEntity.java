package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_plan_case")
public class TestPlanCaseEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("plan_id")
    private Long planId;

    @TableField("source_case_id")
    private Long sourceCaseId;

    @TableField("origin_type")
    private PlanCaseOriginType originType;

    @TableField("snapshot_case_no")
    private String snapshotCaseNo;

    @TableField("snapshot_title")
    private String snapshotTitle;

    @TableField("snapshot_module")
    private String snapshotModule;

    @TableField("snapshot_priority")
    private String snapshotPriority;

    @TableField("snapshot_precondition")
    private String snapshotPrecondition;

    @TableField("snapshot_steps")
    private String snapshotSteps;

    @TableField("snapshot_expected_result")
    private String snapshotExpectedResult;

    @TableField("source_case_updated_at")
    private LocalDateTime sourceCaseUpdatedAt;

    @TableField("added_after_start")
    private Boolean addedAfterStart;

    @TableField("assignee_id")
    private Long assigneeId;

    @TableField("execution_status")
    private PlanCaseExecutionStatus executionStatus;

    @TableField("execution_note")
    private String executionNote;

    @TableField("executed_by")
    private Long executedBy;

    @TableField("executed_at")
    private LocalDateTime executedAt;

    @TableField("sort_order")
    private Integer sortOrder;

    @Version
    @TableField("lock_version")
    private Integer lockVersion;

    @TableField("created_by")
    private Long createdBy;
}
