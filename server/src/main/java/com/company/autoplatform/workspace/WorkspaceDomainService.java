package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.casecenter.CaseMapper;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.security.access.AccessDeniedException;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.company.autoplatform.settings.ParamSetMapper;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WorkspaceDomainService {

    private static final String WORKSPACE_TYPE_PROJECT = "PROJECT";
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String INITIALIZATION_BLANK = "BLANK";
    private static final String INITIALIZATION_SAMPLE = "SAMPLE";

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceMemberRoleMapper workspaceMemberRoleMapper;
    private final WorkspaceRoleMapper workspaceRoleMapper;
    private final UserService userService;
    private final CaseMapper caseMapper;
    private final TaskMapper taskMapper;
    private final ReportMapper reportMapper;
    private final BugMapper bugMapper;
    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;

    public WorkspaceDomainService(
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            WorkspaceMemberRoleMapper workspaceMemberRoleMapper,
            WorkspaceRoleMapper workspaceRoleMapper,
            UserService userService,
            CaseMapper caseMapper,
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            BugMapper bugMapper,
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper
    ) {
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceMemberRoleMapper = workspaceMemberRoleMapper;
        this.workspaceRoleMapper = workspaceRoleMapper;
        this.userService = userService;
        this.caseMapper = caseMapper;
        this.taskMapper = taskMapper;
        this.reportMapper = reportMapper;
        this.bugMapper = bugMapper;
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
    }

    public WorkspaceEntity requireWorkspace(String workspaceCode) {
        WorkspaceEntity workspace = workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getWorkspaceCode, workspaceCode)
                .eq(WorkspaceEntity::getStatus, 1)
                .last("limit 1"));
        if (workspace == null) {
            throw new BadRequestException("无效的工作空间: " + workspaceCode);
        }
        return workspace;
    }

    public WorkspaceEntity requireWorkspaceById(Long workspaceId) {
        WorkspaceEntity workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null || workspace.getStatus() != 1) {
            throw new BadRequestException("无效的工作空间");
        }
        return workspace;
    }

    @Transactional
    public WorkspaceItem createWorkspace(CreateWorkspaceRequest request) {
        boolean platformAdmin = isPlatformAdmin();
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        validateSelfServiceCreateRequest(request, platformAdmin, currentUser.userId());

        String workspaceCode = platformAdmin ? request.workspaceCode() : null;
        if (workspaceCode == null || workspaceCode.isBlank()) {
            workspaceCode = generateWorkspaceCode();
        } else {
            workspaceCode = workspaceCode.trim();
        }
        if (workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getWorkspaceCode, workspaceCode)
                .last("limit 1")) != null) {
            throw new BadRequestException("空间编码已存在");
        }
        WorkspaceEntity entity = new WorkspaceEntity();
        entity.setWorkspaceCode(workspaceCode);
        applyWorkspaceRequest(entity, request, true, platformAdmin ? request.ownerUserId() : currentUser.userId());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMapper.insert(entity);
        ensureOwnerMember(entity);
        return toWorkspaceItem(entity);
    }

    public WorkspaceItem updateWorkspace(String workspaceCode, CreateWorkspaceRequest request) {
        requirePlatformAdmin();
        WorkspaceEntity entity = requireWorkspace(workspaceCode);
        applyWorkspaceRequest(entity, request, false, request.ownerUserId());
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMapper.updateById(entity);
        ensureOwnerMember(entity);
        return toWorkspaceItem(entity);
    }

    public void deleteWorkspace(String workspaceCode) {
        requirePlatformAdmin();
        WorkspaceEntity workspace = requireWorkspace(workspaceCode);
        deleteWorkspaceInternal(workspace);
    }

    @Transactional
    public void deleteWorkspaceForPlatformAdmin(String workspaceCode) {
        requirePlatformAdmin();
        WorkspaceEntity workspace = workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getWorkspaceCode, workspaceCode)
                .last("limit 1"));
        if (workspace == null) {
            throw new BadRequestException("工作区不存在");
        }
        deleteWorkspaceInternal(workspace);
    }

    private void deleteWorkspaceInternal(WorkspaceEntity workspace) {
        validateWorkspaceDeletable(workspace.getId());
        List<Long> memberIds = workspaceMemberMapper.selectList(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId()))
                .stream()
                .map(WorkspaceMemberEntity::getId)
                .toList();
        if (!memberIds.isEmpty()) {
            workspaceMemberRoleMapper.delete(new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                    .in(WorkspaceMemberRoleEntity::getMemberId, memberIds));
        }
        workspaceMemberMapper.delete(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId()));
        workspaceRoleMapper.delete(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                .eq(WorkspaceRoleEntity::getWorkspaceId, workspace.getId()));
        workspaceMapper.deleteById(workspace.getId());
    }

    private String generateWorkspaceCode() {
        for (int i = 0; i < 5; i++) {
            String code = "ws_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            if (workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                    .eq(WorkspaceEntity::getWorkspaceCode, code)
                    .last("limit 1")) == null) {
                return code;
            }
        }
        throw new BadRequestException("空间编码生成失败，请稍后重试");
    }

    private void applyWorkspaceRequest(
            WorkspaceEntity entity,
            CreateWorkspaceRequest request,
            boolean creating,
            Long ownerUserId
    ) {
        entity.setWorkspaceName(request.workspaceName().trim());
        entity.setDescription(request.description() == null ? "" : request.description().trim());
        entity.setWorkspaceType(normalizeWorkspaceType(request.workspaceType()));
        if (ownerUserId != null) {
            userService.requireAnyUser(ownerUserId);
        }
        entity.setOwnerUserId(ownerUserId);
        entity.setStatus(normalizeWorkspaceStatus(request.status()));
        entity.setIndustry(normalizeIndustry(request.industry()));
        entity.setInitializationMode(normalizeInitializationMode(request.initializationMode()));
        if (creating && entity.getStatus() == null) {
            entity.setStatus(1);
        }
    }

    private void validateSelfServiceCreateRequest(CreateWorkspaceRequest request, boolean platformAdmin, Long userId) {
        if (platformAdmin) {
            return;
        }
        if (request.workspaceCode() != null && !request.workspaceCode().isBlank()) {
            throw new AccessDeniedException("普通用户不能指定工作区编码");
        }
        if (request.ownerUserId() != null && !request.ownerUserId().equals(userId)) {
            throw new AccessDeniedException("普通用户只能创建本人负责的工作区");
        }
        if (request.status() != null && request.status() != 1) {
            throw new AccessDeniedException("普通用户只能创建启用状态的工作区");
        }
    }

    private Integer normalizeWorkspaceStatus(Integer status) {
        if (status == null) {
            return 1;
        }
        if (status != 0 && status != 1) {
            throw new BadRequestException("无效的空间状态");
        }
        return status;
    }

    private String normalizeWorkspaceType(String workspaceType) {
        if (workspaceType == null || workspaceType.isBlank()) {
            return WORKSPACE_TYPE_PROJECT;
        }
        String normalized = workspaceType.trim().toUpperCase();
        if (!List.of("PROJECT", "TEAM", "PRODUCT").contains(normalized)) {
            throw new BadRequestException("无效的空间类型");
        }
        return normalized;
    }

    private String normalizeIndustry(String industry) {
        if (industry == null || industry.isBlank()) {
            return null;
        }
        return industry.trim();
    }

    private String normalizeInitializationMode(String initializationMode) {
        if (initializationMode == null || initializationMode.isBlank()) {
            return INITIALIZATION_BLANK;
        }
        String normalized = initializationMode.trim().toUpperCase();
        if (!List.of(INITIALIZATION_BLANK, INITIALIZATION_SAMPLE).contains(normalized)) {
            throw new BadRequestException("无效的工作区初始化方式");
        }
        return normalized;
    }

    private void ensureOwnerMember(WorkspaceEntity workspace) {
        if (workspace.getOwnerUserId() == null) {
            return;
        }
        UserEntity owner = userService.requireAnyUser(workspace.getOwnerUserId());
        if (userService.isPlatformAdmin(owner.getId())) {
            return;
        }
        WorkspaceMemberEntity entity = workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, owner.getId())
                .last("limit 1"));
        if (entity == null) {
            entity = new WorkspaceMemberEntity();
            entity.setWorkspaceId(workspace.getId());
            entity.setUserId(owner.getId());
            entity.setRoleCode(ROLE_ADMIN);
            entity.setStatus(1);
            entity.setCreatedAt(LocalDateTime.now());
            entity.setUpdatedAt(LocalDateTime.now());
            workspaceMemberMapper.insert(entity);
            return;
        }
        entity.setRoleCode(ROLE_ADMIN);
        entity.setStatus(1);
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMemberMapper.updateById(entity);
    }

    private boolean isPlatformAdmin() {
        return PlatformRole.isAdminRole(CurrentUserContext.require().platformRole());
    }

    private void requirePlatformAdmin() {
        if (!isPlatformAdmin()) {
            throw new AccessDeniedException("只有管理员可执行该操作");
        }
    }

    public WorkspaceItem toWorkspaceItem(WorkspaceEntity entity) {
        String ownerName = null;
        if (entity.getOwnerUserId() != null) {
            UserEntity owner = userService.findActiveUser(entity.getOwnerUserId());
            ownerName = owner == null ? null : owner.getDisplayName();
        }
        int memberCount = Math.toIntExact(workspaceMemberMapper.selectCount(
                new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, entity.getId())
                        .eq(WorkspaceMemberEntity::getStatus, 1)));
        return new WorkspaceItem(
                entity.getWorkspaceCode(),
                entity.getWorkspaceName(),
                entity.getDescription(),
                false,
                entity.getWorkspaceType() == null ? WORKSPACE_TYPE_PROJECT : entity.getWorkspaceType(),
                entity.getOwnerUserId(),
                ownerName,
                entity.getStatus(),
                entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString(),
                entity.getUpdatedAt() == null ? null : entity.getUpdatedAt().toString(),
                entity.getIndustry(),
                entity.getInitializationMode() == null ? INITIALIZATION_BLANK : entity.getInitializationMode(),
                memberCount,
                resolveCurrentUserRoleName(entity)
        );
    }

    private String resolveCurrentUserRoleName(WorkspaceEntity workspace) {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        if (isPlatformAdmin()) {
            return "平台管理员";
        }
        if (workspace.getOwnerUserId() != null && workspace.getOwnerUserId().equals(currentUser.userId())) {
            return "工作区管理员";
        }
        WorkspaceMemberEntity member = workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, currentUser.userId())
                .eq(WorkspaceMemberEntity::getStatus, 1)
                .last("limit 1"));
        if (member == null) {
            return null;
        }
        List<Long> roleIds = workspaceMemberRoleMapper.selectList(
                        new LambdaQueryWrapper<WorkspaceMemberRoleEntity>()
                                .eq(WorkspaceMemberRoleEntity::getMemberId, member.getId())
                                .orderByAsc(WorkspaceMemberRoleEntity::getId))
                .stream()
                .map(WorkspaceMemberRoleEntity::getRoleId)
                .toList();
        if (!roleIds.isEmpty()) {
            WorkspaceRoleEntity role = workspaceRoleMapper.selectOne(new LambdaQueryWrapper<WorkspaceRoleEntity>()
                    .in(WorkspaceRoleEntity::getId, roleIds)
                    .eq(WorkspaceRoleEntity::getStatus, 1)
                    .orderByAsc(WorkspaceRoleEntity::getId)
                    .last("limit 1"));
            if (role != null) {
                return role.getRoleName();
            }
        }
        return ROLE_ADMIN.equalsIgnoreCase(member.getRoleCode()) ? "工作区管理员" : "普通成员";
    }

    private void validateWorkspaceDeletable(Long workspaceId) {
        boolean hasDependencies =
                workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspaceId)
                        .ne(WorkspaceMemberEntity::getStatus, -1)) > 0
                        || caseMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.casecenter.CaseEntity>()
                        .eq(com.company.autoplatform.casecenter.CaseEntity::getWorkspaceId, workspaceId)) > 0
                        || taskMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.execution.TaskEntity>()
                        .eq(com.company.autoplatform.execution.TaskEntity::getWorkspaceId, workspaceId)) > 0
                        || reportMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.execution.ReportEntity>()
                        .eq(com.company.autoplatform.execution.ReportEntity::getWorkspaceId, workspaceId)) > 0
                        || bugMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.bug.BugEntity>()
                        .eq(com.company.autoplatform.bug.BugEntity::getWorkspaceId, workspaceId)) > 0
                        || envConfigMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.settings.EnvConfigEntity>()
                        .eq(com.company.autoplatform.settings.EnvConfigEntity::getWorkspaceId, workspaceId)) > 0
                        || paramSetMapper.selectCount(new LambdaQueryWrapper<com.company.autoplatform.settings.ParamSetEntity>()
                        .eq(com.company.autoplatform.settings.ParamSetEntity::getWorkspaceId, workspaceId)) > 0;
        if (hasDependencies) {
            throw new BadRequestException("当前工作空间存在关联数据，不能删除");
        }
    }
}
