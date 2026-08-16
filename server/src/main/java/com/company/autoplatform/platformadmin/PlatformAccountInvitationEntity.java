package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_platform_account_invitation")
public class PlatformAccountInvitationEntity extends BaseEntity {

    @TableField("user_id")
    private Long userId;

    @TableField("token_hash")
    private String tokenHash;

    @TableField("expires_at")
    private LocalDateTime expiresAt;

    @TableField("accepted_at")
    private LocalDateTime acceptedAt;

    @TableField("revoked_at")
    private LocalDateTime revokedAt;

    @TableField("created_by")
    private Long createdBy;
}
