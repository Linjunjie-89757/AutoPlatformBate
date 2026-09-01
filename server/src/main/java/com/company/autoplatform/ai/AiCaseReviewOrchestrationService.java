package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

@Service
public class AiCaseReviewOrchestrationService {

    static final int REVIEW_BATCH_SIZE = 20;
    static final int MAX_REVIEW_SUPPLEMENT_CASES = 20;

    private final AiCaseService aiCaseService;
    private final AiCaseCandidateService candidateService;
    private final AiCaseReviewRunMapper reviewRunMapper;
    private final AiCaseReviewBatchMapper reviewBatchMapper;
    private final AiCaseCandidateReviewSnapshotMapper snapshotMapper;
    private final AiCaseCoverageItemMapper coverageItemMapper;
    private final AiGenerationTaskResponseSupport responseSupport;

    public AiCaseReviewOrchestrationService(
            AiCaseService aiCaseService,
            AiCaseCandidateService candidateService,
            AiCaseReviewRunMapper reviewRunMapper,
            AiCaseReviewBatchMapper reviewBatchMapper,
            AiCaseCandidateReviewSnapshotMapper snapshotMapper,
            AiCaseCoverageItemMapper coverageItemMapper,
            AiGenerationTaskResponseSupport responseSupport
    ) {
        this.aiCaseService = aiCaseService;
        this.candidateService = candidateService;
        this.reviewRunMapper = reviewRunMapper;
        this.reviewBatchMapper = reviewBatchMapper;
        this.snapshotMapper = snapshotMapper;
        this.coverageItemMapper = coverageItemMapper;
        this.responseSupport = responseSupport;
    }

