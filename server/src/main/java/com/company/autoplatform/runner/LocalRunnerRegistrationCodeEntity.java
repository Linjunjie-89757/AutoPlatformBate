package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_local_runner_registration_code")
public class LocalRunnerRegistrationCodeEntity extends BaseEntity {

    private String codeHash;

    private String status;

    @TableField("expires_at")
    private LocalDateTime expiresAt;

    @TableField("used_at")
    private LocalDateTime usedAt;

    @TableField("used_runner_id")
    private String usedRunnerId;

    @TableField("created_by")
    private Long createdBy;
}
