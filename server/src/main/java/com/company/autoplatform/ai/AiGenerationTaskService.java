package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class AiGenerationTaskService {

    private final long reviewTaskTimeoutSeconds;
    private final long generationTaskTimeoutSeconds;
    private final long completeTaskTimeoutSeconds;
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
    private final AiStreamDiagnostics streamDiagnostics;

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
            AiCaseReviewOrchestrationService reviewOrchestrationService,
            AiStreamDiagnostics streamDiagnostics,
            @Value("${app.ai.review-task-timeout-seconds:600}") long reviewTaskTimeoutSeconds,
            @Value("${app.ai.generation-task-timeout-seconds:600}") long generationTaskTimeoutSeconds,
            @Value("${app.ai.complete-task-timeout-seconds:1800}") long completeTaskTimeoutSeconds
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
        this.streamDiagnostics = streamDiagnostics;
        this.reviewTaskTimeoutSeconds = Math.max(1, reviewTaskTimeoutSeconds);
        this.generationTaskTimeoutSeconds = Math.max(1, generationTaskTimeoutSeconds);
        this.completeTaskTimeoutSeconds = Math.max(1, completeTaskTimeoutSeconds);
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

    public AiGenerationTaskResponse retryFailedReviewBatches(String taskId, String workspaceCode) {
        AiGenerationTaskResponse current = taskDomainService.getTask(taskId, workspaceCode);
        if (!AiGenerationWorkflowContract.REVIEW_FAILED.equals(current.reviewStatus())
                && !AiGenerationWorkflowContract.REVIEW_PARTIAL.equals(current.reviewStatus())) {
            throw new BadRequestException("当前任务没有可重试的评审");
        }
        AiGenerationTaskEntity entity = requireTask(taskId);
        if (!stateSupport.prepareReviewRetry(entity)) {
            throw new BadRequestException("评审重试已由其他请求提交，请刷新任务状态");
        }
        appendEvent(taskId, "REVIEW_RETRY_STARTED", "REVIEWING", "INFO", "开始重新评审已有用例，不重新生成。", null, null, entity.getReviewProvider(), entity.getReviewModel(), null);
        return taskDomainService.getTask(taskId, workspaceCode);
    }

    public void executeReviewRetry(String taskId, String workspaceCode) {
        try {
            requireActiveTask(taskId, "REVIEWING");
            executeReview(requireTask(taskId), workspaceCode);
        } catch (TaskCanceledException exception) {
            stateSupport.markCanceled(requireTask(taskId), exception.getMessage());
        } catch (Exception exception) {
            markReviewFailedIfActive(taskId, exception);
        }
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
                executeGenerationTask(entity, workspaceCode, false);
            } else {
                executeGenerationTask(entity, workspaceCode, true);
            }
        } catch (TaskCanceledException exception) {
            stateSupport.markCanceled(requireTask(taskId), exception.getMessage());
        } catch (Exception exception) {
            stateSupport.markFailed(taskId, exception);
        }
    }

    private void executeGenerationTask(AiGenerationTaskEntity entity, String workspaceCode, boolean stream) {
        String taskId = entity.getTaskId();
        appendEvent(taskId, "TASK_STARTED", "SETUP", "INFO", "开始生成用例，完成后进行一次 AI 评审", null, null, null, null, null);
        stateSupport.transitionToGenerating(entity);
        List<Long> assetIds = responseSupport.readValue(entity.getAssetIdsJson(), new TypeReference<List<Long>>() {}, List.of());
        syncImageAudit(entity, assetIds);
        GenerateAiCasesRequest request = new GenerateAiCasesRequest(workspaceCode, entity.getRequirementTitle(),
                entity.getRequirementContent(), null, null, assetIds, List.of(), null, taskGenerationStageLimit(entity));
        GenerateAiCasesResponse generation = executeWithStageTimeout(taskId, false, () -> {
            if (!stream) return aiCaseService.generateCases(workspaceCode, request);
            List<GeneratedAiCaseItem> liveCases = new ArrayList<>();
            AiCaseService.StreamedGenerateCasesResult result = aiCaseService.streamGenerateCases(workspaceCode, request,
                    model -> {
                        AiGenerationTaskEntity latest = requireActiveTask(taskId, "GENERATING");
                        latest.setProvider(model.provider());
                        latest.setModel(model.model());
                        latest.setUpdatedAt(LocalDateTime.now());
                        aiGenerationTaskMapper.updateById(latest);
                        appendEvent(taskId, "GENERATION_MODEL_READY", "GENERATING", "INFO", "生成模型已就绪：" + model.model(), null, null, model.provider(), model.model(), null);
                    }, update -> {
                        AiGenerationTaskEntity latest = requireActiveTask(taskId, "GENERATING");
                        liveCases.add(update.item());
                        stateSupport.persistGeneratedCasesSnapshot(latest, liveCases, update.rawOutput());
                        appendEvent(taskId, "CASE_GENERATED", "GENERATING", "SUCCESS", eventMessageSupport.buildGeneratedCaseEventMessage(update.itemIndex(), update.item()),
                                update.itemIndex(), update.item().title(), latest.getProvider(), latest.getModel(), responseSupport.writeValue(update.item()));
                        AiTaskTimeout.recordProgress("CASE:" + AiGenerationCaseQualityService.fingerprint(update.item()));
                    });
            if (result.fallbackToComplete()) appendEvent(taskId, "GENERATION_STREAM_FALLBACK", "GENERATING", "WARN",
                    "当前协议不支持流式，已使用完整输出", null, null, result.provider(), result.model(), null);
            return new GenerateAiCasesResponse(result.workspaceCode(), result.workspaceName(), result.provider(), result.model(),
                    result.systemMaxCases(), result.requestedMaxCases(), result.effectiveMaxCases(), result.actualGeneratedCount(),
                    result.generatedCases(), result.coverageSummary(), result.remainingCoverageGaps(), result.warnings(), result.invalidCases(),
                    result.rawContent(), result.ignoredImages(), null, List.of());
        });
        entity = requireActiveTask(taskId, "GENERATING");
        entity.setProvider(generation.provider());
        entity.setModel(generation.model());
        entity.setGenerationProvider(generation.provider());
        entity.setGenerationModel(generation.model());
        entity.setGeneratedCount(generation.generatedCases().size());
        entity.setWarningsJson(responseSupport.writeValue(generation.warnings()));
        List<String> warnings = generation.warnings() == null ? List.of() : generation.warnings();
        entity.setHasWarnings(warnings.isEmpty() ? 0 : 1);
        entity.setWarningCodesJson(responseSupport.writeValue(warnings.stream().map(this::warningCode).distinct().toList()));
        entity.setInvalidCasesJson(responseSupport.writeValue(generation.invalidCases()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(generation.generatedCases()));
        entity.setGenerationRawOutput(stateSupport.limitRawOutput(generation.rawContent()));
        entity.setSelfCheckStatus("NOT_STARTED");
        entity.setSelfCheckResultJson(null);
        applyImageFallbackAudit(entity, generation.ignoredImages());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        candidateService.materializeGeneratedCases(entity, generation.generatedCases());
        appendEvent(taskId, "GENERATION_COMPLETED", "GENERATING", "SUCCESS", "用例生成完成，共 " + generation.generatedCases().size() + " 条", null, null, generation.provider(), generation.model(), null);
        stateSupport.transitionToReviewing(entity);
        try {
            executeReview(entity, workspaceCode);
        } catch (TaskCanceledException exception) {
            throw exception;
        } catch (Exception exception) {
            markReviewFailedIfActive(taskId, exception);
        }
    }

    private void executeReview(AiGenerationTaskEntity entity, String workspaceCode) {
        String taskId = entity.getTaskId();
        List<AiCaseCandidateEntity> candidates = candidateService.listEntities(taskId);
        List<GeneratedAiCaseItem> cases = new ArrayList<>();
        for (AiCaseCandidateEntity candidate : candidates) {
            cases.add(responseSupport.readValue(candidate.getCurrentCaseJson(), new TypeReference<GeneratedAiCaseItem>() {}, null));
        }
        appendEvent(taskId, "REVIEW_STARTED", "REVIEWING", "INFO", "开始评审全部 " + candidates.size() + " 条用例", null, null, null, null, null);
        AiCaseReviewOrchestrationService.ReviewExecutionResult execution = executeWithStageTimeout(taskId, true, () -> {
            if ("COMPLETE".equals(normalizeOutputMode(entity.getOutputMode()))) {
                return reviewOrchestrationService.execute(workspaceCode, entity, candidates);
            }
            var streamed = reviewOrchestrationService.executeStreaming(workspaceCode, entity, candidates, model -> {
                AiGenerationTaskEntity latest = requireActiveTask(taskId, "REVIEWING");
                latest.setReviewProvider(model.provider());
                latest.setReviewModel(model.model());
                latest.setUpdatedAt(LocalDateTime.now());
                aiGenerationTaskMapper.updateById(latest);
            }, update -> persistReviewUpdate(taskId, cases, update));
            return new AiCaseReviewOrchestrationService.ReviewExecutionResult(streamed.reviewResult(), 0, 0,
                    streamed.reviewedCaseCount(), streamed.supplementCases(), null, null, streamed.rawContent(), false, null,
                    streamed.provider(), streamed.model());
        });
        AiGenerationTaskEntity latest = requireActiveTask(taskId, "REVIEWING");
        // Use the latest candidate content so a concurrent human edit is never replaced by an old snapshot.
        List<AiCaseCandidateEntity> currentCandidates = candidateService.listEntities(taskId);
        List<GeneratedAiCaseItem> currentCases = currentCandidates.stream().map(candidate ->
                responseSupport.readValue(candidate.getCurrentCaseJson(), new TypeReference<GeneratedAiCaseItem>() {}, (GeneratedAiCaseItem) null)).toList();
        List<GeneratedAiCaseItem> finalCases = resultMergeSupport.mergeCompleteReviewResult(currentCases, currentCandidates, execution.reviewResult(), taskCaseTotalLimit(latest));
        persistReviewSupplementCandidates(latest, currentCases.size(), finalCases);
        latest.setGeneratedCasesJson(responseSupport.writeValue(finalCases));
        latest.setGeneratedCount(finalCases.size());
        latest.setReviewProvider(execution.provider());
        latest.setReviewModel(execution.model());
        latest.setReviewResultJson(responseSupport.writeValue(execution.reviewResult()));
        latest.setReviewRawOutput(stateSupport.limitRawOutput(execution.rawContent()));
        latest.setTotalReviewBatches(0);
        latest.setCompletedReviewBatches(0);
        latest.setFailedReviewBatches(0);
        latest.setReviewedCaseCount(execution.reviewedCaseCount());
        latest.setSupplementedCaseCount((int) candidateService.listEntities(taskId).stream().filter(c -> "REVIEW_SUPPLEMENTED".equals(c.getOrigin())).count());
        latest.setCoverageCompleteness("UNKNOWN");
        stateSupport.markCompleted(latest, "生成与评审已完成，请确认建议并选择采纳。");
        appendCompleteReviewEvents(taskId, finalCases, execution.reviewResult(), execution.provider(), execution.model(), false);
        appendEvent(taskId, "TASK_COMPLETED", "DONE", "SUCCESS", "生成与评审已完成，等待人工采纳", null, null, execution.provider(), execution.model(), null);
    }

    private void persistReviewUpdate(String taskId, List<GeneratedAiCaseItem> cases, AiCaseService.ReviewCaseStreamUpdate update) {
        AiGenerationTaskEntity latest = requireActiveTask(taskId, "REVIEWING");
        if ("SUPPLEMENTED".equals(update.status())) {
            if (cases.size() >= taskCaseTotalLimit(latest) || update.supplementCase() == null) return;
            GeneratedAiCaseItem item = resultMergeSupport.withStreamSupplementMetadata(update);
            if (candidateService.appendSupplement(latest, cases.size(), item, firstNonBlank(update.reason(), update.summary(), update.supplementReason())) == null) return;
            cases.add(item);
            appendEvent(taskId, "CASE_SUPPLEMENTED", "REVIEWING", "INFO", "评审补充用例，待人工确认：" + item.title(), cases.size() - 1, item.title(), latest.getReviewProvider(), latest.getReviewModel(), null);
        } else {
            if (update.itemIndex() == null || update.itemIndex() < 0 || update.itemIndex() >= cases.size()) return;
            if (!candidateService.recordReview(taskId, update.candidateCaseId(), update.itemIndex(), update.status(),
                    update.suggestedAction(), update.score(), update.confidence(), firstNonBlank(update.reason(), update.summary(), update.reviewComment()),
                    update.suggestedCase(), update.mergeTargetCandidateIds(), update.sourceVersion(), update.sourceContentHash())) return;
            GeneratedAiCaseItem item = resultMergeSupport.applyReviewUpdate(cases.get(update.itemIndex()), update);
            cases.set(update.itemIndex(), item);
            appendEvent(taskId, "CASE_REVIEWED", "REVIEWING", reviewEventLevel(update.status()),
                    eventMessageSupport.buildReviewedCaseEventMessage(update.itemIndex(), item.title(), update.status(), update.summary(), update.coverageComment(), update.evidenceComment()),
                    update.itemIndex(), item.title(), latest.getReviewProvider(), latest.getReviewModel(), null);
        }
        latest.setGeneratedCasesJson(responseSupport.writeValue(cases));
        latest.setGeneratedCount(cases.size());
        latest.setReviewedCaseCount((int) candidateService.listEntities(taskId).stream().filter(c -> c.getReviewStatus() != null && !"PENDING".equals(c.getReviewStatus()) && !"REVIEW_SUPPLEMENTED".equals(c.getOrigin())).count());
        latest.setReviewRawOutput(stateSupport.limitRawOutput(update.rawOutput()));
        latest.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(latest);
        AiTaskTimeout.recordProgress("SUPPLEMENTED".equals(update.status())
                ? "SUPPLEMENT:" + AiGenerationCaseQualityService.fingerprint(update.supplementCase())
                : "REVIEW:" + update.itemIndex());
    }

    private AiGenerationTaskEntity requireActiveTask(String taskId, String stage) {
        AiGenerationTaskEntity latest = requireTask(taskId);
        if (Thread.currentThread().isInterrupted() || stateSupport.isCanceled(latest)) throw new TaskCanceledException("任务已取消或执行已停止");
        AiTaskTimeout timeout = AiTaskTimeout.current();
        if (timeout != null && timeout.remainingNanos() <= 0) throw timeout.failure();
        if (!stage.equals(latest.getStatus())) throw new IllegalStateException("任务阶段已结束，忽略迟到结果");
        return latest;
    }

    public StreamingResponseBody streamTaskEvents(String taskId, String workspaceCode) {
        return sseSupport.streamTaskEvents(taskId, workspaceCode);
    }

    private <T> T executeWithStageTimeout(String taskId, boolean review, Callable<T> operation) {
        boolean streaming = "STREAM".equals(normalizeOutputMode(requireTask(taskId).getOutputMode()));
        AiStreamDiagnostics.Session diagnostic = streaming
                ? streamDiagnostics.open(taskId, review ? "REVIEWING" : "GENERATING") : null;
        String diagnosticOutcome = "FAILED";
        String diagnosticError = null;
        long seconds = streaming ? (review ? reviewTaskTimeoutSeconds : generationTaskTimeoutSeconds) : completeTaskTimeoutSeconds;
        AiTaskTimeout timeout = new AiTaskTimeout(streaming, review, seconds);
        var executor = Executors.newVirtualThreadPerTaskExecutor();
        SecurityContext callerContext = SecurityContextHolder.getContext();
        Future<T> future = executor.submit(() -> {
            SecurityContextHolder.setContext(callerContext);
            AiStreamDiagnostics.attach(diagnostic);
            AiTaskTimeout.attach(timeout);
            try { return operation.call(); }
            finally { AiTaskTimeout.detach(); AiStreamDiagnostics.detach(); SecurityContextHolder.clearContext(); }
        });
        try {
            while (true) {
                if (stateSupport.isCanceled(requireTask(taskId))) throw new TaskCanceledException("任务已取消，已停止模型调用");
                long remaining = timeout.remainingNanos();
                if (remaining <= 0) throw new TimeoutException();
                try {
                    T result = future.get(Math.min(remaining, TimeUnit.MILLISECONDS.toNanos(250)), TimeUnit.NANOSECONDS);
                    if (timeout.remainingNanos() <= 0) throw new TimeoutException();
                    diagnosticOutcome = "SUCCEEDED";
                    return result;
                } catch (TimeoutException waiting) {
                    if (timeout.remainingNanos() <= 0) throw waiting;
                } catch (ExecutionException failure) {
                    if (timeout.remainingNanos() <= 0) throw new TimeoutException();
                    throw failure;
                }
            }
        } catch (TimeoutException exception) {
            diagnosticOutcome = "TIMED_OUT";
            RuntimeException failure = timeout.failure();
            diagnosticError = failure.getMessage();
            if (review) stateSupport.markReviewFailed(taskId, failure);
            throw failure;
        } catch (InterruptedException exception) {
            diagnosticOutcome = "CANCELED";
            diagnosticError = "Task interrupted";
            Thread.currentThread().interrupt();
            throw new TaskCanceledException("任务执行已中断");
        } catch (ExecutionException exception) {
            diagnosticError = exception.getCause().getMessage();
            if (exception.getCause() instanceof TaskCanceledException) diagnosticOutcome = "CANCELED";
            if (exception.getCause() instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("AI 调用失败", exception.getCause());
        } catch (TaskCanceledException exception) {
            diagnosticOutcome = "CANCELED";
            diagnosticError = exception.getMessage();
            throw exception;
        } finally {
            timeout.stop();
            future.cancel(true);
            executor.shutdownNow();
            streamDiagnostics.finish(diagnostic, diagnosticOutcome, diagnosticError);
        }
    }

    private void markReviewFailedIfActive(String taskId, Exception exception) {
        AiGenerationTaskEntity latest = aiGenerationTaskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId)
                .last("limit 1"));
        if (latest == null) {
            return;
        }
        if ("REVIEWING".equals(latest.getStatus())
                && AiGenerationWorkflowContract.REVIEW_RUNNING.equals(latest.getReviewStatus())) {
            stateSupport.markReviewFailed(taskId, exception);
        }
    }

    private void syncImageAudit(AiGenerationTaskEntity entity, List<Long> assetIds) {
        int imageCount = assetIds == null ? 0 : assetIds.size();
        if (imageCount == 0) {
            return;
        }
        entity.setImageCount(imageCount);
        entity.setInputMode("MULTIMODAL");
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
    }

    private int taskCaseTotalLimit(AiGenerationTaskEntity entity) {
        Integer limit = entity.getCaseGenerationLimit();
        return limit == null
                ? AiCaseService.DEFAULT_MAX_CASES
                : Math.max(1, Math.min(limit, AiCaseService.SYSTEM_MAX_CASES));
    }

    private int taskGenerationStageLimit(AiGenerationTaskEntity entity) {
        return AiCaseService.generationStageLimit(taskCaseTotalLimit(entity));
    }

    private void applyImageFallbackAudit(AiGenerationTaskEntity entity, boolean ignoredImages) {
        if (ignoredImages) {
            entity.setInputMode("TEXT_ONLY_FALLBACK");
            entity.setHasWarnings(1);
            List<String> warnings = responseSupport.readValue(
                    entity.getWarningsJson(), new TypeReference<List<String>>() {}, new ArrayList<>()
            );
            if (warnings.stream().noneMatch(item -> item.contains("图片素材"))) {
                warnings.add("图片素材未被当前模型支持，已降级为纯文本生成。");
            }
            entity.setWarningsJson(responseSupport.writeValue(warnings));
            entity.setWarningCodesJson(responseSupport.writeValue(warnings.stream()
                    .map(this::warningCode)
                    .distinct()
                    .toList()));
        }
    }

    private void appendCompleteReviewEvents(String taskId, List<GeneratedAiCaseItem> finalCases, AiReviewResult review, String provider, String model, boolean warning) {
        long optimized = finalCases.stream().filter(item -> "CHANGE_SUGGESTED".equals(item.aiReviewStatus())).count();
        long supplemented = finalCases.stream().filter(item -> "REVIEW_SUPPLEMENTED".equals(item.aiSource())
                || "SELF_REVIEW_SUPPLEMENT".equals(item.aiSource())).count();
        long notRecommended = finalCases.stream().filter(item -> "NOT_RECOMMENDED".equals(item.aiReviewStatus())).count();
        long approved = finalCases.stream().filter(item -> "APPROVED".equals(item.aiReviewStatus())).count();
        long needsAttention = finalCases.size() - approved;
        appendEvent(taskId, "REVIEW_COMPLETED", "REVIEWING", warning ? "WARN" : "SUCCESS", "AI 评审完成：通过 " + approved + " 条，待人工处理 " + needsAttention + " 条。", null, null, provider, model, responseSupport.writeValue(Map.of(
                "approved", approved,
                "optimized", optimized,
                "supplemented", supplemented,
                "notRecommended", notRecommended,
                "unresolvedCoverageGaps", review == null || review.unresolvedCoverageGaps() == null ? List.of() : review.unresolvedCoverageGaps()
        )));
        appendEvent(taskId, "FINAL_CASES_READY", "DONE", "SUCCESS", "可用用例已准备完成，共 " + finalCases.size() + " 条。", null, null, provider, model, null);
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
