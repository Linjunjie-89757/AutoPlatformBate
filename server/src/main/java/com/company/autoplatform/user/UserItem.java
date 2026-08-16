package com.company.autoplatform.user;

import java.util.List;

public record UserItem(
        Long id,
        String username,
        String email,
        String displayName,
        String roleCode,
        Integer status,
        String activationStatus,
        List<String> workspaceCodes,
        List<String> workspaceNames
) {
}