    @Transactional
    public ReviewExecutionResult execute(
            String workspaceCode,
            AiGenerationTaskEntity task,
            List<AiCaseCandidateEntity> candidates
    ) {
        List<AiCaseCandidateEntity> safeCandidates = candidates == null ? List.of() : candidates;
        String runId = "AIR_" + shortId();
        LocalDateTime startedAt = LocalDateTime.now();
        AiCaseReviewRunEntity run = new AiCaseReviewRunEntity();
        run.setReviewRunId(runId);
        run.setTaskId(task.getTaskId());
        run.setRunNo(nextRunNo(task.getTaskId()));
        run.setStatus("RUNNING");
        run.setTriggerType("TASK_EXECUTION");
        run.setTotalBatches((safeCandidates.size() + REVIEW_BATCH_SIZE - 1) / REVIEW_BATCH_SIZE);
        run.setCompletedBatches(0);
        run.setFailedBatches(0);
        run.setReviewedCaseCount(0);
        run.setSupplementedCaseCount(0);
        run.setCoverageCompleteness("UNKNOWN");
        run.setStartedAt(startedAt);
        run.setCreatedAt(startedAt);
        run.setUpdatedAt(startedAt);
        reviewRunMapper.insert(run);

        List<AiReviewCaseDecision> decisions = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();
        LinkedHashSet<String> coverageGaps = new LinkedHashSet<>();
        List<GeneratedAiCaseItem> supplements = new ArrayList<>();
        int completedBatches = 0;
        int failedBatches = 0;
        int reviewedCaseCount = 0;
        String firstProvider = null;
        String firstModel = null;
        String reviewResultValue = null;
        String reviewSummary = null;
        String firstFailureMessage = null;
        StringBuilder rawContent = new StringBuilder();

        for (int start = 0, batchNo = 1; start < safeCandidates.size(); start += REVIEW_BATCH_SIZE, batchNo += 1) {
            int end = Math.min(start + REVIEW_BATCH_SIZE, safeCandidates.size());
            List<AiCaseCandidateEntity> batchCandidates = safeCandidates.subList(start, end);
            AiCaseReviewBatchEntity batch = createBatch(task, runId, batchNo, batchCandidates);
            try {
                AiReviewResult result = aiCaseService.reviewGeneratedCasesBatch(workspaceCode, new ReviewAiGeneratedCasesRequest(
                        task.getRequirementTitle(),
                        task.getRequirementContent(),
                        null,
                        List.copyOf(coverageGaps),
                        batchCandidates.stream().map(candidateService::toReviewItem).toList()
                ));
                if (result == null || !result.structured()) {
                    throw new BadRequestException("AI 评审返回内容无法解析为结构化结果");
                }
                for (AiReviewCaseDecision decision : result.caseDecisions() == null ? List.<AiReviewCaseDecision>of() : result.caseDecisions()) {
                    AiReviewCaseDecision globalDecision = rebaseDecision(batchCandidates, decision);
                    if (globalDecision != null && recordDecision(task, batchCandidates, globalDecision)) {
                        decisions.add(globalDecision);
                        reviewedCaseCount += 1;
                    }
                }
                issues.addAll(nonBlank(result.issues()));
                suggestions.addAll(nonBlank(result.suggestions()));
                coverageGaps.addAll(nonBlank(result.unresolvedCoverageGaps()));
                coverageGaps.addAll(decisionGaps(result));
                reviewResultValue = mergeReviewResultValue(reviewResultValue, result.result());
                reviewSummary = firstNonBlank(reviewSummary, result.summary());
                if (result.rawContent() != null && !result.rawContent().isBlank()) {
                    if (!rawContent.isEmpty()) {
                        rawContent.append("\n");
                    }
                    rawContent.append(result.rawContent());
                }
                firstProvider = firstNonBlank(firstProvider, "reviewer");
                firstModel = firstNonBlank(firstModel, "reviewer");
                batch.setStatus("SUCCEEDED");
                batch.setResultJson(responseSupport.writeValue(result));
                batch.setRawOutput(limitRawOutput(result.rawContent()));
                batch.setFinishedAt(LocalDateTime.now());
                batch.setUpdatedAt(LocalDateTime.now());
                reviewBatchMapper.updateById(batch);
                completedBatches += 1;
            } catch (RuntimeException exception) {
                firstFailureMessage = firstNonBlank(firstFailureMessage, safeMessage(exception));
                batch.setStatus("FAILED");
                batch.setErrorCode("AI_REVIEW_BATCH_FAILED");
                batch.setErrorMessage(exception.getMessage());
                batch.setFinishedAt(LocalDateTime.now());
                batch.setUpdatedAt(LocalDateTime.now());
                reviewBatchMapper.updateById(batch);
                failedBatches += 1;
            }
        }

        boolean allBatchesSucceeded = failedBatches == 0;
        if (allBatchesSucceeded && !coverageGaps.isEmpty() && !safeCandidates.isEmpty()) {
            try {
                AiReviewResult supplementResult = aiCaseService.reviewCoverageSupplement(workspaceCode, new ReviewAiGeneratedCasesRequest(
                        task.getRequirementTitle(),
                        task.getRequirementContent(),
                        null,
                        List.copyOf(coverageGaps),
                        safeCandidates.stream().map(candidateService::toReviewItem).toList()
                ));
                if (supplementResult != null && supplementResult.structured()) {
                    for (GeneratedAiCaseItem supplement : supplementResult.supplementCases() == null
                            ? List.<GeneratedAiCaseItem>of() : supplementResult.supplementCases()) {
                        if (supplements.size() >= MAX_REVIEW_SUPPLEMENT_CASES) {
                            break;
                        }
                        supplements.add(supplement);
                    }
                    coverageGaps.addAll(nonBlank(supplementResult.unresolvedCoverageGaps()));
                }
            } catch (RuntimeException exception) {
                issues.add("评审补充失败：" + safeMessage(exception));
            }
        }

        List<String> normalizedGaps = List.copyOf(coverageGaps);
        persistCoverageItems(task, normalizedGaps);
        run.setStatus(failedBatches == 0 ? "SUCCEEDED" : (completedBatches == 0 ? "FAILED" : "PARTIAL"));
        run.setCompletedBatches(completedBatches);
        run.setFailedBatches(failedBatches);
        run.setReviewedCaseCount(reviewedCaseCount);
        run.setSupplementedCaseCount(supplements.size());
        run.setCoverageCompleteness(failedBatches == 0 ? (normalizedGaps.isEmpty() ? "COMPLETE" : "INCOMPLETE") : "UNKNOWN");
        run.setGlobalResultJson(responseSupport.writeValue(Map.of(
                "issues", issues,
                "suggestions", suggestions,
                "unresolvedCoverageGaps", normalizedGaps,
                "caseDecisions", decisions,
                "supplementCases", supplements
        )));
        run.setFinishedAt(LocalDateTime.now());
        run.setUpdatedAt(LocalDateTime.now());
        reviewRunMapper.updateById(run);
        if (failedBatches > 0 && completedBatches == 0) {
            return new ReviewExecutionResult(
                    null,
                    completedBatches,
                    failedBatches,
                    reviewedCaseCount,
                    supplements,
                    runId,
                    firstFailureMessage,
                    rawContent.toString()
            );
        }
        return new ReviewExecutionResult(
                new AiReviewResult(
                        failedBatches == 0 ? firstNonBlank(reviewResultValue, normalizedGaps.isEmpty() ? "APPROVE" : "SUGGEST") : "SUGGEST",
                        failedBatches == 0 ? firstNonBlank(reviewSummary, "评审批次已完成") : (completedBatches == 0 ? "评审批次全部失败" : "评审批次部分失败，已保留成功批次结果"),
                        issues,
                        suggestions,
                        decisions,
                        supplements,
                        normalizedGaps,
                        rawContent.toString(),
                        true
                ),
                completedBatches,
                failedBatches,
                reviewedCaseCount,
                supplements,
                runId,
                firstFailureMessage,
                rawContent.toString()
        );
    }

