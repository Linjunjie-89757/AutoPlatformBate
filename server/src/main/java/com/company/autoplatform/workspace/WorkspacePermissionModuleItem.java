package com.company.autoplatform.workspace;

import java.util.List;

public record WorkspacePermissionModuleItem(
        String id,
        String label,
        List<WorkspacePermissionItem> permissions
) {
}
