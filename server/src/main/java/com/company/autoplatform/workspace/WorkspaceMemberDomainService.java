package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final WorkspaceRoleDomainService workspaceRoleDomainService;
    private final WorkspaceMemberRoleMapper workspaceMemberRoleMapper;

    public WorkspaceMemberDomainService(
            WorkspaceMemberMapper workspaceMemberMapper,
            UserService userService,
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceDomainService workspaceDomainService,
            WorkspaceRoleDomainService workspaceRoleDomainService,
            WorkspaceMemberRoleMapper workspaceMemberRoleMapper
    ) {
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.userService = userService;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceDomainService = workspaceDomainService;
        this.workspaceRoleDomainService = workspaceRoleDomainService;
        this.workspaceMemberRoleMapper = workspaceMemberRoleMapper;
    }

    public List<WorkspaceMemberItem> listMembers(String workspaceCode) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        workspaceRoleDomainService.ensureSystemRoles(workspace.getId());
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
                    "ADMIN",
                    List.of(),
                    admin.getStatus()
            ));
        }

        workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceMemberEntity::getStatus, 1)
                        .orderByAsc(WorkspaceMemberEntity::getId))
                .stream()
                .map(entity -> toMemberItem(entity, workspace))
                .filter(Objects::nonNull)
                .forEach(item -> result.put(item.userId(), item));

        return new ArrayList<>(result.values());
    }

    public WorkspaceMemberCandidateItem findMemberCandidate(String workspaceCode, String account) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        UserEntity user = userService.findAnyUserByAccount(account);
        if (user == null || userService.isSuperAdmin(user.getId())) {
            return null;
        }
        boolean alreadyMember = userService.isPlatformAdmin(user.getId())
                || workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceMemberEntity::getUserId, user.getId())
                        .eq(WorkspaceMemberEntity::getStatus, 1)) > 0;
        return new WorkspaceMemberCandidateItem(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.getStatus(),
                alreadyMember
        );
    }

    @Transactional
    public WorkspaceMemberItem createMember(String workspaceCode, CreateWorkspaceMemberRequest request) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        UserEntity user = userService.requireAnyUser(request.userId());
        if (userService.isPlatformAdmin(user.getId())) {
            throw new BadRequestException("管理员默认拥有全部空间，无需单独加入空间");
        }
        String memberType = normalizeMemberType(request.memberType(), request.roleCode());

        WorkspaceMemberEntity entity = workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, user.getId())
                .last("limit 1"));
        if (entity == null) {
            entity = new WorkspaceMemberEntity();
            entity.setWorkspaceId(workspace.getId());
            entity.setUserId(user.getId());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setRoleCode(memberType);
            entity.setStatus(1);
            entity.setUpdatedAt(LocalDateTime.now());
            workspaceMemberMapper.insert(entity);
        } else {
            entity.setRoleCode(memberType);
            entity.setStatus(1);
            entity.setUpdatedAt(LocalDateTime.now());
            workspaceMemberMapper.updateById(entity);
        }
        replaceMemberRoles(entity, workspace.getId(), memberType, request.roleIds());
        return toMemberItem(entity, workspace);
    }

    @Transactional
    public List<WorkspaceMemberItem> createMembers(String workspaceCode, BatchWorkspaceMemberRequest request) {
        List<WorkspaceMemberItem> result = new ArrayList<>();
        for (Long userId : request.userIds()) {
            result.add(createMember(workspaceCode, new CreateWorkspaceMemberRequest(
                    userId,
                    request.memberType(),
                    request.roleIds(),
                    request.roleCode()
            )));
        }
        return result;
    }

    @Transactional
    public WorkspaceMemberItem updateMember(String workspaceCode, Long memberId, UpdateWorkspaceMemberRequest request) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceMemberEntity entity = requireMember(memberId);
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("成员不属于当前工作空间");
        }
        String memberType = normalizeMemberType(request.memberType(), request.roleCode());
        if (Objects.equals(workspace.getOwnerUserId(), entity.getUserId()) && !ROLE_ADMIN.equals(memberType)) {
            throw new BadRequestException("负责人不能降级为普通成员，请先转让负责人");
        }
        entity.setRoleCode(memberType);
        entity.setStatus(1);
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMemberMapper.updateById(entity);
        replaceMemberRoles(entity, workspace.getId(), memberType, request.roleIds());
        return toMemberItem(entity, workspace);
    }

    @Transactional
    public void deleteMember(String workspaceCode, Long memberId) {
        workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
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
        workspaceMemberRoleMapper.delete(new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                .eq(WorkspaceMemberRoleEntity::getMemberId, memberId));
        workspaceMemberMapper.deleteById(memberId);
    }

    private WorkspaceMemberEntity requireMember(Long memberId) {
        WorkspaceMemberEntity entity = workspaceMemberMapper.selectById(memberId);
        if (entity == null || entity.getStatus() != 1) {
            throw new BadRequestException("成员不存在");
        }
        return entity;
    }

    private String normalizeMemberType(String memberType, String legacyRoleCode) {
        String source = memberType == null || memberType.isBlank() ? legacyRoleCode : memberType;
        if (source == null || source.isBlank()) {
            return ROLE_MEMBER;
        }
        String normalized = source.trim().toUpperCase();
        if (!List.of(ROLE_ADMIN, ROLE_MEMBER).contains(normalized)) {
            throw new BadRequestException("无效的工作区身份");
        }
        return normalized;
    }

    private void replaceMemberRoles(
            WorkspaceMemberEntity member,
            Long workspaceId,
            String memberType,
            List<Long> requestedRoleIds
    ) {
        List<WorkspaceRoleEntity> roles;
        if (requestedRoleIds == null) {
            roles = List.of(workspaceRoleDomainService.requireDefaultRole(workspaceId, memberType));
        } else {
            roles = workspaceRoleDomainService.requireRoles(workspaceId, requestedRoleIds);
            if (ROLE_MEMBER.equals(memberType) && roles.isEmpty()) {
                throw new BadRequestException("普通成员至少需要分配一个业务角色");
            }
        }

        workspaceMemberRoleMapper.delete(new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                .eq(WorkspaceMemberRoleEntity::getMemberId, member.getId()));
        LocalDateTime now = LocalDateTime.now();
        for (WorkspaceRoleEntity role : roles) {
            WorkspaceMemberRoleEntity binding = new WorkspaceMemberRoleEntity();
            binding.setMemberId(member.getId());
            binding.setRoleId(role.getId());
            binding.setCreatedAt(now);
            binding.setUpdatedAt(now);
            workspaceMemberRoleMapper.insert(binding);
        }
    }

    private List<WorkspaceMemberRoleItem> ensureAndListMemberRoles(WorkspaceMemberEntity entity) {
        List<WorkspaceMemberRoleItem> roles = workspaceRoleDomainService.listMemberRoles(entity.getId());
        if (!roles.isEmpty()) {
            return roles;
        }
        String memberType = normalizeMemberType(entity.getRoleCode(), null);
        if (ROLE_ADMIN.equals(memberType)) {
            return List.of();
        }
        replaceMemberRoles(entity, entity.getWorkspaceId(), memberType, null);
        return workspaceRoleDomainService.listMemberRoles(entity.getId());
    }

    private WorkspaceMemberItem toMemberItem(WorkspaceMemberEntity entity, WorkspaceEntity workspace) {
        UserEntity user = userService.requireAnyUser(entity.getUserId());
        if (userService.isSuperAdmin(user.getId())) {
            return null;
        }
        String storedMemberType = normalizeMemberType(entity.getRoleCode(), null);
        String memberType = Objects.equals(workspace.getOwnerUserId(), entity.getUserId()) ? "OWNER" : storedMemberType;
        return new WorkspaceMemberItem(
                entity.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                userService.isPlatformAdmin(user.getId()) ? ROLE_ADMIN : storedMemberType,
                memberType,
                ensureAndListMemberRoles(entity),
                user.getStatus()
        );
    }
}
