package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class WorkspaceMemberDomainService {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_MEMBER = "MEMBER";

    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final UserService userService;
    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceDomainService workspaceDomainService;

    public WorkspaceMemberDomainService(
            WorkspaceMemberMapper workspaceMemberMapper,
            UserService userService,
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceDomainService workspaceDomainService
    ) {
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.userService = userService;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceDomainService = workspaceDomainService;
    }

    public List<WorkspaceMemberItem> listMembers(String workspaceCode) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireReadableWorkspace(workspaceCode);
        Map<Long, WorkspaceMemberItem> result = new LinkedHashMap<>();

        List<UserEntity> admins = userService.listPlatformAdminUsers();
        for (UserEntity admin : admins) {
            result.put(admin.getId(), new WorkspaceMemberItem(
                    -admin.getId(),
                    admin.getId(),
                    admin.getUsername(),
                    admin.getEmail(),
                    admin.getDisplayName(),
                    "ADMIN",
                    admin.getStatus()
            ));
        }

        workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceMemberEntity::getStatus, 1)
                        .orderByAsc(WorkspaceMemberEntity::getId))
                .stream()
                .map(this::toMemberItem)
                .filter(Objects::nonNull)
                .forEach(item -> result.put(item.userId(), item));

        return new ArrayList<>(result.values());
    }

    public WorkspaceMemberItem createMember(String workspaceCode, CreateWorkspaceMemberRequest request) {
        workspaceAccessSupport.requirePlatformAdmin();
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        UserEntity user = userService.requireAnyUser(request.userId());
        if (userService.isPlatformAdmin(user.getId())) {
            throw new BadRequestException("管理员默认拥有全部空间，无需单独加入空间");
        }
        String roleCode = normalizeMemberRole(request.roleCode());

        WorkspaceMemberEntity entity = workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, user.getId())
                .last("limit 1"));
        if (entity == null) {
            entity = new WorkspaceMemberEntity();
            entity.setWorkspaceId(workspace.getId());
            entity.setUserId(user.getId());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setRoleCode(roleCode);
            entity.setStatus(1);
            entity.setUpdatedAt(LocalDateTime.now());
            workspaceMemberMapper.insert(entity);
        } else {
            entity.setRoleCode(roleCode);
            entity.setStatus(1);
            entity.setUpdatedAt(LocalDateTime.now());
            workspaceMemberMapper.updateById(entity);
        }
        return toMemberItem(entity);
    }

    public List<WorkspaceMemberItem> createMembers(String workspaceCode, BatchWorkspaceMemberRequest request) {
        workspaceAccessSupport.requirePlatformAdmin();
        List<WorkspaceMemberItem> result = new ArrayList<>();
        for (Long userId : request.userIds()) {
            result.add(createMember(workspaceCode, new CreateWorkspaceMemberRequest(userId, request.roleCode())));
        }
        return result;
    }

    public WorkspaceMemberItem updateMember(String workspaceCode, Long memberId, UpdateWorkspaceMemberRequest request) {
        workspaceAccessSupport.requirePlatformAdmin();
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        WorkspaceMemberEntity entity = requireMember(memberId);
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("成员不属于当前工作空间");
        }
        if (Objects.equals(workspace.getOwnerUserId(), entity.getUserId()) && !ROLE_ADMIN.equals(normalizeMemberRole(request.roleCode()))) {
            throw new BadRequestException("负责人不能降级为普通成员，请先转让负责人");
        }
        entity.setRoleCode(normalizeMemberRole(request.roleCode()));
        entity.setStatus(1);
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMemberMapper.updateById(entity);
        return toMemberItem(entity);
    }

    public void deleteMember(String workspaceCode, Long memberId) {
        workspaceAccessSupport.requirePlatformAdmin();
        if (memberId < 0) {
            userService.removeAdminFromWorkspace(-memberId, workspaceCode);
            return;
        }
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        WorkspaceMemberEntity entity = requireMember(memberId);
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("成员不属于当前工作空间");
        }
        if (Objects.equals(workspace.getOwnerUserId(), entity.getUserId())) {
            throw new BadRequestException("负责人不能移除，请先转让负责人");
        }
        workspaceMemberMapper.deleteById(memberId);
    }

    private WorkspaceMemberEntity requireMember(Long memberId) {
        WorkspaceMemberEntity entity = workspaceMemberMapper.selectById(memberId);
        if (entity == null || entity.getStatus() != 1) {
            throw new BadRequestException("成员不存在");
        }
        return entity;
    }

    private String normalizeMemberRole(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return ROLE_MEMBER;
        }
        String normalized = roleCode.trim().toUpperCase();
        if (!List.of(ROLE_ADMIN, ROLE_MEMBER).contains(normalized)) {
            throw new BadRequestException("无效的成员角色");
        }
        return normalized;
    }

    private WorkspaceMemberItem toMemberItem(WorkspaceMemberEntity entity) {
        UserEntity user = userService.requireAnyUser(entity.getUserId());
        if (userService.isSuperAdmin(user.getId())) {
            return null;
        }
        return new WorkspaceMemberItem(
                entity.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                userService.isPlatformAdmin(user.getId()) ? ROLE_ADMIN : normalizeMemberRole(entity.getRoleCode()),
                user.getStatus()
        );
    }
}
