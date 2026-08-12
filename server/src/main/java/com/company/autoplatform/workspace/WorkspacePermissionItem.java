package com.company.autoplatform.workspace;

public record WorkspacePermissionItem(
        String code,
        String action,
        String label,
        boolean risky
) {
}
