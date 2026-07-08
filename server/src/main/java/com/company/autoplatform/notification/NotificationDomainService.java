package com.company.autoplatform.notification;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.company.autoplatform.notification.NotificationModels.*;

@Service
public class NotificationDomainService {

    public static final String EVENT_API_SUITE_FINISHED = "API_SUITE_FINISHED";
    public static final String EVENT_API_SUITE_FAILED = "API_SUITE_FAILED";
    public static final String EVENT_WEB_UI_FINISHED = "WEB_UI_FINISHED";
    public static final String EVENT_WEB_UI_FAILED = "WEB_UI_FAILED";

    private static final String CHANNEL_WECOM = "WECOM_ROBOT";
    private static final String CHANNEL_WEBHOOK = "WEBHOOK";
    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";
    private static final DateTimeFormatter NOTIFICATION_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final TypeReference<List<Long>> LONG_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, String>> STRING_MAP_TYPE = new TypeReference<>() {
    };

    private final NotificationChannelMapper channelMapper;
    private final NotificationRuleMapper ruleMapper;
    private final NotificationRecordMapper recordMapper;
    private final WorkspaceService workspaceService;
    private final ObjectMapper objectMapper;
    private final String publicFrontendBaseUrl;
    private final String publicBackendBaseUrl;

    public NotificationDomainService(
            NotificationChannelMapper channelMapper,
            NotificationRuleMapper ruleMapper,
            NotificationRecordMapper recordMapper,
            WorkspaceService workspaceService,
            ObjectMapper objectMapper,
            @Value("${app.public-frontend-base-url:${APP_PUBLIC_FRONTEND_BASE_URL:}}") String publicFrontendBaseUrl,
            @Value("${app.public-backend-base-url:${autoplatform.public-base-url:http://localhost:${server.port:8080}}}") String publicBackendBaseUrl
    ) {
        this.channelMapper = channelMapper;
        this.ruleMapper = ruleMapper;
        this.recordMapper = recordMapper;
        this.workspaceService = workspaceService;
        this.objectMapper = objectMapper;
        this.publicFrontendBaseUrl = normalizePublicBaseUrl(publicFrontendBaseUrl);
        this.publicBackendBaseUrl = normalizePublicBaseUrl(publicBackendBaseUrl);
    }

    public List<NotificationEventOption> listEventTypes() {
        return List.of(
                new NotificationEventOption(EVENT_API_SUITE_FINISHED, eventName(EVENT_API_SUITE_FINISHED)),
                new NotificationEventOption(EVENT_API_SUITE_FAILED, eventName(EVENT_API_SUITE_FAILED)),
                new NotificationEventOption(EVENT_WEB_UI_FINISHED, eventName(EVENT_WEB_UI_FINISHED)),
                new NotificationEventOption(EVENT_WEB_UI_FAILED, eventName(EVENT_WEB_UI_FAILED))
        );
    }

