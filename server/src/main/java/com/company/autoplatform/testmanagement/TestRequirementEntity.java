package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_requirement")
public class TestRequirementEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("requirement_no")
    private String requirementNo;

    @TableField("version_id")
    private Long versionId;

    private String title;

    private RequirementPriority priority;

    @TableField("source_type")
    private RequirementSourceType sourceType;

    @TableField("source_ref")
    private String sourceRef;

    @TableField("assignee_id")
    private Long assigneeId;

    private String description;

    @Version
    @TableField("lock_version")
    private Integer lockVersion;

    @TableField("deleted_at")
    private LocalDateTime deletedAt;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;
}
