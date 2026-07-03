package com.company.autoplatform.notification;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_notification_channel")
public class NotificationChannelEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("channel_name")
    private String channelName;

    @TableField("channel_type")
    private String channelType;

    @TableField("webhook_url")
    private String webhookUrl;

    @TableField("secret_key")
    private String secretKey;

    @TableField("http_method")
    private String httpMethod;

    @TableField("headers_json")
    private String headersJson;

    @TableField("body_template")
    private String bodyTemplate;

    @TableField("timeout_ms")
    private Integer timeoutMs;

    @TableField("retry_count")
    private Integer retryCount;

    private Integer status;

    private String remark;
}
