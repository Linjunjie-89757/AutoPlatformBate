package com.company.autoplatform.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class NotificationModels {

    private NotificationModels() {
    }

    public record NotificationEventOption(String value, String label) {
    }

    public record NotificationChannelItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String channelName,
            String channelType,
            String channelTypeName,
            String webhookUrl,
            Boolean secretKeyConfigured,
            String httpMethod,
            String headersJson,
            String bodyTemplate,
            Integer timeoutMs,
            Integer retryCount,
            Integer status,
            String remark,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record SaveNotificationChannelRequest(
            String workspaceCode,
            @NotBlank String channelName,
            @NotBlank String channelType,
            @NotBlank String webhookUrl,
            String secretKey,
            String httpMethod,
            String headersJson,
            String bodyTemplate,
            Integer timeoutMs,
            Integer retryCount,
            Integer status,
            String remark
    ) {
    }

    public record NotificationRuleItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String ruleName,
            String eventType,
            String eventName,
            String triggerCondition,
            List<Long> channelIds,
            List<String> channelNames,
            Integer frequencyLimitSeconds,
            Integer status,
            LocalDateTime lastTriggeredAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record SaveNotificationRuleRequest(
            String workspaceCode,
            @NotBlank String ruleName,
            @NotBlank String eventType,
            String triggerCondition,
            @NotEmpty List<Long> channelIds,
            Integer frequencyLimitSeconds,
            Integer status
    ) {
    }

    public record NotificationRecordItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long ruleId,
            String ruleName,
            Long channelId,
            String channelName,
            String eventType,
            String eventName,
            String eventTitle,
            String targetType,
            Long targetId,
            String targetName,
            String sendStatus,
            String responseBody,
            String errorMessage,
            Integer retryCount,
            LocalDateTime triggeredAt,
            LocalDateTime sentAt,
            LocalDateTime createdAt
    ) {
    }

    public record UpdateNotificationStatusRequest(Integer status) {
    }

    public record TestNotificationChannelRequest(
            Long channelId,
            String channelType,
            String webhookUrl,
            String secretKey,
            String httpMethod,
            String headersJson,
            String bodyTemplate,
            Integer timeoutMs,
            Integer retryCount,
            String message
    ) {
    }

    public record NotificationSendResult(
            Boolean success,
            String message,
            String responseBody
    ) {
    }

    public record NotificationEvent(
            Long workspaceId,
            String eventType,
            String eventTitle,
            String targetType,
            Long targetId,
            String targetName,
            String result,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Long durationMs,
            String failureSummary,
            String linkUrl,
            Map<String, Object> extra
    ) {
    }
}
