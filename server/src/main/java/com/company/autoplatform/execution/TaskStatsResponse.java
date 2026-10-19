package com.company.autoplatform.execution;

public record TaskStatsResponse(
        long total,
        long running,
        long failed
) {
}
