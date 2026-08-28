package com.company.autoplatform.bug;

import java.time.LocalDateTime;
import java.util.List;

public record BugSummaryResponse(
        Long id,
        String bugNo,
        String title,
        List<String> tags,
        BugPriority priority,
        BugSeverity severity,
        BugStatus status,
        String assigneeName,
        String reporterName,
        LocalDateTime createdAt,
        String updatedByName,
        LocalDateTime updatedAt,
        Long relatedCaseId,
        int relatedCaseCount,
        String versionName,
        String environmentName,
        String workspaceCode,
        String workspaceName
) {
}
