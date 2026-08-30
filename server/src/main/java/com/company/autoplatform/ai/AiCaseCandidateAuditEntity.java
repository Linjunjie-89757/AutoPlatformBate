package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_candidate_audit")
public class AiCaseCandidateAuditEntity extends BaseEntity {

    @TableField("candidate_id")
    private String candidateId;

    @TableField("task_id")
    private String taskId;

    @TableField("action_type")
    private String actionType;

    @TableField("from_version")
    private Integer fromVersion;

    @TableField("to_version")
    private Integer toVersion;

    @TableField("before_case_json")
    private String beforeCaseJson;

    @TableField("after_case_json")
    private String afterCaseJson;

    @TableField("metadata_json")
    private String metadataJson;

    @TableField("operator_id")
    private Long operatorId;
}
