package com.company.autoplatform.ai;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class AiGenerationTaskRunner {

    private final AiGenerationTaskService aiGenerationTaskService;

    public AiGenerationTaskRunner(AiGenerationTaskService aiGenerationTaskService) {
        this.aiGenerationTaskService = aiGenerationTaskService;
    }

    @Async("aiGenerationTaskExecutor")
    public void runTask(String taskId, String workspaceCode) {
        aiGenerationTaskService.executeTask(taskId, workspaceCode);
    }

    @Async("aiGenerationTaskExecutor")
    public void runReviewRetry(String taskId, String workspaceCode) {
        aiGenerationTaskService.executeReviewRetry(taskId, workspaceCode);
    }
}
