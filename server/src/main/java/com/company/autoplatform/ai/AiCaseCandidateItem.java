package com.company.autoplatform.ai;

import java.util.List;

public record AiCaseCandidateItem(
        String candidateCaseId,
        Integer displayIndex,
        String origin,
        GeneratedAiCaseItem originalCase,
        GeneratedAiCaseItem suggestedCase,
        GeneratedAiCaseItem currentCase,
        String reviewStatus,
        String suggestedAction,
        Integer reviewScore,
        Double reviewConfidence,
        String reviewReason,
        List<String> mergeTargetCandidateIds,
        String humanDecision,
        Integer contentVersion,
        String contentHash,
        Integer suggestionSourceVersion,
        String suggestionSourceHash,
        String createdAt,
        String updatedAt
) {
}
