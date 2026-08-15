package com.company.autoplatform.workspace;

public record WorkspaceJoinApplicationItem(
        Long id,
        String workspaceCode,
        String workspaceName,
        String description,
        Long applicantUserId,
        String applicantName,
        String status,
        String submittedAt
) {
}
