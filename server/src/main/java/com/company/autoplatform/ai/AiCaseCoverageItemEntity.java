package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_case_coverage_item")
public class AiCaseCoverageItemEntity extends BaseEntity {

    @TableField("coverage_item_id")
    private String coverageItemId;

    @TableField("task_id")
    private String taskId;

    @TableField("item_no")
    private Integer itemNo;

    private String title;
    private String description;

    @TableField("requirement_reference")
    private String requirementReference;

    @TableField("coverage_status")
    private String coverageStatus;

    @TableField("covered_candidate_ids_json")
    private String coveredCandidateIdsJson;

    @TableField("evidence_json")
    private String evidenceJson;

    @TableField("issues_json")
    private String issuesJson;
}
