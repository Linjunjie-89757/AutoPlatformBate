package com.company.autoplatform.execution;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_exec_report_share")
public class ReportShareEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("report_id")
    private Long reportId;

    @TableField("token_hash")
    private String tokenHash;

    private Integer status;

    @TableField("expires_at")
    private LocalDateTime expiresAt;

    @TableField("created_by")
    private String createdBy;

    @TableField("last_accessed_at")
    private LocalDateTime lastAccessedAt;

    @TableField("access_count")
    private Integer accessCount;
}
