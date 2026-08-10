package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.casecenter.CaseMapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.company.autoplatform.settings.ParamSetMapper;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WorkspaceDomainService {

    private static final String WORKSPACE_TYPE_PROJECT = "PROJECT";
    private static final String ROLE_ADMIN = "ADMIN";

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

    public WorkspaceItem createWorkspace(CreateWorkspaceRequest request) {
        requirePlatformAdmin();
        String workspaceCode = request.workspaceCode();
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
        applyWorkspaceRequest(entity, request, true);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMapper.insert(entity);
        ensureOwnerMember(entity);
        return toWorkspaceItem(entity);
    }

    public WorkspaceItem updateWorkspace(String workspaceCode, CreateWorkspaceRequest request) {
        requirePlatformAdmin();
        WorkspaceEntity entity = requireWorkspace(workspaceCode);
        applyWorkspaceRequest(entity, request, false);
        entity.setUpdatedAt(LocalDateTime.now());
        workspaceMapper.updateById(entity);
        ensureOwnerMember(entity);
        return toWorkspaceItem(entity);
    }

    public void deleteWorkspace(String workspaceCode) {
        requirePlatformAdmin();
        WorkspaceEntity workspace = requireWorkspace(workspaceCode);
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

    private void applyWorkspaceRequest(WorkspaceEntity entity, CreateWorkspaceRequest request, boolean creating) {
        entity.setWorkspaceName(request.workspaceName().trim());
        entity.setDescription(request.description() == null ? "" : request.description().trim());
        entity.setWorkspaceType(normalizeWorkspaceType(request.workspaceType()));
        if (request.ownerUserId() != null) {
            userService.requireAnyUser(request.ownerUserId());
        }
        entity.setOwnerUserId(request.ownerUserId());
        entity.setStatus(normalizeWorkspaceStatus(request.status()));
        if (creating && entity.getStatus() == null) {
            entity.setStatus(1);
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
            throw new BadRequestException("只有管理员可执行该操作");
        }
    }

    WorkspaceItem toWorkspaceItem(WorkspaceEntity entity) {
        String ownerName = null;
        if (entity.getOwnerUserId() != null) {
            UserEntity owner = userService.findActiveUser(entity.getOwnerUserId());
            ownerName = owner == null ? null : owner.getDisplayName();
        }
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
                entity.getUpdatedAt() == null ? null : entity.getUpdatedAt().toString()
        );
    }

    private void validateWorkspaceDeletable(Long workspaceId) {
        boolean hasDependencies =
                workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                        .eq(WorkspaceMemberEntity::getWorkspaceId, workspaceId)) > 0
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
