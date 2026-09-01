package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class AiGenerationTaskExecutionStateSupport {

    private static final int RAW_OUTPUT_LIMIT = 12000;

    private final AiGenerationTaskMapper aiGenerationTaskMapper;
    private final AiGenerationTaskResponseSupport responseSupport;
    private final AiGenerationTaskEventService eventService;

    public AiGenerationTaskExecutionStateSupport(
            AiGenerationTaskMapper aiGenerationTaskMapper,
            AiGenerationTaskResponseSupport responseSupport,
            AiGenerationTaskEventService eventService
    ) {
        this.aiGenerationTaskMapper = aiGenerationTaskMapper;
        this.responseSupport = responseSupport;
        this.eventService = eventService;
    }

    void transitionToGenerating(AiGenerationTaskEntity entity) {
        entity.setStatus("GENERATING");
        entity.setGenerationStatus("RUNNING");
        entity.setReviewStatus("NOT_STARTED");
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setCurrentStep(2);
        entity.setStepMessage("正在根据需求生成测试用例。");
        entity.setErrorMessage(null);
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
    }

    void transitionToReviewing(AiGenerationTaskEntity entity) {
        entity.setStatus("REVIEWING");
        entity.setGenerationStatus("SUCCEEDED");
        entity.setReviewStatus("RUNNING");
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setCurrentStep(3);
        entity.setStepMessage("已完成用例生成，正在进行 AI 自动评审。");
        entity.setErrorMessage(null);
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
    }

    boolean prepareReviewRetry(AiGenerationTaskEntity entity) {
        entity.setStatus("REVIEWING");
        entity.setGenerationStatus("SUCCEEDED");
        entity.setReviewStatus(AiGenerationWorkflowContract.REVIEW_RUNNING);
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setCurrentStep(3);
        entity.setStepMessage("正在重试失败的 AI 评审批次。");
        entity.setErrorMessage(null);
        entity.setFinishedAt(null);
        entity.setUpdatedAt(LocalDateTime.now());
        return aiGenerationTaskMapper.update(entity, new LambdaUpdateWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, entity.getTaskId())
                .in(AiGenerationTaskEntity::getReviewStatus,
                        AiGenerationWorkflowContract.REVIEW_FAILED,
                        AiGenerationWorkflowContract.REVIEW_PARTIAL)
                .ne(AiGenerationTaskEntity::getStatus, "REVIEWING")) > 0;
    }

    void markCompleted(AiGenerationTaskEntity entity, String stepMessage) {
        entity.setStatus("COMPLETED");
        entity.setGenerationStatus("SUCCEEDED");
        entity.setReviewStatus("SUCCEEDED");
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setCurrentStep(4);
        entity.setStepMessage(stepMessage);
        entity.setFinishedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
    }

    void markReviewPartial(AiGenerationTaskEntity entity, String stepMessage, String errorMessage) {
        entity.setStatus("COMPLETED");
        entity.setGenerationStatus("SUCCEEDED");
        entity.setReviewStatus(AiGenerationWorkflowContract.REVIEW_PARTIAL);
        entity.setFailedStage("AI_REVIEW");
        entity.setErrorCode("AI_REVIEW_PARTIAL");
        entity.setCurrentStep(3);
        entity.setStepMessage(stepMessage);
        entity.setErrorMessage(errorMessage);
        entity.setFinishedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setHasWarnings(1);
        aiGenerationTaskMapper.updateById(entity);
    }

    void markReviewCompletedWithWarnings(
            AiGenerationTaskEntity entity,
            String stepMessage,
            String errorCode,
            String errorMessage
    ) {
        entity.setStatus("COMPLETED");
        entity.setGenerationStatus("SUCCEEDED");
        entity.setReviewStatus(AiGenerationWorkflowContract.REVIEW_SUCCEEDED);
        entity.setFailedStage("AI_REVIEW");
        entity.setErrorCode(errorCode);
        entity.setCurrentStep(3);
        entity.setStepMessage(stepMessage);
        entity.setErrorMessage(errorMessage);
        entity.setFinishedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setHasWarnings(1);
        aiGenerationTaskMapper.updateById(entity);
    }

    void markCanceled(AiGenerationTaskEntity entity, String stepMessage) {
        String previousStatus = entity.getStatus();
        entity.setCancelRequested(1);
        entity.setStatus("CANCELED");
        boolean reviewStage = "REVIEWING".equals(previousStatus)
                || ("CANCELED".equals(previousStatus)
                && "SUCCEEDED".equals(entity.getGenerationStatus())
                && ("RUNNING".equals(entity.getReviewStatus()) || "CANCELED".equals(entity.getReviewStatus())));
        if (reviewStage) {
            entity.setGenerationStatus("SUCCEEDED");
            entity.setReviewStatus("CANCELED");
        } else {
            entity.setGenerationStatus("CANCELED");
            entity.setReviewStatus("NOT_STARTED");
        }
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setStepMessage(stepMessage);
        entity.setFinishedAt(entity.getFinishedAt() == null ? LocalDateTime.now() : entity.getFinishedAt());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        appendEvent(entity.getTaskId(), "TASK_CANCELED", "DONE", "WARN", stepMessage, null, null, entity.getProvider(), entity.getModel(), null);
    }

    void markFailed(String taskId, Exception exception) {
        AiGenerationTaskEntity latest = requireTask(taskId);
        if (isCanceled(latest)) {
            markCanceled(latest, "任务已取消，错误结果已忽略。");
            return;
        }
        latest.setStatus("FAILED");
        boolean reviewStage = latest.getCurrentStep() != null && latest.getCurrentStep() >= 3;
        latest.setGenerationStatus(reviewStage ? "SUCCEEDED" : "FAILED");
        latest.setReviewStatus(reviewStage ? "FAILED" : "NOT_STARTED");
        latest.setFailedStage(reviewStage ? "AI_REVIEW" : "GENERATION");
        latest.setErrorCode(reviewStage ? "AI_REVIEW_FAILED" : "GENERATION_FAILED");
        latest.setCurrentStep(Math.min(latest.getCurrentStep() == null ? 2 : latest.getCurrentStep(), 3));
        latest.setStepMessage("任务执行失败，请检查 AI 配置或稍后重试。");
        latest.setErrorMessage(exception.getMessage());
        latest.setFinishedAt(LocalDateTime.now());
        latest.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(latest);
        appendEvent(taskId, "TASK_FAILED", latest.getCurrentStep() != null && latest.getCurrentStep() >= 3 ? "REVIEWING" : "GENERATING", "ERROR", exception.getMessage(), null, null, latest.getProvider(), latest.getModel(), null);
    }

    void markReviewFailed(String taskId, Exception exception) {
        AiGenerationTaskEntity latest = requireTask(taskId);
        if (isCanceled(latest)) {
            markCanceled(latest, "任务已取消，评审错误结果已忽略。");
            return;
        }
        latest.setStatus("COMPLETED");
        latest.setGenerationStatus("SUCCEEDED");
        latest.setReviewStatus("FAILED");
        latest.setFailedStage("AI_REVIEW");
        latest.setErrorCode("AI_REVIEW_FAILED");
        latest.setCurrentStep(3);
        latest.setStepMessage("用例已生成，但 AI 评审失败，仍可查看和采纳。");
        latest.setErrorMessage(exception.getMessage());
        latest.setFinishedAt(LocalDateTime.now());
        latest.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(latest);
        appendEvent(taskId, "REVIEW_FAILED", "REVIEWING", "ERROR", exception.getMessage(), null, null, latest.getProvider(), latest.getModel(), null);
    }

    void persistGeneratedCasesSnapshot(AiGenerationTaskEntity entity, List<GeneratedAiCaseItem> generatedCases, String rawOutput) {
        entity.setGeneratedCasesJson(responseSupport.writeValue(generatedCases));
        entity.setGeneratedCount(generatedCases.size());
        entity.setGenerationRawOutput(limitRawOutput(rawOutput));
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
    }

    String limitRawOutput(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() <= RAW_OUTPUT_LIMIT) {
            return value;
        }
        return value.substring(value.length() - RAW_OUTPUT_LIMIT);
    }

    boolean isCanceled(AiGenerationTaskEntity entity) {
        return entity.getCancelRequested() != null && entity.getCancelRequested() == 1;
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
}
