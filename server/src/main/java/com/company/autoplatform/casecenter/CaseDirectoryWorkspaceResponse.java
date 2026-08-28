package com.company.autoplatform.casecenter;

import java.util.List;

public record CaseDirectoryWorkspaceResponse(
        String workspaceCode,
        String workspaceName,
        long caseCount,
        List<CaseDirectoryNodeResponse> children
) {
}
