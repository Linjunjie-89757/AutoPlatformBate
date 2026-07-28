package com.company.autoplatform.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceMemberEntity;
import com.company.autoplatform.workspace.WorkspaceMemberMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class UserWorkspaceGrantSupport {

    private final UserMapper userMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceMapper workspaceMapper;
    private final UserRoleSupport userRoleSupport;

    public UserWorkspaceGrantSupport(
            UserMapper userMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            WorkspaceMapper workspaceMapper,
            UserRoleSupport userRoleSupport
    ) {
        this.userMapper = userMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceMapper = workspaceMapper;
        this.userRoleSupport = userRoleSupport;
    }

    public List<UserEntity> listPlatformAdminUsers() {
        return userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.PLATFORM_ADMIN)
                .eq(UserEntity::getStatus, 1)
                .orderByAsc(UserEntity::getId));
    }

    public void replaceWorkspaceCodes(UserEntity user, List<String> requestedWorkspaceCodes) {
        if (userRoleSupport.isStoredAdminRole(user.getRoleCode())) {
            clearUserWorkspaces(user.getId());
            return;
        }

        List<String> normalizedCodes = normalizeWorkspaceCodes(requestedWorkspaceCodes);
        if (normalizedCodes.isEmpty()) {
            clearUserWorkspaces(user.getId());
            return;
        }

        Map<String, WorkspaceMemberEntity> existingMemberships = workspaceMemberMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceMemberEntity>().eq(WorkspaceMemberEntity::getUserId, user.getId()))
                .stream()
                .collect(Collectors.toMap(
                        item -> requireWorkspaceById(item.getWorkspaceId()).getWorkspaceCode(),
                        Function.identity(),
                        (left, right) -> left
                ));

        Set<String> requestedSet = new LinkedHashSet<>(normalizedCodes);
        for (String workspaceCode : requestedSet) {
            WorkspaceEntity workspace = requireWorkspaceByCode(workspaceCode);
            WorkspaceMemberEntity existing = existingMemberships.remove(workspaceCode);
            if (existing == null) {
                WorkspaceMemberEntity entity = new WorkspaceMemberEntity();
                entity.setWorkspaceId(workspace.getId());
                entity.setUserId(user.getId());
                entity.setRoleCode("MEMBER");
                entity.setStatus(1);
                entity.setCreatedAt(LocalDateTime.now());
                entity.setUpdatedAt(LocalDateTime.now());
                workspaceMemberMapper.insert(entity);
            } else {
                existing.setStatus(1);
                existing.setUpdatedAt(LocalDateTime.now());
                workspaceMemberMapper.updateById(existing);
            }
        }

        for (WorkspaceMemberEntity redundant : existingMemberships.values()) {
            workspaceMemberMapper.deleteById(redundant.getId());
        }
    }

    public List<WorkspaceEntity> findUserWorkspaces(Long userId) {
        if (userRoleSupport.isPlatformAdmin(userId)) {
            return listActiveWorkspaces();
        }
        List<Long> workspaceIds = workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getUserId, userId)
                        .eq(WorkspaceMemberEntity::getStatus, 1)
                        .orderByAsc(WorkspaceMemberEntity::getId))
                .stream()
                .map(WorkspaceMemberEntity::getWorkspaceId)
                .distinct()
                .toList();
        if (workspaceIds.isEmpty()) {
            return List.of();
        }
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getStatus, 1)
                .in(WorkspaceEntity::getId, workspaceIds)
                .orderByAsc(WorkspaceEntity::getId));
    }

    public Map<Long, List<WorkspaceEntity>> buildUserWorkspaceMap() {
        List<WorkspaceEntity> allWorkspaces = listActiveWorkspaces();
        Map<Long, WorkspaceEntity> workspaceById = allWorkspaces.stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity()));
        Map<Long, List<WorkspaceEntity>> result = new java.util.HashMap<>();

        List<UserEntity> admins = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                .in(UserEntity::getRoleCode, List.of(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN))
                .orderByAsc(UserEntity::getId));
        for (UserEntity admin : admins) {
            result.put(admin.getId(), allWorkspaces);
        }

        List<WorkspaceMemberEntity> memberships = workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getStatus, 1)
                .orderByAsc(WorkspaceMemberEntity::getId));
        for (WorkspaceMemberEntity membership : memberships) {
            WorkspaceEntity workspace = workspaceById.get(membership.getWorkspaceId());
            if (workspace == null) {
                continue;
            }
            result.computeIfAbsent(membership.getUserId(), ignored -> new ArrayList<>()).add(workspace);
        }
        return result;
    }

    public List<String> remainingWorkspaceCodesExcept(String workspaceCode) {
        return listActiveWorkspaces().stream()
                .map(WorkspaceEntity::getWorkspaceCode)
                .filter(code -> !code.equals(workspaceCode))
                .toList();
    }

    private List<WorkspaceEntity> listActiveWorkspaces() {
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getStatus, 1)
                .orderByAsc(WorkspaceEntity::getId));
    }

    private void clearUserWorkspaces(Long userId) {
        workspaceMemberMapper.delete(new LambdaQueryWrapper<WorkspaceMemberEntity>().eq(WorkspaceMemberEntity::getUserId, userId));
    }

    private List<String> normalizeWorkspaceCodes(List<String> workspaceCodes) {
        if (workspaceCodes == null) {
            return List.of();
        }
        return workspaceCodes.stream()
                .filter(code -> code != null && !code.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private WorkspaceEntity requireWorkspaceById(Long workspaceId) {
        WorkspaceEntity workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null || workspace.getStatus() != 1) {
            throw new BadRequestException("工作空间不存在");
        }
        return workspace;
    }

    private WorkspaceEntity requireWorkspaceByCode(String workspaceCode) {
        WorkspaceEntity workspace = workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getWorkspaceCode, workspaceCode)
                .eq(WorkspaceEntity::getStatus, 1)
                .last("limit 1"));
        if (workspace == null) {
            throw new BadRequestException("工作空间不存在");
        }
        return workspace;
    }
}
