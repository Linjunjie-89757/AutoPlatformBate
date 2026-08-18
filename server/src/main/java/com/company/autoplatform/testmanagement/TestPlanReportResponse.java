package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;

public record TestPlanReportResponse(
        Long id,
        Long planId,
        PlanReportStatus status,
        String contentSnapshotJson,
        LocalDateTime generatedAt,
        Long signedBy,
        String signerName,
        LocalDateTime signedAt,
        Integer lockVersion
) {
}
