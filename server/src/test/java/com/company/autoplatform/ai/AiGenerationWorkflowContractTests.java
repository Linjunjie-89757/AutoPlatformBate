package com.company.autoplatform.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiGenerationWorkflowContractTests {

    @Test
    void onlyFullySuccessfulReviewCanCreateGlobalSupplement() {
        assertThat(AiGenerationWorkflowContract.isReviewSupplementAllowed("SUCCEEDED", 0)).isTrue();
        assertThat(AiGenerationWorkflowContract.isReviewSupplementAllowed("PARTIAL", 0)).isFalse();
        assertThat(AiGenerationWorkflowContract.isReviewSupplementAllowed("SUCCEEDED", 1)).isFalse();
    }

    @Test
    void warningCandidatesCanBeAdoptedAfterHumanConfirmation() {
        assertThat(AiGenerationWorkflowContract.canAdopt("VALID")).isTrue();
        assertThat(AiGenerationWorkflowContract.canAdopt("WARNING")).isTrue();
        assertThat(AiGenerationWorkflowContract.canAdopt("FAILED")).isFalse();
        assertThat(AiGenerationWorkflowContract.canAdopt("DUPLICATE")).isFalse();
    }
}
