package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_bug_info")
public class BugEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("bug_no")
    private String bugNo;

    private String title;

    private String description;

    @TableField("reproduction_steps")
    private String reproductionSteps;

    @TableField("expected_result")
    private String expectedResult;

    @TableField("actual_result")
    private String actualResult;

    @TableField("module_name")
    private String moduleName;

    @TableField("version_name")
    private String versionName;

    @TableField("bug_type")
    private String bugType;

    @TableField("environment_name")
    private String environmentName;

    private String priority;

    private String severity;

    private String status;

    @TableField("source_type")
    private String sourceType;

    @TableField("assignee_id")
    private Long assigneeId;

    /** Populated for response projections such as test-plan defect lists. */
    @TableField(exist = false)
    private String assigneeName;

    @TableField("reporter_id")
    private Long reporterId;

    @TableField("related_case_id")
    private Long relatedCaseId;

    @TableField("related_report_id")
    private Long relatedReportId;

    @TableField("related_task_id")
    private Long relatedTaskId;

    @TableField("test_version_id")
    private Long testVersionId;

    @TableField("test_requirement_id")
    private Long testRequirementId;

    @TableField("test_plan_id")
    private Long testPlanId;

    @TableField("test_plan_case_id")
    private Long testPlanCaseId;

    @TableField("tags_json")
    private String tagsJson;
}
