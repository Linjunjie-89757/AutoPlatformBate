package com.company.autoplatform.execution;

import java.time.LocalDateTime;

public record SharedReportResponse(
        ReportDetailResponse report,
        LocalDateTime expiresAt,
        LocalDateTime accessedAt
) {
}
