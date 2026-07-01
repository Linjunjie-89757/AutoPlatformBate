package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskEntity;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.runner.LocalRunnerController;
import com.company.autoplatform.runner.LocalRunnerNodeEntity;
import com.company.autoplatform.runner.LocalRunnerNodeMapper;
import com.company.autoplatform.runner.LocalRunnerService;
import com.company.autoplatform.runner.LocalRunnerTaskEntity;
import com.company.autoplatform.runner.LocalRunnerTaskFinalResultEvent;
import com.company.autoplatform.runner.LocalRunnerTaskLogMapper;
import com.company.autoplatform.runner.LocalRunnerTaskMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import static com.company.autoplatform.runner.LocalRunnerModels.PullRunnerTaskRequest;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerFinalResultReport;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerRegisterRequest;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskStatusReport;
import static com.company.autoplatform.runner.LocalRunnerModels.Progress;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings({"rawtypes", "unchecked"})
class ApiLocalRunnerBackendSmokeTests {

    @Test
    void apiCaseLocalRunnerTaskPollAndFinalReportFlowPersistsFormalReport() {
        ObjectMapper objectMapper = new ObjectMapper();
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskMapper localTaskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerTaskLogMapper localTaskLogMapper = mock(LocalRunnerTaskLogMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        AtomicReference<LocalRunnerNodeEntity> runnerStore = new AtomicReference<>();
        List<LocalRunnerTaskEntity> localTasks = new ArrayList<>();

        when(nodeMapper.selectOne(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> runnerStore.get());
        doAnswer(invocation -> {
            LocalRunnerNodeEntity runner = invocation.getArgument(0);
            runner.setId(101L);
            runnerStore.set(runner);
            return 1;
        }).when(nodeMapper).insert(any(LocalRunnerNodeEntity.class));
        doAnswer(invocation -> {
            runnerStore.set(invocation.getArgument(0));
            return 1;
        }).when(nodeMapper).updateById(any(LocalRunnerNodeEntity.class));

        when(localTaskMapper.selectOne(any(LambdaQueryWrapper.class))).thenAnswer(invocation ->
                localTasks.isEmpty() ? null : localTasks.get(0)
        );
        when(localTaskMapper.selectList(any(LambdaQueryWrapper.class))).thenAnswer(invocation -> new ArrayList<>(localTasks));
        doAnswer(invocation -> {
            LocalRunnerTaskEntity task = invocation.getArgument(0);
            task.setId(501L);
            localTasks.add(task);
            return 1;
        }).when(localTaskMapper).insert(any(LocalRunnerTaskEntity.class));

        LocalRunnerService localRunnerService = new LocalRunnerService(
                nodeMapper,
                localTaskMapper,
                localTaskLogMapper,
                objectMapper,
                eventPublisher
        );
        LocalRunnerController controller = new LocalRunnerController(localRunnerService);

        var registerResponse = controller.register(new RunnerRegisterRequest(
                "install-api-smoke",
                null,
                "0.1.0",
                "1.0",
                Map.of("deviceName", "local-api-smoke"),
                List.of("API_CASE_RUN")
        ));
        String runnerId = registerResponse.data().runnerId();
        String runnerToken = registerResponse.data().runnerToken();

        localRunnerService.createTask(new CreateRunnerTaskCommand(
                7L,
                "risk-ops",
                "run_api_case_backend_smoke",
                "API_CASE_RUN",
                "LOCAL_RUNNER",
                null,
                "11",
                "1.0",
                "MANUAL",
                1,
                null,
                Map.of("requestTimeoutMs", 5000),
                Map.of("baseUrl", "http://127.0.0.1:18080"),
                Map.of("token", "abc"),
                Map.of(),
                List.of(Map.of(
                        "fileId", "contract-file",
                        "fileName", "contract.txt",
                        "contentBase64", "Y29udHJhY3Q="
                )),
                List.of(),
                Map.of(),
                Map.of("apiCaseSnapshot", Map.of(
                        "caseId", 2001L,
                        "caseName", "Upload contract",
                        "request", Map.of(
                                "method", "POST",
                                "url", "http://127.0.0.1:18080/contracts"
                        )
                ))
        ));

        var pullResponse = controller.pullTask(new PullRunnerTaskRequest(
                runnerId,
                runnerToken,
                "0.1.0",
                "1.0",
                List.of("API_CASE_RUN"),
                List.of("risk-ops"),
                Map.of("maxSlots", 1, "usedSlots", 0),
                List.of()
        ));

        assertThat(pullResponse.data().hasTask()).isTrue();
        assertThat(pullResponse.data().task().runId()).isEqualTo("run_api_case_backend_smoke");
        assertThat(pullResponse.data().task().artifactRefs()).hasSize(1);
        Map<String, Object> artifactRef = pullResponse.data().task().artifactRefs().get(0);
        assertThat(artifactRef)
                .containsEntry("fileId", "contract-file")
                .containsEntry("contentBase64", "Y29udHJhY3Q=");
        assertThat(localTasks.get(0).getStatus()).isEqualTo("ASSIGNED");
        assertThat(localTasks.get(0).getRunnerId()).isEqualTo(runnerId);

        String executionToken = pullResponse.data().task().executionToken();
        controller.reportStatus("run_api_case_backend_smoke", new RunnerTaskStatusReport(
                runnerId,
                executionToken,
                "RUNNING",
                "REQUEST",
                new Progress(1, 1, 50),
                "running API case",
                LocalDateTime.now()
        ));
        assertThat(localTasks.get(0).getStatus()).isEqualTo("RUNNING");
        assertThat(localTasks.get(0).getStartedAt()).isNotNull();

        controller.reportFinalResult("run_api_case_backend_smoke", new RunnerFinalResultReport(
                runnerId,
                executionToken,
                "SUCCESS",
                localTasks.get(0).getStartedAt(),
                LocalDateTime.now(),
                123L,
                Map.of("statusCode", 201),
                null,
                Map.of(
                        "request", Map.of(
                                "method", "POST",
                                "url", "http://127.0.0.1:18080/contracts",
                                "headers", Map.of("authorization", "Bearer abc")
                        ),
                        "response", Map.of(
                                "status", 201,
                                "headers", Map.of("content-type", "application/json"),
                                "body", "{\"id\":\"C-100\"}"
                        ),
                        "assertions", List.of(Map.of(
                                "assertionId", "status",
                                "type", "STATUS_CODE",
                                "expected", "201",
                                "actual", "201",
                                "status", "PASSED"
                        )),
                        "extractedVariables", Map.of("CONTRACT_ID", "C-100")
                )
        ));

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(LocalRunnerTaskFinalResultEvent.class);
        LocalRunnerTaskFinalResultEvent event = (LocalRunnerTaskFinalResultEvent) eventCaptor.getValue();
        assertThat(event.runId()).isEqualTo("run_api_case_backend_smoke");
        assertThat(event.taskType()).isEqualTo("API_CASE_RUN");
        assertThat(event.payload()).containsKey("apiCaseSnapshot");
        assertThat(event.result()).containsEntry("durationMs", 123L);

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
        apiCase.setCaseName("Upload contract");
        when(caseMapper.selectById(2001L)).thenReturn(apiCase);
        doAnswer(invocation -> {
            TaskEntity task = invocation.getArgument(0);
            task.setId(9001L);
            return 1;
        }).when(taskMapper).insert(any(TaskEntity.class));
        doAnswer(invocation -> {
            ReportEntity report = invocation.getArgument(0);
            report.setId(9101L);
            return 1;
        }).when(reportMapper).insert(any(ReportEntity.class));

        ApiLocalRunnerReportService reportService = new ApiLocalRunnerReportService(
                taskMapper,
                reportMapper,
                stepMapper,
                caseMapper,
                caseHistoryMapper,
                scenarioMapper,
                scenarioHistoryMapper
        );
        reportService.handleLocalRunnerTaskFinalResult(event);

        ArgumentCaptor<ReportEntity> reportCaptor = ArgumentCaptor.forClass(ReportEntity.class);
        ArgumentCaptor<ApiRunStepResultEntity> stepCaptor = ArgumentCaptor.forClass(ApiRunStepResultEntity.class);
        ArgumentCaptor<ApiDefinitionCaseRunHistoryEntity> historyCaptor = ArgumentCaptor.forClass(ApiDefinitionCaseRunHistoryEntity.class);
        verify(reportMapper).insert(reportCaptor.capture());
        verify(stepMapper).insert(stepCaptor.capture());
        verify(caseHistoryMapper).insert(historyCaptor.capture());

        assertThat(reportCaptor.getValue().getLogSource()).isEqualTo("API_LOCAL_RUNNER");
        assertThat(reportCaptor.getValue().getLogText()).contains("LOCAL_RUNNER", "run_api_case_backend_smoke");
        assertThat(stepCaptor.getValue().getReportId()).isEqualTo(9101L);
        assertThat(stepCaptor.getValue().getStepName()).isEqualTo("Upload contract");
        assertThat(stepCaptor.getValue().getResponseSnapshotJson()).contains("\"statusCode\":201");
        assertThat(stepCaptor.getValue().getExtractionResultsJson()).contains("\"name\":\"CONTRACT_ID\"", "\"value\":\"C-100\"");
        assertThat(historyCaptor.getValue().getCaseId()).isEqualTo(2001L);
        assertThat(historyCaptor.getValue().getRunResult()).isEqualTo("SUCCESS");
        assertThat(apiCase.getLastRunResult()).isEqualTo("SUCCESS");
    }
}
