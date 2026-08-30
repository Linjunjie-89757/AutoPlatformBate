package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_candidate")
public class AiCaseCandidateEntity extends BaseEntity {

    @TableField("candidate_id")
    private String candidateId;

    @TableField("task_id")
    private String taskId;

    @TableField("display_index")
    private Integer displayIndex;

    private String origin;

    @TableField("original_case_json")
    private String originalCaseJson;

    @TableField("suggested_case_json")
    private String suggestedCaseJson;

    @TableField("current_case_json")
    private String currentCaseJson;

    @TableField("review_status")
    private String reviewStatus;

    @TableField("suggested_action")
    private String suggestedAction;

    @TableField("review_score")
    private Integer reviewScore;

    @TableField("review_confidence")
    private Double reviewConfidence;

    @TableField("review_reason")
    private String reviewReason;

    @TableField("merge_target_candidate_ids_json")
    private String mergeTargetCandidateIdsJson;

    @TableField("human_decision")
    private String humanDecision;

    @TableField("content_version")
    private Integer contentVersion;

    @TableField("content_hash")
    private String contentHash;

    @TableField("suggestion_source_version")
    private Integer suggestionSourceVersion;

    @TableField("suggestion_source_hash")
    private String suggestionSourceHash;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;
}
