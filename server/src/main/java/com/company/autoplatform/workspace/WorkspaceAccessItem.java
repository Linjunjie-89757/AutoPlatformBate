package com.company.autoplatform.workspace;

public record WorkspaceAccessItem(
        String workspaceCode,
        String memberType,
        boolean canManage
) {
}
