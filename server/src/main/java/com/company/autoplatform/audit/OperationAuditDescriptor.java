package com.company.autoplatform.audit;

public record OperationAuditDescriptor(
        String category,
        String actionCode,
        String actionName,
        String target
) {
}
