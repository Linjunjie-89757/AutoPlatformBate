package com.company.autoplatform.platformadmin;

import java.time.LocalDateTime;

public record PlatformOverviewOperationItem(
        Long id,
        String operatorName,
        String actionName,
        String target,
        String result,
        LocalDateTime createdAt
) {
}
