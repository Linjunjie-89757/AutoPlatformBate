package com.company.autoplatform.workspace;

import java.time.LocalDateTime;

public record WorkspaceRoleItem(
        Long id,
        String roleCode,
        String name,
        String description,
        Integer memberCount,
        Integer permissionCount,
        LocalDateTime updatedAt,
        boolean system
) {
}
