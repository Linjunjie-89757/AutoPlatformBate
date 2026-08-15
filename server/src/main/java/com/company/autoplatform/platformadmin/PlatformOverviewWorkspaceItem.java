package com.company.autoplatform.platformadmin;

public record PlatformOverviewWorkspaceItem(
        String workspaceCode,
        String workspaceName,
        long memberCount,
        Integer status
) {
}
