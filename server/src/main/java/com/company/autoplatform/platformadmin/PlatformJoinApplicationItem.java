package com.company.autoplatform.platformadmin;

import java.time.LocalDateTime;

public record PlatformJoinApplicationItem(
        Long id,
        String workspaceCode,
        String workspaceName,
        String workspaceDescription,
        Long applicantUserId,
        String applicantName,
        String applicantEmail,
        String status,
        String rejectReason,
        LocalDateTime submittedAt,
        LocalDateTime handledAt
) {
}