    @Transactional
    public StreamReviewExecutionResult executeStreaming(
            String workspaceCode,
            AiGenerationTaskEntity task,
            List<AiCaseCandidateEntity> candidates,
            Consumer<AiCaseService.AiStreamModelInfo> modelConsumer,
            Consumer<AiCaseService.ReviewCaseStreamUpdate> updateConsumer
    ) {
        List<AiCaseCandidateEntity> safeCandidates = candidates == null ? List.of() : candidates;
        String runId = "AIR_" + shortId();
        LocalDateTime startedAt = LocalDateTime.now();
        AiCaseReviewRunEntity run = new AiCaseReviewRunEntity();
        run.setReviewRunId(runId);
        run.setTaskId(task.getTaskId());
        run.setRunNo(nextRunNo(task.getTaskId()));
        run.setStatus("RUNNING");
        run.setTriggerType("TASK_EXECUTION_STREAM");
        run.setTotalBatches((safeCandidates.size() + REVIEW_BATCH_SIZE - 1) / REVIEW_BATCH_SIZE);
        run.setCompletedBatches(0);
        run.setFailedBatches(0);
        run.setReviewedCaseCount(0);
        run.setSupplementedCaseCount(0);
        run.setCoverageCompleteness("UNKNOWN");
        run.setStartedAt(startedAt);
        run.setCreatedAt(startedAt);
        run.setUpdatedAt(startedAt);
        reviewRunMapper.insert(run);

        List<AiReviewCaseDecision> decisions = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();
        LinkedHashSet<String> coverageGaps = new LinkedHashSet<>();
        List<GeneratedAiCaseItem> supplements = new ArrayList<>();
        int completedBatches = 0;
        int failedBatches = 0;
        int reviewedCaseCount = 0;
        String firstProvider = null;
        String firstModel = null;
        String reviewResultValue = null;
        String reviewSummary = null;
        String firstFailureMessage = null;
        StringBuilder rawContent = new StringBuilder();

        for (int start = 0, batchNo = 1; start < safeCandidates.size(); start += REVIEW_BATCH_SIZE, batchNo += 1) {
            int end = Math.min(start + REVIEW_BATCH_SIZE, safeCandidates.size());
            List<AiCaseCandidateEntity> batchCandidates = safeCandidates.subList(start, end);
            AiCaseReviewBatchEntity batch = createBatch(task, runId, batchNo, batchCandidates);
            try {
                AiCaseService.StreamedReviewResult streamed = aiCaseService.streamReviewGeneratedCases(
                        workspaceCode,
                        new ReviewAiGeneratedCasesRequest(
                                task.getRequirementTitle(),
                                task.getRequirementContent(),
                                null,
                                List.copyOf(coverageGaps),
                                batchCandidates.stream().map(candidateService::toReviewItem).toList()
                        ),
                        modelConsumer,
                        update -> {
                            AiCaseService.ReviewCaseStreamUpdate rebased = rebaseStreamUpdate(batchCandidates, update);
                            if (rebased != null && updateConsumer != null) {
                                updateConsumer.accept(rebased);
                            }
                        },
                        false
                );
                if (streamed == null || streamed.reviewResult() == null || !streamed.reviewResult().structured()) {
                    throw new BadRequestException("AI 评审返回内容无法解析为结构化结果");
                }
                AiReviewResult result = streamed.reviewResult();
                for (AiReviewCaseDecision decision : result.caseDecisions() == null ? List.<AiReviewCaseDecision>of() : result.caseDecisions()) {
                    AiReviewCaseDecision globalDecision = rebaseDecision(batchCandidates, decision);
                    if (globalDecision != null) {
                        decisions.add(globalDecision);
                        reviewedCaseCount += 1;
                    }
                }
                issues.addAll(nonBlank(result.issues()));
                suggestions.addAll(nonBlank(result.suggestions()));
                coverageGaps.addAll(nonBlank(result.unresolvedCoverageGaps()));
                coverageGaps.addAll(decisionGaps(result));
                reviewResultValue = mergeReviewResultValue(reviewResultValue, result.result());
                reviewSummary = firstNonBlank(reviewSummary, result.summary());
                firstProvider = firstNonBlank(firstProvider, streamed.provider());
                firstModel = firstNonBlank(firstModel, streamed.model());
                appendRaw(rawContent, streamed.rawContent());
                batch.setStatus("SUCCEEDED");
                batch.setResultJson(responseSupport.writeValue(result));
                batch.setRawOutput(limitRawOutput(streamed.rawContent()));
                batch.setFinishedAt(LocalDateTime.now());
                batch.setUpdatedAt(LocalDateTime.now());
                reviewBatchMapper.updateById(batch);
                completedBatches += 1;
            } catch (AiGenerationTaskService.TaskCanceledException exception) {
                throw exception;
            } catch (RuntimeException exception) {
                firstFailureMessage = firstNonBlank(firstFailureMessage, safeMessage(exception));
                batch.setStatus("FAILED");
                batch.setErrorCode("AI_REVIEW_BATCH_FAILED");
                batch.setErrorMessage(exception.getMessage());
                batch.setFinishedAt(LocalDateTime.now());
                batch.setUpdatedAt(LocalDateTime.now());
                reviewBatchMapper.updateById(batch);
                failedBatches += 1;
            }
        }

        boolean allBatchesSucceeded = failedBatches == 0;
        if (allBatchesSucceeded && !coverageGaps.isEmpty() && !safeCandidates.isEmpty()) {
            try {
                AiReviewResult supplementResult = aiCaseService.reviewCoverageSupplement(workspaceCode, new ReviewAiGeneratedCasesRequest(
                        task.getRequirementTitle(),
                        task.getRequirementContent(),
                        null,
                        List.copyOf(coverageGaps),
                        safeCandidates.stream().map(candidateService::toReviewItem).toList()
                ));
                if (supplementResult != null && supplementResult.structured()) {
                    for (GeneratedAiCaseItem supplement : supplementResult.supplementCases() == null
                            ? List.<GeneratedAiCaseItem>of() : supplementResult.supplementCases()) {
                        if (supplements.size() >= MAX_REVIEW_SUPPLEMENT_CASES) {
                            break;
                        }
                        supplements.add(supplement);
                        if (updateConsumer != null) {
                            updateConsumer.accept(new AiCaseService.ReviewCaseStreamUpdate(
                                    null,
                                    "SUPPLEMENTED",
                                    firstNonBlank(supplement.aiReviewSummary(), supplement.supplementReason(), supplement.coverageGap()),
                                    null,
                                    null,
                                    supplement.reviewComment(),
                                    null,
                                    supplement.supplementReason(),
                                    supplement.coverageGap(),
                                    null,
                                    supplement,
                                    supplementResult.rawContent(),
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    List.of(),
                                    null,
                                    null
                            ));
                        }
                    }
                    coverageGaps.addAll(nonBlank(supplementResult.unresolvedCoverageGaps()));
                    appendRaw(rawContent, supplementResult.rawContent());
                    reviewResultValue = mergeReviewResultValue(reviewResultValue, supplementResult.result());
                    reviewSummary = firstNonBlank(reviewSummary, supplementResult.summary());
                }
            } catch (RuntimeException exception) {
                issues.add("评审补充失败：" + safeMessage(exception));
            }
        }

        List<String> normalizedGaps = List.copyOf(coverageGaps);
        persistCoverageItems(task, normalizedGaps);
        run.setStatus(failedBatches == 0 ? "SUCCEEDED" : (completedBatches == 0 ? "FAILED" : "PARTIAL"));
        run.setCompletedBatches(completedBatches);
        run.setFailedBatches(failedBatches);
        run.setReviewedCaseCount(reviewedCaseCount);
        run.setSupplementedCaseCount(supplements.size());
        run.setCoverageCompleteness(failedBatches == 0 ? (normalizedGaps.isEmpty() ? "COMPLETE" : "INCOMPLETE") : "UNKNOWN");
        run.setGlobalResultJson(responseSupport.writeValue(Map.of(
                "issues", issues,
                "suggestions", suggestions,
                "unresolvedCoverageGaps", normalizedGaps,
                "caseDecisions", decisions,
                "supplementCases", supplements
        )));
        run.setFinishedAt(LocalDateTime.now());
        run.setUpdatedAt(LocalDateTime.now());
        reviewRunMapper.updateById(run);
        if (failedBatches > 0 && completedBatches == 0) {
            return new StreamReviewExecutionResult(null, completedBatches, failedBatches, reviewedCaseCount,
                    supplements, runId, firstFailureMessage, rawContent.toString(), firstProvider, firstModel);
        }
        return new StreamReviewExecutionResult(new AiReviewResult(
                failedBatches == 0 ? firstNonBlank(reviewResultValue, normalizedGaps.isEmpty() ? "APPROVE" : "SUGGEST") : "SUGGEST",
                failedBatches == 0 ? firstNonBlank(reviewSummary, "评审批次已完成") : "评审批次部分失败，已保留成功批次结果",
                issues, suggestions, decisions, supplements, normalizedGaps, rawContent.toString(), true
        ), completedBatches, failedBatches, reviewedCaseCount, supplements, runId, firstFailureMessage,
                rawContent.toString(), firstProvider, firstModel);
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
        if (target == null && update.itemIndex() != null && update.itemIndex() >= 0 && update.itemIndex() < batchCandidates.size()) {
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
                update.suggestedCase(), update.mergeTargetCandidateIds(), update.sourceVersion(), update.sourceContentHash()
        );
    }

