package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_platform_notification_delivery")
public class PlatformNotificationDeliveryEntity extends BaseEntity {

    @TableField("event_key")
    private String eventKey;

    private String recipient;
    private String status;

    @TableField("last_error")
    private String lastError;

    @TableField("sent_at")
    private LocalDateTime sentAt;
}
