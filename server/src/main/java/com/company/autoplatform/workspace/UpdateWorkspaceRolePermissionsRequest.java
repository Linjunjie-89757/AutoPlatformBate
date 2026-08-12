package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdateWorkspaceRolePermissionsRequest(
        @NotNull(message = "权限集合不能为空")
        List<String> permissionCodes
) {
}
