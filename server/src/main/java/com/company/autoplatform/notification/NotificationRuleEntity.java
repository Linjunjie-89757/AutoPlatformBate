package com.company.autoplatform.notification;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_notification_rule")
public class NotificationRuleEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("rule_name")
    private String ruleName;

    @TableField("event_type")
    private String eventType;

    @TableField("trigger_condition")
    private String triggerCondition;

    @TableField("channel_ids_json")
    private String channelIdsJson;

    @TableField("frequency_limit_seconds")
    private Integer frequencyLimitSeconds;

    @TableField("last_triggered_at")
    private LocalDateTime lastTriggeredAt;

    private Integer status;
}
