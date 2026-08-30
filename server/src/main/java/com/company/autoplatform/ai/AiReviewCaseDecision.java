package com.company.autoplatform.ai;

import java.util.List;

public record AiReviewCaseDecision(
        Integer caseIndex,
        String status,
        String summary,
        String coverageComment,
        String evidenceComment,
        String reviewComment,
        String optimizationReason,
        String coverageGap,
        GeneratedAiCaseItem optimizedCase,
        String candidateCaseId,
        String suggestedAction,
        Integer score,
        Double confidence,
        String reason,
        GeneratedAiCaseItem suggestedCase,
        List<String> mergeTargetCandidateIds,
        Integer sourceVersion,
        String sourceContentHash
) {
    public AiReviewCaseDecision(
            Integer caseIndex,
            String status,
            String summary,
            String coverageComment,
            String evidenceComment,
            String reviewComment,
            String optimizationReason,
            String coverageGap,
            GeneratedAiCaseItem optimizedCase
    ) {
        this(
                caseIndex,
                status,
                summary,
                coverageComment,
                evidenceComment,
                reviewComment,
                optimizationReason,
                coverageGap,
                optimizedCase,
                null,
                null,
                null,
                null,
                summary,
                optimizedCase,
                List.of(),
                null,
                null
        );
    }
}
