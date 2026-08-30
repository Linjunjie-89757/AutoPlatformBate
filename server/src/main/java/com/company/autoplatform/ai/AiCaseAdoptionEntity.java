package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_adoption")
public class AiCaseAdoptionEntity extends BaseEntity {

    @TableField("task_id")
    private String taskId;

    @TableField("case_index")
    private Integer caseIndex;

    @TableField("candidate_id")
    private String candidateId;

    private String status;

    @TableField("failure_reason")
    private String failureReason;

    @TableField("directory_id")
    private Long directoryId;

    @TableField("created_case_id")
    private Long createdCaseId;

    @TableField("adopted_content_version")
    private Integer adoptedContentVersion;

    @TableField("adopted_content_source")
    private String adoptedContentSource;

    @TableField("idempotency_key")
    private String idempotencyKey;

    @TableField("attempt_count")
    private Integer attemptCount;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;
}
