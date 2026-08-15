package com.company.autoplatform.workspace;

public record WorkspaceItem(
        String code,
        String name,
        String description,
        boolean allScope,
        String workspaceType,
        Long ownerUserId,
        String ownerName,
        Integer status,
        String createdAt,
        String updatedAt,
        String industry,
        String initializationMode,
        Integer memberCount,
        String roleName
) {
}
