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
            AiCaseCandidateService candidateService
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
        entity.setGeneratedCount(generation.actualGeneratedCount() == null ? 0 : generation.actualGeneratedCount());
        entity.setWarningsJson(responseSupport.writeValue(generation.warnings()));
        entity.setInvalidCasesJson(responseSupport.writeValue(generation.invalidCases()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(generation.generatedCases()));
        entity.setGenerationRawOutput(stateSupport.limitRawOutput(generation.rawContent()));
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        List<AiCaseCandidateEntity> candidates = candidateService.materializeGeneratedCases(entity, generation.generatedCases());
        stateSupport.transitionToReviewing(entity);
        if (generation.ignoredImages()) {
            appendEvent(entity.getTaskId(), "IMAGE_ASSETS_IGNORED", "GENERATING", "WARN", "当前生成模型实际不支持图片输入，已自动忽略图片素材并改为纯文本生成。", null, null, generation.provider(), generation.model(), null);
        } else if (!assetIds.isEmpty()) {
            appendEvent(entity.getTaskId(), "IMAGE_ASSETS_ACCEPTED", "GENERATING", "SUCCESS", "图片素材已被模型接受，继续生成。", null, null, generation.provider(), generation.model(), null);
        }
        appendEvent(entity.getTaskId(), "GENERATION_COMPLETED", "GENERATING", "SUCCESS", "用例生成完成，共 " + generation.generatedCases().size() + " 条。", null, null, generation.provider(), generation.model(), null);
        appendEvent(entity.getTaskId(), "REVIEW_STARTED", "REVIEWING", "INFO", "开始执行 AI 自动评审", null, null, null, null, null);

        AiReviewResult review;
        try {
            review = aiCaseService.reviewGeneratedCases(workspaceCode, new ReviewAiGeneratedCasesRequest(
                    entity.getRequirementTitle(),
                    entity.getRequirementContent(),
                    null,
                    generation.remainingCoverageGaps(),
                    candidates.stream().map(candidateService::toReviewItem).toList()
            ));
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
        if (review == null || !review.structured()) {
            stateSupport.markReviewFailed(entity.getTaskId(), new IllegalStateException("AI 评审返回内容无法解析为结构化结果"));
            return;
        }

        List<GeneratedAiCaseItem> finalCases = resultMergeSupport.mergeCompleteReviewResult(generation.generatedCases(), candidates, review);
        persistCompleteReviewCandidates(entity, generation.generatedCases().size(), finalCases, review);
        entity.setGeneratedCasesJson(responseSupport.writeValue(finalCases));
        entity.setGeneratedCount(finalCases.size());
        entity.setReviewResultJson(responseSupport.writeValue(review));
        entity.setReviewRawOutput(stateSupport.limitRawOutput(review.rawContent()));
        stateSupport.markCompleted(entity, "任务已完成，可在记录详情中查看生成结果并继续处理。");
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
        entity.setGeneratedCount(generation.actualGeneratedCount() == null ? generatedCases.size() : generation.actualGeneratedCount());
        entity.setWarningsJson(responseSupport.writeValue(generation.warnings()));
        entity.setInvalidCasesJson(responseSupport.writeValue(generation.invalidCases()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
        entity.setGenerationRawOutput(stateSupport.limitRawOutput(generation.rawContent()));
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
        appendEvent(taskId, "GENERATION_COMPLETED", "GENERATING", "SUCCESS", "用例生成完成，共 " + generatedCases.size() + " 条。", null, null, generation.provider(), generation.model(), null);

        final String[] reviewProvider = new String[]{null};
        final String[] reviewModel = new String[]{null};
        AiCaseService.StreamedReviewResult review;
        try {
            review = aiCaseService.streamReviewGeneratedCases(
                    workspaceCode,
                    new ReviewAiGeneratedCasesRequest(
                            entity.getRequirementTitle(),
                            entity.getRequirementContent(),
                            null,
                            generation.remainingCoverageGaps(),
                            candidates.stream().map(candidateService::toReviewItem).toList()
                    ),
                    modelInfo -> {
                        reviewProvider[0] = modelInfo.provider();
                        reviewModel[0] = modelInfo.model();
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
        if (review == null || review.reviewResult() == null || !review.reviewResult().structured()) {
            stateSupport.markReviewFailed(taskId, new IllegalStateException("AI 评审返回内容无法解析为结构化结果"));
            return;
        }
        if (review.fallbackToComplete()) {
            generatedCases.clear();
            generatedCases.addAll(resultMergeSupport.mergeCompleteReviewResult(generation.generatedCases(), candidates, review.reviewResult()));
        }
        entity.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
        entity.setGeneratedCount(generatedCases.size());
        entity.setReviewResultJson(responseSupport.writeValue(review.reviewResult()));
        entity.setReviewRawOutput(stateSupport.limitRawOutput(review.rawContent()));
        stateSupport.markCompleted(entity, "任务已完成，可在记录详情中查看生成结果并继续处理。");
        if (review.fallbackToComplete()) {
            appendEvent(
                    taskId,
                    "REVIEW_STREAM_FALLBACK",
                    "REVIEWING",
                    "WARN",
                    "当前评审模型不支持实时流式或流式请求失败，已降级为完整输出。",
                    null,
                    null,
                    review.provider(),
                    review.model(),
                    responseSupport.writeValue(Map.of("reason", blankToNull(review.fallbackReason()) == null ? "" : review.fallbackReason()))
            );
        }
        appendEvent(taskId, "REVIEW_COMPLETED", "REVIEWING", "SUCCESS", "AI 评审完成。", null, null, review.provider(), review.model(), null);
        appendEvent(taskId, "TASK_COMPLETED", "DONE", "SUCCESS", "生成与评审已完成。", null, null, review.provider(), review.model(), null);
    }

    public StreamingResponseBody streamTaskEvents(String taskId, String workspaceCode) {
        return sseSupport.streamTaskEvents(taskId, workspaceCode);
    }

    private void appendCompleteReviewEvents(String taskId, List<GeneratedAiCaseItem> finalCases, AiReviewResult review, String provider, String model) {
        long optimized = finalCases.stream().filter(item -> "CHANGE_SUGGESTED".equals(item.aiReviewStatus())).count();
        long supplemented = finalCases.stream().filter(item -> "REVIEW_SUPPLEMENTED".equals(item.aiSource())).count();
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

    private static class TaskCanceledException extends RuntimeException {
        private TaskCanceledException(String message) {
            super(message);
        }
    }
}
