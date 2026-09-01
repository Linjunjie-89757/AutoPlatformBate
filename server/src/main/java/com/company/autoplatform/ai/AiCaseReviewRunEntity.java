package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_review_run")
public class AiCaseReviewRunEntity extends BaseEntity {

    @TableField("review_run_id")
    private String reviewRunId;

    @TableField("task_id")
    private String taskId;

    @TableField("run_no")
    private Integer runNo;

    private String status;

    @TableField("trigger_type")
    private String triggerType;

    private String provider;
    private String model;

    @TableField("prompt_version")
    private String promptVersion;

    @TableField("prompt_hash")
    private String promptHash;

    private Double temperature;

    @TableField("total_batches")
    private Integer totalBatches;

    @TableField("completed_batches")
    private Integer completedBatches;

    @TableField("failed_batches")
    private Integer failedBatches;

    @TableField("reviewed_case_count")
    private Integer reviewedCaseCount;

    @TableField("supplemented_case_count")
    private Integer supplementedCaseCount;

    @TableField("coverage_completeness")
    private String coverageCompleteness;

    @TableField("global_result_json")
    private String globalResultJson;

    @TableField("raw_output")
    private String rawOutput;

    @TableField("error_code")
    private String errorCode;

    @TableField("error_message")
    private String errorMessage;

    @TableField("started_at")
    private java.time.LocalDateTime startedAt;

    @TableField("finished_at")
    private java.time.LocalDateTime finishedAt;
}
