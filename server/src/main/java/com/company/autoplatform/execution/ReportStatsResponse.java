package com.company.autoplatform.execution;

public record ReportStatsResponse(
        long total,
        long success,
        long failed
) {
}
