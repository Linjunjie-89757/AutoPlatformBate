package com.company.autoplatform.testmanagement;

import com.company.autoplatform.bug.BugEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record TestVersionReportData(
        TestVersionResponse version,
        LocalDateTime generatedAt,
        long caseCount,
        long executedCount,
        long passedCount,
        BigDecimal executeRate,
        BigDecimal passRate,
        long requirementCoveredCount,
        BigDecimal requirementCoverRate,
        long openP0Count,
        long openP1Count,
        boolean allPlansCompleted,
        boolean ownerConfirmed,
        int qualityPassedCount,
        List<PlanItem> plans,
        List<RequirementItem> requirements,
        List<BugEntity> defects
) {
    public record PlanItem(
            String planNo,
            String name,
            PlanType type,
            PlanStatus status,
            String ownerName,
            long caseCount,
            long executedCount,
            long passedCount,
            BigDecimal executeRate,
            BigDecimal passRate,
            long defectCount
    ) {
    }

    public record RequirementItem(
            String requirementNo,
            String title,
            RequirementPriority priority,
            String qualityStatus,
            long caseTotal,
            long caseReviewed
    ) {
    }
}
