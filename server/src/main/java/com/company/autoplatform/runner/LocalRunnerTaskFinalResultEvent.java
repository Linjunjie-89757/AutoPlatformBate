package com.company.autoplatform.runner;

import java.util.Map;

public record LocalRunnerTaskFinalResultEvent(
        String runId,
        String taskType,
        String status,
        Long workspaceId,
        String workspaceCode,
        String runnerId,
        Map<String, Object> payload,
        Map<String, Object> environmentSnapshot,
        Map<String, Object> variableSnapshot,
        Map<String, Object> result
) {
    public LocalRunnerTaskFinalResultEvent(
            String runId,
            String taskType,
            String status,
            Long workspaceId,
            String workspaceCode,
            String runnerId,
            Map<String, Object> payload,
            Map<String, Object> result
    ) {
        this(runId, taskType, status, workspaceId, workspaceCode, runnerId, payload, Map.of(), Map.of(), result);
    }
}
