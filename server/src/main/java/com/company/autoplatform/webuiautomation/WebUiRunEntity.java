package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_run")
public class WebUiRunEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("case_id")
    private Long caseId;

    @TableField("case_name")
    private String caseName;

    @TableField("batch_id")
    private Long batchId;

    @TableField("batch_sort_order")
    private Integer batchSortOrder;

    @TableField("environment_id")
    private Long environmentId;

    @TableField("environment_name")
    private String environmentName;

    private String status;

    @TableField("browser_type")
    private String browserType;

    private Boolean headless;

    @TableField("base_url")
    private String baseUrl;

    @TableField("total_steps")
    private Integer totalSteps;

    @TableField("passed_steps")
    private Integer passedSteps;

    @TableField("failed_steps")
    private Integer failedSteps;

    @TableField("skipped_steps")
    private Integer skippedSteps;

    @TableField("duration_ms")
    private Long durationMs;

    @TableField("failure_summary")
    private String failureSummary;

    @TableField("context_snapshot_json")
    private String contextSnapshotJson;

    @TableField("operator_name")
    private String operatorName;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("finished_at")
    private LocalDateTime finishedAt;
}
