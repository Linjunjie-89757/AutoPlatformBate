package com.company.autoplatform.casecenter;

public record CaseSummaryResponse(
        Long id,
        String caseNo,
        String title,
        String caseType,
        String priority,
        String sourceType,
        String executionStatus,
        String ownerName,
        String executorName,
        String executionComment,
        String executedAt,
        String workspaceCode,
        String workspaceName,
        Long directoryId,
        String directoryName,
        Long createdBy,
        String createdByName,
        String createdAt,
        Long updatedBy,
        String updatedByName,
        String updatedAt,
        String reviewStatus,
        String reviewComment,
        Long reviewedBy,
        String reviewedByName,
        String reviewedAt
) {
}