    private void appendRaw(StringBuilder rawContent, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (!rawContent.isEmpty()) {
            rawContent.append("\n");
        }
        rawContent.append(value);
    }

    private AiCaseReviewBatchEntity createBatch(
            AiGenerationTaskEntity task,
            String runId,
            int batchNo,
            List<AiCaseCandidateEntity> candidates
    ) {
        LocalDateTime now = LocalDateTime.now();
        AiCaseReviewBatchEntity batch = new AiCaseReviewBatchEntity();
        batch.setReviewBatchId("AIB_" + shortId());
        batch.setReviewRunId(runId);
        batch.setTaskId(task.getTaskId());
        batch.setBatchNo(batchNo);
        batch.setStatus("RUNNING");
        batch.setCandidateIdsJson(responseSupport.writeValue(candidates.stream().map(AiCaseCandidateEntity::getCandidateId).toList()));
        batch.setCoverageItemIdsJson(responseSupport.writeValue(List.of()));
        batch.setSnapshotId(null);
        batch.setAttemptCount(1);
        batch.setStartedAt(now);
        batch.setCreatedAt(now);
        batch.setUpdatedAt(now);
        for (AiCaseCandidateEntity candidate : candidates) {
            AiCaseCandidateReviewSnapshotEntity snapshot = new AiCaseCandidateReviewSnapshotEntity();
            snapshot.setSnapshotId("AIS_" + shortId());
            snapshot.setCandidateId(candidate.getCandidateId());
            snapshot.setTaskId(task.getTaskId());
            snapshot.setReviewRunId(runId);
            snapshot.setReviewBatchId(batch.getReviewBatchId());
            snapshot.setContentVersion(candidate.getContentVersion() == null ? 1 : candidate.getContentVersion());
            snapshot.setContentHash(candidate.getContentHash());
            snapshot.setCaseJson(candidate.getCurrentCaseJson());
            snapshot.setCreatedAt(now);
            snapshot.setUpdatedAt(now);
            snapshotMapper.insert(snapshot);
        }
        reviewBatchMapper.insert(batch);
        return batch;
    }

