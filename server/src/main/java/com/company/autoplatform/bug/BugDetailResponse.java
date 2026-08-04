package com.company.autoplatform.bug;

import java.time.LocalDateTime;
import java.util.List;

public record BugDetailResponse(
        Long id,
        String bugNo,
        String title,
        String description,
        String reproductionSteps,
        String expectedResult,
        String actualResult,
        String moduleName,
        BugPriority priority,
        BugSeverity severity,
        BugStatus status,
        BugSourceType sourceType,
        Long assigneeId,
        String assigneeName,
        Long reporterId,
        String reporterName,
        Long relatedCaseId,
        List<BugCaseSummaryResponse> relatedCases,
        Long relatedReportId,
        Long relatedTaskId,
        List<String> tags,
        String workspaceCode,
        String workspaceName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String updatedByName,
        List<BugAttachmentResponse> attachments,
        BugSourceContextResponse sourceContext,
        List<BugActivityResponse> activities,
        List<BugFlowResponse> flows,
        List<BugCommentResponse> comments
) {
}
