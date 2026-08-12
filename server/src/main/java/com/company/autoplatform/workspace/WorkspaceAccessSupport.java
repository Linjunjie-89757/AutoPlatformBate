package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class WorkspaceAccessSupport {

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceMemberRoleMapper workspaceMemberRoleMapper;
    private final WorkspaceRolePermissionMapper workspaceRolePermissionMapper;
    private final WorkspaceDomainService workspaceDomainService;

    public WorkspaceAccessSupport(
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            WorkspaceMemberRoleMapper workspaceMemberRoleMapper,
            WorkspaceRolePermissionMapper workspaceRolePermissionMapper,
            WorkspaceDomainService workspaceDomainService
    ) {
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceMemberRoleMapper = workspaceMemberRoleMapper;
        this.workspaceRolePermissionMapper = workspaceRolePermissionMapper;
        this.workspaceDomainService = workspaceDomainService;
    }

    public WorkspaceEntity requireReadableWorkspace(String workspaceCode) {
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        if (!isPlatformAdmin() && !listReadableWorkspaceIds().contains(workspace.getId())) {
            throw new AccessDeniedException("当前账号无权访问该工作空间");
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
            throw new AccessDeniedException("只有工作区管理员可执行该操作");
        }
        return workspace;
    }

    public WorkspaceEntity requirePermission(String workspaceCode, String permissionCode) {
        if (!WorkspacePermissionCatalog.contains(permissionCode)) {
            throw new IllegalArgumentException("Unknown workspace permission: " + permissionCode);
        }
        WorkspaceEntity workspace = requireReadableWorkspace(workspaceCode);
        if (isPlatformAdmin()) {
            return workspace;
        }

        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        if (workspace.getOwnerUserId() != null && workspace.getOwnerUserId().equals(currentUser.userId())) {
            return workspace;
        }
        WorkspaceMemberEntity membership = findActiveMembership(workspace.getId(), currentUser.userId());
        if (membership != null && "ADMIN".equalsIgnoreCase(membership.getRoleCode())) {
            return workspace;
        }
        if (membership == null || !listPermissionCodes(membership.getId()).contains(permissionCode)) {
            throw new AccessDeniedException("当前账号缺少权限: " + permissionCode);
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

    public List<WorkspaceAccessItem> listCurrentWorkspaceAccesses() {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        List<WorkspaceEntity> workspaces = listReadableWorkspaceEntities();
        if (workspaces.isEmpty()) {
            return List.of();
        }

        boolean platformAdmin = isPlatformAdmin();
        Map<Long, WorkspaceMemberEntity> memberships = new LinkedHashMap<>();
        if (!platformAdmin) {
            workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                            .eq(WorkspaceMemberEntity::getUserId, currentUser.userId())
                            .eq(WorkspaceMemberEntity::getStatus, 1)
                            .in(WorkspaceMemberEntity::getWorkspaceId, workspaces.stream().map(WorkspaceEntity::getId).toList()))
                    .forEach(member -> memberships.put(member.getWorkspaceId(), member));
        }

        return workspaces.stream().map(workspace -> {
            if (platformAdmin) {
                return new WorkspaceAccessItem(
                        workspace.getWorkspaceCode(),
                        "ADMIN",
                        true,
                        WorkspacePermissionCatalog.allCodes()
                );
            }
            if (workspace.getOwnerUserId() != null && workspace.getOwnerUserId().equals(currentUser.userId())) {
                return new WorkspaceAccessItem(
                        workspace.getWorkspaceCode(),
                        "OWNER",
                        true,
                        WorkspacePermissionCatalog.allCodes()
                );
            }
            WorkspaceMemberEntity member = memberships.get(workspace.getId());
            String memberType = member == null || member.getRoleCode() == null
                    ? "MEMBER"
                    : member.getRoleCode().trim().toUpperCase();
            boolean canManage = "ADMIN".equals(memberType);
            return new WorkspaceAccessItem(
                    workspace.getWorkspaceCode(),
                    memberType,
                    canManage,
                    canManage
                            ? WorkspacePermissionCatalog.allCodes()
                            : member == null ? List.of() : listPermissionCodes(member.getId())
            );
        }).toList();
    }

    private WorkspaceMemberEntity findActiveMembership(Long workspaceId, Long userId) {
        return workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceMemberEntity::getUserId, userId)
                .eq(WorkspaceMemberEntity::getStatus, 1)
                .last("limit 1"));
    }

    private List<String> listPermissionCodes(Long memberId) {
        List<Long> roleIds = workspaceMemberRoleMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                                .eq(WorkspaceMemberRoleEntity::getMemberId, memberId))
                .stream()
                .map(WorkspaceMemberRoleEntity::getRoleId)
                .distinct()
                .toList();
        if (roleIds.isEmpty()) {
            return List.of();
        }
        return workspaceRolePermissionMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceRolePermissionEntity>()
                                .in(WorkspaceRolePermissionEntity::getRoleId, roleIds)
                                .orderByAsc(WorkspaceRolePermissionEntity::getId))
                .stream()
                .map(WorkspaceRolePermissionEntity::getPermissionCode)
                .filter(WorkspacePermissionCatalog::contains)
                .distinct()
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
            throw new AccessDeniedException("只有管理员可执行该操作");
        }
    }
}
