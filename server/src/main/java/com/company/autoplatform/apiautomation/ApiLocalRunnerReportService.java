package com.company.autoplatform.apiautomation;

import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskEntity;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.runner.LocalRunnerTaskFinalResultEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiLocalRunnerReportService {

    private static final String TASK_TYPE_API_CASE_RUN = "API_CASE_RUN";
    private static final String TASK_TYPE_API_SCENARIO_RUN = "API_SCENARIO_RUN";
    private static final String TASK_TYPE_API_SUITE_RUN = "API_SUITE_RUN";
    private static final String EXECUTION_LOCATION_LOCAL_RUNNER = "LOCAL_RUNNER";

    private final TaskMapper taskMapper;
    private final ReportMapper reportMapper;
    private final ApiRunStepResultMapper stepResultMapper;
    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final ApiScenarioRunHistoryMapper scenarioRunHistoryMapper;
    private final ApiExecutionSuiteMapper suiteMapper;
    private final ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper;

    @Autowired
    public ApiLocalRunnerReportService(
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            ApiRunStepResultMapper stepResultMapper,
            ApiDefinitionCaseMapper caseMapper,
            ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper,
            ApiScenarioMapper scenarioMapper,
            ApiScenarioRunHistoryMapper scenarioRunHistoryMapper,
            ApiExecutionSuiteMapper suiteMapper,
            ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper
    ) {
        this.taskMapper = taskMapper;
        this.reportMapper = reportMapper;
        this.stepResultMapper = stepResultMapper;
        this.caseMapper = caseMapper;
        this.caseRunHistoryMapper = caseRunHistoryMapper;
        this.scenarioMapper = scenarioMapper;
        this.scenarioRunHistoryMapper = scenarioRunHistoryMapper;
        this.suiteMapper = suiteMapper;
        this.suiteRunHistoryMapper = suiteRunHistoryMapper;
    }

    public ApiLocalRunnerReportService(
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            ApiRunStepResultMapper stepResultMapper,
            ApiDefinitionCaseMapper caseMapper,
            ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper,
            ApiScenarioMapper scenarioMapper,
            ApiScenarioRunHistoryMapper scenarioRunHistoryMapper
    ) {
        this(
                taskMapper,
                reportMapper,
                stepResultMapper,
                caseMapper,
                caseRunHistoryMapper,
                scenarioMapper,
                scenarioRunHistoryMapper,
                null,
                null
        );
    }

    @EventListener
    @Transactional
    public void handleLocalRunnerTaskFinalResult(LocalRunnerTaskFinalResultEvent event) {
        if (TASK_TYPE_API_CASE_RUN.equals(event.taskType())) {
            persistCaseResult(event);
        }
        if (TASK_TYPE_API_SCENARIO_RUN.equals(event.taskType())) {
            persistScenarioResult(event);
        }
        if (TASK_TYPE_API_SUITE_RUN.equals(event.taskType())) {
            persistSuiteResult(event);
        }
    }

    private void persistCaseResult(LocalRunnerTaskFinalResultEvent event) {
        Map<String, Object> payload = safeMap(event.payload());
        Map<String, Object> apiCaseSnapshot = safeMap(payload.get("apiCaseSnapshot"));
        Map<String, Object> result = safeMap(event.result());
        Map<String, Object> reportData = safeMap(result.get("reportData"));
        Long caseId = longValue(apiCaseSnapshot.get("caseId"));
        ApiDefinitionCaseEntity apiCase = caseId == null ? null : caseMapper.selectById(caseId);
        Long workspaceId = apiCase == null ? event.workspaceId() : apiCase.getWorkspaceId();
        String caseName = firstText(apiCase == null ? null : apiCase.getCaseName(), stringValue(apiCaseSnapshot.get("caseName")), "Local Runner API case");

        RunArtifacts artifacts = createRunArtifacts(workspaceId, "接口用例本地执行", caseName, event);
        ApiRunStepResultEntity step = toStepEntity(
                workspaceId,
                artifacts.report().getId(),
                1,
                caseName,
                apiCase == null ? null : apiCase.getDefinitionId(),
                "SUCCESS".equals(event.status()),
                longValue(result.get("durationMs")),
                null,
                safeMap(reportData.get("request")),
                safeMap(reportData.get("response")),
                safeList(reportData.get("assertions")),
                safeMap(reportData.get("extractedVariables")),
                safeMap(reportData.get("scriptResults"))
        );
        stepResultMapper.insert(step);

        if (apiCase != null) {
            apiCase.setLastRunResult(event.status());
            apiCase.setLastRunAt(LocalDateTime.now());
            apiCase.setUpdatedAt(LocalDateTime.now());
            caseMapper.updateById(apiCase);

            ApiDefinitionCaseRunHistoryEntity history = new ApiDefinitionCaseRunHistoryEntity();
            history.setWorkspaceId(apiCase.getWorkspaceId());
            history.setDefinitionId(apiCase.getDefinitionId());
            history.setCaseId(apiCase.getId());
            history.setReportId(artifacts.report().getId());
            history.setCaseName(caseName);
            history.setRunResult(event.status());
            history.setFailureSummary(stringValue(result.get("errorMessage")));
            history.setOperatorName("Local Runner");
            history.setStatusCode(integerValue(safeMap(reportData.get("response")).get("status")));
            history.setDurationMs(longValue(result.get("durationMs")));
            history.setResponseSize(responseSize(safeMap(reportData.get("response"))));
            history.setContextSnapshotJson(contextSnapshot(event));
            history.setCreatedAt(LocalDateTime.now());
            history.setUpdatedAt(LocalDateTime.now());
            caseRunHistoryMapper.insert(history);
        }
    }

    private void persistScenarioResult(LocalRunnerTaskFinalResultEvent event) {
        Map<String, Object> payload = safeMap(event.payload());
        Map<String, Object> scenarioSnapshot = safeMap(payload.get("scenarioSnapshot"));
        Map<String, Object> runOptions = safeMap(payload.get("runOptions"));
        Map<String, Object> result = safeMap(event.result());
        Map<String, Object> summary = safeMap(result.get("summary"));
        Map<String, Object> reportData = safeMap(result.get("reportData"));
        List<Map<String, Object>> stepResults = safeList(reportData.get("stepResults"));
        Long scenarioId = longValue(scenarioSnapshot.get("scenarioId"));
        ApiScenarioEntity scenario = scenarioId == null ? null : scenarioMapper.selectById(scenarioId);
        Long workspaceId = scenario == null ? event.workspaceId() : scenario.getWorkspaceId();
        String scenarioName = firstText(scenario == null ? null : scenario.getScenarioName(), stringValue(scenarioSnapshot.get("scenarioName")), "Local Runner API scenario");

        RunArtifacts artifacts = createRunArtifacts(workspaceId, "接口场景本地执行", scenarioName, event);
        int order = 1;
        List<ApiRunStepResultResponse> stepResponses = new java.util.ArrayList<>();
        for (Map<String, Object> stepResult : stepResults) {
            String stepName = firstText(stringValue(stepResult.get("stepName")), stringValue(stepResult.get("stepId")), "API step");
            boolean success = "SUCCESS".equals(stringValue(stepResult.get("status")));
            Long durationMs = longValue(stepResult.get("durationMs"));
            String errorMessage = stringValue(stepResult.get("errorMessage"));
            Map<String, Object> request = safeMap(stepResult.get("request"));
            Map<String, Object> response = safeMap(stepResult.get("response"));
            List<Map<String, Object>> assertions = safeList(stepResult.get("assertions"));
            Map<String, Object> extractedVariables = safeMap(stepResult.get("extractedVariables"));
            Map<String, Object> scriptResults = safeMap(stepResult.get("scriptResults"));
            stepResultMapper.insert(toStepEntity(
                    workspaceId,
                    artifacts.report().getId(),
                    order,
                    stepName,
                    null,
                    success,
                    durationMs,
                    errorMessage,
                    request,
                    response,
                    assertions,
                    extractedVariables,
                    scriptResults
            ));
            stepResponses.add(toStepResponse(
                    artifacts.report().getId(),
                    order,
                    stepName,
                    null,
                    success,
                    durationMs,
                    errorMessage,
                    request,
                    response,
                    assertions,
                    extractedVariables,
                    scriptResults
            ));
            order++;
        }

        if (scenario != null) {
            scenario.setLastRunResult(event.status());
            scenario.setLastRunAt(LocalDateTime.now());
            scenario.setUpdatedAt(LocalDateTime.now());
            scenarioMapper.updateById(scenario);

            ApiScenarioRunHistoryEntity history = new ApiScenarioRunHistoryEntity();
            history.setWorkspaceId(scenario.getWorkspaceId());
            history.setScenarioId(scenario.getId());
            history.setScenarioName(scenarioName);
            history.setReportId(artifacts.report().getId());
            history.setResult(event.status());
            history.setFailureSummary(firstText(stringValue(result.get("errorMessage")), stringValue(summary.get("errorMessage")), null));
            history.setTotalCount(integerValue(summary.get("totalSteps"), stepResults.size()));
            history.setSuccessCount(integerValue(summary.get("passedSteps"), countStatus(stepResults, "SUCCESS")));
            history.setFailedCount(integerValue(summary.get("failedSteps"), countStatus(stepResults, "FAILED")));
            history.setSkippedCount(integerValue(summary.get("skippedSteps"), countStatus(stepResults, "SKIPPED")));
            history.setDurationMs(longValue(result.get("durationMs"), 0L));
            history.setEnvironmentId(resolveRunEnvironmentId(runOptions, event));
            history.setVariableSetId(resolveRunVariableSetId(runOptions, event));
            history.setLoopCount(1);
            history.setThreadCount(1);
            history.setDataIterationJson("[]");
            history.setDetailJson(ApiAutomationJsonSupport.toJson(stepResponses, "Failed to serialize Local Runner API scenario step detail"));
            history.setContextSnapshotJson(contextSnapshot(event));
            history.setOperatorName("Local Runner");
            history.setCreatedAt(LocalDateTime.now());
            history.setUpdatedAt(LocalDateTime.now());
            scenarioRunHistoryMapper.insert(history);
        }
    }

    private void persistSuiteResult(LocalRunnerTaskFinalResultEvent event) {
        Map<String, Object> payload = safeMap(event.payload());
        Map<String, Object> suiteSnapshot = safeMap(payload.get("suiteSnapshot"));
        Map<String, Object> result = safeMap(event.result());
        Map<String, Object> summary = safeMap(result.get("summary"));
        Map<String, Object> reportData = safeMap(result.get("reportData"));
        Map<String, Object> runOptions = safeMap(payload.get("runOptions"));
        List<Map<String, Object>> stepResults = safeList(reportData.get("stepResults"));
        List<Map<String, Object>> itemSnapshots = safeList(reportData.get("itemSnapshots"));
        List<Map<String, Object>> suiteStepResults = enrichSuiteStepResults(stepResults, itemSnapshots);
        Long suiteId = longValue(suiteSnapshot.get("suiteId"));
        ApiExecutionSuiteEntity suite = suiteMapper == null || suiteId == null ? null : suiteMapper.selectById(suiteId);
        Long workspaceId = suite == null ? event.workspaceId() : suite.getWorkspaceId();
        String suiteName = firstText(suite == null ? null : suite.getSuiteName(), stringValue(suiteSnapshot.get("suiteName")), "Local Runner API suite");

        RunArtifacts artifacts = createRunArtifacts(workspaceId, "接口套件本地执行", suiteName, event);
        int order = 1;
        for (Map<String, Object> stepResult : suiteStepResults) {
            stepResultMapper.insert(toStepEntity(
                    workspaceId,
                    artifacts.report().getId(),
                    order++,
                    firstText(stringValue(stepResult.get("stepName")), stringValue(stepResult.get("stepId")), "API step"),
                    null,
                    "SUCCESS".equals(stringValue(stepResult.get("status"))),
                    longValue(stepResult.get("durationMs")),
                    stringValue(stepResult.get("errorMessage")),
                    safeMap(stepResult.get("request")),
                    safeMap(stepResult.get("response")),
                    safeList(stepResult.get("assertions")),
                    safeMap(stepResult.get("extractedVariables")),
                    safeMap(stepResult.get("scriptResults"))
            ));
        }

        if (suite != null && suiteRunHistoryMapper != null) {
            suite.setLastRunResult(event.status());
            suite.setLastRunAt(LocalDateTime.now());
            suite.setUpdatedAt(LocalDateTime.now());
            suiteMapper.updateById(suite);

            ApiExecutionSuiteRunHistoryEntity history = new ApiExecutionSuiteRunHistoryEntity();
            history.setWorkspaceId(suite.getWorkspaceId());
            history.setSuiteId(suite.getId());
            history.setSuiteName(suiteName);
            history.setModuleId(suite.getModuleId());
            history.setPriority(suite.getPriority());
            history.setReportId(artifacts.report().getId());
            history.setResult(event.status());
            history.setFailureSummary(firstText(stringValue(result.get("errorMessage")), stringValue(summary.get("errorMessage")), null));
            history.setTotalCount(integerValue(summary.get("totalSteps"), suiteStepResults.size()));
            history.setSuccessCount(integerValue(summary.get("passedSteps"), countStatus(suiteStepResults, "SUCCESS")));
            history.setFailedCount(integerValue(summary.get("failedSteps"), countStatus(suiteStepResults, "FAILED")));
            history.setSkippedCount(integerValue(summary.get("skippedSteps"), countStatus(suiteStepResults, "SKIPPED")));
            history.setDurationMs(longValue(result.get("durationMs"), 0L));
            history.setEnvironmentId(resolveRunEnvironmentId(runOptions, event));
            history.setVariableSetId(resolveRunVariableSetId(runOptions, event));
            history.setRunMode(firstText(suite.getRunMode(), stringValue(suiteSnapshot.get("runMode")), "SERIAL"));
            history.setRunOn(EXECUTION_LOCATION_LOCAL_RUNNER);
            history.setContinueOnFailure(suite.getContinueOnFailure());
            history.setGlobalTimeoutMs(suite.getGlobalTimeoutMs());
            history.setStepFailureRetryCount(suite.getStepFailureRetryCount());
            history.setDefaultStepWaitMs(suite.getDefaultStepWaitMs());
            history.setDataDrivenEnabled(false);
            history.setDataIterationJson("[]");
            history.setTriggerSource("LOCAL_RUNNER");
            history.setOperatorName("Local Runner");
            history.setDetailJson(ApiAutomationJsonSupport.toJson(suiteStepResults, "Failed to serialize Local Runner API suite step detail"));
            history.setItemSnapshotJson(ApiAutomationJsonSupport.toJson(itemSnapshots, "Failed to serialize Local Runner API suite item snapshots"));
            history.setContextSnapshotJson(contextSnapshot(event));
            history.setCreatedAt(LocalDateTime.now());
            history.setUpdatedAt(LocalDateTime.now());
            suiteRunHistoryMapper.insert(history);
        }
    }

    private RunArtifacts createRunArtifacts(Long workspaceId, String prefix, String targetName, LocalRunnerTaskFinalResultEvent event) {
        LocalDateTime now = LocalDateTime.now();
        TaskEntity task = new TaskEntity();
        task.setWorkspaceId(workspaceId);
        task.setTaskName(prefix + " - " + targetName);
        task.setEngineType("API");
        task.setTaskStatus(event.status());
        task.setSummary(targetName);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        ReportEntity report = new ReportEntity();
        report.setWorkspaceId(workspaceId);
        report.setTaskId(task.getId());
        report.setReportName(targetName + " @ " + now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        report.setResult(event.status());
        report.setFailureSummary(stringValue(event.result().get("errorMessage")));
        report.setLogSource("API_LOCAL_RUNNER");
        report.setLogText(contextSnapshot(event));
        report.setAttachmentsJson("[]");
        report.setArchived(false);
        report.setCreatedAt(now);
        report.setUpdatedAt(now);
        reportMapper.insert(report);
        return new RunArtifacts(task, report);
    }

    private ApiRunStepResultEntity toStepEntity(
            Long workspaceId,
            Long reportId,
            int stepOrder,
            String stepName,
            Long definitionId,
            boolean success,
            Long durationMs,
            String errorMessage,
            Map<String, Object> request,
            Map<String, Object> response,
            List<Map<String, Object>> assertions,
            Map<String, Object> extractedVariables,
            Map<String, Object> scriptResults
    ) {
        ApiRunStepResultEntity entity = new ApiRunStepResultEntity();
        entity.setWorkspaceId(workspaceId);
        entity.setReportId(reportId);
        entity.setStepOrder(stepOrder);
        entity.setStepName(stepName);
        entity.setDefinitionId(definitionId);
        entity.setSuccess(success);
        entity.setDurationMs(durationMs == null ? 0L : durationMs);
        entity.setRequestSnapshotJson(ApiAutomationJsonSupport.toJson(toRequestSnapshot(request), "Failed to serialize Local Runner API request snapshot"));
        entity.setResponseSnapshotJson(ApiAutomationJsonSupport.toJson(toResponseSnapshot(response), "Failed to serialize Local Runner API response snapshot"));
        entity.setAssertionResultsJson(ApiAutomationJsonSupport.toJson(toAssertionResults(assertions), "Failed to serialize Local Runner API assertions"));
        entity.setExtractionResultsJson(ApiAutomationJsonSupport.toJson(toExtractionResults(extractedVariables), "Failed to serialize Local Runner API extractions"));
        entity.setProcessorResultsJson(ApiAutomationJsonSupport.toJson(toProcessorResults(scriptResults), "Failed to serialize Local Runner API processors"));
        entity.setErrorMessage(errorMessage);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return entity;
    }

    private ApiRunStepResultResponse toStepResponse(
            Long reportId,
            int stepOrder,
            String stepName,
            Long definitionId,
            boolean success,
            Long durationMs,
            String errorMessage,
            Map<String, Object> request,
            Map<String, Object> response,
            List<Map<String, Object>> assertions,
            Map<String, Object> extractedVariables,
            Map<String, Object> scriptResults
    ) {
        return new ApiRunStepResultResponse(
                null,
                reportId,
                stepOrder,
                stepName,
                definitionId,
                success,
                durationMs == null ? 0L : durationMs,
                toRequestSnapshot(request),
                toResponseSnapshot(response),
                toAssertionResults(assertions),
                toExtractionResults(extractedVariables),
                toProcessorResults(scriptResults),
                errorMessage,
                LocalDateTime.now()
        );
    }

    private ApiRequestSnapshot toRequestSnapshot(Map<String, Object> request) {
        return new ApiRequestSnapshot(
                firstText(stringValue(request.get("method")), "GET"),
                stringValue(request.get("url")),
                stringMap(request.get("headers")),
                List.of(),
                List.of(),
                null,
                null,
                List.of(),
                null,
                null,
                stringValue(request.get("body"))
        );
    }

    private ApiResponseSnapshot toResponseSnapshot(Map<String, Object> response) {
        return new ApiResponseSnapshot(
                integerValue(firstPresent(response.get("statusCode"), response.get("status"))),
                stringMap(response.get("headers")),
                stringValue(response.get("body")),
                stringMap(response.get("headers")).get("content-type")
        );
    }

    private List<ApiAssertionResult> toAssertionResults(List<Map<String, Object>> assertions) {
        return assertions.stream()
                .map(assertion -> new ApiAssertionResult(
                        stringValue(firstPresent(assertion.get("assertionId"), assertion.get("id"))),
                        stringValue(assertion.get("type")),
                        stringValue(assertion.get("name")),
                        stringValue(assertion.get("subject")),
                        stringValue(assertion.get("condition")),
                        stringValue(assertion.get("expected")),
                        stringValue(firstPresent(assertion.get("actual"), assertion.get("actualValue"))),
                        !"FAILED".equals(stringValue(assertion.get("status"))),
                        stringValue(assertion.get("message"))
                ))
                .toList();
    }

    private List<ApiExtractionResult> toExtractionResults(Map<String, Object> extractedVariables) {
        return extractedVariables.entrySet().stream()
                .filter(entry -> entry.getKey() != null)
                .map(entry -> new ApiExtractionResult(
                        entry.getKey(),
                        true,
                        stringValue(entry.getValue()),
                        "Extracted by Local Runner"
                ))
                .toList();
    }

    private List<ApiProcessorResult> toProcessorResults(Map<String, Object> scriptResults) {
        List<ApiProcessorResult> results = new java.util.ArrayList<>();
        appendScriptProcessorResult(results, "PRE", safeMap(scriptResults.get("pre")));
        appendScriptProcessorResult(results, "POST", safeMap(scriptResults.get("post")));
        return results;
    }

    private void appendScriptProcessorResult(List<ApiProcessorResult> results, String stage, Map<String, Object> scriptResult) {
        if (scriptResult.isEmpty()) {
            return;
        }
        String status = stringValue(scriptResult.get("status"));
        boolean success = status == null || !"FAILED".equalsIgnoreCase(status);
        results.add(new ApiProcessorResult(
                stage,
                "SCRIPT",
                stage + " script",
                success,
                longValue(scriptResult.get("durationMs"), 0L),
                stringValue(firstPresent(scriptResult.get("message"), scriptResult.get("errorMessage"))),
                safeStringList(scriptResult.get("logs")),
                Map.of()
        ));
    }

    private String contextSnapshot(LocalRunnerTaskFinalResultEvent event) {
        return ApiAutomationJsonSupport.toJson(Map.of(
                "executionLocation", EXECUTION_LOCATION_LOCAL_RUNNER,
                "runnerRunId", event.runId(),
                "runnerId", Optional.ofNullable(event.runnerId()).orElse(""),
                "taskType", event.taskType()
        ), "Failed to serialize Local Runner API context snapshot");
    }

    private Long resolveRunEnvironmentId(Map<String, Object> runOptions, LocalRunnerTaskFinalResultEvent event) {
        Map<String, Object> environmentSnapshot = safeMap(event.environmentSnapshot());
        return longValue(firstPresent(
                runOptions.get("environmentId"),
                environmentSnapshot.get("environmentId")
        ));
    }

    private Long resolveRunVariableSetId(Map<String, Object> runOptions, LocalRunnerTaskFinalResultEvent event) {
        Map<String, Object> variableSnapshot = safeMap(event.variableSnapshot());
        return longValue(firstPresent(
                runOptions.get("variableSetId"),
                variableSnapshot.get("variableSetId")
        ));
    }

    private List<Map<String, Object>> enrichSuiteStepResults(
            List<Map<String, Object>> stepResults,
            List<Map<String, Object>> itemSnapshots
    ) {
        if (stepResults.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> enriched = new java.util.ArrayList<>();
        int stepCursor = 0;
        for (Map<String, Object> item : itemSnapshots) {
            int stepCount = Math.max(0, integerValue(item.get("stepCount"), 0));
            for (int offset = 0; offset < stepCount && stepCursor < stepResults.size(); offset++) {
                Map<String, Object> step = new java.util.LinkedHashMap<>(stepResults.get(stepCursor++));
                step.putIfAbsent("suiteItemId", firstPresent(item.get("suiteItemId"), item.get("itemId")));
                step.putIfAbsent("suiteItemOrder", item.get("sortOrder"));
                enriched.add(step);
            }
        }
        while (stepCursor < stepResults.size()) {
            enriched.add(new java.util.LinkedHashMap<>(stepResults.get(stepCursor++)));
        }
        return enriched;
    }

    private long responseSize(Map<String, Object> response) {
        String body = stringValue(response.get("body"));
        return body == null ? 0L : body.getBytes(StandardCharsets.UTF_8).length;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> safeMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> safeList(Object value) {
        return value instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }

    private List<String> safeStringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .map(this::stringValue)
                .filter(item -> item != null && !item.isBlank())
                .toList();
    }

    private Map<String, String> stringMap(Object value) {
        Map<String, Object> source = safeMap(value);
        return source.entrySet().stream()
                .filter(entry -> entry.getKey() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> String.valueOf(entry.getValue()),
                        (left, right) -> right,
                        java.util.LinkedHashMap::new
                ));
    }

    private Object firstPresent(Object first, Object second) {
        return first == null ? second : first;
    }

    private String firstText(String first, String second) {
        return firstText(first, second, null);
    }

    private String firstText(String first, String second, String fallback) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return fallback;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long longValue(Object value) {
        return longValue(value, null);
    }

    private Long longValue(Object value, Long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            if (value == null) {
                return fallback;
            }
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private Integer integerValue(Object value) {
        return integerValue(value, null);
    }

    private Integer integerValue(Object value, Integer fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            if (value == null) {
                return fallback;
            }
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private int countStatus(List<Map<String, Object>> stepResults, String status) {
        return (int) stepResults.stream()
                .filter(step -> status.equals(stringValue(step.get("status")).toUpperCase(Locale.ROOT)))
                .count();
    }

    private record RunArtifacts(TaskEntity task, ReportEntity report) {
    }
}
