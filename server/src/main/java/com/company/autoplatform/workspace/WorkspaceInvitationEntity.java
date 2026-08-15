package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace_invitation")
public class WorkspaceInvitationEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("invite_code_hash")
    private String inviteCodeHash;

    @TableField("created_by")
    private Long createdBy;

    @TableField("expires_at")
    private LocalDateTime expiresAt;

    @TableField("max_uses")
    private Integer maxUses;

    @TableField("used_count")
    private Integer usedCount;

    private Integer status;
}
