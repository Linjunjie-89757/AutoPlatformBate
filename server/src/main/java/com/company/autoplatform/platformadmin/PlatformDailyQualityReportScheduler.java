package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceMemberEntity;
import com.company.autoplatform.workspace.WorkspaceMemberMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class PlatformDailyQualityReportScheduler {

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper memberMapper;
    private final UserMapper userMapper;
    private final ReportMapper reportMapper;
    private final PlatformNotificationDeliveryMapper deliveryMapper;
    private final PlatformNotificationSettingsService notificationService;

    public PlatformDailyQualityReportScheduler(
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper memberMapper,
            UserMapper userMapper,
            ReportMapper reportMapper,
            PlatformNotificationDeliveryMapper deliveryMapper,
            PlatformNotificationSettingsService notificationService
    ) {
        this.workspaceMapper = workspaceMapper;
        this.memberMapper = memberMapper;
        this.userMapper = userMapper;
        this.reportMapper = reportMapper;
        this.deliveryMapper = deliveryMapper;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "${app.platform-notifications.daily-cron:0 0 9 * * *}", zone = "Asia/Shanghai")
    public void sendPreviousDaySummary() {
        if (!notificationService.isRuleEnabled("daily")) return;
        LocalDate reportDate = LocalDate.now().minusDays(1);
        workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                        .eq(WorkspaceEntity::getStatus, 1)
                        .orderByAsc(WorkspaceEntity::getId))
                .forEach(workspace -> sendWorkspaceSummary(workspace, reportDate));
    }

    private void sendWorkspaceSummary(WorkspaceEntity workspace, LocalDate reportDate) {
        LocalDateTime start = reportDate.atStartOfDay();
        LocalDateTime end = reportDate.plusDays(1).atStartOfDay();
        List<ReportEntity> reports = reportMapper.selectList(new LambdaQueryWrapper<ReportEntity>()
                .eq(ReportEntity::getWorkspaceId, workspace.getId())
                .ge(ReportEntity::getCreatedAt, start)
                .lt(ReportEntity::getCreatedAt, end));
        long succeeded = reports.stream().filter(report -> "SUCCESS".equalsIgnoreCase(report.getResult())).count();
        long failed = reports.stream().filter(report -> "FAILED".equalsIgnoreCase(report.getResult())).count();
        String content = "工作区“%s”在 %s 的测试质量摘要：\n执行报告：%d\n成功：%d\n失败：%d"
                .formatted(workspace.getWorkspaceName(), reportDate, reports.size(), succeeded, failed);

        for (UserEntity recipient : administratorRecipients(workspace)) {
            sendOnce(
                    "daily:%s:%s".formatted(reportDate, workspace.getWorkspaceCode()),
                    recipient.getEmail(),
                    "AutoTest 每日质量报告 - " + workspace.getWorkspaceName(),
                    content
            );
        }
    }

    private Set<UserEntity> administratorRecipients(WorkspaceEntity workspace) {
        Set<Long> userIds = new LinkedHashSet<>();
        if (workspace.getOwnerUserId() != null) userIds.add(workspace.getOwnerUserId());
        memberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceMemberEntity::getRoleCode, "ADMIN")
                        .eq(WorkspaceMemberEntity::getStatus, 1))
                .stream()
                .map(WorkspaceMemberEntity::getUserId)
                .forEach(userIds::add);

        Set<UserEntity> recipients = new LinkedHashSet<>();
        for (Long userId : userIds) {
            UserEntity user = userMapper.selectById(userId);
            if (user != null && user.getStatus() != null && user.getStatus() == 1
                    && user.getEmail() != null && !user.getEmail().isBlank()) {
                recipients.add(user);
            }
        }
        return recipients;
    }

    private void sendOnce(String eventKey, String recipient, String subject, String content) {
        PlatformNotificationDeliveryEntity delivery = deliveryMapper.selectOne(
                new LambdaQueryWrapper<PlatformNotificationDeliveryEntity>()
                        .eq(PlatformNotificationDeliveryEntity::getEventKey, eventKey)
                        .eq(PlatformNotificationDeliveryEntity::getRecipient, recipient)
                        .last("limit 1"));
        if (delivery != null && "SENT".equals(delivery.getStatus())) return;

        LocalDateTime now = LocalDateTime.now();
        if (delivery == null) {
            delivery = new PlatformNotificationDeliveryEntity();
            delivery.setEventKey(eventKey);
            delivery.setRecipient(recipient);
            delivery.setStatus("PENDING");
            delivery.setCreatedAt(now);
            delivery.setUpdatedAt(now);
            try {
                deliveryMapper.insert(delivery);
            } catch (DuplicateKeyException ignored) {
                return;
            }
        }

        boolean sent = notificationService.sendOptional("daily", recipient, subject, content);
        delivery.setStatus(sent ? "SENT" : "FAILED");
        delivery.setLastError(sent ? null : "邮件发送失败或通知配置不可用");
        delivery.setSentAt(sent ? now : null);
        delivery.setUpdatedAt(now);
        deliveryMapper.updateById(delivery);
    }
}
