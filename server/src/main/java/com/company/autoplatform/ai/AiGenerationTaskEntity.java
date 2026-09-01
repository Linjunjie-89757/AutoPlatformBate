package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_generation_task")
public class AiGenerationTaskEntity extends BaseEntity {

    @TableField("task_id")
    private String taskId;

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("requirement_title")
    private String requirementTitle;

    @TableField("requirement_content")
    private String requirementContent;

    @TableField("output_mode")
    private String outputMode;

    private String status;

    @TableField("generation_status")
    private String generationStatus;

    @TableField("review_status")
    private String reviewStatus;

    @TableField("failed_stage")
    private String failedStage;

    @TableField("error_code")
    private String errorCode;

    @TableField("self_check_status")
    private String selfCheckStatus;

    @TableField("self_check_result_json")
    private String selfCheckResultJson;

    @TableField("self_check_attempt_count")
    private Integer selfCheckAttemptCount;

    @TableField("current_step")
    private Integer currentStep;

    @TableField("step_message")
    private String stepMessage;

    @TableField("error_message")
    private String errorMessage;

    @TableField("directory_id")
    private Long directoryId;

    @TableField("directory_name")
    private String directoryName;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;

    private String provider;

    private String model;

    @TableField("generation_provider")
    private String generationProvider;

    @TableField("generation_model")
    private String generationModel;

    @TableField("generation_prompt_version")
    private String generationPromptVersion;

    @TableField("generation_prompt_hash")
    private String generationPromptHash;

    @TableField("generation_temperature")
    private Double generationTemperature;

    @TableField("review_provider")
    private String reviewProvider;

    @TableField("review_model")
    private String reviewModel;

    @TableField("review_prompt_version")
    private String reviewPromptVersion;

    @TableField("review_prompt_hash")
    private String reviewPromptHash;

    @TableField("review_temperature")
    private Double reviewTemperature;

    @TableField("asset_ids_json")
    private String assetIdsJson;

    @TableField("input_mode")
    private String inputMode;

    @TableField("image_digest")
    private String imageDigest;

    @TableField("image_count")
    private Integer imageCount;

    @TableField("input_token_count")
    private Integer inputTokenCount;

    @TableField("output_token_count")
    private Integer outputTokenCount;

    @TableField("review_input_token_count")
    private Integer reviewInputTokenCount;

    @TableField("review_output_token_count")
    private Integer reviewOutputTokenCount;

    @TableField("warnings_json")
    private String warningsJson;

    @TableField("invalid_cases_json")
    private String invalidCasesJson;

    @TableField("generated_cases_json")
    private String generatedCasesJson;

    @TableField("review_result_json")
    private String reviewResultJson;

    @TableField("generation_raw_output")
    private String generationRawOutput;

    @TableField("review_raw_output")
    private String reviewRawOutput;

    @TableField("warning_codes_json")
    private String warningCodesJson;

    @TableField("has_warnings")
    private Integer hasWarnings;

    @TableField("total_review_batches")
    private Integer totalReviewBatches;

    @TableField("completed_review_batches")
    private Integer completedReviewBatches;

    @TableField("failed_review_batches")
    private Integer failedReviewBatches;

    @TableField("reviewed_case_count")
    private Integer reviewedCaseCount;

    @TableField("supplemented_case_count")
    private Integer supplementedCaseCount;

    @TableField("coverage_completeness")
    private String coverageCompleteness;

    @TableField("adopted_case_indexes_json")
    private String adoptedCaseIndexesJson;

    @TableField("deleted_case_indexes_json")
    private String deletedCaseIndexesJson;

    @TableField("saved_case_count")
    private Integer savedCaseCount;

    @TableField("generated_count")
    private Integer generatedCount;

    @TableField("cancel_requested")
    private Integer cancelRequested;

    @TableField("source_task_id")
    private String sourceTaskId;

    @TableField("finished_at")
    private LocalDateTime finishedAt;
}
