package com.company.autoplatform.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiPromptBuilderSupportTests {

    @Test
    void reviewPromptKeepsCoreCaseFieldsAndOmitsPersistenceMetadataAndAuxiliaryGenerationFields() {
        AiCaseConfigEntity config = new AiCaseConfigEntity();
        config.setPromptTemplate("review prompt");
        config.setReviewChecklist("check business coverage");

        ReviewAiGeneratedCasesRequest request = new ReviewAiGeneratedCasesRequest(
                "Requirement title",
                "Complete requirement content",
                null,
                List.of(),
                List.of(new AiExistingCaseItem(
                        "candidate-id-sentinel",
                        17,
                        "content-hash-sentinel",
                        "Case title",
                        "FUNCTION",
                        "P1",
                        "User is logged in",
                        "Open the page; submit the form",
                        "The form is submitted successfully",
                        "test-angle-sentinel",
                        "generation-reason-sentinel",
                        "requirement-evidence-sentinel"
                ))
        );

        String prompt = new AiPromptBuilderSupport().buildGeneratedCasesReviewPrompt(config, request, true);

        assertThat(prompt).contains(
                "Requirement title",
                "Complete requirement content",
                "[Candidate Index 0]",
                "Case title",
                "Type: FUNCTION",
                "Priority: P1",
                "Precondition: User is logged in",
                "Steps: Open the page; submit the form",
                "Expected Result: The form is submitted successfully",
                "caseIndex"
        );
        assertThat(prompt).doesNotContain(
                "candidate-id-sentinel",
                "Content Version",
                "content-hash-sentinel",
                "test-angle-sentinel",
                "generation-reason-sentinel",
                "requirement-evidence-sentinel"
        );
    }
}
