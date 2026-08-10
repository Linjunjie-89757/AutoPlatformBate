package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class WorkspaceAccessSupport {

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceDomainService workspaceDomainService;

    public WorkspaceAccessSupport(
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            WorkspaceDomainService workspaceDomainService
    ) {
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceDomainService = workspaceDomainService;
    }

    public WorkspaceEntity requireReadableWorkspace(String workspaceCode) {
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        if (!isPlatformAdmin() && !listReadableWorkspaceIds().contains(workspace.getId())) {
            throw new BadRequestException("当前账号无权访问该工作空间");
        }
        return workspace;
    }

    public WorkspaceEntity requireWritableWorkspace(String workspaceCode) {
        return requireReadableWorkspace(workspaceCode);
    }

    public WorkspaceEntity requireWorkspaceAdmin(String workspaceCode) {
        WorkspaceEntity workspace = requireReadableWorkspace(workspaceCode);
        if (isPlatformAdmin()) {
            return workspace;
        }

        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        if (workspace.getOwnerUserId() != null && workspace.getOwnerUserId().equals(currentUser.userId())) {
            return workspace;
        }

        Long adminCount = workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, currentUser.userId())
                .eq(WorkspaceMemberEntity::getRoleCode, "ADMIN")
                .eq(WorkspaceMemberEntity::getStatus, 1));
        if (adminCount == 0) {
            throw new BadRequestException("只有工作区管理员可执行该操作");
        }
        return workspace;
    }

    public String resolveTargetWorkspace(String headerWorkspaceCode, String bodyWorkspaceCode) {
        String normalized = WorkspaceScope.normalize(headerWorkspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            if (bodyWorkspaceCode == null || bodyWorkspaceCode.isBlank()) {
                throw new BadRequestException("全部视角下必须明确选择目标空间");
            }
            requireWritableWorkspace(bodyWorkspaceCode);
            return bodyWorkspaceCode;
        }
        requireWritableWorkspace(normalized);
        return normalized;
    }

    public List<WorkspaceEntity> listReadableWorkspaceEntities() {
        if (isPlatformAdmin()) {
            return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                    .eq(WorkspaceEntity::getStatus, 1)
                    .orderByAsc(WorkspaceEntity::getId));
        }
        Set<Long> workspaceIds = new LinkedHashSet<>(listReadableWorkspaceIds());
        if (workspaceIds.isEmpty()) {
            return List.of();
        }
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getStatus, 1)
                .in(WorkspaceEntity::getId, workspaceIds)
                .orderByAsc(WorkspaceEntity::getId));
    }

    public List<Long> listReadableWorkspaceIds() {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        if (PlatformRole.isAdminRole(currentUser.platformRole())) {
            return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                            .eq(WorkspaceEntity::getStatus, 1)
                            .orderByAsc(WorkspaceEntity::getId))
                    .stream()
                    .map(WorkspaceEntity::getId)
                    .toList();
        }
        return workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getUserId, currentUser.userId())
                        .eq(WorkspaceMemberEntity::getStatus, 1)
                        .orderByAsc(WorkspaceMemberEntity::getId))
                .stream()
                .map(WorkspaceMemberEntity::getWorkspaceId)
                .distinct()
                .toList();
    }

    public List<String> listReadableWorkspaceCodes() {
        return listReadableWorkspaceEntities().stream()
                .map(WorkspaceEntity::getWorkspaceCode)
                .toList();
    }

    public boolean isSuperAdmin() {
        return PlatformRole.isSuperAdmin(CurrentUserContext.require().platformRole());
    }

    public boolean isPlatformAdmin() {
        return PlatformRole.isAdminRole(CurrentUserContext.require().platformRole());
    }

    public void requirePlatformAdmin() {
        if (!isPlatformAdmin()) {
            throw new BadRequestException("只有管理员可执行该操作");
        }
    }
}
