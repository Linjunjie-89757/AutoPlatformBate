package com.company.autoplatform.notification;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

import static com.company.autoplatform.notification.NotificationModels.*;

@RestController
@RequestMapping("/api/settings/notifications")
public class NotificationController {

    private final NotificationDomainService notificationDomainService;

    public NotificationController(NotificationDomainService notificationDomainService) {
        this.notificationDomainService = notificationDomainService;
    }

    @GetMapping("/event-types")
    public ApiResponse<List<NotificationEventOption>> listEventTypes() {
        return ApiResponse.ok(notificationDomainService.listEventTypes());
    }

    @GetMapping("/channels")
    public ApiResponse<PageResponse<NotificationChannelItem>> listChannels(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String channelType,
            @RequestParam(required = false) Integer status
    ) {
        return ApiResponse.ok(notificationDomainService.listChannels(workspaceCode, keyword, channelType, status));
    }

    @PostMapping("/channels")
    public ApiResponse<NotificationChannelItem> createChannel(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveNotificationChannelRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.createChannel(workspaceCode, request), "通知渠道已创建");
    }

    @PutMapping("/channels/{id}")
    public ApiResponse<NotificationChannelItem> updateChannel(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveNotificationChannelRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.updateChannel(id, workspaceCode, request), "通知渠道已更新");
    }

    @PutMapping("/channels/{id}/status")
    public ApiResponse<NotificationChannelItem> updateChannelStatus(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody UpdateNotificationStatusRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.updateChannelStatus(id, workspaceCode, request), "通知渠道状态已更新");
    }

    @DeleteMapping("/channels/{id}")
    public ApiResponse<Void> deleteChannel(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        notificationDomainService.deleteChannel(id, workspaceCode);
        return ApiResponse.ok(null, "通知渠道已删除");
    }

    @PostMapping("/channels/test")
    public ApiResponse<NotificationSendResult> testChannel(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody TestNotificationChannelRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.testChannel(workspaceCode, request), "测试通知已发送");
    }

    @GetMapping("/rules")
    public ApiResponse<PageResponse<NotificationRuleItem>> listRules(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) Integer status
    ) {
        return ApiResponse.ok(notificationDomainService.listRules(workspaceCode, keyword, eventType, status));
    }

    @PostMapping("/rules")
    public ApiResponse<NotificationRuleItem> createRule(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveNotificationRuleRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.createRule(workspaceCode, request), "通知规则已创建");
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<NotificationRuleItem> updateRule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveNotificationRuleRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.updateRule(id, workspaceCode, request), "通知规则已更新");
    }

    @PutMapping("/rules/{id}/status")
    public ApiResponse<NotificationRuleItem> updateRuleStatus(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody UpdateNotificationStatusRequest request
    ) {
        return ApiResponse.ok(notificationDomainService.updateRuleStatus(id, workspaceCode, request), "通知规则状态已更新");
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        notificationDomainService.deleteRule(id, workspaceCode);
        return ApiResponse.ok(null, "通知规则已删除");
    }

    @GetMapping("/records")
    public ApiResponse<PageResponse<NotificationRecordItem>> listRecords(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String sendStatus,
            @RequestParam(required = false) Long channelId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(notificationDomainService.listRecords(workspaceCode, eventType, sendStatus, channelId, createdFrom, createdTo, pageNo, pageSize));
    }
}
