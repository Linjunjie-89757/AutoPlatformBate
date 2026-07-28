package com.company.autoplatform.execution;

import java.time.LocalDateTime;

public record ReportShareCreatedResponse(
        Long id,
        Long reportId,
        String reportName,
        String reportResult,
        String workspaceCode,
        String workspaceName,
        Integer status,
        LocalDateTime expiresAt,
        String createdBy,
        LocalDateTime lastAccessedAt,
        Integer accessCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String token,
        String shareUrl
) {
}
