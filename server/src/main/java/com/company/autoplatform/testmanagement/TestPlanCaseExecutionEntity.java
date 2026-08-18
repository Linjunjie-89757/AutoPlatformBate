package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_plan_case_execution")
public class TestPlanCaseExecutionEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("plan_id")
    private Long planId;

    @TableField("plan_case_id")
    private Long planCaseId;

    @TableField("previous_status")
    private PlanCaseExecutionStatus previousStatus;

    @TableField("execution_status")
    private PlanCaseExecutionStatus executionStatus;

    @TableField("execution_note")
    private String executionNote;

    @TableField("executor_id")
    private Long executorId;

    @TableField("executed_at")
    private LocalDateTime executedAt;
}
