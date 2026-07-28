package com.company.autoplatform.audit;

import java.time.LocalDateTime;

public record OperationAuditLogItem(
        Long id,
        String workspaceCode,
        Long operatorUserId,
        String operatorUsername,
        String operatorDisplayName,
        String category,
        String actionCode,
        String actionName,
        String target,
        String requestMethod,
        String sourceIp,
        String result,
        Integer statusCode,
        Long durationMs,
        LocalDateTime createdAt
) {
}
