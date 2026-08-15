package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.CreateWorkspaceRequest;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspaceDomainService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceItem;
import com.company.autoplatform.workspace.WorkspaceMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PlatformWorkspaceService {

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceDomainService workspaceDomainService;

    public PlatformWorkspaceService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceMapper workspaceMapper,
            WorkspaceDomainService workspaceDomainService
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceMapper = workspaceMapper;
        this.workspaceDomainService = workspaceDomainService;
    }

    public List<PlatformWorkspaceItem> listWorkspaces() {
        requireSuperAdmin();
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                        .orderByDesc(WorkspaceEntity::getStatus)
                        .orderByAsc(WorkspaceEntity::getId))
                .stream()
                .map(workspaceDomainService::toWorkspaceItem)
                .map(this::toPlatformItem)
                .toList();
    }

    @Transactional
    public PlatformWorkspaceItem createWorkspace(CreateWorkspaceRequest request) {
        requireSuperAdmin();
        return toPlatformItem(workspaceDomainService.createWorkspace(request));
    }

    @Transactional
    public PlatformWorkspaceItem updateStatus(String workspaceCode, Integer status) {
        requireSuperAdmin();
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("工作区状态无效");
        }

        WorkspaceEntity workspace = findWorkspace(workspaceCode);
        workspace.setStatus(status);
        workspace.setUpdatedAt(java.time.LocalDateTime.now());
        workspaceMapper.updateById(workspace);
        return toPlatformItem(workspaceDomainService.toWorkspaceItem(workspace));
    }

    @Transactional
    public void deleteWorkspace(String workspaceCode) {
        requireSuperAdmin();
        workspaceDomainService.deleteWorkspaceForPlatformAdmin(workspaceCode);
    }

    private WorkspaceEntity findWorkspace(String workspaceCode) {
        WorkspaceEntity workspace = workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .eq(WorkspaceEntity::getWorkspaceCode, workspaceCode)
                .last("limit 1"));
        if (workspace == null) {
            throw new BadRequestException("工作区不存在");
        }
        return workspace;
    }

    private PlatformWorkspaceItem toPlatformItem(WorkspaceItem item) {
        return new PlatformWorkspaceItem(
                item.code(),
                item.name(),
                item.description(),
                item.memberCount() == null ? 0 : item.memberCount(),
                item.status(),
                item.createdAt(),
                item.ownerName()
        );
    }

    private void requireSuperAdmin() {
        if (!workspaceAccessSupport.isSuperAdmin()) {
            throw new AccessDeniedException("仅超级管理员可访问工作区管理");
        }
    }
}
