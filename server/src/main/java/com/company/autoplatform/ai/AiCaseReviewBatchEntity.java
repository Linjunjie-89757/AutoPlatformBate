package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_review_batch")
public class AiCaseReviewBatchEntity extends BaseEntity {

    @TableField("review_batch_id")
    private String reviewBatchId;

    @TableField("review_run_id")
    private String reviewRunId;

    @TableField("task_id")
    private String taskId;

    @TableField("batch_no")
    private Integer batchNo;

    private String status;

    @TableField("candidate_ids_json")
    private String candidateIdsJson;

    @TableField("coverage_item_ids_json")
    private String coverageItemIdsJson;

    @TableField("snapshot_id")
    private String snapshotId;

    @TableField("attempt_count")
    private Integer attemptCount;

    private String provider;
    private String model;

    @TableField("request_id")
    private String requestId;

    @TableField("input_token_count")
    private Integer inputTokenCount;

    @TableField("output_token_count")
    private Integer outputTokenCount;

    @TableField("raw_output")
    private String rawOutput;

    @TableField("result_json")
    private String resultJson;

    @TableField("error_code")
    private String errorCode;

    @TableField("error_message")
    private String errorMessage;

    @TableField("started_at")
    private java.time.LocalDateTime startedAt;

    @TableField("finished_at")
    private java.time.LocalDateTime finishedAt;
}
