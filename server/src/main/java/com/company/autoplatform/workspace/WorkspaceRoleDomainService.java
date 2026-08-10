package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class WorkspaceRoleDomainService {

    static final String SYSTEM_TEST_LEAD = "SYSTEM_TEST_LEAD";
    static final String SYSTEM_TEST_ENGINEER = "SYSTEM_TEST_ENGINEER";

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceRoleMapper workspaceRoleMapper;
    private final WorkspaceMemberRoleMapper workspaceMemberRoleMapper;

    public WorkspaceRoleDomainService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceRoleMapper workspaceRoleMapper,
            WorkspaceMemberRoleMapper workspaceMemberRoleMapper
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceRoleMapper = workspaceRoleMapper;
        this.workspaceMemberRoleMapper = workspaceMemberRoleMapper;
    }

    public List<WorkspaceRoleItem> listRoles(String workspaceCode) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireReadableWorkspace(workspaceCode);
        ensureSystemRoles(workspace.getId());
        return workspaceRoleMapper.selectList(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                        .eq(WorkspaceRoleEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceRoleEntity::getStatus, 1)
                        .orderByAsc(WorkspaceRoleEntity::getId))
                .stream()
                .map(this::toRoleItem)
                .toList();
    }

    public WorkspaceRoleItem createRole(String workspaceCode, CreateWorkspaceRoleRequest request) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        ensureSystemRoles(workspace.getId());
        String name = request.name().trim();
        String description = normalizeDescription(request.description());

        if (List.of("测试负责人", "测试工程师").contains(name)) {
            throw new BadRequestException("当前工作空间已存在同名系统角色");
        }

        Long duplicateCount = workspaceRoleMapper.selectCount(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceRoleEntity::getRoleName, name)
                .eq(WorkspaceRoleEntity::getStatus, 1));
        if (duplicateCount > 0) {
            throw new BadRequestException("当前工作空间已存在同名角色");
        }

        LocalDateTime now = LocalDateTime.now();
        WorkspaceRoleEntity entity = new WorkspaceRoleEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setRoleCode("CUSTOM_" + UUID.randomUUID().toString().replace("-", "").toUpperCase());
        entity.setRoleName(name);
        entity.setDescription(description);
        entity.setStatus(1);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        workspaceRoleMapper.insert(entity);
        return toRoleItem(entity);
    }

    List<WorkspaceRoleEntity> requireRoles(Long workspaceId, List<Long> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return List.of();
        }
        Set<Long> distinctRoleIds = new LinkedHashSet<>(roleIds);
        if (distinctRoleIds.contains(null)) {
            throw new BadRequestException("业务角色不能为空");
        }
        List<WorkspaceRoleEntity> roles = workspaceRoleMapper.selectList(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceRoleEntity::getStatus, 1)
                .in(WorkspaceRoleEntity::getId, distinctRoleIds)
                .orderByAsc(WorkspaceRoleEntity::getId));
        if (roles.size() != distinctRoleIds.size()) {
            throw new BadRequestException("包含无效或不属于当前工作区的业务角色");
        }
        return roles;
    }

    WorkspaceRoleEntity requireDefaultRole(Long workspaceId, String memberType) {
        ensureSystemRoles(workspaceId);
        String roleCode = "ADMIN".equalsIgnoreCase(memberType) ? SYSTEM_TEST_LEAD : SYSTEM_TEST_ENGINEER;
        WorkspaceRoleEntity role = workspaceRoleMapper.selectOne(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceRoleEntity::getRoleCode, roleCode)
                .eq(WorkspaceRoleEntity::getStatus, 1)
                .last("limit 1"));
        if (role == null) {
            throw new BadRequestException("系统业务角色初始化失败");
        }
        return role;
    }

    List<WorkspaceMemberRoleItem> listMemberRoles(Long memberId) {
        List<Long> roleIds = workspaceMemberRoleMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                                .eq(WorkspaceMemberRoleEntity::getMemberId, memberId)
                                .orderByAsc(WorkspaceMemberRoleEntity::getId))
                .stream()
                .map(WorkspaceMemberRoleEntity::getRoleId)
                .toList();
        if (roleIds.isEmpty()) {
            return List.of();
        }
        return workspaceRoleMapper.selectList(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                        .in(WorkspaceRoleEntity::getId, roleIds)
                        .eq(WorkspaceRoleEntity::getStatus, 1)
                        .orderByAsc(WorkspaceRoleEntity::getId))
                .stream()
                .map(role -> new WorkspaceMemberRoleItem(
                        role.getId(),
                        role.getRoleCode(),
                        role.getRoleName(),
                        isSystemRole(role.getRoleCode())
                ))
                .toList();
    }

    void ensureSystemRoles(Long workspaceId) {
        List<WorkspaceRoleEntity> existingRoles = workspaceRoleMapper.selectList(
                new LambdaQueryWrapper<WorkspaceRoleEntity>()
                        .eq(WorkspaceRoleEntity::getWorkspaceId, workspaceId)
                        .in(WorkspaceRoleEntity::getRoleCode, List.of(SYSTEM_TEST_LEAD, SYSTEM_TEST_ENGINEER)));
        Set<String> existingCodes = existingRoles.stream()
                .map(WorkspaceRoleEntity::getRoleCode)
                .collect(java.util.stream.Collectors.toSet());
        List<WorkspaceRoleEntity> missingRoles = new ArrayList<>();
        if (!existingCodes.contains(SYSTEM_TEST_LEAD)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_TEST_LEAD, "测试负责人", "系统内置业务角色，用于标识测试管理职责"));
        }
        if (!existingCodes.contains(SYSTEM_TEST_ENGINEER)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_TEST_ENGINEER, "测试工程师", "系统内置业务角色，用于标识测试执行职责"));
        }
        missingRoles.forEach(workspaceRoleMapper::insert);
    }

    private WorkspaceRoleEntity systemRole(Long workspaceId, String roleCode, String name, String description) {
        LocalDateTime now = LocalDateTime.now();
        WorkspaceRoleEntity entity = new WorkspaceRoleEntity();
        entity.setWorkspaceId(workspaceId);
        entity.setRoleCode(roleCode);
        entity.setRoleName(name);
        entity.setDescription(description);
        entity.setStatus(1);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description.trim();
    }

    private WorkspaceRoleItem toRoleItem(WorkspaceRoleEntity entity) {
        return new WorkspaceRoleItem(
                entity.getId(),
                entity.getRoleCode(),
                entity.getRoleName(),
                entity.getDescription(),
                Math.toIntExact(workspaceMemberRoleMapper.selectCount(
                        new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                                .eq(WorkspaceMemberRoleEntity::getRoleId, entity.getId()))),
                0,
                entity.getUpdatedAt(),
                isSystemRole(entity.getRoleCode())
        );
    }

    private boolean isSystemRole(String roleCode) {
        return SYSTEM_TEST_LEAD.equals(roleCode) || SYSTEM_TEST_ENGINEER.equals(roleCode);
    }
}
