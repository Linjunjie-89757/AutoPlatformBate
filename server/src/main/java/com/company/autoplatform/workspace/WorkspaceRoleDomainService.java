package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    static final String SYSTEM_DEVELOPER = "SYSTEM_DEVELOPER";
    static final String SYSTEM_READ_ONLY = "SYSTEM_READ_ONLY";

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceRoleMapper workspaceRoleMapper;
    private final WorkspaceMemberRoleMapper workspaceMemberRoleMapper;
    private final WorkspaceRolePermissionMapper workspaceRolePermissionMapper;

    public WorkspaceRoleDomainService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceRoleMapper workspaceRoleMapper,
            WorkspaceMemberRoleMapper workspaceMemberRoleMapper,
            WorkspaceRolePermissionMapper workspaceRolePermissionMapper
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceRoleMapper = workspaceRoleMapper;
        this.workspaceMemberRoleMapper = workspaceMemberRoleMapper;
        this.workspaceRolePermissionMapper = workspaceRolePermissionMapper;
    }

    public List<WorkspaceRoleItem> listRoles(String workspaceCode) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
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

        if (List.of("项目负责人", "测试负责人", "测试工程师", "开发人员", "只读访客").contains(name)) {
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

    @Transactional
    public void deleteRole(String workspaceCode, Long roleId) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceRoleEntity role = requireRole(workspace.getId(), roleId);

        workspaceMemberRoleMapper.delete(new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                .eq(WorkspaceMemberRoleEntity::getRoleId, role.getId()));
        workspaceRolePermissionMapper.delete(new LambdaQueryWrapper<WorkspaceRolePermissionEntity>()
                .eq(WorkspaceRolePermissionEntity::getRoleId, role.getId()));
        role.setStatus(0);
        role.setUpdatedAt(LocalDateTime.now());
        workspaceRoleMapper.updateById(role);
    }

    public List<WorkspacePermissionModuleItem> listPermissionCatalog(String workspaceCode) {
        workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        return WorkspacePermissionCatalog.modules();
    }

    public WorkspaceRolePermissionItem listRolePermissions(String workspaceCode, Long roleId) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceRoleEntity role = requireRole(workspace.getId(), roleId);
        return new WorkspaceRolePermissionItem(role.getId(), listPermissionCodes(role.getId()));
    }

    @Transactional
    public WorkspaceRolePermissionItem updateRolePermissions(
            String workspaceCode,
            Long roleId,
            UpdateWorkspaceRolePermissionsRequest request
    ) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceRoleEntity role = requireRole(workspace.getId(), roleId);
        LinkedHashSet<String> permissionCodes = new LinkedHashSet<>();
        for (String permissionCode : request.permissionCodes()) {
            String normalized = permissionCode == null ? "" : permissionCode.trim();
            if (!WorkspacePermissionCatalog.contains(normalized)) {
                throw new BadRequestException("包含无效权限项: " + normalized);
            }
            permissionCodes.add(normalized);
        }

        workspaceRolePermissionMapper.delete(new LambdaQueryWrapper<WorkspaceRolePermissionEntity>()
                .eq(WorkspaceRolePermissionEntity::getRoleId, role.getId()));
        insertPermissions(role.getId(), permissionCodes);
        role.setUpdatedAt(LocalDateTime.now());
        workspaceRoleMapper.updateById(role);
        return new WorkspaceRolePermissionItem(role.getId(), List.copyOf(permissionCodes));
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

    WorkspaceRoleEntity findDefaultRole(Long workspaceId, String memberType) {
        ensureSystemRoles(workspaceId);
        String roleCode = "ADMIN".equalsIgnoreCase(memberType) ? SYSTEM_TEST_LEAD : SYSTEM_TEST_ENGINEER;
        return workspaceRoleMapper.selectOne(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceRoleEntity::getRoleCode, roleCode)
                .eq(WorkspaceRoleEntity::getStatus, 1)
                .last("limit 1"));
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
                        .in(WorkspaceRoleEntity::getRoleCode, List.of(
                                SYSTEM_TEST_LEAD,
                                SYSTEM_TEST_ENGINEER,
                                SYSTEM_DEVELOPER,
                                SYSTEM_READ_ONLY)));
        Set<String> existingCodes = existingRoles.stream()
                .map(WorkspaceRoleEntity::getRoleCode)
                .collect(java.util.stream.Collectors.toSet());
        List<WorkspaceRoleEntity> missingRoles = new ArrayList<>();
        if (!existingCodes.contains(SYSTEM_TEST_LEAD)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_TEST_LEAD, "项目负责人", "负责测试团队管理、权限配置和报告审核"));
        }
        if (!existingCodes.contains(SYSTEM_TEST_ENGINEER)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_TEST_ENGINEER, "测试工程师", "负责用例编写、自动化脚本开发和执行"));
        }
        if (!existingCodes.contains(SYSTEM_DEVELOPER)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_DEVELOPER, "开发人员", "只读查看用例和缺陷，协助联调"));
        }
        if (!existingCodes.contains(SYSTEM_READ_ONLY)) {
            missingRoles.add(systemRole(workspaceId, SYSTEM_READ_ONLY, "只读访客", "仅可查看报告和用例，不可操作"));
        }
        missingRoles.forEach(role -> {
            workspaceRoleMapper.insert(role);
            insertPermissions(role.getId(), WorkspacePermissionCatalog.defaultCodesForRole(role.getRoleCode()));
        });
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
                Math.toIntExact(workspaceRolePermissionMapper.selectCount(
                        new LambdaQueryWrapper<WorkspaceRolePermissionEntity>()
                                .eq(WorkspaceRolePermissionEntity::getRoleId, entity.getId()))),
                entity.getUpdatedAt(),
                isSystemRole(entity.getRoleCode())
        );
    }

    private boolean isSystemRole(String roleCode) {
        return SYSTEM_TEST_LEAD.equals(roleCode)
                || SYSTEM_TEST_ENGINEER.equals(roleCode)
                || SYSTEM_DEVELOPER.equals(roleCode)
                || SYSTEM_READ_ONLY.equals(roleCode);
    }

    private WorkspaceRoleEntity requireRole(Long workspaceId, Long roleId) {
        WorkspaceRoleEntity role = workspaceRoleMapper.selectOne(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getId, roleId)
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceRoleEntity::getStatus, 1)
                .last("limit 1"));
        if (role == null) {
            throw new BadRequestException("业务角色不存在或不属于当前工作区");
        }
        return role;
    }

    private List<String> listPermissionCodes(Long roleId) {
        return workspaceRolePermissionMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceRolePermissionEntity>()
                                .eq(WorkspaceRolePermissionEntity::getRoleId, roleId)
                                .orderByAsc(WorkspaceRolePermissionEntity::getId))
                .stream()
                .map(WorkspaceRolePermissionEntity::getPermissionCode)
                .filter(WorkspacePermissionCatalog::contains)
                .toList();
    }

    private void insertPermissions(Long roleId, Iterable<String> permissionCodes) {
        LocalDateTime now = LocalDateTime.now();
        for (String permissionCode : permissionCodes) {
            WorkspaceRolePermissionEntity binding = new WorkspaceRolePermissionEntity();
            binding.setRoleId(roleId);
            binding.setPermissionCode(permissionCode);
            binding.setCreatedAt(now);
            binding.setUpdatedAt(now);
            workspaceRolePermissionMapper.insert(binding);
        }
    }
}
