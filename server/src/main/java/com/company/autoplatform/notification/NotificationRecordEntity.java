package com.company.autoplatform.notification;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_notification_record")
public class NotificationRecordEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("rule_id")
    private Long ruleId;

    @TableField("rule_name")
    private String ruleName;

    @TableField("channel_id")
    private Long channelId;

    @TableField("channel_name")
    private String channelName;

    @TableField("event_type")
    private String eventType;

    @TableField("event_title")
    private String eventTitle;

    @TableField("target_type")
    private String targetType;

    @TableField("target_id")
    private Long targetId;

    @TableField("target_name")
    private String targetName;

    @TableField("send_status")
    private String sendStatus;

    @TableField("request_payload")
    private String requestPayload;

    @TableField("response_body")
    private String responseBody;

    @TableField("error_message")
    private String errorMessage;

    @TableField("retry_count")
    private Integer retryCount;

    @TableField("triggered_at")
    private LocalDateTime triggeredAt;

    @TableField("sent_at")
    private LocalDateTime sentAt;
}
