package com.company.autoplatform.apiautomation;

import com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import com.company.autoplatform.runner.LocalRunnerService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiRunRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiExecutionSuiteDomainServiceLocalRunnerTests {

    @Test
    void runSuiteCreatesApiSuiteRunnerTaskWhenRunOnLocal() {
        ApiExecutionSuiteModuleMapper suiteModuleMapper = mock(ApiExecutionSuiteModuleMapper.class);
        ApiExecutionSuiteMapper suiteMapper = mock(ApiExecutionSuiteMapper.class);
        ApiExecutionSuiteItemMapper suiteItemMapper = mock(ApiExecutionSuiteItemMapper.class);
        ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper = mock(ApiExecutionSuiteRunHistoryMapper.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiScenarioMapper scenarioMapper = mock(ApiScenarioMapper.class);
        ApiDataFileDomainService dataFileDomainService = mock(ApiDataFileDomainService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<ApiExecutionDomainService> executionDomainServiceProvider = mock(ObjectProvider.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        ApiWorkspaceScopeSupport workspaceScopeSupport = mock(ApiWorkspaceScopeSupport.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);

        ApiExecutionSuiteEntity suite = new ApiExecutionSuiteEntity();
        suite.setId(8001L);
        suite.setWorkspaceId(7L);
        suite.setSuiteName("Local smoke suite");
        suite.setEnvironmentId(21L);
        suite.setVariableSetId(31L);
        suite.setRunMode("SERIAL");
        suite.setRunOn("LOCAL");
        suite.setContinueOnFailure(false);
        suite.setGlobalTimeoutMs(120000);
        suite.setStepFailureRetryCount(1);
        suite.setDefaultStepWaitMs(0);

        ApiExecutionSuiteItemEntity apiCaseItem = new ApiExecutionSuiteItemEntity();
        apiCaseItem.setId(1L);
        apiCaseItem.setSuiteId(8001L);
        apiCaseItem.setItemType("API_CASE");
        apiCaseItem.setItemId(2001L);
        apiCaseItem.setItemNameSnapshot("Create order");
        apiCaseItem.setSortOrder(10);
        apiCaseItem.setEnabled(true);

        ApiExecutionSuiteItemEntity scenarioItem = new ApiExecutionSuiteItemEntity();
        scenarioItem.setId(2L);
        scenarioItem.setSuiteId(8001L);
        scenarioItem.setItemType("SCENARIO");
        scenarioItem.setItemId(3001L);
        scenarioItem.setItemNameSnapshot("Pay order");
        scenarioItem.setSortOrder(20);
        scenarioItem.setEnabled(true);

        ApiDefinitionCaseEntity apiCase = new ApiDefinitionCaseEntity();
        apiCase.setId(2001L);
        apiCase.setWorkspaceId(7L);
        apiCase.setDefinitionId(1001L);
        apiCase.setCaseName("Create order");
        apiCase.setRequestJson("""
                {
                  "method": "POST",
                  "path": "/orders",
                  "body": { "type": "RAW_JSON", "rawText": "{\\"name\\":\\"{{NAME}}\\"}" }
                }
                """);

        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3001L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Pay order");
        scenario.setStepsJson("""
                [{
                  "id": "pay-order",
                  "stepName": "Pay order",
                  "stepType": "CUSTOM_REQUEST",
                  "enabled": true,
                  "requestConfig": {
                    "method": "GET",
                    "path": "/orders/{{ORDER_ID}}"
                  }
                }]
                """);

        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(7L);
        workspace.setWorkspaceCode("risk-ops");

        ApiExecutionRuntimeModels.ResolvedEnvironment environment = new ApiExecutionRuntimeModels.ResolvedEnvironment(
                21L,
                "http://127.0.0.1:18080",
                List.of(),
                null,
                30000,
                List.of(),
                31L,
                null,
                null,
                null,
                null,
                null,
                List.of()
        );
        ApiExecutionDomainService executionDomainService = mock(ApiExecutionDomainService.class);
        when(executionDomainServiceProvider.getObject()).thenReturn(executionDomainService);
        when(executionDomainService.buildExecutionContextForSuiteLocalRunner(7L, 21L, 31L, Map.of("NAME", "codex"), null, null, null))
                .thenReturn(new ApiExecutionRuntimeModels.ExecutionContext(
                        environment,
                        Map.of("NAME", "codex"),
                        "{}"
                ));
        when(suiteMapper.selectById(8001L)).thenReturn(suite);
        when(suiteItemMapper.selectList(any())).thenReturn(List.of(apiCaseItem, scenarioItem));
        when(caseMapper.selectById(2001L)).thenReturn(apiCase);
        when(scenarioMapper.selectById(3001L)).thenReturn(scenario);
        when(workspaceService.requireWorkspaceById(7L)).thenReturn(workspace);
        when(workspaceService.requireWritableWorkspace("risk-ops")).thenReturn(workspace);
        when(dataFileDomainService.readDataRows(any(), any())).thenReturn(List.of());
        when(localRunnerService.createDebugTask(any(CreateRunnerTaskCommand.class))).thenReturn(new RunnerTaskDetailResponse(
                "api_suite_8001_001",
                "API_SUITE_RUN",
                null,
                "PENDING",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Map.of()
        ));

        ApiExecutionSuiteDomainService service = new ApiExecutionSuiteDomainService(
                suiteModuleMapper,
                suiteMapper,
                suiteItemMapper,
                suiteRunHistoryMapper,
                caseMapper,
                scenarioMapper,
                dataFileDomainService,
                executionDomainServiceProvider,
                workspaceService,
                workspaceScopeSupport,
                localRunnerService
        );

        var response = service.runSuite(8001L, "risk-ops", new ApiRunRequest(
                "risk-ops",
                21L,
                31L,
                null,
                "MANUAL",
                "LOCAL",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Map.of("NAME", "codex"),
                "runner-api-1"
        ));

        ArgumentCaptor<CreateRunnerTaskCommand> commandCaptor = ArgumentCaptor.forClass(CreateRunnerTaskCommand.class);
        verify(localRunnerService).createDebugTask(commandCaptor.capture());
        CreateRunnerTaskCommand command = commandCaptor.getValue();

        assertThat(response.result()).isEqualTo("PENDING");
        assertThat(response.taskName()).isEqualTo("api_suite_8001_001");
        assertThat(command.taskType()).isEqualTo("API_SUITE_RUN");
        assertThat(command.runnerId()).isEqualTo("runner-api-1");
        assertThat(command.environmentSnapshot()).containsEntry("environmentId", 21L);
        assertThat(command.environmentSnapshot()).containsEntry("baseUrl", "http://127.0.0.1:18080");
        assertThat(command.environmentSnapshot()).containsEntry("timeoutMs", 30000);
        assertThat(command.variableSnapshot()).containsEntry("variables", Map.of("NAME", "codex"));

        @SuppressWarnings("unchecked")
        Map<String, Object> suiteSnapshot = (Map<String, Object>) command.payload().get("suiteSnapshot");
        assertThat(suiteSnapshot).containsEntry("suiteId", 8001L);
        assertThat(suiteSnapshot).containsEntry("suiteName", "Local smoke suite");
        assertThat((List<?>) suiteSnapshot.get("items")).hasSize(2);

        @SuppressWarnings("unchecked")
        Map<String, Object> runOptions = (Map<String, Object>) command.payload().get("runOptions");
        assertThat(runOptions).containsEntry("stopOnFirstFailure", true);
        assertThat(runOptions).containsEntry("formalReport", true);
    }
}
