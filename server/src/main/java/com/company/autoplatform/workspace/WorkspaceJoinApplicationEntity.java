package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace_join_application")
public class WorkspaceJoinApplicationEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("applicant_user_id")
    private Long applicantUserId;

    private String status;

    @TableField("reject_reason")
    private String rejectReason;
}
