package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_plan")
public class TestPlanEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("plan_no")
    private String planNo;

    private PlanPurpose purpose;

    @TableField("plan_type")
    private PlanType planType;

    private PlanStatus status;

    @TableField("version_id")
    private Long versionId;

    private String name;

    @TableField("owner_id")
    private Long ownerId;

    @TableField("start_date")
    private LocalDate startDate;

    @TableField("end_date")
    private LocalDate endDate;

    private String goal;

    @TableField("min_execute_rate")
    private BigDecimal minExecuteRate;

    @TableField("min_pass_rate")
    private BigDecimal minPassRate;

    @TableField("allow_p0")
    private Boolean allowP0;

    @TableField("max_p1")
    private Integer maxP1;

    @TableField("auto_report")
    private Boolean autoReport;

    @TableField("owner_confirm_required")
    private Boolean ownerConfirmRequired;

    @TableField("snapshot_frozen_at")
    private LocalDateTime snapshotFrozenAt;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("completed_at")
    private LocalDateTime completedAt;

    @TableField("cancelled_at")
    private LocalDateTime cancelledAt;

    @TableField("cancel_reason")
    private String cancelReason;

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
