package com.company.autoplatform.ai;

import java.util.List;

public record GenerateAiCasesResponse(
        String workspaceCode,
        String workspaceName,
        String provider,
        String model,
        Integer systemMaxCases,
        Integer requestedMaxCases,
        Integer effectiveMaxCases,
        Integer actualGeneratedCount,
        List<GeneratedAiCaseItem> generatedCases,
        String coverageSummary,
        List<String> remainingCoverageGaps,
        List<String> warnings,
        List<AiInvalidCaseItem> invalidCases,
        String rawContent,
        boolean ignoredImages,
        AiGenerationSelfCheckResult selfCheck,
        List<GeneratedAiCaseItem> selfSupplementCases
) {
}
