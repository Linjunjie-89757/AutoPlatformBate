package com.company.autoplatform.ai;

public record AiCaseAdoptionItem(
        Integer caseIndex,
        String status,
        String failureReason,
        Long directoryId,
        Long createdCaseId,
        Integer attemptCount,
        String updatedAt,
        String candidateCaseId,
        Integer adoptedContentVersion,
        String adoptedContentSource,
        String idempotencyKey
) {
}