    private boolean recordDecision(
            AiGenerationTaskEntity task,
            List<AiCaseCandidateEntity> batchCandidates,
            AiReviewCaseDecision decision
    ) {
        if (decision == null) {
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
                decision.sourceVersion(), decision.sourceContentHash()
        );
    }

    private void persistCoverageItems(AiGenerationTaskEntity task, List<String> gaps) {
        int nextNo = coverageItemMapper.selectList(new LambdaQueryWrapper<AiCaseCoverageItemEntity>()
                .eq(AiCaseCoverageItemEntity::getTaskId, task.getTaskId())).size() + 1;
        for (String gap : gaps) {
            String normalized = gap.trim();
            AiCaseCoverageItemEntity existing = coverageItemMapper.selectOne(new LambdaQueryWrapper<AiCaseCoverageItemEntity>()
                    .eq(AiCaseCoverageItemEntity::getTaskId, task.getTaskId())
                    .eq(AiCaseCoverageItemEntity::getTitle, normalized)
                    .last("limit 1"));
            if (existing != null) {
                continue;
            }
            AiCaseCoverageItemEntity item = new AiCaseCoverageItemEntity();
            LocalDateTime now = LocalDateTime.now();
            item.setCoverageItemId("AICOV_" + shortId());
            item.setTaskId(task.getTaskId());
            item.setItemNo(nextNo++);
            item.setTitle(normalized);
            item.setDescription(normalized);
            item.setCoverageStatus("GAP");
            item.setCoveredCandidateIdsJson(responseSupport.writeValue(List.of()));
            item.setEvidenceJson(responseSupport.writeValue(List.of()));
            item.setIssuesJson(responseSupport.writeValue(List.of()));
            item.setCreatedAt(now);
            item.setUpdatedAt(now);
            coverageItemMapper.insert(item);
        }
    }

