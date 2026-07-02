package com.company.autoplatform.apiautomation;

import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskEntity;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.runner.LocalRunnerTaskFinalResultEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiLocalRunnerReportServiceTests {

    @Test
    void persistsApiCaseRunResultAsFormalReport() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiDefinitionCaseEntity apiCase = new ApiDefinitionCaseEntity();
        apiCase.setId(2001L);
        apiCase.setWorkspaceId(7L);
        apiCase.setDefinitionId(1001L);
        apiCase.setCaseName("Local API case");
        when(caseMapper.selectById(2001L)).thenReturn(apiCase);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "run_api_case_001",
                "API_CASE_RUN",
                "SUCCESS",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("apiCaseSnapshot", Map.of(
                        "caseId", 2001,
                        "caseName", "Local API case"
                )),
                Map.of(
                        "durationMs", 123,
                        "summary", Map.of("statusCode", 200),
                        "reportData", Map.of(
                                "request", Map.of(
                                        "method", "GET",
                                        "url", "http://127.0.0.1/orders",
                                        "headers", Map.of("x-token", "abc")
                                ),
                                "response", Map.of(
                                        "status", 200,
                                        "headers", Map.of("content-type", "application/json"),
                                        "body", "{\"ok\":true}"
                                ),
                                "assertions", List.of(Map.of(
                                        "assertionId", "status",
                                        "type", "STATUS_CODE",
                                        "expected", "200",
                                        "actual", "200",
                                        "status", "PASSED"
                                ))
                        )
                )
        ));

        ArgumentCaptor<ReportEntity> reportCaptor = ArgumentCaptor.forClass(ReportEntity.class);
        ArgumentCaptor<TaskEntity> taskCaptor = ArgumentCaptor.forClass(TaskEntity.class);
        ArgumentCaptor<ApiRunStepResultEntity> stepCaptor = ArgumentCaptor.forClass(ApiRunStepResultEntity.class);
        ArgumentCaptor<ApiDefinitionCaseRunHistoryEntity> historyCaptor = ArgumentCaptor.forClass(ApiDefinitionCaseRunHistoryEntity.class);

        verify(taskMapper).insert(taskCaptor.capture());
        verify(reportMapper).insert(reportCaptor.capture());
        verify(stepMapper).insert(stepCaptor.capture());
        verify(caseHistoryMapper).insert(historyCaptor.capture());
        verify(caseMapper).updateById(apiCase);

        assertThat(taskCaptor.getValue().getWorkspaceId()).isEqualTo(7L);
        assertThat(reportCaptor.getValue().getWorkspaceId()).isEqualTo(7L);
        assertThat(reportCaptor.getValue().getLogSource()).isEqualTo("API_LOCAL_RUNNER");
        assertThat(reportCaptor.getValue().getLogText()).contains("LOCAL_RUNNER", "run_api_case_001");
        assertThat(stepCaptor.getValue().getStepName()).isEqualTo("Local API case");
        assertThat(stepCaptor.getValue().getSuccess()).isTrue();
        assertThat(stepCaptor.getValue().getResponseSnapshotJson()).contains("\"statusCode\":200");
        assertThat(historyCaptor.getValue().getCaseId()).isEqualTo(2001L);
        assertThat(historyCaptor.getValue().getRunResult()).isEqualTo("SUCCESS");
        assertThat(apiCase.getLastRunResult()).isEqualTo("SUCCESS");
    }

    @Test
    void persistsApiCaseScriptResultsAndExtractedVariablesInFormalStepDetail() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiDefinitionCaseEntity apiCase = new ApiDefinitionCaseEntity();
        apiCase.setId(2002L);
        apiCase.setWorkspaceId(7L);
        apiCase.setDefinitionId(1002L);
        apiCase.setCaseName("Scripted API case");
        when(caseMapper.selectById(2002L)).thenReturn(apiCase);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "run_api_case_script_001",
                "API_CASE_RUN",
                "SUCCESS",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("apiCaseSnapshot", Map.of(
                        "caseId", 2002,
                        "caseName", "Scripted API case"
                )),
                Map.of(
                        "durationMs", 88,
                        "reportData", Map.of(
                                "request", Map.of("method", "GET", "url", "http://127.0.0.1/case-script"),
                                "response", Map.of("status", 200, "body", "{\"token\":\"case-token\"}"),
                                "assertions", List.of(),
                                "scriptResults", Map.of(
                                        "pre", Map.of("status", "SUCCESS", "phase", "pre"),
                                        "post", Map.of("status", "SUCCESS", "phase", "post")
                                ),
                                "extractedVariables", Map.of(
                                        "CASE_TOKEN", "case-token",
                                        "SERVER_TOKEN", "server-token"
                                )
                        )
                )
        ));

        ArgumentCaptor<ApiRunStepResultEntity> stepCaptor = ArgumentCaptor.forClass(ApiRunStepResultEntity.class);
        verify(stepMapper).insert(stepCaptor.capture());

        assertThat(stepCaptor.getValue().getProcessorResultsJson())
                .contains("\"processorType\":\"SCRIPT\"", "\"stage\":\"PRE\"", "\"stage\":\"POST\"");
        assertThat(stepCaptor.getValue().getExtractionResultsJson())
                .contains("\"name\":\"CASE_TOKEN\"", "\"value\":\"case-token\"", "\"name\":\"SERVER_TOKEN\"");
    }

    @Test
    void persistsApiScenarioRunResultAsFormalReport() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3001L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Local API scenario");
        when(scenarioMapper.selectById(3001L)).thenReturn(scenario);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "run_api_scenario_001",
                "API_SCENARIO_RUN",
                "FAILED",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("scenarioSnapshot", Map.of(
                        "scenarioId", 3001,
                        "scenarioName", "Local API scenario"
                )),
                Map.of("environmentId", 8137),
                Map.of("variableSetId", 915),
                Map.of(
                        "durationMs", 456,
                        "summary", Map.of("totalSteps", 2, "passedSteps", 1, "failedSteps", 1),
                        "errorMessage", "step failed",
                        "reportData", Map.of(
                                "stepResults", List.of(
                                        Map.of(
                                                "stepId", "step-1",
                                                "stepName", "Create order",
                                                "status", "SUCCESS",
                                                "durationMs", 100,
                                                "request", Map.of("method", "POST", "url", "http://127.0.0.1/orders"),
                                                "response", Map.of("status", 201, "body", "{\"id\":\"A100\"}"),
                                                "assertions", List.of()
                                        ),
                                        Map.of(
                                                "stepId", "step-2",
                                                "stepName", "Get order",
                                                "status", "FAILED",
                                                "durationMs", 200,
                                                "errorMessage", "not found",
                                                "assertions", List.of()
                                        )
                                )
                        )
                )
        ));

        ArgumentCaptor<ApiScenarioRunHistoryEntity> historyCaptor = ArgumentCaptor.forClass(ApiScenarioRunHistoryEntity.class);

        verify(taskMapper).insert(org.mockito.ArgumentMatchers.any(TaskEntity.class));
        verify(reportMapper).insert(org.mockito.ArgumentMatchers.any(ReportEntity.class));
        verify(stepMapper, org.mockito.Mockito.times(2)).insert(org.mockito.ArgumentMatchers.any(ApiRunStepResultEntity.class));
        verify(scenarioHistoryMapper).insert(historyCaptor.capture());
        verify(caseHistoryMapper, never()).insert(org.mockito.ArgumentMatchers.any(ApiDefinitionCaseRunHistoryEntity.class));
        verify(scenarioMapper).updateById(scenario);

        assertThat(historyCaptor.getValue().getScenarioId()).isEqualTo(3001L);
        assertThat(historyCaptor.getValue().getResult()).isEqualTo("FAILED");
        assertThat(historyCaptor.getValue().getTotalCount()).isEqualTo(2);
        assertThat(historyCaptor.getValue().getSuccessCount()).isEqualTo(1);
        assertThat(historyCaptor.getValue().getFailedCount()).isEqualTo(1);
        assertThat(historyCaptor.getValue().getEnvironmentId()).isEqualTo(8137L);
        assertThat(historyCaptor.getValue().getVariableSetId()).isEqualTo(915L);
        assertThat(historyCaptor.getValue().getContextSnapshotJson()).contains("LOCAL_RUNNER", "run_api_scenario_001");
        assertThat(historyCaptor.getValue().getDetailJson())
                .startsWith("[")
                .contains("\"stepName\":\"Create order\"", "\"stepName\":\"Get order\"", "\"errorMessage\":\"not found\"")
                .doesNotContain("\"stepResults\"");
        assertThat(scenario.getLastRunResult()).isEqualTo("FAILED");
    }

    @Test
    void persistsApiSuiteRunResultAsFormalSuiteHistory() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiExecutionSuiteMapper suiteMapper = mock(ApiExecutionSuiteMapper.class);
        ApiExecutionSuiteRunHistoryMapper suiteHistoryMapper = mock(ApiExecutionSuiteRunHistoryMapper.class);
        ApiExecutionSuiteEntity suite = new ApiExecutionSuiteEntity();
        suite.setId(8001L);
        suite.setWorkspaceId(7L);
        suite.setSuiteName("Local API suite");
        suite.setRunMode("SERIAL");
        suite.setRunOn("LOCAL");
        suite.setContinueOnFailure(false);
        when(suiteMapper.selectById(8001L)).thenReturn(suite);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper,
                suiteMapper,
                suiteHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "run_api_suite_001",
                "API_SUITE_RUN",
                "SUCCESS",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("suiteSnapshot", Map.of(
                        "suiteId", 8001,
                        "suiteName", "Local API suite"
                )),
                Map.of(
                        "durationMs", 300,
                        "summary", Map.of("totalSteps", 2, "passedSteps", 2, "failedSteps", 0),
                        "reportData", Map.of(
                                "itemSnapshots", List.of(
                                        Map.of("itemId", 1, "itemType", "API_CASE", "itemName", "Create order", "sortOrder", 10, "result", "SUCCESS", "totalCount", 1, "durationMs", 100),
                                        Map.of("itemId", 2, "itemType", "SCENARIO", "itemName", "Pay order", "sortOrder", 20, "result", "SUCCESS", "totalCount", 1, "durationMs", 200)
                                ),
                                "stepResults", List.of(
                                        Map.of(
                                                "stepId", "suite-item-1-create",
                                                "stepName", "Create order",
                                                "status", "SUCCESS",
                                                "durationMs", 100,
                                                "request", Map.of("method", "POST", "url", "http://127.0.0.1/orders"),
                                                "response", Map.of("status", 201, "body", "{\"id\":\"S100\"}"),
                                                "assertions", List.of()
                                        ),
                                        Map.of(
                                                "stepId", "suite-item-2-pay",
                                                "stepName", "Pay order",
                                                "status", "SUCCESS",
                                                "durationMs", 200,
                                                "request", Map.of("method", "GET", "url", "http://127.0.0.1/orders/S100"),
                                                "response", Map.of("status", 200, "body", "{\"status\":\"PAID\"}"),
                                                "assertions", List.of()
                                        )
                                )
                        )
                )
        ));

        ArgumentCaptor<ApiExecutionSuiteRunHistoryEntity> historyCaptor = ArgumentCaptor.forClass(ApiExecutionSuiteRunHistoryEntity.class);

        verify(taskMapper).insert(org.mockito.ArgumentMatchers.any(TaskEntity.class));
        verify(reportMapper).insert(org.mockito.ArgumentMatchers.any(ReportEntity.class));
        verify(stepMapper, org.mockito.Mockito.times(2)).insert(org.mockito.ArgumentMatchers.any(ApiRunStepResultEntity.class));
        verify(suiteHistoryMapper).insert(historyCaptor.capture());
        verify(suiteMapper).updateById(suite);

        assertThat(historyCaptor.getValue().getSuiteId()).isEqualTo(8001L);
        assertThat(historyCaptor.getValue().getResult()).isEqualTo("SUCCESS");
        assertThat(historyCaptor.getValue().getRunOn()).isEqualTo("LOCAL_RUNNER");
        assertThat(historyCaptor.getValue().getTotalCount()).isEqualTo(2);
        assertThat(historyCaptor.getValue().getSuccessCount()).isEqualTo(2);
        assertThat(historyCaptor.getValue().getItemSnapshotJson()).contains("Create order", "Pay order");
        assertThat(historyCaptor.getValue().getDetailJson()).contains("Create order", "Pay order");
        assertThat(suite.getLastRunResult()).isEqualTo("SUCCESS");
    }

    @Test
    void persistsApiScenarioStepScriptResultsAndExtractedVariables() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3002L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Scripted API scenario");
        when(scenarioMapper.selectById(3002L)).thenReturn(scenario);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "run_api_scenario_script_001",
                "API_SCENARIO_RUN",
                "SUCCESS",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("scenarioSnapshot", Map.of(
                        "scenarioId", 3002,
                        "scenarioName", "Scripted API scenario"
                )),
                Map.of(
                        "durationMs", 99,
                        "summary", Map.of("totalSteps", 1, "passedSteps", 1, "failedSteps", 0),
                        "reportData", Map.of(
                                "extractedVariables", Map.of("GLOBAL_TOKEN", "global-token"),
                                "stepResults", List.of(Map.of(
                                        "stepId", "step-script",
                                        "stepName", "Scripted step",
                                        "status", "SUCCESS",
                                        "durationMs", 99,
                                        "request", Map.of("method", "GET", "url", "http://127.0.0.1/scripted"),
                                        "response", Map.of("status", 200, "body", "{\"token\":\"step-token\"}"),
                                        "assertions", List.of(),
                                        "scriptResults", Map.of(
                                                "pre", Map.of("status", "SUCCESS", "phase", "pre"),
                                                "post", Map.of("status", "SUCCESS", "phase", "post")
                                        ),
                                        "extractedVariables", Map.of("STEP_TOKEN", "step-token")
                                ))
                        )
                )
        ));

        ArgumentCaptor<ApiRunStepResultEntity> stepCaptor = ArgumentCaptor.forClass(ApiRunStepResultEntity.class);
        ArgumentCaptor<ApiScenarioRunHistoryEntity> historyCaptor = ArgumentCaptor.forClass(ApiScenarioRunHistoryEntity.class);
        verify(stepMapper).insert(stepCaptor.capture());
        verify(scenarioHistoryMapper).insert(historyCaptor.capture());

        assertThat(stepCaptor.getValue().getProcessorResultsJson())
                .contains("\"processorType\":\"SCRIPT\"", "\"stage\":\"PRE\"", "\"stage\":\"POST\"");
        assertThat(stepCaptor.getValue().getExtractionResultsJson())
                .contains("\"name\":\"STEP_TOKEN\"", "\"value\":\"step-token\"");
        assertThat(historyCaptor.getValue().getDetailJson())
                .startsWith("[")
                .contains("STEP_TOKEN", "processorResults")
                .doesNotContain("scriptResults");
    }

    @Test
    void usesRunnerTaskWorkspaceWhenApiCaseSnapshotIsDebugOnly() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        ReportMapper reportMapper = mock(ReportMapper.class);
        ApiRunStepResultMapper stepMapper = mock(ApiRunStepResultMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiDefinitionCaseRunHistoryMapper caseHistoryMapper = mock(ApiDefinitionCaseRunHistoryMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiScenarioRunHistoryMapper scenarioHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        when(caseMapper.selectById(0L)).thenReturn(null);

        ApiLocalRunnerReportService service = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );

        service.handleLocalRunnerTaskFinalResult(new LocalRunnerTaskFinalResultEvent(
                "debug-api-case-001",
                "API_CASE_RUN",
                "SUCCESS",
                7L,
                "risk-ops",
                "runner_local",
                Map.of("apiCaseSnapshot", Map.of(
                        "caseId", 0,
                        "caseName", "Local Runner smoke API case"
                )),
                Map.of(
                        "durationMs", 12,
                        "reportData", Map.of(
                                "request", Map.of("method", "GET", "url", "http://127.0.0.1/api/auth/me"),
                                "response", Map.of("status", 200, "body", "{}"),
                                "assertions", List.of()
                        )
                )
        ));

        ArgumentCaptor<TaskEntity> taskCaptor = ArgumentCaptor.forClass(TaskEntity.class);
        ArgumentCaptor<ReportEntity> reportCaptor = ArgumentCaptor.forClass(ReportEntity.class);
        ArgumentCaptor<ApiRunStepResultEntity> stepCaptor = ArgumentCaptor.forClass(ApiRunStepResultEntity.class);

        verify(taskMapper).insert(taskCaptor.capture());
        verify(reportMapper).insert(reportCaptor.capture());
        verify(stepMapper).insert(stepCaptor.capture());
        verify(caseHistoryMapper, never()).insert(org.mockito.ArgumentMatchers.any(ApiDefinitionCaseRunHistoryEntity.class));
        verify(caseMapper, never()).updateById(org.mockito.ArgumentMatchers.any(ApiDefinitionCaseEntity.class));

        assertThat(taskCaptor.getValue().getWorkspaceId()).isEqualTo(7L);
        assertThat(reportCaptor.getValue().getWorkspaceId()).isEqualTo(7L);
        assertThat(stepCaptor.getValue().getWorkspaceId()).isEqualTo(7L);
        assertThat(reportCaptor.getValue().getLogText()).contains("debug-api-case-001", "LOCAL_RUNNER");
    }
}
