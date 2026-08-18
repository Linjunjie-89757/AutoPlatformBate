package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;

public record RequirementCaseResponse(
        Long relationId,
        Long caseId,
        String caseNo,
        String title,
        String priority,
        RequirementReviewStatus reviewStatus,
        String reviewNote,
        Long reviewerId,
        String reviewerName,
        LocalDateTime reviewedAt,
        boolean reviewOutdated
) {
}
