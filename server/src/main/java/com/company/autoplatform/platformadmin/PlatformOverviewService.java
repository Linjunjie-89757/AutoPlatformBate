package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.audit.OperationAuditLogEntity;
import com.company.autoplatform.audit.OperationAuditLogMapper;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationMapper;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceMemberEntity;
import com.company.autoplatform.workspace.WorkspaceMemberMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PlatformOverviewService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String RESULT_SUCCESS = "SUCCESS";
    private static final String AUTH_CATEGORY = "AUTH";
    private static final String LOGIN_ACTION = "登录系统登录";

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final UserMapper userMapper;
    private final WorkspaceJoinApplicationMapper applicationMapper;
    private final OperationAuditLogMapper auditLogMapper;

    public PlatformOverviewService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            UserMapper userMapper,
            WorkspaceJoinApplicationMapper applicationMapper,
            OperationAuditLogMapper auditLogMapper
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.userMapper = userMapper;
        this.applicationMapper = applicationMapper;
        this.auditLogMapper = auditLogMapper;
    }

    public PlatformOverviewResponse getOverview() {
        requireSuperAdmin();

        long workspaceTotal = workspaceMapper.selectCount(null);
        long registeredUserTotal = userMapper.selectCount(null);
        long pendingApprovalTotal = applicationMapper.selectCount(
                new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                        .eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING)
        );
        long todayActiveUserTotal = countTodayActiveUsers();

        return new PlatformOverviewResponse(
                workspaceTotal,
                registeredUserTotal,
                todayActiveUserTotal,
                pendingApprovalTotal,
                listWorkspaceSummaries(),
                listRecentOperations()
        );
    }

    private List<PlatformOverviewWorkspaceItem> listWorkspaceSummaries() {
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                        .orderByDesc(WorkspaceEntity::getStatus)
                        .orderByAsc(WorkspaceEntity::getId)
                        .last("limit 5"))
                .stream()
                .map(workspace -> new PlatformOverviewWorkspaceItem(
                        workspace.getWorkspaceCode(),
                        workspace.getWorkspaceName(),
                        workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                                .eq(WorkspaceMemberEntity::getStatus, 1)),
                        workspace.getStatus()
                ))
                .toList();
    }

    private List<PlatformOverviewOperationItem> listRecentOperations() {
        return auditLogMapper.selectList(new LambdaQueryWrapper<OperationAuditLogEntity>()
                        .orderByDesc(OperationAuditLogEntity::getId)
                        .last("limit 6"))
                .stream()
                .map(item -> new PlatformOverviewOperationItem(
                        item.getId(),
                        firstNonBlank(item.getOperatorDisplayName(), item.getOperatorUsername(), "系统"),
                        item.getActionName(),
                        item.getTarget(),
                        item.getResult(),
                        item.getCreatedAt()
                ))
                .toList();
    }

    private long countTodayActiveUsers() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        return auditLogMapper.selectList(new LambdaQueryWrapper<OperationAuditLogEntity>()
                        .eq(OperationAuditLogEntity::getCategory, AUTH_CATEGORY)
                        .eq(OperationAuditLogEntity::getActionName, LOGIN_ACTION)
                        .eq(OperationAuditLogEntity::getResult, RESULT_SUCCESS)
                        .ge(OperationAuditLogEntity::getCreatedAt, startOfDay)
                        .isNotNull(OperationAuditLogEntity::getOperatorUserId))
                .stream()
                .map(OperationAuditLogEntity::getOperatorUserId)
                .distinct()
                .count();
    }

    private void requireSuperAdmin() {
        if (!workspaceAccessSupport.isSuperAdmin()) {
            throw new AccessDeniedException("仅超级管理员可访问平台管理");
        }
    }

    private String firstNonBlank(String first, String second, String fallback) {
        if (first != null && !first.isBlank()) return first;
        if (second != null && !second.isBlank()) return second;
        return fallback;
    }
}
