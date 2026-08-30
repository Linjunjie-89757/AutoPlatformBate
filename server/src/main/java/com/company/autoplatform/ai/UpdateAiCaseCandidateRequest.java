package com.company.autoplatform.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateAiCaseCandidateRequest(
        @NotNull(message = "Expected content version is required") Integer expectedVersion,
        @NotBlank(message = "Expected content hash is required") String expectedContentHash,
        @NotNull(message = "Current case is required") @Valid GeneratedAiCaseItem currentCase
) {
}