    public PageResponse<NotificationChannelItem> listChannels(String workspaceCode, String keyword, String channelType, Integer status) {
        LambdaQueryWrapper<NotificationChannelEntity> query = new LambdaQueryWrapper<>();
        applyWorkspaceScope(query, NotificationChannelEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper.like(NotificationChannelEntity::getChannelName, trimmedKeyword)
                    .or()
                    .like(NotificationChannelEntity::getRemark, trimmedKeyword));
        }
        String normalizedType = normalizeChannelTypeOrNull(channelType);
        if (normalizedType != null) {
            query.eq(NotificationChannelEntity::getChannelType, normalizedType);
        }
        if (status != null) {
            query.eq(NotificationChannelEntity::getStatus, normalizeStatus(status));
        }
        List<NotificationChannelItem> items = channelMapper.selectList(query
                        .orderByDesc(NotificationChannelEntity::getUpdatedAt)
                        .orderByDesc(NotificationChannelEntity::getId))
                .stream()
                .map(this::toChannelItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public NotificationChannelItem createChannel(String headerWorkspaceCode, SaveNotificationChannelRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        NotificationChannelEntity entity = new NotificationChannelEntity();
        entity.setWorkspaceId(workspace.getId());
        fillChannel(entity, request, false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        channelMapper.insert(entity);
        return toChannelItem(entity);
    }

    public NotificationChannelItem updateChannel(Long id, String headerWorkspaceCode, SaveNotificationChannelRequest request) {
        NotificationChannelEntity entity = requireChannel(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the notification channel");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move notification channel to another workspace");
        }
        fillChannel(entity, request, true);
        entity.setUpdatedAt(LocalDateTime.now());
        channelMapper.updateById(entity);
        return toChannelItem(entity);
    }

    public NotificationChannelItem updateChannelStatus(Long id, String workspaceCode, UpdateNotificationStatusRequest request) {
        NotificationChannelEntity entity = requireChannel(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot update the notification channel");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        entity.setStatus(normalizeStatus(request == null ? null : request.status()));
        entity.setUpdatedAt(LocalDateTime.now());
        channelMapper.updateById(entity);
        return toChannelItem(entity);
    }

    public void deleteChannel(Long id, String workspaceCode) {
        NotificationChannelEntity entity = requireChannel(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the notification channel");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        channelMapper.deleteById(id);
    }

    public NotificationSendResult testChannel(String workspaceCode, TestNotificationChannelRequest request) {
        NotificationChannelEntity channel;
        if (request.channelId() != null) {
            channel = requireChannel(request.channelId());
            validateReadable(channel.getWorkspaceId(), workspaceCode, "Current workspace cannot test the notification channel");
        } else {
            WorkspaceEntity workspace = resolveScopedWorkspaceForWrite(workspaceCode);
            channel = new NotificationChannelEntity();
            channel.setWorkspaceId(workspace.getId());
            channel.setChannelName("测试渠道");
            channel.setChannelType(normalizeChannelType(request.channelType()));
            channel.setWebhookUrl(requiredText(request.webhookUrl(), "Webhook 地址不能为空"));
            channel.setSecretKey(blankToNull(request.secretKey()));
            channel.setHttpMethod(normalizeHttpMethod(request.httpMethod()));
            channel.setHeadersJson(blankToNull(request.headersJson()));
            channel.setBodyTemplate(blankToNull(request.bodyTemplate()));
            channel.setTimeoutMs(normalizeRange(request.timeoutMs(), 5000, 1000, 60000));
            channel.setRetryCount(normalizeRange(request.retryCount(), 0, 0, 5));
            channel.setStatus(1);
        }
        NotificationEvent event = new NotificationEvent(
                channel.getWorkspaceId(),
                EVENT_API_SUITE_FINISHED,
                "通知配置测试",
                "NOTIFICATION_TEST",
                null,
                "通知配置测试",
                "SUCCESS",
                1,
                1,
                0,
                0L,
                null,
                null,
                Map.of("message", blankToNull(request.message()) == null ? "这是一条来自自动化测试平台的测试通知。" : request.message().trim())
        );
        SendAttempt attempt = sendToChannel(channel, event, buildMessage(event));
        return new NotificationSendResult(attempt.success(), attempt.success() ? "测试发送成功" : "测试发送失败", attempt.responseBody());
    }

    public PageResponse<NotificationRuleItem> listRules(String workspaceCode, String keyword, String eventType, Integer status) {
        LambdaQueryWrapper<NotificationRuleEntity> query = new LambdaQueryWrapper<>();
        applyWorkspaceScope(query, NotificationRuleEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.like(NotificationRuleEntity::getRuleName, trimmedKeyword);
        }
        String normalizedEvent = normalizeEventTypeOrNull(eventType);
        if (normalizedEvent != null) {
            query.eq(NotificationRuleEntity::getEventType, normalizedEvent);
        }
        if (status != null) {
            query.eq(NotificationRuleEntity::getStatus, normalizeStatus(status));
        }
        List<NotificationRuleItem> items = ruleMapper.selectList(query
                        .orderByDesc(NotificationRuleEntity::getUpdatedAt)
                        .orderByDesc(NotificationRuleEntity::getId))
                .stream()
                .map(this::toRuleItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public NotificationRuleItem createRule(String headerWorkspaceCode, SaveNotificationRuleRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        NotificationRuleEntity entity = new NotificationRuleEntity();
        entity.setWorkspaceId(workspace.getId());
        fillRule(entity, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        ruleMapper.insert(entity);
        return toRuleItem(entity);
    }

    public NotificationRuleItem updateRule(Long id, String headerWorkspaceCode, SaveNotificationRuleRequest request) {
        NotificationRuleEntity entity = requireRule(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the notification rule");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move notification rule to another workspace");
        }
        fillRule(entity, request);
        entity.setUpdatedAt(LocalDateTime.now());
        ruleMapper.updateById(entity);
        return toRuleItem(entity);
    }

    public NotificationRuleItem updateRuleStatus(Long id, String workspaceCode, UpdateNotificationStatusRequest request) {
        NotificationRuleEntity entity = requireRule(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot update the notification rule");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        entity.setStatus(normalizeStatus(request == null ? null : request.status()));
        entity.setUpdatedAt(LocalDateTime.now());
        ruleMapper.updateById(entity);
        return toRuleItem(entity);
    }

    public void deleteRule(Long id, String workspaceCode) {
        NotificationRuleEntity entity = requireRule(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the notification rule");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        ruleMapper.deleteById(id);
    }

    public PageResponse<NotificationRecordItem> listRecords(
            String workspaceCode,
            String eventType,
            String sendStatus,
            Long channelId,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<NotificationRecordEntity> query = new LambdaQueryWrapper<>();
        applyWorkspaceScope(query, NotificationRecordEntity::getWorkspaceId, workspaceCode);
        String normalizedEvent = normalizeEventTypeOrNull(eventType);
        if (normalizedEvent != null) {
            query.eq(NotificationRecordEntity::getEventType, normalizedEvent);
        }
        String normalizedStatus = blankToNull(sendStatus);
        if (normalizedStatus != null) {
            query.eq(NotificationRecordEntity::getSendStatus, normalizedStatus.toUpperCase(Locale.ROOT));
        }
        if (channelId != null) {
            query.eq(NotificationRecordEntity::getChannelId, channelId);
        }
        if (createdFrom != null) {
            query.ge(NotificationRecordEntity::getCreatedAt, createdFrom);
        }
        if (createdTo != null) {
            query.le(NotificationRecordEntity::getCreatedAt, createdTo);
        }
        List<NotificationRecordItem> allItems = recordMapper.selectList(query
                        .orderByDesc(NotificationRecordEntity::getCreatedAt)
                        .orderByDesc(NotificationRecordEntity::getId))
                .stream()
                .map(this::toRecordItem)
                .toList();
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : pageSize;
        int fromIndex = Math.min((safePageNo - 1) * safePageSize, allItems.size());
        int toIndex = Math.min(fromIndex + safePageSize, allItems.size());
        return PageResponse.of(allItems.subList(fromIndex, toIndex), allItems.size(), safePageNo, safePageSize);
    }

    public void publishEvent(NotificationEvent event) {
        if (event == null || event.workspaceId() == null || blankToNull(event.eventType()) == null) {
            return;
        }
        try {
            List<NotificationRuleEntity> rules = ruleMapper.selectList(new LambdaQueryWrapper<NotificationRuleEntity>()
                    .eq(NotificationRuleEntity::getWorkspaceId, event.workspaceId())
                    .eq(NotificationRuleEntity::getEventType, normalizeEventType(event.eventType()))
                    .eq(NotificationRuleEntity::getStatus, 1)
                    .orderByAsc(NotificationRuleEntity::getId));
            for (NotificationRuleEntity rule : rules) {
                publishRule(rule, event);
            }
        } catch (RuntimeException ignored) {
            // Notification must never block the automation execution result.
        }
    }

    public boolean hasActiveRule(Long workspaceId, String eventType, String result) {
        if (workspaceId == null || blankToNull(eventType) == null) {
            return false;
        }
        List<NotificationRuleEntity> rules = ruleMapper.selectList(new LambdaQueryWrapper<NotificationRuleEntity>()
                .eq(NotificationRuleEntity::getWorkspaceId, workspaceId)
                .eq(NotificationRuleEntity::getEventType, normalizeEventType(eventType))
                .eq(NotificationRuleEntity::getStatus, 1));
        for (NotificationRuleEntity rule : rules) {
            NotificationEvent event = new NotificationEvent(
                    workspaceId,
                    eventType,
                    "",
                    "",
                    null,
                    "",
                    result,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Map.of()
            );
            if (!matchesCondition(rule, event) || isRateLimited(rule)) {
                continue;
            }
            for (Long channelId : readChannelIds(rule.getChannelIdsJson())) {
                NotificationChannelEntity channel = channelMapper.selectById(channelId);
                if (channel != null && workspaceId.equals(channel.getWorkspaceId()) && Integer.valueOf(1).equals(channel.getStatus())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void publishRule(NotificationRuleEntity rule, NotificationEvent event) {
        if (!matchesCondition(rule, event) || isRateLimited(rule)) {
            return;
        }
        String message = buildMessage(event);
        for (Long channelId : readChannelIds(rule.getChannelIdsJson())) {
            NotificationChannelEntity channel = channelMapper.selectById(channelId);
            if (channel == null || !event.workspaceId().equals(channel.getWorkspaceId()) || !Integer.valueOf(1).equals(channel.getStatus())) {
                continue;
            }
            SendAttempt attempt = sendToChannel(channel, event, message);
            persistRecord(rule, channel, event, attempt);
        }
        rule.setLastTriggeredAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        ruleMapper.updateById(rule);
    }

    private SendAttempt sendToChannel(NotificationChannelEntity channel, NotificationEvent event, String message) {
        String payload = buildRequestPayload(channel, event, message);
        int maxAttempt = Math.max(0, channel.getRetryCount() == null ? 0 : channel.getRetryCount()) + 1;
        SendAttempt last = null;
        for (int attempt = 1; attempt <= maxAttempt; attempt++) {
            last = doSend(channel, payload, attempt - 1);
            if (last.success()) {
                return last;
            }
        }
        return last == null ? new SendAttempt(false, payload, null, "通知发送失败", 0) : last;
    }

    private SendAttempt doSend(NotificationChannelEntity channel, String payload, int retryCount) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(normalizeRange(channel.getTimeoutMs(), 5000, 1000, 60000)))
                    .build();
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(channel.getWebhookUrl()))
                    .timeout(Duration.ofMillis(normalizeRange(channel.getTimeoutMs(), 5000, 1000, 60000)))
                    .header("Content-Type", "application/json; charset=UTF-8");
            readHeaders(channel.getHeadersJson()).forEach(builder::header);
            builder.method(normalizeHttpMethod(channel.getHttpMethod()), HttpRequest.BodyPublishers.ofString(payload));
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            boolean success = response.statusCode() >= 200 && response.statusCode() < 300;
            if (CHANNEL_WECOM.equals(channel.getChannelType()) && response.body() != null) {
                success = success && response.body().contains("\"errcode\":0");
            }
            return new SendAttempt(success, payload, response.body(), success ? null : "HTTP " + response.statusCode(), retryCount);
        } catch (Exception error) {
            return new SendAttempt(false, payload, null, error.getMessage(), retryCount);
        }
    }

    private String buildRequestPayload(NotificationChannelEntity channel, NotificationEvent event, String message) {
        if (CHANNEL_WECOM.equals(channel.getChannelType())) {
            return toJson(Map.of(
                    "msgtype", "markdown",
                    "markdown", Map.of("content", message)
            ));
        }
        String template = blankToNull(channel.getBodyTemplate());
        if (template != null) {
            return applyTemplate(template, event, message);
        }
        return toJson(Map.of(
                "eventType", event.eventType(),
                "eventName", eventName(event.eventType()),
                "title", event.eventTitle(),
                "targetName", event.targetName(),
                "result", event.result(),
                "message", message
        ));
    }

    private String buildMessage(NotificationEvent event) {
        StringBuilder builder = new StringBuilder();
        builder.append("### ").append(event.eventTitle()).append('\n');
        appendLine(builder, "对象", event.targetName());
        appendLine(builder, "结果", event.result());
        if (event.totalCount() != null) {
            appendLine(builder, "统计", "总数 " + event.totalCount()
                    + " / 成功 " + defaultNumber(event.successCount())
                    + " / 失败 " + defaultNumber(event.failedCount()));
        }
        if (event.durationMs() != null) {
            appendLine(builder, "耗时", formatDuration(event.durationMs()));
        }
        appendLine(builder, "失败原因", event.failureSummary());
        appendLine(builder, "触发时间", LocalDateTime.now().format(NOTIFICATION_TIME_FORMATTER));
        String link = resolveLinkUrl(event.linkUrl());
        if (link != null) {
            builder.append('\n').append("[查看详情](").append(link).append(")");
        }
        return builder.toString();
    }

    private String resolveLinkUrl(String linkUrl) {
        String link = blankToNull(linkUrl);
        if (link == null || isAbsoluteUrl(link)) {
            return link;
        }
        String baseUrl = link.startsWith("/api/") ? publicBackendBaseUrl : publicFrontendBaseUrl;
        if (baseUrl == null) {
            baseUrl = publicBackendBaseUrl;
        }
        if (baseUrl == null) {
            return link;
        }
        return link.startsWith("/")
                ? baseUrl + link
                : baseUrl + "/" + link;
    }

    private boolean isAbsoluteUrl(String link) {
        String lower = link.toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    private String normalizePublicBaseUrl(String value) {
        String baseUrl = blankToNull(value);
        if (baseUrl == null) {
            return null;
        }
        while (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }

    private void appendLine(StringBuilder builder, String label, String value) {
        String text = blankToNull(value);
        if (text != null) {
            builder.append("> ").append(label).append("：").append(text).append('\n');
        }
    }

    private void persistRecord(NotificationRuleEntity rule, NotificationChannelEntity channel, NotificationEvent event, SendAttempt attempt) {
        LocalDateTime now = LocalDateTime.now();
        NotificationRecordEntity record = new NotificationRecordEntity();
        record.setWorkspaceId(event.workspaceId());
        record.setRuleId(rule.getId());
        record.setRuleName(rule.getRuleName());
        record.setChannelId(channel.getId());
        record.setChannelName(channel.getChannelName());
        record.setEventType(event.eventType());
        record.setEventTitle(event.eventTitle());
        record.setTargetType(event.targetType());
        record.setTargetId(event.targetId());
        record.setTargetName(event.targetName());
        record.setSendStatus(attempt.success() ? STATUS_SUCCESS : STATUS_FAILED);
        record.setRequestPayload(attempt.requestPayload());
        record.setResponseBody(attempt.responseBody());
        record.setErrorMessage(attempt.errorMessage());
        record.setRetryCount(attempt.retryCount());
        record.setTriggeredAt(now);
        record.setSentAt(now);
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        recordMapper.insert(record);
    }

    private void fillChannel(NotificationChannelEntity entity, SaveNotificationChannelRequest request, boolean keepOldSecret) {
        entity.setChannelName(requiredText(request.channelName(), "渠道名称不能为空"));
        entity.setChannelType(normalizeChannelType(request.channelType()));
        entity.setWebhookUrl(requiredText(request.webhookUrl(), "Webhook 地址不能为空"));
        if (blankToNull(request.secretKey()) != null) {
            entity.setSecretKey(request.secretKey().trim());
        } else if (!keepOldSecret) {
            entity.setSecretKey(null);
        }
        entity.setHttpMethod(normalizeHttpMethod(request.httpMethod()));
        entity.setHeadersJson(validateJsonObjectOrNull(request.headersJson(), "请求头必须是 JSON 对象"));
        entity.setBodyTemplate(blankToNull(request.bodyTemplate()));
        entity.setTimeoutMs(normalizeRange(request.timeoutMs(), 5000, 1000, 60000));
        entity.setRetryCount(normalizeRange(request.retryCount(), 2, 0, 5));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
        entity.setRemark(blankToNull(request.remark()));
    }

    private void fillRule(NotificationRuleEntity entity, SaveNotificationRuleRequest request) {
        entity.setRuleName(requiredText(request.ruleName(), "规则名称不能为空"));
        entity.setEventType(normalizeEventType(request.eventType()));
        entity.setTriggerCondition(normalizeTriggerCondition(request.triggerCondition()));
        List<Long> channelIds = request.channelIds() == null ? List.of() : request.channelIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (channelIds.isEmpty()) {
            throw new BadRequestException("通知规则至少选择一个通知渠道");
        }
        for (Long channelId : channelIds) {
            NotificationChannelEntity channel = requireChannel(channelId);
            if (!entity.getWorkspaceId().equals(channel.getWorkspaceId())) {
                throw new BadRequestException("通知渠道必须属于同一工作空间");
            }
        }
        entity.setChannelIdsJson(toJson(channelIds));
        entity.setFrequencyLimitSeconds(normalizeRange(request.frequencyLimitSeconds(), 0, 0, 3600));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private NotificationChannelItem toChannelItem(NotificationChannelEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new NotificationChannelItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getChannelName(),
                entity.getChannelType(),
                channelTypeName(entity.getChannelType()),
                entity.getWebhookUrl(),
                blankToNull(entity.getSecretKey()) != null,
                entity.getHttpMethod(),
                entity.getHeadersJson(),
                entity.getBodyTemplate(),
                entity.getTimeoutMs(),
                entity.getRetryCount(),
                entity.getStatus(),
                entity.getRemark(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private NotificationRuleItem toRuleItem(NotificationRuleEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        List<Long> channelIds = readChannelIds(entity.getChannelIdsJson());
        List<String> channelNames = channelIds.stream()
                .map(channelMapper::selectById)
                .filter(Objects::nonNull)
                .map(NotificationChannelEntity::getChannelName)
                .toList();
        return new NotificationRuleItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getRuleName(),
                entity.getEventType(),
                eventName(entity.getEventType()),
                entity.getTriggerCondition(),
                channelIds,
                channelNames,
                entity.getFrequencyLimitSeconds(),
                entity.getStatus(),
                entity.getLastTriggeredAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private NotificationRecordItem toRecordItem(NotificationRecordEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new NotificationRecordItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getRuleId(),
                entity.getRuleName(),
                entity.getChannelId(),
                entity.getChannelName(),
                entity.getEventType(),
                eventName(entity.getEventType()),
                entity.getEventTitle(),
                entity.getTargetType(),
                entity.getTargetId(),
                entity.getTargetName(),
                entity.getSendStatus(),
                entity.getResponseBody(),
                entity.getErrorMessage(),
                entity.getRetryCount(),
                entity.getTriggeredAt(),
                entity.getSentAt(),
                entity.getCreatedAt()
        );
    }

    private <T> void applyWorkspaceScope(LambdaQueryWrapper<T> query, com.baomidou.mybatisplus.core.toolkit.support.SFunction<T, Long> column, String workspaceCode) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(column, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(column, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
    }

    private WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }

    private WorkspaceEntity resolveScopedWorkspaceForWrite(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            throw new BadRequestException("请先切换到具体工作空间");
        }
        return workspaceService.requireWritableWorkspace(normalized);
    }

    private void validateReadable(Long workspaceId, String workspaceCode, String message) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null && !workspace.getId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
        if (workspace == null && !workspaceService.isPlatformAdmin()
                && !workspaceService.listReadableWorkspaceIds().contains(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private NotificationChannelEntity requireChannel(Long id) {
        NotificationChannelEntity entity = channelMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Notification channel not found");
        }
        return entity;
    }

    private NotificationRuleEntity requireRule(Long id) {
        NotificationRuleEntity entity = ruleMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Notification rule not found");
        }
        return entity;
    }

    private boolean matchesCondition(NotificationRuleEntity rule, NotificationEvent event) {
        String condition = normalizeTriggerCondition(rule.getTriggerCondition());
        String result = blankToNull(event.result());
        if ("SUCCESS_ONLY".equals(condition)) {
            return "SUCCESS".equalsIgnoreCase(result);
        }
        if ("FAILURE_ONLY".equals(condition)) {
            return "FAILED".equalsIgnoreCase(result);
        }
        return true;
    }

    private boolean isRateLimited(NotificationRuleEntity rule) {
        int seconds = rule.getFrequencyLimitSeconds() == null ? 0 : rule.getFrequencyLimitSeconds();
        return seconds > 0
                && rule.getLastTriggeredAt() != null
                && rule.getLastTriggeredAt().plusSeconds(seconds).isAfter(LocalDateTime.now());
    }

    private List<Long> readChannelIds(String json) {
        try {
            return objectMapper.readValue(blankToNull(json) == null ? "[]" : json, LONG_LIST_TYPE);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private Map<String, String> readHeaders(String json) {
        try {
            return objectMapper.readValue(blankToNull(json) == null ? "{}" : json, STRING_MAP_TYPE);
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private String validateJsonObjectOrNull(String json, String message) {
        String value = blankToNull(json);
        if (value == null) {
            return null;
        }
        try {
            objectMapper.readValue(value, STRING_MAP_TYPE);
            return value;
        } catch (Exception ignored) {
            throw new BadRequestException(message);
        }
    }

    private String applyTemplate(String template, NotificationEvent event, String message) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("eventName", eventName(event.eventType()));
        values.put("eventType", event.eventType());
        values.put("title", nullToEmpty(event.eventTitle()));
        values.put("targetName", nullToEmpty(event.targetName()));
        values.put("result", nullToEmpty(event.result()));
        values.put("totalCount", String.valueOf(defaultNumber(event.totalCount())));
        values.put("successCount", String.valueOf(defaultNumber(event.successCount())));
        values.put("failedCount", String.valueOf(defaultNumber(event.failedCount())));
        values.put("duration", event.durationMs() == null ? "" : formatDuration(event.durationMs()));
        values.put("failureSummary", nullToEmpty(event.failureSummary()));
        values.put("linkUrl", nullToEmpty(resolveLinkUrl(event.linkUrl())));
        values.put("message", message);
        String result = template;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            result = result.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return result;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception error) {
            throw new BadRequestException("JSON serialization failed");
        }
    }

    private String normalizeEventType(String value) {
        String normalized = requiredText(value, "触发场景不能为空").toUpperCase(Locale.ROOT);
        if (!List.of(EVENT_API_SUITE_FINISHED, EVENT_API_SUITE_FAILED, EVENT_WEB_UI_FINISHED, EVENT_WEB_UI_FAILED).contains(normalized)) {
            throw new BadRequestException("Unsupported notification event type");
        }
        return normalized;
    }

    private String normalizeEventTypeOrNull(String value) {
        return blankToNull(value) == null ? null : normalizeEventType(value);
    }

    private String normalizeChannelType(String value) {
        String normalized = requiredText(value, "渠道类型不能为空").toUpperCase(Locale.ROOT);
        if ("WE_COM".equals(normalized)
                || "WECOM".equals(normalized)
                || "WE_COM_ROBOT".equals(normalized)
                || CHANNEL_WECOM.equals(normalized)) {
            return CHANNEL_WECOM;
        }
        if (CHANNEL_WEBHOOK.equals(normalized)) {
            return CHANNEL_WEBHOOK;
        }
        throw new BadRequestException("Unsupported notification channel type");
    }

    private String normalizeChannelTypeOrNull(String value) {
        return blankToNull(value) == null ? null : normalizeChannelType(value);
    }

    private String normalizeHttpMethod(String value) {
        String method = blankToNull(value) == null ? "POST" : value.trim().toUpperCase(Locale.ROOT);
        if (!"POST".equals(method) && !"PUT".equals(method)) {
            throw new BadRequestException("Webhook 请求方式只支持 POST 或 PUT");
        }
        return method;
    }

    private String normalizeTriggerCondition(String value) {
        String condition = blankToNull(value) == null ? "ALWAYS" : value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALWAYS", "SUCCESS_ONLY", "FAILURE_ONLY").contains(condition)) {
            throw new BadRequestException("Unsupported notification trigger condition");
        }
        return condition;
    }

    private Integer normalizeStatus(Integer status) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("状态只能是 0 或 1");
        }
        return status;
    }

    private int normalizeRange(Integer value, int fallback, int min, int max) {
        int current = value == null ? fallback : value;
        return Math.max(min, Math.min(max, current));
    }

    private String requiredText(String value, String message) {
        String trimmed = blankToNull(value);
        if (trimmed == null) {
            throw new BadRequestException(message);
        }
        return trimmed;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private int defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String formatDuration(Long durationMs) {
        if (durationMs == null) {
            return "";
        }
        if (durationMs < 1000) {
            return durationMs + "ms";
        }
        return String.format(Locale.ROOT, "%.1fs", durationMs / 1000.0);
    }

    public String eventName(String eventType) {
        return switch (eventType) {
            case EVENT_API_SUITE_FINISHED -> "接口自动化套件执行完成";
            case EVENT_API_SUITE_FAILED -> "接口自动化套件执行失败";
            case EVENT_WEB_UI_FINISHED -> "Web UI 执行完成";
            case EVENT_WEB_UI_FAILED -> "Web UI 执行失败";
            default -> eventType;
        };
    }

    private String channelTypeName(String channelType) {
        return switch (channelType) {
            case CHANNEL_WECOM -> "企业微信机器人";
            case CHANNEL_WEBHOOK -> "通用 Webhook";
            default -> channelType;
        };
    }

    private record SendAttempt(
            boolean success,
            String requestPayload,
            String responseBody,
            String errorMessage,
            int retryCount
    ) {
    }
}
