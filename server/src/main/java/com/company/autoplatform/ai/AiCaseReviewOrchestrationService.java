package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

@Service
public class AiCaseReviewOrchestrationService {

    private final AiCaseService aiCaseService;
    private final AiCaseCandidateService candidateService;

    public AiCaseReviewOrchestrationService(AiCaseService aiCaseService, AiCaseCandidateService candidateService) {
        this.aiCaseService = aiCaseService;
        this.candidateService = candidateService;
    }

    public ReviewExecutionResult execute(String workspaceCode, AiGenerationTaskEntity task,
                                         List<AiCaseCandidateEntity> candidates) {
        AiCaseService.ReviewedCasesResult response = aiCaseService.reviewGeneratedCasesBatch(
                workspaceCode, reviewRequest(task, candidates));
        AiReviewResult result = normalizeResult(candidates, response.reviewResult());
        int recorded = 0;
        for (AiReviewCaseDecision decision : result.caseDecisions()) {
            if (recordDecision(task, candidates, decision)) recorded++;
        }
        // Batch counters remain zero for new tasks; legacy database records are untouched.
        return new ReviewExecutionResult(result, 0, 0, recorded, result.supplementCases(),
                null, null, result.rawContent(), false, null, response.provider(), response.model());
    }

    public ReviewExecutionResult retryFailedBatches(String workspaceCode, AiGenerationTaskEntity task) {
        return execute(workspaceCode, task, candidateService.listEntities(task.getTaskId()));
    }

    public StreamReviewExecutionResult executeStreaming(String workspaceCode, AiGenerationTaskEntity task,
            List<AiCaseCandidateEntity> candidates, Consumer<AiCaseService.AiStreamModelInfo> modelConsumer,
            Consumer<AiCaseService.ReviewCaseStreamUpdate> updateConsumer) {
        AiCaseService.StreamedReviewResult response = aiCaseService.streamReviewGeneratedCases(
                workspaceCode, reviewRequest(task, candidates), modelConsumer, update -> {
                    if (Thread.currentThread().isInterrupted()) {
                        throw new AiGenerationTaskService.TaskCanceledException("评审执行已停止");
                    }
                    AiCaseService.ReviewCaseStreamUpdate mapped = "SUPPLEMENTED".equals(update.status())
                            ? update : rebaseStreamUpdate(candidates, update);
                    if (mapped != null && updateConsumer != null) updateConsumer.accept(mapped);
                }, true);
        AiReviewResult result = normalizeResult(candidates, response.reviewResult());
        return new StreamReviewExecutionResult(result, 0, 0, result.caseDecisions().size(), result.supplementCases(),
                null, null, result.rawContent(), response.provider(), response.model(), false, null);
    }

