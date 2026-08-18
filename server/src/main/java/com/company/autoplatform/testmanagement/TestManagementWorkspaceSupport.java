package com.company.autoplatform.testmanagement;

import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class TestManagementWorkspaceSupport {

    private final WorkspaceService workspaceService;

    public TestManagementWorkspaceSupport(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    public TestManagementWorkspaceScope requireReadScope(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        List<WorkspaceEntity> workspaces;
        if (WorkspaceScope.isAll(normalized)) {
            workspaceService.requirePlatformAdmin();
            workspaces = workspaceService.listReadableWorkspaceEntities();
        } else {
            workspaces = List.of(workspaceService.requireReadableWorkspace(normalized));
        }
        return new TestManagementWorkspaceScope(
                workspaces.stream().map(WorkspaceEntity::getId).toList(),
                workspaces.stream().collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity()))
        );
    }

    public WorkspaceEntity requireWritableWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            throw TestManagementException.validation("写操作必须选择具体工作区");
        }
        return workspaceService.requireWritableWorkspace(normalized);
    }

    public WorkspaceEntity requireReadableEntityWorkspace(String workspaceCode, Long entityWorkspaceId) {
        TestManagementWorkspaceScope scope = requireReadScope(workspaceCode);
        WorkspaceEntity workspace = scope.workspaces().get(entityWorkspaceId);
        if (workspace == null) {
            throw TestManagementException.notFound("测试管理资源", entityWorkspaceId);
        }
        return workspace;
    }

    public WorkspaceEntity requireWritableEntityWorkspace(String workspaceCode, Long entityWorkspaceId) {
        WorkspaceEntity workspace = requireWritableWorkspace(workspaceCode);
        if (!workspace.getId().equals(entityWorkspaceId)) {
            throw TestManagementException.notFound("测试管理资源", entityWorkspaceId);
        }
        return workspace;
    }
}
