package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_plan_case_defect")
public class TestPlanCaseDefectRelationEntity extends BaseEntity {
    @TableField("workspace_id") private Long workspaceId;
    @TableField("plan_id") private Long planId;
    @TableField("plan_case_id") private Long planCaseId;
    @TableField("defect_id") private Long defectId;
    @TableField("created_by") private Long createdBy;
}
