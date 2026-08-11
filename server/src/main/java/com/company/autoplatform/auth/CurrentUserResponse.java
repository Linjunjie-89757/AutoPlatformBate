package com.company.autoplatform.auth;

import com.company.autoplatform.workspace.WorkspaceAccessItem;

import java.util.List;

public record CurrentUserResponse(
        Long id,
        String username,
        String displayName,
        String roleCode,
        List<String> workspaceCodes,
        List<WorkspaceAccessItem> workspaceAccesses
) {
}
