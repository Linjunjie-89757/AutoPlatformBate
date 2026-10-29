package com.company.autoplatform.platformadmin;

public record PlatformWorkspaceItem(
        String workspaceCode,
        String workspaceName,
        String description,
        long memberCount,
        Integer status,
        String createdAt,
        Long ownerUserId,
        String ownerName,
        String workspaceType,
        String industry,
        String initializationMode
) {
}
