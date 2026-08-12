package com.company.autoplatform.ai;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record GenerateAiCasesRequest(
        String workspaceCode,
        @NotBlank(message = "Requirement title is required") String requirementTitle,
        @NotBlank(message = "Requirement content is required") String requirementContent,
        String sceneFocus,
        String improvementNotes,
        List<Long> assetIds,
        List<AiExistingCaseItem> existingCases,
        Long ownerId,
        @Min(value = 1, message = "Max cases must be >= 1")
        @Max(value = 200, message = "Max cases must be <= 200")
        Integer maxCases
) {
}
