package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_candidate_review_snapshot")
public class AiCaseCandidateReviewSnapshotEntity extends BaseEntity {

    @TableField("snapshot_id")
    private String snapshotId;

    @TableField("candidate_id")
    private String candidateId;

    @TableField("task_id")
    private String taskId;

    @TableField("review_run_id")
    private String reviewRunId;

    @TableField("review_batch_id")
    private String reviewBatchId;

    @TableField("content_version")
    private Integer contentVersion;

    @TableField("content_hash")
    private String contentHash;

    @TableField("case_json")
    private String caseJson;
}
