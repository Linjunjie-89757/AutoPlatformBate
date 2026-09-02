package com.company.autoplatform.ai;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.casecenter.CaseService;
import com.company.autoplatform.casecenter.CreateCaseDirectoryRequest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

class AiGenerationTaskExecutionServiceTests extends IntegrationTestSupport {

    @Autowired
    private AiCaseService aiCaseService;

    @Autowired
    private AiGenerationTaskService aiGenerationTaskService;

    @Autowired
    private AiCaseCandidateService aiCaseCandidateService;

    @Autowired
    private AiCaseAdoptionService aiCaseAdoptionService;

    @Autowired
    private CaseService caseService;

    @MockitoBean
    private AiProviderClient aiProviderClient;

    @Test
    void executeCompleteTaskPersistsGenerationReviewAndEvents() {
        reset(aiProviderClient);
        String unique = uniquePrefix("complete");
        String model = unique + "-model";
        AiProviderConnectionItem provider = aiCaseService.createProvider(WORKSPACE_CODE, new SaveAiProviderConnectionRequest(
                WORKSPACE_CODE,
                null,
                unique + "-provider",
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "https://ai.example.test/v1",
                30,
                model,
                unique + "-secret",
                1
        ));
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated case");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of("generation warning"),
                List.of(),
                "{\"cases\":[{\"title\":\"" + unique + " generated case\"}]}"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE",
                "review summary",
                List.of("issue one"),
                List.of("suggestion one"),
                List.of(new AiReviewCaseDecision(
                        0,
                        "APPROVED",
                        "case approved",
                        "coverage ok",
                        "evidence ok",
                        "review comment",
                        null,
                        null,
                        null
                )),
                List.of(),
                List.of("unresolved gap"),
                "{\"result\":\"APPROVE\"}",
                true
        ));

        AiGenerationTaskResponse created = aiGenerationTaskService.createTask(WORKSPACE_CODE, new CreateAiGenerationTaskRequest(
                WORKSPACE_CODE,
                unique + " requirement",
                "User can login and view dashboard.",
                "COMPLETE",
                null,
                unique + " directory",
                List.of(),
                0
        ));

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.failedStage()).isNull();
        assertThat(detail.errorCode()).isNull();
        assertThat(detail.currentStep()).isEqualTo(4);
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.provider()).isEqualTo("OPENAI_COMPATIBLE_CHAT");
        assertThat(detail.model()).isEqualTo(model);
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(unique + " generated case");
        assertThat(detail.generatedCases().get(0).aiReviewStatus()).isEqualTo("APPROVED");
        assertThat(detail.generatedCases().get(0).aiReviewSummary()).isEqualTo("case approved");
        assertThat(detail.reviewResult()).isNotNull();
        assertThat(detail.reviewResult().result()).isEqualTo("APPROVE");
        assertThat(detail.reviewResult().summary()).isEqualTo("review summary");
        assertThat(detail.generationRawOutput()).contains(unique + " generated case");
        assertThat(detail.reviewRawOutput()).isEqualTo("{\"result\":\"APPROVE\"}");
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains(
                        "TASK_STARTED",
                        "GENERATION_COMPLETED",
                        "REVIEW_STARTED",
                        "REVIEW_COMPLETED",
                        "FINAL_CASES_READY",
                        "TASK_COMPLETED"
                );
    }

    @Test
    void selfCheckSupplementIsGeneratedOnceAndStoredAsCandidateSource() {
        reset(aiProviderClient);
        String unique = uniquePrefix("self-supplement");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        GeneratedAiCaseItem initial = generatedCase(unique + " initial");
        GeneratedAiCaseItem supplement = generatedCase(unique + " exception");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(initial), "coverage", List.of(), List.of(), List.of(), "initial raw"
        ));
        when(aiProviderClient.selfCheck(any(), any(), any())).thenReturn(new AiGenerationSelfCheckResult(
                true, false, List.of("invalid credentials"), List.of(), "补充认证失败场景", "self check raw"
        ));
        when(aiProviderClient.generateSupplement(any(), any(), any(), anyInt())).thenReturn(new AiGeneratedCasesResult(
                List.of(supplement), "supplement coverage", List.of(), List.of(), List.of(), "supplement raw"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE", "review complete", List.of(), List.of(), List.of(), List.of(), List.of(), "review raw", true
        ));

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.selfCheckStatus()).isEqualTo(AiGenerationWorkflowContract.SELF_CHECK_SUCCEEDED);
        assertThat(detail.generatedCases()).hasSize(2);
        assertThat(detail.generatedCases().get(1).aiSource()).isEqualTo("SELF_REVIEW_SUPPLEMENT");
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("GENERATION_SELF_CHECK_COMPLETED", "GENERATION_SELF_SUPPLEMENTED");

        List<AiCaseCandidateItem> candidates = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE);
        assertThat(candidates).hasSize(2);
        assertThat(candidates.get(1).sourceType())
                .isEqualTo(AiGenerationWorkflowContract.SOURCE_SELF_REVIEW_SUPPLEMENT);
        verify(aiProviderClient).generateSupplement(any(), any(), any(), anyInt());
    }

    @Test
    void reviewSendsAllCandidatesInOneRequest() {
        reset(aiProviderClient);
        String unique = uniquePrefix("review-batches");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt", 100);
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        List<GeneratedAiCaseItem> generated = new java.util.ArrayList<>();
        for (int index = 0; index < 21; index += 1) {
            generated.add(generatedCase(unique + " case-" + index));
        }
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                generated, "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE", "review approved", List.of(), List.of(), List.of(
                        new AiReviewCaseDecision(
                                0, "APPROVED", "approved", "covered", "evidence", "reviewed", null, null, null
                        ),
                        new AiReviewCaseDecision(
                                20, "APPROVED", "approved", "covered", "evidence", "reviewed", null, null, null
                        )
                ), List.of(), List.of(), "review raw", true
        ));

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        List<AiCaseCandidateItem> candidates = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE);
        assertThat(candidates).hasSize(21);
        assertThat(candidates.get(0).reviewStatus()).isEqualTo("APPROVED");
        assertThat(candidates.get(20).reviewStatus()).isEqualTo("APPROVED");
        verify(aiProviderClient).review(any(), any(), any());

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.totalReviewBatches()).isEqualTo(1);
        assertThat(detail.completedReviewBatches()).isEqualTo(1);
        assertThat(detail.failedReviewBatches()).isZero();
        assertThat(detail.reviewStatus()).isEqualTo("SUCCEEDED");
    }

    @Test
    void taskReservesTwentyPercentOfTotalCapacityForReviewSupplement() {
        reset(aiProviderClient);
        String unique = uniquePrefix("capacity-reservation");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt", 500);
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase(unique + " generated")), "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.selfCheck(any(), any(), any())).thenReturn(new AiGenerationSelfCheckResult(
                true, true, List.of(), List.of(), null, "self check raw"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE", "review complete", List.of(), List.of(), List.of(), List.of(), List.of(), "review raw", true
        ));

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        ArgumentCaptor<AiProviderRequestProfile> profileCaptor = ArgumentCaptor.forClass(AiProviderRequestProfile.class);
        verify(aiProviderClient).generate(profileCaptor.capture(), any(), any(), any());
        assertThat(profileCaptor.getValue().maxCases()).isEqualTo(400);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.caseGenerationLimit()).isEqualTo(500);
        assertThat(detail.status()).isEqualTo("COMPLETED");
    }

    @Test
    void reviewSupplementUsesAllRemainingTaskCapacityInsteadOfFixedTwentyCases() {
        reset(aiProviderClient);
        String unique = uniquePrefix("review-supplement-capacity");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt", 100);
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        List<GeneratedAiCaseItem> generated = new java.util.ArrayList<>();
        for (int index = 0; index < 21; index += 1) {
            generated.add(generatedCase(unique + " generated-" + index));
        }
        List<GeneratedAiCaseItem> supplements = new java.util.ArrayList<>();
        for (int index = 0; index < 25; index += 1) {
            supplements.add(generatedCase(unique + " supplemented-" + index));
        }
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                generated, "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.selfCheck(any(), any(), any())).thenReturn(new AiGenerationSelfCheckResult(
                true, true, List.of(), List.of(), null, "self check raw"
        ));
        AiReviewResult batchReview = new AiReviewResult(
                "APPROVE", "batch complete", List.of(), List.of(), List.of(), List.of(),
                List.of("confirmed global gap"), "batch raw", true
        );
        AiReviewResult supplementReview = new AiReviewResult(
                "SUGGEST", "supplement complete", List.of(), List.of(), List.of(), supplements,
                List.of(), "supplement raw", true
        );
        when(aiProviderClient.review(any(), any(), any()))
                .thenReturn(batchReview, supplementReview);

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.caseGenerationLimit()).isEqualTo(100);
        assertThat(detail.generatedCases()).hasSize(46);
        assertThat(detail.supplementedCaseCount()).isEqualTo(25);
        verify(aiProviderClient, times(2)).review(any(), any(), any());
    }

    @Test
    void streamReviewSendsAllCandidatesInOneRequest() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream-review-batches");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt", 100);
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        List<GeneratedAiCaseItem> generated = new java.util.ArrayList<>();
        for (int index = 0; index < 21; index += 1) {
            generated.add(generatedCase(unique + " case-" + index));
        }
        String generationLine = "{\"title\":\"" + unique + " streamed case\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\","
                + "\"precondition\":\"User has valid account\",\"steps\":\"1. Open login page\","
                + "\"expectedResult\":\"Dashboard is visible\",\"aiSource\":\"AI_STREAM\"}";
        String reviewContent = java.util.stream.IntStream.range(0, 21)
                .mapToObj(index -> "{\"caseIndex\":" + index + ",\"status\":\"APPROVED\"}")
                .collect(java.util.stream.Collectors.joining("\n"))
                + "\n{\"type\":\"SUMMARY\",\"reviewedCount\":21,\"unresolvedCoverageGaps\":[],\"result\":\"APPROVE\"}\n";
        when(aiProviderClient.parseGeneratedCasesContent(anyString(), anyInt())).thenReturn(new AiGeneratedCasesResult(
                generated, "coverage summary", List.of(), List.of(), List.of(), generationLine
        ));
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(generationLine + "\n");
                    return new AiProviderClient.StreamContentResult(generationLine + "\n", false, null);
                })
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(reviewContent);
                    return new AiProviderClient.StreamContentResult(reviewContent, false, null);
                });

        AiGenerationTaskResponse created = createTask(unique, "STREAM");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        List<AiCaseCandidateItem> candidates = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE);
        assertThat(candidates).hasSize(21);
        assertThat(candidates.get(0).reviewStatus()).isEqualTo("APPROVED");
        assertThat(candidates.get(20).reviewStatus()).isEqualTo("APPROVED");
        verify(aiProviderClient, times(2)).streamStructuredContentWithResult(any(), any(), any(), any());

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.totalReviewBatches()).isEqualTo(1);
        assertThat(detail.completedReviewBatches()).isEqualTo(1);
        assertThat(detail.failedReviewBatches()).isZero();
        assertThat(detail.reviewStatus()).isEqualTo("SUCCEEDED");
    }

    @Test
    void failedReviewBatchesCanBeRetriedWithoutRegeneratingCases() {
        reset(aiProviderClient);
        String unique = uniquePrefix("review-retry");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated case");
        AiReviewResult approved = new AiReviewResult(
                "APPROVE", "retry approved", List.of(), List.of(), List.of(new AiReviewCaseDecision(
                        0, "APPROVED", "approved after retry", "covered", "evidence", "reviewed", null, null, null
                )), List.of(), List.of(), "retry raw", true
        );
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase), "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.review(any(), any(), any()))
                .thenThrow(new IllegalStateException("first review failed"))
                .thenReturn(approved);

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);
        AiGenerationTaskResponse failed = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(failed.reviewStatus()).isEqualTo("FAILED");
        assertThat(failed.failedReviewBatches()).isEqualTo(1);

        AiGenerationTaskResponse retrying = aiGenerationTaskService.retryFailedReviewBatches(created.taskId(), WORKSPACE_CODE);
        assertThat(retrying.status()).isEqualTo("REVIEWING");
        assertThat(retrying.reviewStatus()).isEqualTo("RUNNING");
        aiGenerationTaskService.executeReviewRetry(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse completed = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(completed.status()).isEqualTo("COMPLETED");
        assertThat(completed.reviewStatus()).isEqualTo("SUCCEEDED");
        assertThat(completed.generatedCases().get(0).aiReviewStatus()).isEqualTo("APPROVED");
        verify(aiProviderClient).generate(any(), any(), any(), any());
        verify(aiProviderClient, times(2)).review(any(), any(), any());
    }

    @Test
    void reviewRetryResubmitsTheSingleFailedReviewRequest() {
        reset(aiProviderClient);
        String unique = uniquePrefix("review-retry-partial");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt", 100);
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        List<GeneratedAiCaseItem> generated = new java.util.ArrayList<>();
        for (int index = 0; index < 21; index += 1) {
            generated.add(generatedCase(unique + " case-" + index));
        }
        AiReviewResult approved = new AiReviewResult(
                "APPROVE", "review approved", List.of(), List.of(), List.of(
                        new AiReviewCaseDecision(
                                0, "APPROVED", "approved", "covered", "evidence", "reviewed", null, null, null
                        ),
                        new AiReviewCaseDecision(
                                20, "APPROVED", "approved", "covered", "evidence", "reviewed", null, null, null
                        )
                ), List.of(), List.of(), "review raw", true
        );
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                generated, "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.review(any(), any(), any()))
                .thenThrow(new IllegalStateException("review request failed"))
                .thenReturn(approved);

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);
        AiGenerationTaskResponse failed = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(failed.totalReviewBatches()).isEqualTo(1);
        assertThat(failed.completedReviewBatches()).isZero();
        assertThat(failed.failedReviewBatches()).isEqualTo(1);
        assertThat(failed.reviewStatus()).isEqualTo("FAILED");

        aiGenerationTaskService.retryFailedReviewBatches(created.taskId(), WORKSPACE_CODE);
        aiGenerationTaskService.executeReviewRetry(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse completed = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(completed.totalReviewBatches()).isEqualTo(1);
        assertThat(completed.completedReviewBatches()).isEqualTo(1);
        assertThat(completed.failedReviewBatches()).isZero();
        assertThat(completed.reviewStatus()).isEqualTo("SUCCEEDED");
        List<AiCaseCandidateItem> candidates = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE);
        assertThat(candidates.get(0).reviewStatus()).isEqualTo("APPROVED");
        assertThat(candidates.get(20).reviewStatus()).isEqualTo("APPROVED");
        verify(aiProviderClient).generate(any(), any(), any(), any());
        verify(aiProviderClient, times(2)).review(any(), any(), any());
    }

    @Test
    void adoptionRejectsDuplicateFormalCaseBeforeCreatingAnotherCase() {
        reset(aiProviderClient);
        String unique = uniquePrefix("adoption-duplicate");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " duplicate title");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase), "coverage", List.of(), List.of(), List.of(), "generation raw"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE", "approved", List.of(), List.of(), List.of(new AiReviewCaseDecision(
                        0, "APPROVED", "approved", "covered", "evidence", "reviewed", null, null, null
                )), List.of(), List.of(), "review raw", true
        ));

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);
        AiCaseCandidateItem candidate = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE).get(0);
        var directory = caseService.createDirectory(
                WORKSPACE_CODE,
                new CreateCaseDirectoryRequest(WORKSPACE_CODE, null, unique + " duplicate directory")
        );
        caseService.createCase(WORKSPACE_CODE, new com.company.autoplatform.casecenter.CreateCaseRequest(
                WORKSPACE_CODE, directory.id(), generatedCase.title(), generatedCase.caseType(), generatedCase.priority(),
                "MANUAL", null, generatedCase.precondition(), generatedCase.steps(), generatedCase.expectedResult()
        ));

        AiCaseAdoptionItem adoption = aiCaseAdoptionService.adoptCandidate(
                created.taskId(), WORKSPACE_CODE, candidate.candidateCaseId(), new AdoptAiCaseRequest(directory.id())
        );
        assertThat(adoption.status()).isEqualTo("ADOPT_FAILED");
        assertThat(adoption.failureReason()).contains("已存在");
        assertThat(adoption.createdCaseId()).isNull();
    }

    @Test
    void reviewSuggestionNeverOverwritesOriginalOrCurrentCandidate() {
        reset(aiProviderClient);
        String unique = uniquePrefix("human-confirmation");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        GeneratedAiCaseItem original = generatedCase(unique + " original case");
        GeneratedAiCaseItem suggestion = generatedCase(unique + " suggested case");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(original), "coverage", List.of(), List.of(), List.of(), "{}"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "SUGGEST",
                "review suggestion",
                List.of(),
                List.of("improve assertion"),
                List.of(new AiReviewCaseDecision(
                        0,
                        "CHANGE_SUGGESTED",
                        "use explicit assertion",
                        "coverage ok",
                        "evidence ok",
                        "needs improvement",
                        "expected result is vague",
                        null,
                        null,
                        null,
                        "MODIFY",
                        78,
                        0.91,
                        "expected result is vague",
                        suggestion,
                        List.of(),
                        1,
                        null
                )),
                List.of(),
                List.of(),
                "{}",
                true
        ));

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(original.title());
        assertThat(detail.generatedCases().get(0).aiReviewStatus()).isEqualTo("CHANGE_SUGGESTED");

        List<AiCaseCandidateItem> candidates = aiCaseCandidateService.list(created.taskId(), WORKSPACE_CODE);
        assertThat(candidates).hasSize(1);
        AiCaseCandidateItem candidate = candidates.get(0);
        assertThat(candidate.candidateCaseId()).startsWith("AIC_");
        assertThat(candidate.originalCase().title()).isEqualTo(original.title());
        assertThat(candidate.currentCase().title()).isEqualTo(original.title());
        assertThat(candidate.suggestedCase().title()).isEqualTo(suggestion.title());
        assertThat(candidate.reviewStatus()).isEqualTo("CHANGE_SUGGESTED");
        assertThat(candidate.suggestedAction()).isEqualTo("MODIFY");
        assertThat(candidate.humanDecision()).isEqualTo("PENDING");

        AiCaseCandidateItem applied = aiCaseCandidateService.applySuggestion(
                created.taskId(),
                candidate.candidateCaseId(),
                WORKSPACE_CODE,
                new AiCaseCandidateVersionRequest(candidate.contentVersion(), candidate.contentHash())
        );
        assertThat(applied.originalCase().title()).isEqualTo(original.title());
        assertThat(applied.currentCase().title()).isEqualTo(suggestion.title());
        assertThat(applied.humanDecision()).isEqualTo("APPLIED_SUGGESTION");
        assertThat(applied.contentVersion()).isEqualTo(2);
        AiCaseCandidateItem reset = aiCaseCandidateService.resetVersionChoice(
                created.taskId(),
                candidate.candidateCaseId(),
                WORKSPACE_CODE,
                new AiCaseCandidateVersionRequest(applied.contentVersion(), applied.contentHash())
        );
        assertThat(reset.currentCase().title()).isEqualTo(original.title());
        assertThat(reset.humanDecision()).isEqualTo("PENDING");
        assertThat(reset.contentVersion()).isEqualTo(3);
        AiCaseCandidateItem reapplied = aiCaseCandidateService.applySuggestion(
                created.taskId(),
                candidate.candidateCaseId(),
                WORKSPACE_CODE,
                new AiCaseCandidateVersionRequest(reset.contentVersion(), reset.contentHash())
        );
        assertThat(reapplied.currentCase().title()).isEqualTo(suggestion.title());
        assertThat(reapplied.humanDecision()).isEqualTo("APPLIED_SUGGESTION");
        assertThat(reapplied.contentVersion()).isEqualTo(4);
        boolean staleRecorded = aiCaseCandidateService.recordReview(
                created.taskId(),
                candidate.candidateCaseId(),
                candidate.displayIndex(),
                "NOT_RECOMMENDED",
                "EXCLUDE",
                1,
                0.1,
                "late review",
                null,
                List.of(),
                candidate.contentVersion(),
                candidate.contentHash()
        );
        assertThat(staleRecorded).isFalse();
        AiCaseCandidateItem afterStaleReview = aiCaseCandidateService.get(
                created.taskId(), candidate.candidateCaseId(), WORKSPACE_CODE
        );
        assertThat(afterStaleReview.reviewStatus()).isEqualTo("CHANGE_SUGGESTED");
        assertThat(afterStaleReview.currentCase().title()).isEqualTo(suggestion.title());
        assertThatThrownBy(() -> aiCaseCandidateService.applySuggestion(
                created.taskId(),
                candidate.candidateCaseId(),
                WORKSPACE_CODE,
                new AiCaseCandidateVersionRequest(candidate.contentVersion(), candidate.contentHash())
        )).hasMessageContaining("请刷新后重试");

        var directory = caseService.createDirectory(
                WORKSPACE_CODE,
                new CreateCaseDirectoryRequest(WORKSPACE_CODE, null, unique + " adopted directory")
        );
        AiCaseAdoptionItem adoption = aiCaseAdoptionService.adoptCandidate(
                created.taskId(),
                WORKSPACE_CODE,
                candidate.candidateCaseId(),
                new AdoptAiCaseRequest(directory.id())
        );
        assertThat(adoption.status()).isEqualTo("ADOPTED");
        assertThat(adoption.candidateCaseId()).isEqualTo(candidate.candidateCaseId());
        assertThat(adoption.adoptedContentVersion()).isEqualTo(4);
        assertThat(adoption.adoptedContentSource()).isEqualTo("AI_SUGGESTED");
        assertThat(caseService.getCase(adoption.createdCaseId(), WORKSPACE_CODE).title()).isEqualTo(suggestion.title());

        AiCaseAdoptionItem repeated = aiCaseAdoptionService.adoptCandidate(
                created.taskId(),
                WORKSPACE_CODE,
                candidate.candidateCaseId(),
                new AdoptAiCaseRequest(directory.id())
        );
        assertThat(repeated.createdCaseId()).isEqualTo(adoption.createdCaseId());
    }

    @Test
    void executeCompleteTaskMarksFailedWhenGenerationFails() {
        reset(aiProviderClient);
        String unique = uniquePrefix("complete-generation-fail");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        when(aiProviderClient.generate(any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("mock generation failed"));
        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("FAILED");
        assertThat(detail.generationStatus()).isEqualTo("FAILED");
        assertThat(detail.reviewStatus()).isEqualTo("NOT_STARTED");
        assertThat(detail.failedStage()).isEqualTo("GENERATION");
        assertThat(detail.errorCode()).isEqualTo("GENERATION_FAILED");
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.errorMessage()).isEqualTo("mock generation failed");
        assertThat(detail.generatedCount()).isZero();
        assertThat(detail.generatedCases()).isEmpty();
        assertThat(detail.generationRawOutput()).isNull();
        assertThat(detail.reviewResult()).isNull();
        assertThat(detail.reviewRawOutput()).isNull();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("TASK_STARTED", "TASK_FAILED")
                .doesNotContain("GENERATION_COMPLETED", "REVIEW_STARTED");
    }

    @Test
    void executeCompleteTaskKeepsGenerationResultWhenReviewFails() {
        reset(aiProviderClient);
        String unique = uniquePrefix("complete-review-fail");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated before review failure");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of("generation warning"),
                List.of(),
                "{\"cases\":[{\"title\":\"" + unique + " generated before review failure\"}]}"
        ));
        doThrow(new IllegalStateException("mock review failed"))
                .when(aiProviderClient)
                .review(any(), any(), any());
        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("FAILED");
        assertThat(detail.failedStage()).isEqualTo("AI_REVIEW");
        assertThat(detail.errorCode()).isEqualTo("AI_REVIEW_FAILED");
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.errorMessage()).isEqualTo("mock review failed");
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(unique + " generated before review failure");
        assertThat(detail.generationRawOutput()).contains(unique + " generated before review failure");
        assertThat(detail.reviewResult()).isNull();
        assertThat(detail.reviewRawOutput()).isNull();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("GENERATION_COMPLETED", "REVIEW_STARTED", "REVIEW_FAILED")
                .doesNotContain("TASK_FAILED");
    }

    @Test
    void executeTaskKeepsCanceledWhenCanceledBeforeStart() {
        reset(aiProviderClient);
        String unique = uniquePrefix("cancel-before-start");
        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");

        aiGenerationTaskService.cancelTask(created.taskId(), WORKSPACE_CODE);
        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("CANCELED");
        assertThat(detail.generationStatus()).isEqualTo("CANCELED");
        assertThat(detail.reviewStatus()).isEqualTo("NOT_STARTED");
        assertThat(detail.cancelRequested()).isTrue();
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.generatedCount()).isZero();
        assertThat(detail.generatedCases()).isEmpty();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("TASK_CANCELED")
                .doesNotContain("TASK_STARTED", "TASK_FAILED", "GENERATION_COMPLETED", "REVIEW_STARTED");
    }

    @Test
    void executeCompleteTaskKeepsCanceledWhenCanceledAfterGenerationReturns() {
        reset(aiProviderClient);
        String unique = uniquePrefix("complete-cancel-after-generation");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        AtomicReference<String> taskId = new AtomicReference<>();
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated before cancel");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenAnswer(invocation -> {
            aiGenerationTaskService.cancelTask(taskId.get(), WORKSPACE_CODE);
            return new AiGeneratedCasesResult(
                    List.of(generatedCase),
                    "coverage summary",
                    List.of("remaining gap"),
                    List.of("generation warning"),
                    List.of(),
                    "{\"cases\":[{\"title\":\"" + unique + " generated before cancel\"}]}"
            );
        });
        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        taskId.set(created.taskId());

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("CANCELED");
        assertThat(detail.generationStatus()).isEqualTo("CANCELED");
        assertThat(detail.reviewStatus()).isEqualTo("NOT_STARTED");
        assertThat(detail.cancelRequested()).isTrue();
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.generatedCount()).isZero();
        assertThat(detail.generatedCases()).isEmpty();
        assertThat(detail.generationRawOutput()).isNull();
        assertThat(detail.reviewResult()).isNull();
        assertThat(detail.reviewRawOutput()).isNull();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("TASK_STARTED", "TASK_CANCELED")
                .doesNotContain("TASK_FAILED", "GENERATION_COMPLETED", "REVIEW_STARTED");
    }

    @Test
    void executeCompleteTaskKeepsGenerationSucceededWhenCanceledDuringReview() {
        reset(aiProviderClient);
        String unique = uniquePrefix("complete-cancel-during-review");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        AtomicReference<String> taskId = new AtomicReference<>();
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated before review cancel");
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of(),
                List.of(),
                List.of(),
                "{\"cases\":[{\"title\":\"" + unique + " generated before review cancel\"}]}"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenAnswer(invocation -> {
            aiGenerationTaskService.cancelTask(taskId.get(), WORKSPACE_CODE);
            return new AiReviewResult(
                    "APPROVE",
                    "review canceled",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    "{}",
                    true
            );
        });

        AiGenerationTaskResponse created = createTask(unique, "COMPLETE");
        taskId.set(created.taskId());

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("CANCELED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("CANCELED");
        assertThat(detail.failedStage()).isNull();
        assertThat(detail.errorCode()).isNull();
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("GENERATION_COMPLETED", "REVIEW_STARTED", "TASK_CANCELED")
                .doesNotContain("TASK_FAILED", "REVIEW_COMPLETED", "TASK_COMPLETED");
    }

    @Test
    void streamGenerationStopsNormallyAfterAcceptedUniqueCaseLimit() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream-limit");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");

        AiProviderClient realParser = new AiProviderClient(List.of());
        when(aiProviderClient.parseGeneratedCasesContent(anyString(), anyInt()))
                .thenAnswer(invocation -> realParser.parseGeneratedCasesContent(
                        invocation.getArgument(0), invocation.getArgument(1)
                ));
        when(aiProviderClient.selfCheck(any(), any(), any())).thenReturn(new AiGenerationSelfCheckResult(
                true, true, List.of(), List.of(), null, "self check raw"
        ));

        List<String> streamedTitles = List.of(
                unique + " case-a",
                unique + " case-a",
                unique + " case-b",
                unique + " case-c",
                unique + " case-d"
        );
        AtomicInteger emittedChunks = new AtomicInteger();
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    StringBuilder content = new StringBuilder();
                    for (String title : streamedTitles) {
                        String line = generatedCaseLine(title);
                        content.append(line).append('\n');
                        emittedChunks.incrementAndGet();
                        deltaConsumer.accept(line + "\n");
                    }
                    return new AiProviderClient.StreamContentResult(content.toString(), false, null);
                });

        List<AiCaseService.GeneratedCaseStreamUpdate> updates = new java.util.ArrayList<>();
        AiCaseService.StreamedGenerateCasesResult result = aiCaseService.streamGenerateCases(
                WORKSPACE_CODE,
                new GenerateAiCasesRequest(
                        WORKSPACE_CODE,
                        unique + " requirement",
                        "User can login and view dashboard.",
                        null,
                        null,
                        List.of(),
                        List.of(),
                        null,
                        3
                ),
                modelInfo -> { },
                updates::add
        );

        assertThat(emittedChunks).hasValue(4);
        assertThat(updates).hasSize(3);
        assertThat(result.generatedCases()).extracting(GeneratedAiCaseItem::title)
                .containsExactly(unique + " case-a", unique + " case-b", unique + " case-c");
        assertThat(result.generationLimitReached()).isTrue();
        assertThat(result.fallbackToComplete()).isFalse();
        assertThat(result.warnings()).anyMatch(item -> item.contains("主动结束模型流式输出"));
    }

    @Test
    void executeStreamTaskPersistsGenerationReviewAndEvents() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream");
        String model = unique + "-model";
        AiProviderConnectionItem provider = aiCaseService.createProvider(WORKSPACE_CODE, new SaveAiProviderConnectionRequest(
                WORKSPACE_CODE,
                null,
                unique + "-provider",
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "https://ai.example.test/v1",
                30,
                model,
                unique + "-secret",
                1
        ));
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");

        GeneratedAiCaseItem generatedCase = generatedCase(unique + " streamed case");
        String generationLine = "{\"title\":\"" + unique + " streamed case\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\","
                + "\"precondition\":\"User has valid account\",\"steps\":\"1. Open login page\","
                + "\"expectedResult\":\"Dashboard is visible\",\"aiSource\":\"AI_STREAM\"}";
        String reviewLine = "{\"caseIndex\":0,\"status\":\"APPROVED\",\"summary\":\"stream case approved\","
                + "\"coverageComment\":\"coverage ok\",\"evidenceComment\":\"evidence ok\","
                + "\"reviewComment\":\"review comment\"}";
        when(aiProviderClient.parseGeneratedCasesContent(anyString(), anyInt())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of(),
                List.of(),
                generationLine
        ));
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(generationLine + "\n");
                    return new AiProviderClient.StreamContentResult(generationLine + "\n", false, null);
                })
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(reviewLine + "\n");
                    return new AiProviderClient.StreamContentResult(reviewLine + "\n", false, null);
                });

        AiGenerationTaskResponse created = aiGenerationTaskService.createTask(WORKSPACE_CODE, new CreateAiGenerationTaskRequest(
                WORKSPACE_CODE,
                unique + " requirement",
                "User can login and view dashboard.",
                "STREAM",
                null,
                unique + " directory",
                List.of(),
                0
        ));

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.currentStep()).isEqualTo(4);
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.provider()).isEqualTo("OPENAI_COMPATIBLE_CHAT");
        assertThat(detail.model()).isEqualTo(model);
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(unique + " streamed case");
        assertThat(detail.generatedCases().get(0).aiReviewStatus()).isEqualTo("APPROVED");
        assertThat(detail.generatedCases().get(0).aiReviewSummary()).isEqualTo("stream case approved");
        assertThat(detail.reviewResult()).isNotNull();
        assertThat(detail.reviewResult().result()).isEqualTo("APPROVE");
        assertThat(detail.generationRawOutput()).contains(unique + " streamed case");
        assertThat(detail.reviewRawOutput()).contains("stream case approved");
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains(
                        "CASE_GENERATED",
                        "GENERATION_COMPLETED",
                        "REVIEW_STARTED",
                        "CASE_REVIEWED",
                        "REVIEW_COMPLETED",
                        "TASK_COMPLETED"
                );
    }

    @Test
    void executeStreamTaskMarksFailedWhenGenerationStreamFails() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream-generation-fail");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("mock stream generation failed"));
        AiGenerationTaskResponse created = createTask(unique, "STREAM");

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("FAILED");
        assertThat(detail.generationStatus()).isEqualTo("FAILED");
        assertThat(detail.reviewStatus()).isEqualTo("NOT_STARTED");
        assertThat(detail.failedStage()).isEqualTo("GENERATION");
        assertThat(detail.errorCode()).isEqualTo("GENERATION_FAILED");
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.errorMessage()).isEqualTo("mock stream generation failed");
        assertThat(detail.generatedCount()).isZero();
        assertThat(detail.generatedCases()).isEmpty();
        assertThat(detail.generationRawOutput()).isNull();
        assertThat(detail.reviewResult()).isNull();
        assertThat(detail.reviewRawOutput()).isNull();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("TASK_STARTED", "GENERATION_MODEL_READY", "TASK_FAILED")
                .doesNotContain("CASE_GENERATED", "GENERATION_COMPLETED", "REVIEW_STARTED");
    }

    @Test
    void executeStreamTaskKeepsGenerationResultWhenReviewStreamFails() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream-review-fail");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " streamed before review failure");
        String generationLine = "{\"title\":\"" + unique + " streamed before review failure\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\","
                + "\"precondition\":\"User has valid account\",\"steps\":\"1. Open login page\","
                + "\"expectedResult\":\"Dashboard is visible\",\"aiSource\":\"AI_STREAM\"}";
        when(aiProviderClient.parseGeneratedCasesContent(anyString(), anyInt())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of(),
                List.of(),
                generationLine
        ));
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(generationLine + "\n");
                    return new AiProviderClient.StreamContentResult(generationLine + "\n", false, null);
                })
                .thenThrow(new IllegalStateException("mock stream review failed"));
        AiGenerationTaskResponse created = createTask(unique, "STREAM");

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("FAILED");
        assertThat(detail.failedStage()).isEqualTo("AI_REVIEW");
        assertThat(detail.errorCode()).isEqualTo("AI_REVIEW_FAILED");
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.errorMessage()).isEqualTo("mock stream review failed");
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(unique + " streamed before review failure");
        assertThat(detail.generationRawOutput()).contains(unique + " streamed before review failure");
        assertThat(detail.reviewResult()).isNull();
        assertThat(detail.reviewRawOutput()).isNull();
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("CASE_GENERATED", "GENERATION_COMPLETED", "REVIEW_STARTED", "REVIEW_FAILED")
                .doesNotContain("TASK_FAILED");
    }

    @Test
    void executeStreamTaskCompletesWhenGenerationFallsBackToCompleteOutput() {
        reset(aiProviderClient);
        String unique = uniquePrefix("stream-fallback");
        String model = unique + "-model";
        AiProviderConnectionItem provider = createProvider(unique, model);
        upsertConfig("CASE_GENERATOR", provider.id(), model, unique + " generator prompt");
        upsertConfig("CASE_REVIEWER", provider.id(), model, unique + " reviewer prompt");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " fallback case");
        String generationContent = "{\"cases\":[{\"title\":\"" + unique + " fallback case\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\","
                + "\"precondition\":\"User has valid account\",\"steps\":\"1. Open login page\","
                + "\"expectedResult\":\"Dashboard is visible\",\"aiSource\":\"AI_FALLBACK\"}]}";
        String reviewLine = "{\"caseIndex\":0,\"status\":\"APPROVED\",\"summary\":\"fallback case approved\","
                + "\"coverageComment\":\"coverage ok\",\"evidenceComment\":\"evidence ok\","
                + "\"reviewComment\":\"review comment\"}";
        when(aiProviderClient.parseGeneratedCasesContent(anyString(), anyInt())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of(),
                List.of(),
                generationContent
        ));
        when(aiProviderClient.streamStructuredContentWithResult(any(), any(), any(), any()))
                .thenReturn(new AiProviderClient.StreamContentResult(generationContent, true, "mock generation fallback"))
                .thenAnswer(invocation -> {
                    Consumer<String> deltaConsumer = invocation.getArgument(3);
                    deltaConsumer.accept(reviewLine + "\n");
                    return new AiProviderClient.StreamContentResult(reviewLine + "\n", false, null);
                });
        AiGenerationTaskResponse created = createTask(unique, "STREAM");

        aiGenerationTaskService.executeTask(created.taskId(), WORKSPACE_CODE);

        AiGenerationTaskResponse detail = aiGenerationTaskService.getTask(created.taskId(), WORKSPACE_CODE);
        assertThat(detail.status()).isEqualTo("COMPLETED");
        assertThat(detail.generationStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.reviewStatus()).isEqualTo("SUCCEEDED");
        assertThat(detail.currentStep()).isEqualTo(4);
        assertThat(detail.finishedAt()).isNotBlank();
        assertThat(detail.generatedCount()).isEqualTo(1);
        assertThat(detail.generatedCases()).hasSize(1);
        assertThat(detail.generatedCases().get(0).title()).isEqualTo(unique + " fallback case");
        assertThat(detail.generatedCases().get(0).aiReviewStatus()).isEqualTo("APPROVED");
        assertThat(detail.reviewResult()).isNotNull();
        assertThat(detail.reviewResult().result()).isEqualTo("APPROVE");
        assertThat(detail.generationRawOutput()).contains(unique + " fallback case");
        assertThat(detail.reviewRawOutput()).contains("fallback case approved");
        assertThat(detail.events()).extracting(AiGenerationTaskEventResponse::eventType)
                .contains("GENERATION_STREAM_FALLBACK", "GENERATION_COMPLETED", "REVIEW_STARTED", "REVIEW_COMPLETED", "TASK_COMPLETED");
    }

    private AiProviderConnectionItem createProvider(String unique, String model) {
        return aiCaseService.createProvider(WORKSPACE_CODE, new SaveAiProviderConnectionRequest(
                WORKSPACE_CODE,
                null,
                unique + "-provider",
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "https://ai.example.test/v1",
                30,
                model,
                unique + "-secret",
                1
        ));
    }

    private AiGenerationTaskResponse createTask(String unique, String outputMode) {
        return aiGenerationTaskService.createTask(WORKSPACE_CODE, new CreateAiGenerationTaskRequest(
                WORKSPACE_CODE,
                unique + " requirement",
                "User can login and view dashboard.",
                outputMode,
                null,
                unique + " directory",
                List.of(),
                0
        ));
    }

    private void upsertConfig(String roleType, Long providerId, String model, String promptTemplate) {
        upsertConfig(roleType, providerId, model, promptTemplate,
                "CASE_GENERATOR".equals(roleType) ? 100 : 12);
    }

    private void upsertConfig(String roleType, Long providerId, String model, String promptTemplate, int maxCases) {
        SaveAiCaseConfigRequest request = new SaveAiCaseConfigRequest(
                WORKSPACE_CODE,
                roleType,
                providerId,
                null,
                null,
                model,
                null,
                null,
                promptTemplate,
                "review checklist",
                0.3,
                0.9,
                maxCases,
                null,
                true,
                1
        );
        AiCaseConfigResponse current = aiCaseService.getConfig(WORKSPACE_CODE, null);
        AiCaseConfigItem existing = "CASE_REVIEWER".equals(roleType)
                ? current.reviewerConfig()
                : current.generatorConfig();
        if (existing == null) {
            aiCaseService.createConfig(WORKSPACE_CODE, request);
        } else {
            aiCaseService.updateConfig(existing.id(), WORKSPACE_CODE, request);
        }
    }

    private GeneratedAiCaseItem generatedCase(String title) {
        return new GeneratedAiCaseItem(
                title,
                "FUNCTION",
                "P1",
                "User has valid account",
                "1. Open login page",
                "Dashboard is visible",
                "Login risk",
                "Happy path",
                "Core login flow",
                "Requirement line 1",
                "AI_GENERATED",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                "PENDING_REVIEW",
                "Pending review",
                false,
                null,
                null
        );
    }

    private String generatedCaseLine(String title) {
        return "{\"title\":\"" + title + "\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\","
                + "\"precondition\":\"User has valid account\",\"steps\":\"1. Open login page\","
                + "\"expectedResult\":\"Dashboard is visible\",\"aiSource\":\"AI_STREAM\"}";
    }

    private String uniquePrefix(String label) {
        return "ai-task-" + label + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
