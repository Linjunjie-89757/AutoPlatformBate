package com.company.autoplatform.audit;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_operation_audit_log")
public class OperationAuditLogEntity extends BaseEntity {

    @TableField("workspace_code")
    private String workspaceCode;

    @TableField("operator_user_id")
    private Long operatorUserId;

    @TableField("operator_username")
    private String operatorUsername;

    @TableField("operator_display_name")
    private String operatorDisplayName;

    private String category;

    @TableField("action_code")
    private String actionCode;

    @TableField("action_name")
    private String actionName;

    private String target;

    @TableField("request_method")
    private String requestMethod;

    @TableField("source_ip")
    private String sourceIp;

    private String result;

    @TableField("status_code")
    private Integer statusCode;

    @TableField("duration_ms")
    private Long durationMs;
}
