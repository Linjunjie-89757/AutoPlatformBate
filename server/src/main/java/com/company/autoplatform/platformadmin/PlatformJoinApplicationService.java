package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationMapper;
import com.company.autoplatform.workspace.WorkspaceJoinService;
import com.company.autoplatform.workspace.WorkspaceMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class PlatformJoinApplicationService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED";

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceJoinApplicationMapper applicationMapper;
    private final WorkspaceMapper workspaceMapper;
    private final UserService userService;
    private final WorkspaceJoinService workspaceJoinService;
    private final PlatformNotificationSettingsService notificationSettingsService;

    public PlatformJoinApplicationService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceJoinApplicationMapper applicationMapper,
            WorkspaceMapper workspaceMapper,
            UserService userService,
            WorkspaceJoinService workspaceJoinService,
            PlatformNotificationSettingsService notificationSettingsService
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.applicationMapper = applicationMapper;
        this.workspaceMapper = workspaceMapper;
        this.userService = userService;
        this.workspaceJoinService = workspaceJoinService;
        this.notificationSettingsService = notificationSettingsService;
    }

    public List<PlatformJoinApplicationItem> listApplications(String status) {
        requireSuperAdmin();
        LambdaQueryWrapper<WorkspaceJoinApplicationEntity> query =
                new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                        .orderByDesc(WorkspaceJoinApplicationEntity::getUpdatedAt)
                        .orderByDesc(WorkspaceJoinApplicationEntity::getId);
        String normalizedStatus = status == null || status.isBlank()
                ? STATUS_PENDING
                : status.trim().toUpperCase(Locale.ROOT);
        if (STATUS_PENDING.equals(normalizedStatus)) {
            query.eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING);
        } else if ("HANDLED".equals(normalizedStatus)) {
            query.in(WorkspaceJoinApplicationEntity::getStatus, STATUS_APPROVED, STATUS_REJECTED);
        } else if (!"ALL".equals(normalizedStatus)) {
            throw new BadRequestException("无效的申请状态");
        }
        return applicationMapper.selectList(query).stream().map(this::toItem).toList();
    }

    @Transactional
    public PlatformJoinApplicationItem approveApplication(Long applicationId) {
        requireSuperAdmin();
        WorkspaceJoinApplicationEntity application = requireApplication(applicationId);
        WorkspaceEntity workspace = requireWorkspace(application.getWorkspaceId());
        workspaceJoinService.approveApplication(workspace.getWorkspaceCode(), applicationId);
        PlatformJoinApplicationItem item = toItem(requireApplication(applicationId));
        notificationSettingsService.sendOptional(
                "approve",
                item.applicantEmail(),
                "AutoTest 工作区申请已通过",
                "您好，%s：\n\n你加入工作区“%s”的申请已通过，现在可以进入该工作区。"
                        .formatted(item.applicantName(), item.workspaceName())
        );
        return item;
    }

    @Transactional
    public PlatformJoinApplicationItem rejectApplication(Long applicationId, String reason) {
        requireSuperAdmin();
        WorkspaceJoinApplicationEntity application = requireApplication(applicationId);
        WorkspaceEntity workspace = requireWorkspace(application.getWorkspaceId());
        workspaceJoinService.rejectApplication(workspace.getWorkspaceCode(), applicationId, reason);
        PlatformJoinApplicationItem item = toItem(requireApplication(applicationId));
        notificationSettingsService.sendOptional(
                "approve",
                item.applicantEmail(),
                "AutoTest 工作区申请未通过",
                "您好，%s：\n\n你加入工作区“%s”的申请未通过。原因：%s"
                        .formatted(item.applicantName(), item.workspaceName(), item.rejectReason())
        );
        return item;
    }

    private PlatformJoinApplicationItem toItem(WorkspaceJoinApplicationEntity application) {
        WorkspaceEntity workspace = requireWorkspace(application.getWorkspaceId());
        UserEntity applicant = userService.requireAnyUser(application.getApplicantUserId());
        boolean pending = STATUS_PENDING.equals(application.getStatus());
        return new PlatformJoinApplicationItem(
                application.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                workspace.getDescription(),
                applicant.getId(),
                firstNonBlank(applicant.getDisplayName(), applicant.getUsername()),
                applicant.getEmail(),
                application.getStatus(),
                application.getRejectReason(),
                application.getCreatedAt(),
                pending ? null : application.getUpdatedAt()
        );
    }

    private WorkspaceJoinApplicationEntity requireApplication(Long applicationId) {
        WorkspaceJoinApplicationEntity application = applicationMapper.selectById(applicationId);
        if (application == null) {
            throw new NotFoundException("工作区申请不存在");
        }
        return application;
    }

    private WorkspaceEntity requireWorkspace(Long workspaceId) {
        WorkspaceEntity workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new NotFoundException("工作区不存在");
        }
        return workspace;
    }

    private void requireSuperAdmin() {
        if (!workspaceAccessSupport.isSuperAdmin()) {
            throw new org.springframework.security.access.AccessDeniedException("仅超级管理员可审批平台申请");
        }
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        return second == null || second.isBlank() ? "未命名用户" : second;
    }
}
