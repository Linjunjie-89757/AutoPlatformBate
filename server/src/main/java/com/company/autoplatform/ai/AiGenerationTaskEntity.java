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

    @TableField("asset_ids_json")
    private String assetIdsJson;

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
