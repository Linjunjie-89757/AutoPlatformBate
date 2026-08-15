package com.company.autoplatform.workspace;

public record WorkspaceJoinCandidateItem(
        String workspaceCode,
        String workspaceName,
        String description,
        long memberCount,
        String ownerName
) {
}
