package com.company.autoplatform.workspace;

import java.util.List;

public record WorkspaceAccessItem(
        String workspaceCode,
        String memberType,
        boolean canManage,
        List<String> permissionCodes
) {
}
