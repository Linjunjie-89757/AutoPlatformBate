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
@TableName("tb_test_plan_report")
public class TestPlanReportEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("plan_id")
    private Long planId;

    private PlanReportStatus status;

    @TableField("content_snapshot_json")
    private String contentSnapshotJson;

    @TableField("generated_at")
    private LocalDateTime generatedAt;

    @TableField("signed_by")
    private Long signedBy;

    @TableField("signed_at")
    private LocalDateTime signedAt;

    @TableField("signature_revoked_by")
    private Long signatureRevokedBy;

    @TableField("signature_revoked_at")
    private LocalDateTime signatureRevokedAt;

    @Version
    @TableField("lock_version")
    private Integer lockVersion;
}