    private ReviewAiGeneratedCasesRequest reviewRequest(AiGenerationTaskEntity task, List<AiCaseCandidateEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) throw new BadRequestException("没有可评审的候选用例");
        return new ReviewAiGeneratedCasesRequest(task.getRequirementTitle(), task.getRequirementContent(),
                null, List.of(), candidates.stream().map(candidateService::toReviewItem).toList());
    }

    private AiReviewResult normalizeResult(List<AiCaseCandidateEntity> candidates, AiReviewResult result) {
        if (result == null || !result.structured()) throw new BadRequestException("AI 评审结果无法解析");
        List<AiReviewCaseDecision> decisions = new ArrayList<>();
        for (AiReviewCaseDecision decision : result.caseDecisions() == null ? List.<AiReviewCaseDecision>of() : result.caseDecisions()) {
            AiReviewCaseDecision mapped = rebaseDecision(candidates, decision);
            if (mapped == null) throw new BadRequestException("AI 评审返回了未知候选用例");
            decisions.add(mapped);
        }
        return new AiReviewResult(result.result(), result.summary(), result.issues(), result.suggestions(),
                decisions, result.supplementCases() == null ? List.of() : result.supplementCases(),
                result.unresolvedCoverageGaps(), result.rawContent(), true);
    }

    private AiCaseService.ReviewCaseStreamUpdate rebaseStreamUpdate(
            List<AiCaseCandidateEntity> batchCandidates,
            AiCaseService.ReviewCaseStreamUpdate update
    ) {
        if (update == null || "SUPPLEMENTED".equals(update.status())) {
            return null;
        }
        AiCaseCandidateEntity target = null;
        if (update.candidateCaseId() != null && !update.candidateCaseId().isBlank()) {
            target = batchCandidates.stream()
                    .filter(candidate -> update.candidateCaseId().equals(candidate.getCandidateId()))
                    .findFirst()
                    .orElse(null);
        }
        else if (update.itemIndex() != null && update.itemIndex() >= 0 && update.itemIndex() < batchCandidates.size()) {
            target = batchCandidates.get(update.itemIndex());
        }
        if (target == null) {
            return null;
        }
        return new AiCaseService.ReviewCaseStreamUpdate(
                target.getDisplayIndex(), update.status(), update.summary(), update.coverageComment(),
                update.evidenceComment(), update.reviewComment(), update.optimizationReason(), update.supplementReason(),
                update.coverageGap(), update.optimizedCase(), update.supplementCase(), update.rawOutput(),
                target.getCandidateId(), update.suggestedAction(), update.score(), update.confidence(), update.reason(),
                update.suggestedCase(), update.mergeTargetCandidateIds(),
                update.sourceVersion() == null ? target.getContentVersion() : update.sourceVersion(),
                firstNonBlank(update.sourceContentHash(), target.getContentHash())
        );
    }

    private boolean recordDecision(
            AiGenerationTaskEntity task,
            List<AiCaseCandidateEntity> batchCandidates,
            AiReviewCaseDecision decision
    ) {
        if (decision == null || Thread.currentThread().isInterrupted()) {
            return false;
        }
        boolean belongsToBatch = batchCandidates.stream().anyMatch(candidate ->
                decision.candidateCaseId() != null && decision.candidateCaseId().equals(candidate.getCandidateId())
                        || decision.candidateCaseId() == null && decision.caseIndex() != null
                        && decision.caseIndex().equals(candidate.getDisplayIndex()));
        if (!belongsToBatch) {
            return false;
        }
        return candidateService.recordReview(
                task.getTaskId(),
                decision.candidateCaseId(),
                decision.caseIndex(),
                decision.status(),
                decision.suggestedAction(),
                decision.score(),
                decision.confidence(),
                firstNonBlank(decision.reason(), decision.summary(), decision.reviewComment()),
                decision.suggestedCase() == null ? decision.optimizedCase() : decision.suggestedCase(),
                decision.mergeTargetCandidateIds(),
                decision.sourceVersion(),
                decision.sourceContentHash()
        );
    }

    private AiReviewCaseDecision rebaseDecision(
            List<AiCaseCandidateEntity> batchCandidates,
            AiReviewCaseDecision decision
    ) {
        AiCaseCandidateEntity target = null;
        if (decision.candidateCaseId() != null && !decision.candidateCaseId().isBlank()) {
            target = batchCandidates.stream()
                    .filter(candidate -> decision.candidateCaseId().equals(candidate.getCandidateId()))
                    .findFirst()
                    .orElse(null);
        } else if (decision.caseIndex() != null && decision.caseIndex() >= 0 && decision.caseIndex() < batchCandidates.size()) {
            target = batchCandidates.get(decision.caseIndex());
        }
        if (target == null) {
            return null;
        }
        return new AiReviewCaseDecision(
                target.getDisplayIndex(), decision.status(), decision.summary(), decision.coverageComment(),
                decision.evidenceComment(), decision.reviewComment(), decision.optimizationReason(), decision.coverageGap(),
                decision.optimizedCase(), target.getCandidateId(), decision.suggestedAction(), decision.score(),
                decision.confidence(), decision.reason(), decision.suggestedCase(), decision.mergeTargetCandidateIds(),
                decision.sourceVersion() == null ? target.getContentVersion() : decision.sourceVersion(),
                firstNonBlank(decision.sourceContentHash(), target.getContentHash())
        );
    }

    private String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value;
        return null;
    }

    public record ReviewExecutionResult(
            AiReviewResult reviewResult,
            int completedBatches,
            int failedBatches,
            int reviewedCaseCount,
            List<GeneratedAiCaseItem> supplementCases,
            String reviewRunId,
            String errorMessage,
            String rawContent,
            boolean supplementFailed,
            String supplementFailureMessage,
            String provider,
            String model
    ) {
    }

    public record StreamReviewExecutionResult(
            AiReviewResult reviewResult,
            int completedBatches,
            int failedBatches,
            int reviewedCaseCount,
            List<GeneratedAiCaseItem> supplementCases,
            String reviewRunId,
            String errorMessage,
            String rawContent,
            String provider,
            String model,
            boolean supplementFailed,
            String supplementFailureMessage
    ) {
    }
}
