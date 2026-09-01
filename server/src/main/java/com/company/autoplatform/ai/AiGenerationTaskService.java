package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiGenerationTaskService {

    private final AiGenerationTaskMapper aiGenerationTaskMapper;
    private final AiGenerationTaskDomainService taskDomainService;
    private final AiCaseService aiCaseService;
    private final AiGenerationTaskEventService eventService;
    private final AiGenerationTaskResponseSupport responseSupport;
    private final AiGenerationTaskResultMergeSupport resultMergeSupport;
    private final AiGenerationTaskEventMessageSupport eventMessageSupport;
    private final AiGenerationTaskSseSupport sseSupport;
    private final AiGenerationTaskExecutionStateSupport stateSupport;
    private final AiCaseCandidateService candidateService;
    private final AiCaseReviewOrchestrationService reviewOrchestrationService;

    public AiGenerationTaskService(
            AiGenerationTaskMapper aiGenerationTaskMapper,
            AiGenerationTaskDomainService taskDomainService,
            AiCaseService aiCaseService,
            AiGenerationTaskEventService eventService,
            AiGenerationTaskResponseSupport responseSupport,
            AiGenerationTaskResultMergeSupport resultMergeSupport,
            AiGenerationTaskEventMessageSupport eventMessageSupport,
            AiGenerationTaskSseSupport sseSupport,
            AiGenerationTaskExecutionStateSupport stateSupport,
            AiCaseCandidateService candidateService,
            AiCaseReviewOrchestrationService reviewOrchestrationService
    ) {
        this.aiGenerationTaskMapper = aiGenerationTaskMapper;
        this.taskDomainService = taskDomainService;
        this.aiCaseService = aiCaseService;
        this.eventService = eventService;
        this.responseSupport = responseSupport;
        this.resultMergeSupport = resultMergeSupport;
        this.eventMessageSupport = eventMessageSupport;
        this.sseSupport = sseSupport;
        this.stateSupport = stateSupport;
        this.candidateService = candidateService;
        this.reviewOrchestrationService = reviewOrchestrationService;
    }

    public AiGenerationTaskResponse createTask(String headerWorkspaceCode, CreateAiGenerationTaskRequest request) {
        return taskDomainService.createTask(headerWorkspaceCode, request);
    }

    public List<AiGenerationTaskResponse> listTasks(String workspaceCode) {
        return taskDomainService.listTasks(workspaceCode);
    }

    public AiGenerationTaskResponse getTask(String taskId, String workspaceCode) {
        return taskDomainService.getTask(taskId, workspaceCode);
    }

    public AiGenerationTaskResponse cancelTask(String taskId, String workspaceCode) {
        return taskDomainService.cancelTask(taskId, workspaceCode);
    }

    public AiGenerationTaskResponse retryTask(String taskId, String workspaceCode) {
        return taskDomainService.retryTask(taskId, workspaceCode);
    }

    public AiGenerationTaskResponse updateTask(String taskId, String workspaceCode, UpdateAiGenerationTaskRequest request) {
        return taskDomainService.updateTask(taskId, workspaceCode, request);
    }

    public void deleteTask(String taskId, String workspaceCode) {
        taskDomainService.deleteTask(taskId, workspaceCode);
    }

    public void executeTask(String taskId, String workspaceCode) {
        AiGenerationTaskEntity entity = requireTask(taskId);
        if (stateSupport.isCanceled(entity)) {
            stateSupport.markCanceled(entity, "任务已取消，未进入执行阶段。");
            return;
        }

        try {
            if ("COMPLETE".equals(normalizeOutputMode(entity.getOutputMode()))) {
                executeCompleteTask(entity, workspaceCode);
            } else {
                executeStreamTask(entity, workspaceCode);
            }
        } catch (TaskCanceledException exception) {
            stateSupport.markCanceled(requireTask(taskId), exception.getMessage());
        } catch (Exception exception) {
            stateSupport.markFailed(taskId, exception);
        }
    }

    private void executeCompleteTask(AiGenerationTaskEntity entity, String workspaceCode) {
        appendEvent(entity.getTaskId(), "TASK_STARTED", "SETUP", "INFO", "任务开始执行完整输出链路", null, null, null, null, null);
        stateSupport.transitionToGenerating(entity);
        List<Long> assetIds = responseSupport.readValue(entity.getAssetIdsJson(), new TypeReference<List<Long>>() {}, List.of());
        if (!assetIds.isEmpty()) {
            appendEvent(entity.getTaskId(), "IMAGE_ASSETS_SENT", "GENERATING", "INFO", "已提交 " + assetIds.size() + " 个图片素材，开始图文生成。", null, null, null, null, null);
        }
        GenerateAiCasesResponse generation = aiCaseService.generateCases(workspaceCode, new GenerateAiCasesRequest(
                workspaceCode,
                entity.getRequirementTitle(),
                entity.getRequirementContent(),
                null,
                null,
                assetIds,
                List.of(),
                null,
                null
        ));

        entity = requireTask(entity.getTaskId());
        if (stateSupport.isCanceled(entity)) {
            throw new TaskCanceledException("任务已取消，生成结果未继续写入。");
        }

        entity.setProvider(generation.provider());
        entity.setModel(generation.model());
        entity.setGenerationProvider(generation.provider());
        entity.setGenerationModel(generation.model());
        entity.setGeneratedCount(generation.actualGeneratedCount() == null ? 0 : generation.actualGeneratedCount());
        entity.setWarningsJson(responseSupport.writeValue(generation.warnings()));
        entity.setInvalidCasesJson(responseSupport.writeValue(generation.invalidCases()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(generation.generatedCases()));
        entity.setGenerationRawOutput(stateSupport.limitRawOutput(generation.rawContent()));
        persistSelfCheckResult(entity, generation.selfCheck(), generation.warnings());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        List<AiCaseCandidateEntity> candidates = candidateService.materializeGeneratedCases(entity, generation.generatedCases());
        stateSupport.transitionToReviewing(entity);
        if (generation.ignoredImages()) {
            appendEvent(entity.getTaskId(), "IMAGE_ASSETS_IGNORED", "GENERATING", "WARN", "当前生成模型实际不支持图片输入，已自动忽略图片素材并改为纯文本生成。", null, null, generation.provider(), generation.model(), null);
        } else if (!assetIds.isEmpty()) {
            appendEvent(entity.getTaskId(), "IMAGE_ASSETS_ACCEPTED", "GENERATING", "SUCCESS", "图片素材已被模型接受，继续生成。", null, null, generation.provider(), generation.model(), null);
        }
        appendSelfCheckEvents(entity.getTaskId(), generation.selfCheck(), generation.selfSupplementCases(), generation.provider(), generation.model());
        appendEvent(entity.getTaskId(), "GENERATION_COMPLETED", "GENERATING", "SUCCESS", "用例生成完成，共 " + generation.generatedCases().size() + " 条。", null, null, generation.provider(), generation.model(), null);
        appendEvent(entity.getTaskId(), "REVIEW_STARTED", "REVIEWING", "INFO", "开始执行 AI 自动评审", null, null, null, null, null);

        AiCaseReviewOrchestrationService.ReviewExecutionResult reviewExecution;
        try {
            reviewExecution = reviewOrchestrationService.execute(workspaceCode, entity, candidates);
        } catch (TaskCanceledException exception) {
            throw exception;
        } catch (Exception exception) {
            stateSupport.markReviewFailed(entity.getTaskId(), exception);
            return;
        }

        entity = requireTask(entity.getTaskId());
        if (stateSupport.isCanceled(entity)) {
            throw new TaskCanceledException("任务已取消，评审结果未继续写入。");
        }
        if (reviewExecution.reviewResult() == null) {
            entity.setTotalReviewBatches(reviewExecution.completedBatches() + reviewExecution.failedBatches());
            entity.setCompletedReviewBatches(reviewExecution.completedBatches());
            entity.setFailedReviewBatches(reviewExecution.failedBatches());
            entity.setReviewedCaseCount(reviewExecution.reviewedCaseCount());
            entity.setSupplementedCaseCount(0);
            entity.setUpdatedAt(LocalDateTime.now());
            aiGenerationTaskMapper.updateById(entity);
            stateSupport.markReviewFailed(entity.getTaskId(), new IllegalStateException(
                    firstNonBlank(reviewExecution.errorMessage(), "AI 评审批次全部失败")
            ));
            return;
        }
        AiReviewResult review = reviewExecution.reviewResult();
        List<GeneratedAiCaseItem> finalCases = resultMergeSupport.mergeCompleteReviewResult(generation.generatedCases(), candidates, review);
        persistReviewSupplementCandidates(entity, generation.generatedCases().size(), finalCases);
        entity.setGeneratedCasesJson(responseSupport.writeValue(finalCases));
        entity.setGeneratedCount(finalCases.size());
        entity.setReviewResultJson(responseSupport.writeValue(review));
        entity.setReviewRawOutput(stateSupport.limitRawOutput(review.rawContent()));
        entity.setTotalReviewBatches(reviewExecution.completedBatches() + reviewExecution.failedBatches());
        entity.setCompletedReviewBatches(reviewExecution.completedBatches());
        entity.setFailedReviewBatches(reviewExecution.failedBatches());
        entity.setReviewedCaseCount(reviewExecution.reviewedCaseCount());
        entity.setSupplementedCaseCount(reviewExecution.supplementCases().size());
        entity.setCoverageCompleteness(reviewExecution.failedBatches() == 0
                ? (review.unresolvedCoverageGaps() == null || review.unresolvedCoverageGaps().isEmpty() ? "COMPLETE" : "INCOMPLETE")
                : "UNKNOWN");
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        if (reviewExecution.failedBatches() > 0 && reviewExecution.completedBatches() > 0) {
            stateSupport.markReviewPartial(entity, "用例已生成，部分 AI 评审批次失败，成功结果仍可查看和采纳。", "失败批次：" + reviewExecution.failedBatches());
        } else if (reviewExecution.failedBatches() > 0) {
            stateSupport.markReviewFailed(entity.getTaskId(), new IllegalStateException("AI 评审批次全部失败"));
        } else {
            stateSupport.markCompleted(entity, "任务已完成，可在记录详情中查看生成结果并继续处理。");
        }
        appendCompleteReviewEvents(entity.getTaskId(), finalCases, review, generation.provider(), generation.model());
        appendEvent(entity.getTaskId(), "TASK_COMPLETED", "DONE", "SUCCESS", "生成与评审已完成。", null, null, generation.provider(), generation.model(), null);
    }

    private void executeStreamTask(AiGenerationTaskEntity entity, String workspaceCode) {
        String taskId = entity.getTaskId();
        appendEvent(taskId, "TASK_STARTED", "SETUP", "INFO", "任务开始执行实时流式输出链路", null, null, null, null, null);
        stateSupport.transitionToGenerating(entity);
        List<Long> assetIds = responseSupport.readValue(entity.getAssetIdsJson(), new TypeReference<List<Long>>() {}, List.of());
        if (!assetIds.isEmpty()) {
            appendEvent(taskId, "IMAGE_ASSETS_SENT", "GENERATING", "INFO", "已提交 " + assetIds.size() + " 个图片素材，开始图文生成。", null, null, null, null, null);
        }
        List<GeneratedAiCaseItem> generatedCases = new ArrayList<>();
        AiCaseService.StreamedGenerateCasesResult generation = aiCaseService.streamGenerateCases(
                workspaceCode,
                new GenerateAiCasesRequest(
                        workspaceCode,
                        entity.getRequirementTitle(),
                        entity.getRequirementContent(),
                        null,
                        null,
                        assetIds,
                        List.of(),
                        null,
                        null
                ),
                modelInfo -> {
                    AiGenerationTaskEntity latest = requireTask(taskId);
                    latest.setProvider(modelInfo.provider());
                    latest.setModel(modelInfo.model());
                    latest.setUpdatedAt(LocalDateTime.now());
                    aiGenerationTaskMapper.updateById(latest);
                    appendEvent(taskId, "GENERATION_MODEL_READY", "GENERATING", "INFO", "生成模型已就绪：" + modelInfo.model(), null, null, modelInfo.provider(), modelInfo.model(), null);
                },
                update -> {
                    AiGenerationTaskEntity latest = requireTask(taskId);
                    if (stateSupport.isCanceled(latest)) {
                        throw new TaskCanceledException("任务已取消，停止接收生成流。");
                    }
                    generatedCases.add(update.item());
                    stateSupport.persistGeneratedCasesSnapshot(latest, generatedCases, update.rawOutput());
                    appendEvent(taskId, "CASE_GENERATED", "GENERATING", "SUCCESS", eventMessageSupport.buildGeneratedCaseEventMessage(update.itemIndex(), update.item()), update.itemIndex(), update.item().title(), latest.getProvider(), latest.getModel(), responseSupport.writeValue(update.item()));
                }
        );

        entity = requireTask(taskId);
        if (stateSupport.isCanceled(entity)) {
            throw new TaskCanceledException("任务已取消，生成结果未继续写入。");
        }
        generatedCases.clear();
        generatedCases.addAll(generation.generatedCases());
        entity.setProvider(generation.provider());
        entity.setModel(generation.model());
        entity.setGenerationProvider(generation.provider());
        entity.setGenerationModel(generation.model());
        entity.setGeneratedCount(generation.actualGeneratedCount() == null ? generatedCases.size() : generation.actualGeneratedCount());
        entity.setWarningsJson(responseSupport.writeValue(generation.warnings()));
        entity.setInvalidCasesJson(responseSupport.writeValue(generation.invalidCases()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
        entity.setGenerationRawOutput(stateSupport.limitRawOutput(generation.rawContent()));
        persistSelfCheckResult(entity, generation.selfCheck(), generation.warnings());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        List<AiCaseCandidateEntity> candidates = candidateService.materializeGeneratedCases(entity, generatedCases);
        stateSupport.transitionToReviewing(entity);
        if (generation.ignoredImages()) {
            appendEvent(taskId, "IMAGE_ASSETS_IGNORED", "GENERATING", "WARN", "当前生成模型实际不支持图片输入，已自动忽略图片素材并改为纯文本生成。", null, null, generation.provider(), generation.model(), null);
        } else if (!assetIds.isEmpty()) {
            appendEvent(taskId, "IMAGE_ASSETS_ACCEPTED", "GENERATING", "SUCCESS", "图片素材已被模型接受，继续生成。", null, null, generation.provider(), generation.model(), null);
        }
        if (generation.fallbackToComplete()) {
            appendEvent(
                    taskId,
                    "GENERATION_STREAM_FALLBACK",
                    "GENERATING",
                    "WARN",
                    "当前生成模型不支持实时流式或流式请求失败，已降级为完整输出。",
                    null,
                    null,
                    generation.provider(),
                    generation.model(),
                    responseSupport.writeValue(Map.of("reason", blankToNull(generation.fallbackReason()) == null ? "" : generation.fallbackReason()))
            );
        }
        appendSelfCheckEvents(taskId, generation.selfCheck(), generation.selfSupplementCases(), generation.provider(), generation.model());
        appendEvent(taskId, "GENERATION_COMPLETED", "GENERATING", "SUCCESS", "用例生成完成，共 " + generatedCases.size() + " 条。", null, null, generation.provider(), generation.model(), null);

        final String[] reviewProvider = new String[]{null};
        final String[] reviewModel = new String[]{null};
        AiCaseReviewOrchestrationService.StreamReviewExecutionResult reviewExecution;
        try {
            reviewExecution = reviewOrchestrationService.executeStreaming(
                    workspaceCode,
                    entity,
                    candidates,
                    modelInfo -> {
                        reviewProvider[0] = modelInfo.provider();
                        reviewModel[0] = modelInfo.model();
                        AiGenerationTaskEntity latest = requireTask(taskId);
                        latest.setReviewProvider(modelInfo.provider());
                        latest.setReviewModel(modelInfo.model());
                        latest.setUpdatedAt(LocalDateTime.now());
                        aiGenerationTaskMapper.updateById(latest);
                        appendEvent(taskId, "REVIEW_STARTED", "REVIEWING", "INFO", "评审模型已就绪：" + modelInfo.model(), null, null, modelInfo.provider(), modelInfo.model(), null);
                    },
                    update -> {
                        AiGenerationTaskEntity latest = requireTask(taskId);
                        if (stateSupport.isCanceled(latest)) {
                            throw new TaskCanceledException("任务已取消，停止接收评审流。");
                        }
                        if ("SUPPLEMENTED".equals(update.status()) && update.supplementCase() != null) {
                            if (generatedCases.size() >= AiCaseService.FINAL_MAX_CASES) {
                                return;
                            }
                            GeneratedAiCaseItem supplemented = resultMergeSupport.withStreamSupplementMetadata(update);
                            AiCaseCandidateEntity supplementCandidate = candidateService.appendSupplement(
                                    latest,
                                    generatedCases.size(),
                                    supplemented,
                                    firstNonBlank(update.reason(), update.summary(), update.supplementReason(), update.coverageGap())
                            );
                            if (supplementCandidate == null) {
                                return;
                            }
                            generatedCases.add(supplemented);
                            latest.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
                            latest.setGeneratedCount(generatedCases.size());
                            latest.setReviewRawOutput(stateSupport.limitRawOutput(update.rawOutput()));
                            latest.setUpdatedAt(LocalDateTime.now());
                            aiGenerationTaskMapper.updateById(latest);
                            int itemIndex = generatedCases.size() - 1;
                            appendEvent(taskId, "CASE_SUPPLEMENTED", "REVIEWING", "SUCCESS", eventMessageSupport.buildSupplementedCaseEventMessage(itemIndex, supplemented), itemIndex, supplemented.title(), reviewProvider[0], reviewModel[0], responseSupport.writeValue(Map.of(
                                    "status", update.status(),
                                    "summary", update.summary() == null ? "" : update.summary(),
                                    "supplementReason", update.supplementReason() == null ? "" : update.supplementReason(),
                                    "coverageGap", update.coverageGap() == null ? "" : update.coverageGap()
                            )));
                            return;
                        }
                        if (update.itemIndex() == null || update.itemIndex() < 0 || update.itemIndex() >= generatedCases.size()) {
                            return;
                        }
                        GeneratedAiCaseItem reviewed = resultMergeSupport.applyReviewUpdate(generatedCases.get(update.itemIndex()), update);
                        boolean reviewRecorded = candidateService.recordReview(
                                taskId,
                                update.candidateCaseId(),
                                update.itemIndex(),
                                update.status(),
                                update.suggestedAction(),
                                update.score(),
                                update.confidence(),
                                firstNonBlank(update.reason(), update.summary(), update.reviewComment()),
                                update.suggestedCase(),
                                update.mergeTargetCandidateIds(),
                                update.sourceVersion(),
                                update.sourceContentHash()
                        );
                        if (!reviewRecorded) {
                            return;
                        }
                        generatedCases.set(update.itemIndex(), reviewed);
                        latest.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
                        latest.setReviewRawOutput(stateSupport.limitRawOutput(update.rawOutput()));
                        latest.setUpdatedAt(LocalDateTime.now());
                        aiGenerationTaskMapper.updateById(latest);
                        appendEvent(taskId, "CASE_REVIEWED", "REVIEWING", reviewEventLevel(update.status()), eventMessageSupport.buildReviewedCaseEventMessage(update.itemIndex(), reviewed.title(), update.status(), update.summary(), update.coverageComment(), update.evidenceComment()), update.itemIndex(), reviewed.title(), reviewProvider[0], reviewModel[0], responseSupport.writeValue(Map.of(
                                "status", update.status(),
                                "summary", update.summary() == null ? "" : update.summary(),
                                "coverageComment", update.coverageComment() == null ? "" : update.coverageComment(),
                                "evidenceComment", update.evidenceComment() == null ? "" : update.evidenceComment(),
                                "reviewComment", update.reviewComment() == null ? "" : update.reviewComment(),
                                "optimizationReason", update.optimizationReason() == null ? "" : update.optimizationReason(),
                                "coverageGap", update.coverageGap() == null ? "" : update.coverageGap()
                        )));
                    }
            );
        } catch (TaskCanceledException exception) {
            throw exception;
        } catch (Exception exception) {
            stateSupport.markReviewFailed(taskId, exception);
            return;
        }

        entity = requireTask(taskId);
        if (stateSupport.isCanceled(entity)) {
            throw new TaskCanceledException("任务已取消，评审结果未继续写入。");
        }
        if (reviewExecution == null || reviewExecution.reviewResult() == null) {
            entity.setTotalReviewBatches(reviewExecution == null ? 0 : reviewExecution.completedBatches() + reviewExecution.failedBatches());
            entity.setCompletedReviewBatches(reviewExecution == null ? 0 : reviewExecution.completedBatches());
            entity.setFailedReviewBatches(reviewExecution == null ? 0 : reviewExecution.failedBatches());
            entity.setReviewedCaseCount(reviewExecution == null ? 0 : reviewExecution.reviewedCaseCount());
            entity.setUpdatedAt(LocalDateTime.now());
            aiGenerationTaskMapper.updateById(entity);
            stateSupport.markReviewFailed(taskId, new IllegalStateException(firstNonBlank(
                    reviewExecution == null ? null : reviewExecution.errorMessage(),
                    "AI 评审批次全部失败"
            )));
            return;
        }
        AiReviewResult review = reviewExecution.reviewResult();
        entity.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
        entity.setGeneratedCount(generatedCases.size());
        entity.setReviewResultJson(responseSupport.writeValue(review));
        entity.setReviewRawOutput(stateSupport.limitRawOutput(reviewExecution.rawContent()));
        entity.setTotalReviewBatches(reviewExecution.completedBatches() + reviewExecution.failedBatches());
        entity.setCompletedReviewBatches(reviewExecution.completedBatches());
        entity.setFailedReviewBatches(reviewExecution.failedBatches());
        entity.setReviewedCaseCount(reviewExecution.reviewedCaseCount());
        entity.setSupplementedCaseCount(reviewExecution.supplementCases().size());
        entity.setCoverageCompleteness(reviewExecution.failedBatches() == 0
                ? (review.unresolvedCoverageGaps() == null || review.unresolvedCoverageGaps().isEmpty() ? "COMPLETE" : "INCOMPLETE")
                : "UNKNOWN");
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        if (reviewExecution.failedBatches() > 0 && reviewExecution.completedBatches() > 0) {
            stateSupport.markReviewPartial(entity, "用例已生成，部分 AI 评审批次失败，成功结果仍可查看和采纳。", "失败批次：" + reviewExecution.failedBatches());
        } else if (reviewExecution.failedBatches() > 0) {
            stateSupport.markReviewFailed(taskId, new IllegalStateException("AI 评审批次全部失败"));
        } else {
            stateSupport.markCompleted(entity, "任务已完成，可在记录详情中查看生成结果并继续处理。");
        }
        appendCompleteReviewEvents(taskId, generatedCases, review, firstNonBlank(reviewProvider[0], reviewExecution.provider()), firstNonBlank(reviewModel[0], reviewExecution.model()));
        appendEvent(taskId, "TASK_COMPLETED", "DONE", reviewExecution.failedBatches() > 0 ? "WARN" : "SUCCESS", "生成与评审已完成。", null, null, firstNonBlank(reviewProvider[0], reviewExecution.provider()), firstNonBlank(reviewModel[0], reviewExecution.model()), null);
    }

    public StreamingResponseBody streamTaskEvents(String taskId, String workspaceCode) {
        return sseSupport.streamTaskEvents(taskId, workspaceCode);
    }

    private void appendCompleteReviewEvents(String taskId, List<GeneratedAiCaseItem> finalCases, AiReviewResult review, String provider, String model) {
        long optimized = finalCases.stream().filter(item -> "CHANGE_SUGGESTED".equals(item.aiReviewStatus())).count();
        long supplemented = finalCases.stream().filter(item -> "REVIEW_SUPPLEMENTED".equals(item.aiSource())
                || "SELF_REVIEW_SUPPLEMENT".equals(item.aiSource())).count();
        long notRecommended = finalCases.stream().filter(item -> "NOT_RECOMMENDED".equals(item.aiReviewStatus())).count();
        long approved = finalCases.stream().filter(item -> "APPROVED".equals(item.aiReviewStatus())).count();
        long needsAttention = finalCases.size() - approved;
        appendEvent(taskId, "REVIEW_COMPLETED", "REVIEWING", "SUCCESS", "AI 评审完成：通过 " + approved + " 条，待人工处理 " + needsAttention + " 条。", null, null, provider, model, responseSupport.writeValue(Map.of(
                "approved", approved,
                "optimized", optimized,
                "supplemented", supplemented,
                "notRecommended", notRecommended,
                "unresolvedCoverageGaps", review == null || review.unresolvedCoverageGaps() == null ? List.of() : review.unresolvedCoverageGaps()
        )));
        appendEvent(taskId, "FINAL_CASES_READY", "DONE", "SUCCESS", "可用用例已准备完成，共 " + finalCases.size() + " 条。", null, null, provider, model, null);
    }

    private void persistSelfCheckResult(
            AiGenerationTaskEntity entity,
            AiGenerationSelfCheckResult selfCheck,
            List<String> warnings
    ) {
        if (selfCheck == null) {
            entity.setSelfCheckStatus(AiGenerationWorkflowContract.SELF_CHECK_FAILED);
            entity.setSelfCheckResultJson(null);
            entity.setSelfCheckAttemptCount(1);
        } else {
            entity.setSelfCheckStatus(selfCheck.structured()
                    ? AiGenerationWorkflowContract.SELF_CHECK_SUCCEEDED
                    : AiGenerationWorkflowContract.SELF_CHECK_FAILED);
            entity.setSelfCheckResultJson(responseSupport.writeValue(selfCheck));
            entity.setSelfCheckAttemptCount(1);
        }
        List<String> warningValues = warnings == null ? List.of() : warnings;
        entity.setHasWarnings(warningValues.isEmpty() ? 0 : 1);
        entity.setWarningCodesJson(responseSupport.writeValue(warningValues.stream()
                .map(this::warningCode)
                .distinct()
                .toList()));
    }

    private void appendSelfCheckEvents(
            String taskId,
            AiGenerationSelfCheckResult selfCheck,
            List<GeneratedAiCaseItem> supplements,
            String provider,
            String model
    ) {
        if (selfCheck == null) {
            return;
        }
        appendEvent(taskId, "GENERATION_SELF_CHECK_COMPLETED", "GENERATING",
                selfCheck.structured() ? "SUCCESS" : "WARN",
                selfCheck.structured()
                        ? (selfCheck.complete() ? "生成模型自检完成，未发现明显遗漏。" : "生成模型自检完成，发现待补充覆盖项。")
                        : "生成模型自检结果无法解析，已保留初始生成用例。",
                null, null, provider, model, responseSupport.writeValue(selfCheck));
        if (supplements != null && !supplements.isEmpty()) {
            appendEvent(taskId, "GENERATION_SELF_SUPPLEMENTED", "GENERATING", "SUCCESS",
                    "生成模型根据自检缺口补充 " + supplements.size() + " 条用例。",
                    null, null, provider, model, responseSupport.writeValue(supplements));
        }
    }

    private String warningCode(String warning) {
        if (warning == null) {
            return "GENERATION_WARNING";
        }
        String normalized = warning.toLowerCase(Locale.ROOT);
        if (normalized.contains("自检") || normalized.contains("self")) {
            return "SELF_CHECK_WARNING";
        }
        if (normalized.contains("自补") || normalized.contains("supplement")) {
            return "SELF_SUPPLEMENT_WARNING";
        }
        if (normalized.contains("duplicate") || normalized.contains("重复")) {
            return "DUPLICATE_CASE_WARNING";
        }
        if (normalized.contains("maximum") || normalized.contains("上限")) {
            return "CASE_LIMIT_WARNING";
        }
        return "GENERATION_WARNING";
    }

    private AiGenerationTaskEventResponse appendEvent(
            String taskId,
            String eventType,
            String phase,
            String level,
            String message,
            Integer itemIndex,
            String itemTitle,
            String provider,
            String model,
            String payloadJson
    ) {
        return eventService.append(
                taskId,
                eventType,
                phase,
                level,
                message == null || message.isBlank() ? "-" : message,
                itemIndex,
                itemTitle,
                provider,
                model,
                payloadJson
        );
    }

    private void persistCompleteReviewCandidates(
            AiGenerationTaskEntity task,
            int generatedCaseCount,
            List<GeneratedAiCaseItem> finalCases,
            AiReviewResult review
    ) {
        if (review != null && review.caseDecisions() != null) {
            for (AiReviewCaseDecision decision : review.caseDecisions()) {
                candidateService.recordReview(
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
        }
        for (int index = generatedCaseCount; index < finalCases.size(); index += 1) {
            GeneratedAiCaseItem supplement = finalCases.get(index);
            candidateService.appendSupplement(
                    task,
                    index,
                    supplement,
                    firstNonBlank(supplement.aiReviewSummary(), supplement.supplementReason(), supplement.coverageGap())
            );
        }
    }

    private void persistReviewSupplementCandidates(
            AiGenerationTaskEntity task,
            int generatedCaseCount,
            List<GeneratedAiCaseItem> finalCases
    ) {
        for (int index = generatedCaseCount; index < finalCases.size(); index += 1) {
            GeneratedAiCaseItem supplement = finalCases.get(index);
            candidateService.appendSupplement(
                    task,
                    index,
                    supplement,
                    firstNonBlank(supplement.aiReviewSummary(), supplement.supplementReason(), supplement.coverageGap())
            );
        }
    }

    private String reviewEventLevel(String status) {
        if ("APPROVED".equals(status) || "SUPPLEMENTED".equals(status)) {
            return "SUCCESS";
        }
        if ("OPTIMIZED".equals(status) || "CHANGE_SUGGESTED".equals(status) || "CONFIRM_REQUIRED".equals(status)) {
            return "WARN";
        }
        if ("NOT_RECOMMENDED".equals(status) || "REJECTED".equals(status)) {
            return "ERROR";
        }
        return "INFO";
    }

    private AiGenerationTaskEntity requireTask(String taskId) {
        AiGenerationTaskEntity entity = aiGenerationTaskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId)
                .last("limit 1"));
        if (entity == null) {
            throw new BadRequestException("AI generation task does not exist");
        }
        return entity;
    }

    private String normalizeOutputMode(String outputMode) {
        return outputMode == null ? "STREAM" : outputMode.trim().toUpperCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    static class TaskCanceledException extends RuntimeException {
        TaskCanceledException(String message) {
            super(message);
        }
    }
}
