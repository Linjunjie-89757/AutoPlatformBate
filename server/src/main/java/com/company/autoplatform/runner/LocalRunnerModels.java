package com.company.autoplatform.runner;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class LocalRunnerModels {

    private LocalRunnerModels() {
    }

    public record RunnerRegisterRequest(
            @NotBlank(message = "installId cannot be blank") String installId,
            String pairingCode,
            String runnerVersion,
            String protocolVersion,
            Map<String, Object> machineHint,
            List<String> capabilities
    ) {
    }

    public record RunnerRegisterResponse(
            String runnerId,
            String runnerToken,
            String runnerName,
            String protocolVersion,
            Boolean accepted,
            String message
    ) {
    }

    public record RunnerHealthPayload(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            String runnerToken,
            String runnerVersion,
            String protocolVersion,
            List<String> capabilities,
            String currentTaskId,
            String currentRunId,
            Integer queueSize,
            Map<String, Object> resource,
            Map<String, Object> browser,
            Map<String, Object> session
    ) {
    }

    public record PullRunnerTaskRequest(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            String runnerToken,
            String runnerVersion,
            String protocolVersion,
            List<String> capabilities,
            List<String> workspaceCodes,
            Map<String, Object> resource,
            List<String> currentRunIds
    ) {
    }

    public record PullRunnerTaskResponse(
            Boolean hasTask,
            LocalDateTime serverTime,
            Integer pollIntervalMs,
            RunnerTaskEnvelope task
    ) {
    }

    public record RunnerTaskEnvelope(
            String runId,
            String taskType,
            String executionLocation,
            String executionToken,
            String runnerId,
            String workspaceCode,
            String userId,
            String protocolVersion,
            String priority,
            Integer resourceCost,
            LocalDateTime createdAt,
            LocalDateTime deadlineAt,
            Map<String, Object> timeoutPolicy,
            Map<String, Object> environmentSnapshot,
            Map<String, Object> variableSnapshot,
            Map<String, Object> scriptSnapshot,
            List<Map<String, Object>> artifactRefs,
            List<Map<String, Object>> maskingRules,
            Map<String, Object> screenshotPolicy,
            Map<String, Object> payload
    ) {
    }

    public record RunnerTaskStatusReport(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            @NotBlank(message = "executionToken cannot be blank") String executionToken,
            String status,
            String currentStage,
            Progress progress,
            String message,
            LocalDateTime reportedAt
    ) {
    }

    public record Progress(
            Integer current,
            Integer total,
            Integer percent
    ) {
    }

    public record RunnerTaskLogReport(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            @NotBlank(message = "executionToken cannot be blank") String executionToken,
            Long sequenceNo,
            String level,
            String message,
            String stepId,
            Map<String, Object> data,
            LocalDateTime timestamp
    ) {
    }

    public record RunnerStepResultReport(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            @NotBlank(message = "executionToken cannot be blank") String executionToken,
            @NotBlank(message = "stepId cannot be blank") String stepId,
            String status,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            Long durationMs,
            String errorMessage,
            String screenshotRef,
            Map<String, Object> extra
    ) {
    }

    public record RunnerFinalResultReport(
            @NotBlank(message = "runnerId cannot be blank") String runnerId,
            @NotBlank(message = "executionToken cannot be blank") String executionToken,
            String status,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            Long durationMs,
            Map<String, Object> summary,
            String errorMessage,
            Map<String, Object> reportData
    ) {
    }

    public record RunnerTaskAckResponse(
            String runId,
            String status,
            Boolean accepted,
            String message
    ) {
    }

    public record CreateRunnerDebugTaskRequest(
            String runId,
            String taskType,
            String runnerId,
            String priority,
            Integer resourceCost,
            String protocolVersion,
            LocalDateTime deadlineAt,
            Map<String, Object> timeoutPolicy,
            Map<String, Object> environmentSnapshot,
            Map<String, Object> variableSnapshot,
            Map<String, Object> scriptSnapshot,
            List<Map<String, Object>> artifactRefs,
            List<Map<String, Object>> maskingRules,
            Map<String, Object> screenshotPolicy,
            Map<String, Object> payload
    ) {
    }

    public record RunnerTaskDetailResponse(
            String runId,
            String taskType,
            String runnerId,
            String status,
            String currentStage,
            Progress progress,
            String statusMessage,
            String errorMessage,
            LocalDateTime assignedAt,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            LocalDateTime lastReportedAt,
            RunnerTaskEnvelope envelope,
            Map<String, Object> result,
            List<RunnerTaskLogEntry> logs
    ) {
    }

    public record RunnerTaskLogEntry(
            Long sequenceNo,
            String level,
            String message,
            String stepId,
            Map<String, Object> data,
            LocalDateTime loggedAt
    ) {
    }

    public record RunnerOfflineScanResponse(
            Integer changedTasks,
            Integer offlineTasks,
            Integer timedOutTasks
    ) {
    }

    public record RunnerNodeSummaryResponse(
            String runnerId,
            String runnerName,
            String status,
            String runnerVersion,
            String protocolVersion,
            List<String> capabilities,
            Map<String, Object> resource,
            Map<String, Object> browser,
            Map<String, Object> session,
            LocalDateTime lastHeartbeatAt,
            Long secondsSinceHeartbeat,
            Boolean offline,
            List<RunnerActiveTaskSummary> activeTasks,
            Boolean selectable,
            String unselectableReason
    ) {
    }

    public record RunnerActiveTaskSummary(
            String runId,
            String taskType,
            String status,
            String currentStage,
            Integer progressPercent,
            Integer resourceCost,
            LocalDateTime assignedAt,
            LocalDateTime startedAt,
            LocalDateTime lastReportedAt,
            Long runningSeconds
    ) {
    }

    public record CreateRunnerTaskCommand(
            Long workspaceId,
            String workspaceCode,
            String runId,
            String taskType,
            String executionLocation,
            String runnerId,
            String userId,
            String protocolVersion,
            String priority,
            Integer resourceCost,
            LocalDateTime deadlineAt,
            Map<String, Object> timeoutPolicy,
            Map<String, Object> environmentSnapshot,
            Map<String, Object> variableSnapshot,
            Map<String, Object> scriptSnapshot,
            List<Map<String, Object>> artifactRefs,
            List<Map<String, Object>> maskingRules,
            Map<String, Object> screenshotPolicy,
            Map<String, Object> payload
    ) {
    }
}
