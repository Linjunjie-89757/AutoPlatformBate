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
                Map.of(),
                List.of()
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
        assertApiLocalRunnerMaskingRules(command);
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

    @Test
    void runSuiteCollectsFormDataArtifactRefsForLocalRunner() {
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
        suite.setId(8002L);
        suite.setWorkspaceId(7L);
        suite.setSuiteName("Local upload suite");
        suite.setEnvironmentId(21L);
        suite.setVariableSetId(31L);
        suite.setRunMode("SERIAL");
        suite.setRunOn("LOCAL");
        suite.setContinueOnFailure(false);
        suite.setGlobalTimeoutMs(120000);
        suite.setStepFailureRetryCount(0);
        suite.setDefaultStepWaitMs(0);

        ApiExecutionSuiteItemEntity apiCaseItem = new ApiExecutionSuiteItemEntity();
        apiCaseItem.setId(11L);
        apiCaseItem.setSuiteId(8002L);
        apiCaseItem.setItemType("API_CASE");
        apiCaseItem.setItemId(2002L);
        apiCaseItem.setItemNameSnapshot("Upload contract");
        apiCaseItem.setSortOrder(10);
        apiCaseItem.setEnabled(true);

        ApiExecutionSuiteItemEntity scenarioItem = new ApiExecutionSuiteItemEntity();
        scenarioItem.setId(12L);
        scenarioItem.setSuiteId(8002L);
        scenarioItem.setItemType("SCENARIO");
        scenarioItem.setItemId(3002L);
        scenarioItem.setItemNameSnapshot("Upload avatar");
        scenarioItem.setSortOrder(20);
        scenarioItem.setEnabled(true);

        ApiDefinitionCaseEntity apiCase = new ApiDefinitionCaseEntity();
        apiCase.setId(2002L);
        apiCase.setWorkspaceId(7L);
        apiCase.setDefinitionId(1002L);
        apiCase.setCaseName("Upload contract");
        apiCase.setRequestJson("""
                {
                  "method": "POST",
                  "path": "/contracts",
                  "body": {
                    "type": "FORM_DATA",
                    "formItems": [
                      {"key": "name", "value": "contract", "enabled": true},
                      {
                        "key": "file",
                        "value": "contract.txt",
                        "enabled": true,
                        "paramType": "file",
                        "fileName": "contract.txt",
                        "contentType": "text/plain",
                        "fileBase64": "Y29udHJhY3Q="
                      }
                    ]
                  }
                }
                """);

        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3002L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Upload avatar");
        scenario.setContinueOnFailure(false);
        scenario.setStepsJson("""
                [{
                  "id": "upload-avatar-step",
                  "stepName": "Upload avatar",
                  "stepType": "CUSTOM_REQUEST",
                  "enabled": true,
                  "requestConfig": {
                    "method": "POST",
                    "path": "/avatars",
                    "body": {
                      "type": "FORM_DATA",
                      "formItems": [
                        {"key": "description", "value": "avatar", "enabled": true},
                        {
                          "key": "avatar",
                          "enabled": true,
                          "fileName": "avatar.txt",
                          "contentType": "text/plain",
                          "fileBase64": "YXZhdGFy"
                        }
                      ]
                    }
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
        when(executionDomainService.buildExecutionContextForSuiteLocalRunner(7L, 21L, 31L, null, null, null, null))
                .thenReturn(new ApiExecutionRuntimeModels.ExecutionContext(
                        environment,
                        Map.of(),
                        "{}"
                ));
        when(suiteMapper.selectById(8002L)).thenReturn(suite);
        when(suiteItemMapper.selectList(any())).thenReturn(List.of(apiCaseItem, scenarioItem));
        when(caseMapper.selectById(2002L)).thenReturn(apiCase);
        when(scenarioMapper.selectById(3002L)).thenReturn(scenario);
        when(workspaceService.requireWorkspaceById(7L)).thenReturn(workspace);
        when(workspaceService.requireWritableWorkspace("risk-ops")).thenReturn(workspace);
        when(dataFileDomainService.readDataRows(any(), any())).thenReturn(List.of());
        when(localRunnerService.createDebugTask(any(CreateRunnerTaskCommand.class))).thenReturn(new RunnerTaskDetailResponse(
                "api_suite_8002_001",
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
                Map.of(),
                List.of()
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

        service.runSuite(8002L, "risk-ops", new ApiRunRequest(
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
                null,
                "runner-api-1"
        ));

        ArgumentCaptor<CreateRunnerTaskCommand> commandCaptor = ArgumentCaptor.forClass(CreateRunnerTaskCommand.class);
        verify(localRunnerService).createDebugTask(commandCaptor.capture());
        CreateRunnerTaskCommand command = commandCaptor.getValue();

        assertThat(command.taskType()).isEqualTo("API_SUITE_RUN");
        assertThat(command.artifactRefs()).hasSize(2)
                .anySatisfy(artifact -> {
                    assertThat(artifact).containsEntry("fileName", "contract.txt");
                    assertThat(artifact).containsEntry("contentType", "text/plain");
                    assertThat(artifact).containsEntry("contentBase64", "Y29udHJhY3Q=");
                })
                .anySatisfy(artifact -> {
                    assertThat(artifact).containsEntry("fileName", "avatar.txt");
                    assertThat(artifact).containsEntry("contentType", "text/plain");
                    assertThat(artifact).containsEntry("contentBase64", "YXZhdGFy");
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> suiteSnapshot = (Map<String, Object>) command.payload().get("suiteSnapshot");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) suiteSnapshot.get("items");
        @SuppressWarnings("unchecked")
        Map<String, Object> caseSnapshot = (Map<String, Object>) items.get(0).get("caseSnapshot");
        @SuppressWarnings("unchecked")
        Map<String, Object> caseRequest = (Map<String, Object>) caseSnapshot.get("request");
        @SuppressWarnings("unchecked")
        Map<String, Object> caseBody = (Map<String, Object>) caseRequest.get("body");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> caseFormItems = (List<Map<String, Object>>) caseBody.get("formItems");
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioSnapshot = (Map<String, Object>) items.get(1).get("scenarioSnapshot");
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioStep = (Map<String, Object>) ((List<?>) scenarioSnapshot.get("steps")).get(0);
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioCaseSnapshot = (Map<String, Object>) scenarioStep.get("caseSnapshot");
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioRequest = (Map<String, Object>) scenarioCaseSnapshot.get("request");
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioBody = (Map<String, Object>) scenarioRequest.get("body");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scenarioFormItems = (List<Map<String, Object>>) scenarioBody.get("formItems");

        assertThat(caseBody).containsEntry("type", "FORM_DATA");
        assertThat(caseFormItems).extracting(item -> item.get("value"))
                .contains("contract")
                .anySatisfy(value -> assertThat(String.valueOf(value)).startsWith("artifact:"));
        assertThat(scenarioBody).containsEntry("type", "FORM_DATA");
        assertThat(scenarioFormItems).extracting(item -> item.get("value"))
                .contains("avatar")
                .anySatisfy(value -> assertThat(String.valueOf(value)).startsWith("artifact:"));
    }

    private static void assertApiLocalRunnerMaskingRules(CreateRunnerTaskCommand command) {
        assertThat(command.maskingRules()).isNotEmpty()
                .anySatisfy(rule -> {
                    assertThat(rule).containsEntry("type", "FIELD_NAME");
                    assertThat(rule).containsEntry("pattern", "authorization");
                })
                .anySatisfy(rule -> {
                    assertThat(rule).containsEntry("type", "FIELD_NAME");
                    assertThat(rule).containsEntry("pattern", "cookie");
                })
                .anySatisfy(rule -> {
                    assertThat(rule).containsEntry("type", "REGEX");
                    assertThat(String.valueOf(rule.get("pattern"))).contains("password", "token");
                });
    }
}
