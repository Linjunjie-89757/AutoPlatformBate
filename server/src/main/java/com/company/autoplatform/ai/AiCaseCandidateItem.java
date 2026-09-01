package com.company.autoplatform.ai;

import java.util.List;

public record AiCaseCandidateItem(
        String candidateCaseId,
        Integer displayIndex,
        String origin,
        String sourceType,
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
        String validationStatus,
        List<String> validationIssues,
        String duplicateOfCandidateId,
        String coverageStatus,
        String verificationStatus,
        String supplementBasis,
        Boolean supplementTruncated,
        Integer suggestionSourceVersion,
        String suggestionSourceHash,
        String createdAt,
        String updatedAt
) {
}
