package com.company.autoplatform.workspace;

import java.util.List;

public record WorkspaceMemberItem(
        Long id,
        Long userId,
        String username,
        String email,
        String displayName,
        String roleCode,
        String memberType,
        List<WorkspaceMemberRoleItem> roles,
        Integer status
) {
}
