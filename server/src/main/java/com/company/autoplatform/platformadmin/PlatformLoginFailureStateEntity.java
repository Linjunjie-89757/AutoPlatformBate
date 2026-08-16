package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_platform_login_failure_state")
public class PlatformLoginFailureStateEntity extends BaseEntity {

    @TableField("account_key")
    private String accountKey;

    @TableField("failure_count")
    private Integer failureCount;

    @TableField("window_started_at")
    private LocalDateTime windowStartedAt;

    @TableField("last_failed_at")
    private LocalDateTime lastFailedAt;

    @TableField("alerted_at")
    private LocalDateTime alertedAt;
}
