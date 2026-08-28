package com.company.autoplatform.casecenter;

import java.util.List;

public record CaseDirectoryNodeResponse(
        Long id,
        String name,
        String workspaceCode,
        String workspaceName,
        Long parentId,
        long caseCount,
        List<CaseDirectoryNodeResponse> children
) {
}
