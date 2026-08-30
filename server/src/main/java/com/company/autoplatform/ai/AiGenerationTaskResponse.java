package com.company.autoplatform.ai;

import java.util.List;

public record AiGenerationTaskResponse(
        String taskId,
        String workspaceCode,
        String workspaceName,
        String requirementTitle,
        String requirementContent,
        String outputMode,
        String status,
        Integer currentStep,
        String stepMessage,
        String errorMessage,
        Long directoryId,
        String directoryName,
        String createdByName,
        String updatedByName,
        String provider,
        String model,
        Integer generatedCount,
        Integer savedCaseCount,
        List<String> warnings,
        List<AiInvalidCaseItem> invalidCases,
        List<GeneratedAiCaseItem> generatedCases,
        AiReviewResult reviewResult,
        String generationRawOutput,
        String reviewRawOutput,
        List<AiGenerationTaskEventResponse> events,
        List<Integer> adoptedCaseIndexes,
        List<Integer> deletedCaseIndexes,
        List<AiCaseAdoptionItem> adoptions,
        Boolean cancelRequested,
        String sourceTaskId,
        String createdAt,
        String updatedAt,
        String finishedAt
) {
}
