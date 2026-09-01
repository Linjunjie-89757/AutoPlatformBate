package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_candidate_suggestion")
public class AiCaseCandidateSuggestionEntity extends BaseEntity {

    @TableField("suggestion_id")
    private String suggestionId;

    @TableField("candidate_id")
    private String candidateId;

    @TableField("task_id")
    private String taskId;

    @TableField("source_type")
    private String sourceType;

    @TableField("review_run_id")
    private String reviewRunId;

    @TableField("review_batch_id")
    private String reviewBatchId;

    @TableField("based_on_content_version")
    private Integer basedOnContentVersion;

    @TableField("based_on_content_hash")
    private String basedOnContentHash;

    @TableField("suggested_content_json")
    private String suggestedContentJson;

    @TableField("issue_list_json")
    private String issueListJson;

    private Integer score;
    private Double confidence;
    private String status;
}
