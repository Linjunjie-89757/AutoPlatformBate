package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;

public record TestActivityItem(
        Long id,
        ActivityEntityType entityType,
        Long entityId,
        String actionCode,
        String actionName,
        String detail,
        Long actorId,
        String actorName,
        LocalDateTime createdAt
) {
}