    private int nextRunNo(String taskId) {
        AiCaseReviewRunEntity latest = reviewRunMapper.selectOne(new LambdaQueryWrapper<AiCaseReviewRunEntity>()
                .eq(AiCaseReviewRunEntity::getTaskId, taskId)
                .orderByDesc(AiCaseReviewRunEntity::getRunNo)
                .last("limit 1"));
        return latest == null || latest.getRunNo() == null ? 1 : latest.getRunNo() + 1;
    }

    private List<String> decisionGaps(AiReviewResult result) {
        List<String> gaps = new ArrayList<>();
        for (AiReviewCaseDecision decision : result.caseDecisions() == null ? List.<AiReviewCaseDecision>of() : result.caseDecisions()) {
            if (decision.coverageGap() != null && !decision.coverageGap().isBlank()) {
                gaps.add(decision.coverageGap());
            }
        }
        return gaps;
    }

    private List<String> nonBlank(List<String> values) {
        return values == null ? List.of() : values.stream().filter(item -> item != null && !item.isBlank()).map(String::trim).toList();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String safeMessage(RuntimeException exception) {
        return exception.getMessage() == null || exception.getMessage().isBlank()
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
    }

    private String mergeReviewResultValue(String current, String next) {
        if (next == null || next.isBlank()) {
            return current;
        }
        if (current == null || current.isBlank()) {
            return next.trim();
        }
        if ("REJECT".equalsIgnoreCase(current) || "SUGGEST".equalsIgnoreCase(current)) {
            return current;
        }
        return next.trim();
    }

    private String limitRawOutput(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.length() <= 12000 ? value : value.substring(value.length() - 12000);
    }

    private String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
    }

    public record ReviewExecutionResult(
            AiReviewResult reviewResult,
            int completedBatches,
            int failedBatches,
            int reviewedCaseCount,
            List<GeneratedAiCaseItem> supplementCases,
            String reviewRunId,
            String errorMessage,
            String rawContent
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
            String model
    ) {
    }
}
