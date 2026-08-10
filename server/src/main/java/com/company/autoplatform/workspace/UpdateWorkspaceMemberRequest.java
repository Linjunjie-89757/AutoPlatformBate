package com.company.autoplatform.workspace;

import java.util.List;

public record UpdateWorkspaceMemberRequest(
        String memberType,
        List<Long> roleIds,
        String roleCode
) {
}
