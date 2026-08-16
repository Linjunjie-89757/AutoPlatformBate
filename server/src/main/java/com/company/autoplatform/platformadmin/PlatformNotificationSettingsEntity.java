package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_platform_notification_settings")
public class PlatformNotificationSettingsEntity extends BaseEntity {

    @TableField("smtp_host")
    private String smtpHost;

    @TableField("smtp_port")
    private Integer smtpPort;

    @TableField("smtp_username")
    private String smtpUsername;

    @TableField("smtp_password_cipher_text")
    private String smtpPasswordCipherText;

    private String encryption;

    @TableField("sender_name")
    private String senderName;

    @TableField("rules_json")
    private String rulesJson;
}
