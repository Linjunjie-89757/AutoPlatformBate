package com.company.autoplatform.workspace;

import java.util.List;

public record WorkspaceRolePermissionItem(
        Long roleId,
        List<String> permissionCodes
) {
}
