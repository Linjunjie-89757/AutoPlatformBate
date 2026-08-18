package com.company.autoplatform.testmanagement;

import com.company.autoplatform.workspace.WorkspaceEntity;

import java.util.List;
import java.util.Map;

public record TestManagementWorkspaceScope(
        List<Long> workspaceIds,
        Map<Long, WorkspaceEntity> workspaces
) {
}
