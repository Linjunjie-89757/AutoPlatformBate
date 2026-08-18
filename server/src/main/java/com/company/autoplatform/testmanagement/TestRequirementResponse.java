package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;
import java.util.List;

public record TestRequirementResponse(
        Long id,
        String requirementNo,
        Long versionId,
        String versionName,
        String title,
        RequirementPriority priority,
        RequirementSourceType sourceType,
        String sourceRef,
        Long assigneeId,
        String assigneeName,
        String description,
        String qualityStatus,
        RequirementReviewStatus reviewStatus,
        int caseTotal,
        int caseReviewed,
        int casePassed,
        long defectCount,
        Integer lockVersion,
        String workspaceCode,
        String workspaceName,
        Long createdBy,
        LocalDateTime createdAt,
        Long updatedBy,
        LocalDateTime updatedAt,
        List<RequirementCaseResponse> cases
) {
}
