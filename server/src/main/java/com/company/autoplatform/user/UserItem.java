package com.company.autoplatform.user;

import java.util.List;
import java.time.LocalDateTime;

public record UserItem(
        Long id,
        String username,
        String email,
        String displayName,
        String roleCode,
        Integer status,
        String activationStatus,
        LocalDateTime lastLoginAt,
        List<String> workspaceCodes,
        List<String> workspaceNames
) {
}
