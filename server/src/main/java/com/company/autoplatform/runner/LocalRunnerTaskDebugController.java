package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerDebugTaskRequest;
import static com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerOfflineScanResponse;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskAckResponse;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;

@RestController
@RequestMapping("/api/local-runner/tasks")
public class LocalRunnerTaskDebugController {

    private static final List<String> SUPPORTED_DEBUG_TASK_TYPES = List.of(
            "WEB_ELEMENT_VALIDATE",
            "WEB_CASE_RUN",
            "API_CASE_RUN",
            "API_SCENARIO_RUN"
    );

    private final LocalRunnerService localRunnerService;
    private final WorkspaceService workspaceService;

    public LocalRunnerTaskDebugController(
            LocalRunnerService localRunnerService,
            WorkspaceService workspaceService
    ) {
        this.localRunnerService = localRunnerService;
        this.workspaceService = workspaceService;
    }

    @PostMapping("/debug")
    public ApiResponse<RunnerTaskDetailResponse> createDebugTask(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody(required = false) CreateRunnerDebugTaskRequest request
    ) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        String taskType = normalizeTaskType(request == null ? null : request.taskType());
        CreateRunnerTaskCommand command = new CreateRunnerTaskCommand(
                workspace.getId(),
                workspace.getWorkspaceCode(),
                request == null ? null : request.runId(),
                taskType,
                "LOCAL_RUNNER",
                request == null ? null : request.runnerId(),
                String.valueOf(currentUser.userId()),
                request == null ? null : request.protocolVersion(),
                request == null ? null : request.priority(),
                request == null || request.resourceCost() == null
                        ? defaultResourceCost(taskType)
                        : request.resourceCost(),
                request == null ? null : request.deadlineAt(),
                request == null || request.timeoutPolicy() == null || request.timeoutPolicy().isEmpty()
                        ? defaultTimeoutPolicy(taskType)
                        : request.timeoutPolicy(),
                request == null ? Map.of() : emptyMapIfNull(request.environmentSnapshot()),
                request == null ? Map.of() : emptyMapIfNull(request.variableSnapshot()),
                request == null ? Map.of() : emptyMapIfNull(request.scriptSnapshot()),
                request == null ? List.of() : emptyListIfNull(request.artifactRefs()),
                request == null ? List.of() : emptyListIfNull(request.maskingRules()),
                request == null || request.screenshotPolicy() == null
                        ? defaultScreenshotPolicy()
                        : request.screenshotPolicy(),
                request == null || request.payload() == null
                        ? defaultPayload(taskType)
                        : request.payload()
        );
        return ApiResponse.ok(localRunnerService.createDebugTask(command), "Runner debug task created");
    }

    @GetMapping("/{runId}")
    public ApiResponse<RunnerTaskDetailResponse> getTask(@PathVariable String runId) {
        CurrentUserContext.require();
        RunnerTaskDetailResponse detail = localRunnerService.getTaskDetail(runId);
        workspaceService.requireReadableWorkspace(detail.envelope().workspaceCode());
        return ApiResponse.ok(detail);
    }

    @PostMapping("/{runId}/cancel")
    public ApiResponse<RunnerTaskAckResponse> cancelTask(@PathVariable String runId) {
        CurrentUserContext.require();
        RunnerTaskDetailResponse detail = localRunnerService.getTaskDetail(runId);
        workspaceService.requireWritableWorkspace(detail.envelope().workspaceCode());
        return ApiResponse.ok(localRunnerService.cancelTask(runId), "Runner task canceled");
    }

    @PostMapping("/offline-scan")
    public ApiResponse<RunnerOfflineScanResponse> triggerOfflineScan(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        CurrentUserContext.require();
        int offlineTasks = localRunnerService.markOfflineRunners(Duration.ofSeconds(resolveThresholdSeconds(request)));
        int timedOutTasks = localRunnerService.markTimedOutTasks();
        return ApiResponse.ok(new RunnerOfflineScanResponse(offlineTasks + timedOutTasks, offlineTasks, timedOutTasks), "Runner offline scan completed");
    }

    private long resolveThresholdSeconds(Map<String, Object> request) {
        Object value = request == null ? null : request.get("thresholdSeconds");
        if (value instanceof Number number) {
            return Math.max(30, Math.min(number.longValue(), 3600));
        }
        if (value instanceof String text) {
            try {
                return Math.max(30, Math.min(Long.parseLong(text.trim()), 3600));
            } catch (NumberFormatException ignored) {
                return 120;
            }
        }
        return 120;
    }

    private String normalizeTaskType(String value) {
        String normalized = value == null || value.isBlank() ? "WEB_ELEMENT_VALIDATE" : value.trim().toUpperCase();
        if (!SUPPORTED_DEBUG_TASK_TYPES.contains(normalized)) {
            throw new BadRequestException("Debug runner task only supports WEB_ELEMENT_VALIDATE, WEB_CASE_RUN, API_CASE_RUN or API_SCENARIO_RUN");
        }
        return normalized;
    }

    private Integer defaultResourceCost(String taskType) {
        if ("WEB_CASE_RUN".equals(taskType)) {
            return 5;
        }
        if ("API_CASE_RUN".equals(taskType) || "API_SCENARIO_RUN".equals(taskType)) {
            return 1;
        }
        return 3;
    }

    private Map<String, Object> defaultScreenshotPolicy() {
        return Map.of(
                "screenshotPolicy", "ON_FAILURE",
                "screenshotUploadMode", "FAILURE_ONLY",
                "format", "WEBP",
                "quality", 75
        );
    }

    private Map<String, Object> defaultTimeoutPolicy(String taskType) {
        if ("API_CASE_RUN".equals(taskType) || "API_SCENARIO_RUN".equals(taskType)) {
            return Map.of(
                    "requestTimeoutMs", 30000,
                    "scriptTimeoutMs", 1000
            );
        }
        return Map.of();
    }

    private Map<String, Object> defaultPayload(String taskType) {
        if ("WEB_CASE_RUN".equals(taskType)) {
            return Map.of(
                    "caseSnapshot", Map.of(
                            "caseId", 0,
                            "caseVersion", 1,
                            "caseName", "Local Runner placeholder case",
                            "steps", List.of()
                    ),
                    "runOptions", Map.of(
                            "debugMode", true,
                            "pauseOnFailure", true
                    )
            );
        }
        if ("API_CASE_RUN".equals(taskType)) {
            return Map.of(
                    "apiCaseSnapshot", defaultApiCaseSnapshot(),
                    "runOptions", defaultApiRunOptions()
            );
        }
        if ("API_SCENARIO_RUN".equals(taskType)) {
            return Map.of(
                    "scenarioSnapshot", Map.of(
                            "scenarioId", 0,
                            "scenarioName", "Local Runner placeholder API scenario",
                            "steps", List.of()
                    ),
                    "runOptions", defaultApiRunOptions()
            );
        }
        return Map.of(
                "pageUrl", "",
                "locators", List.of(),
                "validationOptions", Map.of(
                        "autoScroll", true,
                        "captureScreenshot", true,
                        "screenshotLimit", 8
                )
        );
    }

    private Map<String, Object> defaultApiCaseSnapshot() {
        return Map.of(
                "caseId", 0,
                "caseName", "Local Runner placeholder API case",
                "preScript", "",
                "postScript", "",
                "request", Map.of(
                        "method", "GET",
                        "url", "{{baseUrl}}",
                        "headers", List.of(),
                        "queryParams", List.of(),
                        "body", ""
                ),
                "assertions", List.of(),
                "extractors", List.of()
        );
    }

    private Map<String, Object> defaultApiRunOptions() {
        return Map.of(
                "stopOnFirstFailure", true,
                "debugMode", true
        );
    }

    private Map<String, Object> emptyMapIfNull(Map<String, Object> value) {
        return value == null ? Map.of() : value;
    }

    private List<Map<String, Object>> emptyListIfNull(List<Map<String, Object>> value) {
        return value == null ? List.of() : value;
    }
}
