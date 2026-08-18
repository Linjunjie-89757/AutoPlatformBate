package com.company.autoplatform.testmanagement;

public record TestPlanRequirementItem(
        Long id,
        String requirementNo,
        String title,
        RequirementPriority priority,
        RequirementReviewStatus reviewStatus,
        long passedCaseCount
) {
}
