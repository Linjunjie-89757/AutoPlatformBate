package com.company.autoplatform.ai;

import java.util.List;

public record AiGenerationSelfCheckResult(
        boolean structured,
        boolean complete,
        List<String> missingCoverageGaps,
        List<Integer> duplicateCaseIndexes,
        String supplementGuidance,
        String rawContent
) {

    public static AiGenerationSelfCheckResult failed(String rawContent) {
        return new AiGenerationSelfCheckResult(false, false, List.of(), List.of(), null, rawContent);
    }
}
