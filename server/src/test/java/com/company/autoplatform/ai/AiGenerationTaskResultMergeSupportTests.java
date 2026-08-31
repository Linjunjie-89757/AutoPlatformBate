package com.company.autoplatform.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiGenerationTaskResultMergeSupportTests {

    @Test
    void candidateIdAndCaseIndexConflictDoesNotUpdateWrongCase() {
        GeneratedAiCaseItem first = generatedCase("first");
        GeneratedAiCaseItem second = generatedCase("second");
        AiCaseCandidateEntity firstCandidate = candidate("candidate-first", 0);
        AiCaseCandidateEntity secondCandidate = candidate("candidate-second", 1);
        AiReviewCaseDecision decision = new AiReviewCaseDecision(
                0,
                "APPROVED",
                "second approved",
                null,
                null,
                null,
                null,
                null,
                null,
                secondCandidate.getCandidateId(),
                "KEEP",
                95,
                0.99,
                "matches requirement",
                null,
                List.of(),
                1,
                null
        );

        List<GeneratedAiCaseItem> merged = new AiGenerationTaskResultMergeSupport()
                .mergeCompleteReviewResult(
                        List.of(first, second),
                        List.of(firstCandidate, secondCandidate),
                        new AiReviewResult("APPROVE", "done", List.of(), List.of(), List.of(decision), List.of(), List.of(), "{}", true)
                );

        assertThat(merged.get(0).aiReviewStatus()).isNull();
        assertThat(merged.get(1).aiReviewStatus()).isNull();
    }

    private AiCaseCandidateEntity candidate(String candidateId, int displayIndex) {
        AiCaseCandidateEntity candidate = new AiCaseCandidateEntity();
        candidate.setCandidateId(candidateId);
        candidate.setDisplayIndex(displayIndex);
        return candidate;
    }

    private GeneratedAiCaseItem generatedCase(String title) {
        return new GeneratedAiCaseItem(
                title,
                "FUNCTION",
                "P1",
                null,
                "run step",
                "expected result",
                null,
                null,
                null,
                null,
                "INITIAL",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                false,
                null,
                null
        );
    }
}
