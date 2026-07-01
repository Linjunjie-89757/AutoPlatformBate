package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import com.company.autoplatform.runner.LocalRunnerService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;

@Service
public class ApiExecutionDomainService {

    private static final int MAX_SCENARIO_LOOP_COUNT = 999;
    private static final int MAX_SCENARIO_THREAD_COUNT = 10;

    private final ApiExecutionEngineSupport executionEngine;
    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiScenarioRunHistoryMapper scenarioRunHistoryMapper;
    private final ApiDataFileDomainService dataFileDomainService;
    private final ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final LocalRunnerService localRunnerService;

    public ApiExecutionDomainService(
            ApiExecutionEngineSupport executionEngine,
            ApiDefinitionCaseMapper caseMapper,
            ApiScenarioRunHistoryMapper scenarioRunHistoryMapper,
            ApiDataFileDomainService dataFileDomainService,
            ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            LocalRunnerService localRunnerService
    ) {
        this.executionEngine = executionEngine;
        this.caseMapper = caseMapper;
        this.scenarioRunHistoryMapper = scenarioRunHistoryMapper;
        this.dataFileDomainService = dataFileDomainService;
        this.scenarioTestDatasetDomainService = scenarioTestDatasetDomainService;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.localRunnerService = localRunnerService;
    }

    public ApiRunResponse debugRunDefinition(Long id, String workspaceCode, ApiRunRequest request) {
        ApiDefinitionEntity definition = executionEngine.requireDefinition(id);
        workspaceScopeSupport.validateReadable(definition.getWorkspaceId(), workspaceCode, "Current workspace cannot run the definition");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(definition.getWorkspaceId()).getWorkspaceCode());

        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(definition.getWorkspaceId(), request.environmentId(), request.variableSetId(), request.rowVariables(), request.mockApplicationId(), request.mockEnabled(), request.mockBusinessScenarioId());
        ApiExecutionRuntimeModels.RunEnvelope envelope = executionEngine.createRunEnvelope(definition.getWorkspaceId(), "API", "接口调试", definition.getDefinitionName());
        ApiExecutionRuntimeModels.RunStepComputation step = executionEngine.executeDefinition(definition, definition.getDefinitionName(), 1, context.variables(), context.environment());
        executionEngine.persistStep(envelope.report(), definition.getWorkspaceId(), step);
        executionEngine.finalizeRunDefinition(definition, step.success(), envelope.task(), envelope.report(), step);
        return new ApiRunResponse(
                envelope.task().getId(),
                envelope.report().getId(),
                envelope.task().getTaskName(),
                envelope.report().getReportName(),
                envelope.report().getResult(),
                envelope.report().getFailureSummary(),
                List.of(),
                List.of(step.response())
        );
    }

    public ApiRunResponse runCase(Long id, String workspaceCode, ApiRunRequest request) {
        ApiDefinitionCaseEntity apiCase = executionEngine.requireCase(id);
        workspaceScopeSupport.validateReadable(apiCase.getWorkspaceId(), workspaceCode, "Current workspace cannot run the case");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(apiCase.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        if (isLocalRunnerRun(request.runOn())) {
            return createLocalRunnerCaseRun(apiCase, workspace, request);
        }

        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(apiCase.getWorkspaceId(), request.environmentId(), request.variableSetId(), request.rowVariables(), request.mockApplicationId(), request.mockEnabled(), request.mockBusinessScenarioId());
        ApiExecutionRuntimeModels.RunEnvelope envelope = executionEngine.createRunEnvelope(apiCase.getWorkspaceId(), "API", "接口用例调试", apiCase.getCaseName());
        ApiExecutionRuntimeModels.RunStepComputation step = executionEngine.executeCase(apiCase, apiCase.getCaseName(), 1, context.variables(), context.environment());
        executionEngine.persistStep(envelope.report(), apiCase.getWorkspaceId(), step);
        executionEngine.finalizeRunCase(apiCase, step.success(), envelope.task(), envelope.report(), step);
        executionEngine.persistCaseRunHistory(
                apiCase,
                envelope.report(),
                step,
                request.environmentId(),
                request.variableSetId(),
                context.contextSnapshotJson()
        );
        return new ApiRunResponse(
                envelope.task().getId(),
                envelope.report().getId(),
                envelope.task().getTaskName(),
                envelope.report().getReportName(),
                envelope.report().getResult(),
                envelope.report().getFailureSummary(),
                List.of(),
                List.of(step.response())
        );
    }

    private ApiRunResponse createLocalRunnerCaseRun(
            ApiDefinitionCaseEntity apiCase,
            WorkspaceEntity workspace,
            ApiRunRequest request
    ) {
        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(
                apiCase.getWorkspaceId(),
                request.environmentId(),
                request.variableSetId(),
                request.rowVariables(),
                request.mockApplicationId(),
                request.mockEnabled(),
                request.mockBusinessScenarioId()
        );
        ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector = ApiLocalRunnerPayloadSupport.artifactCollector();
        Map<String, Object> payload = buildApiLocalRunnerCasePayload(apiCase, artifactCollector);

        RunnerTaskDetailResponse task = localRunnerService.createDebugTask(new CreateRunnerTaskCommand(
                apiCase.getWorkspaceId(),
                workspace.getWorkspaceCode(),
                "api_case_" + apiCase.getId() + "_" + System.currentTimeMillis(),
                "API_CASE_RUN",
                "LOCAL_RUNNER",
                request.runnerId(),
                null,
                "1.0",
                "MANUAL",
                1,
                null,
                buildApiLocalRunnerCaseTimeoutPolicy(context.environment()),
                buildApiLocalRunnerEnvironmentSnapshot(request.environmentId(), context.environment()),
                buildApiLocalRunnerVariableSnapshot(request.variableSetId(), context.variables()),
                Map.of(),
                artifactCollector.artifactRefs(),
                List.of(),
                Map.of(),
                payload
        ));

        return new ApiRunResponse(
                null,
                null,
                task == null ? null : task.runId(),
                null,
                "PENDING",
                "Local Runner task created",
                List.of(),
                List.of()
        );
    }

    String buildExecutionContextSnapshot(Long workspaceId, Long environmentId, Long variableSetId, Long mockApplicationId, Boolean mockEnabled) {
        return executionEngine.buildExecutionContext(workspaceId, environmentId, variableSetId, null, mockApplicationId, mockEnabled, null).contextSnapshotJson();
    }

    public ApiRunResponse debugRunDefinitionDraft(String workspaceCode, ApiDebugDefinitionRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWorkspace(
                blankToFallback(request.workspaceCode(), workspaceCode)
        );
        workspaceScopeSupport.validateReadable(workspace.getId(), workspaceCode, "Current workspace cannot run the definition");
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        if (request.definitionId() != null) {
            ApiDefinitionEntity definition = executionEngine.requireDefinition(request.definitionId());
            if (!definition.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Definition does not belong to the selected workspace");
            }
        }

        ApiRequestConfigInput config = request.requestConfig();
        String method = Optional.ofNullable(config.method()).orElse("").trim().toUpperCase();
        String path = Optional.ofNullable(config.path()).orElse("").trim();
        if (method.isEmpty()) {
            throw new BadRequestException("HTTP method cannot be blank");
        }
        if (path.isEmpty()) {
            throw new BadRequestException("Path cannot be blank");
        }

        ApiDefinitionEntity draftDefinition = new ApiDefinitionEntity();
        draftDefinition.setId(request.definitionId());
        draftDefinition.setWorkspaceId(workspace.getId());
        draftDefinition.setDefinitionName(blankToFallback(request.name(), method + " " + path));
        draftDefinition.setHttpMethod(method);
        draftDefinition.setPath(path);
        draftDefinition.setRequestJson(ApiAutomationJsonSupport.toJson(config, "Failed to serialize request config"));
        draftDefinition.setAssertionsJson(ApiAutomationJsonSupport.toJson(defaultList(request.assertions()), "Failed to serialize assertions"));
        draftDefinition.setExtractorsJson(ApiAutomationJsonSupport.toJson(defaultList(request.extractors()), "Failed to serialize extractors"));
        draftDefinition.setPreprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.preProcessors(), "PRE"),
                "Failed to serialize pre-processors"));
        draftDefinition.setPostprocessorsJson(ApiAutomationJsonSupport.toJson(normalizePostProcessors(request.postProcessors(), request.extractors()),
                "Failed to serialize post-processors"));

        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(workspace.getId(), request.environmentId(), request.variableSetId(), null, request.mockApplicationId(), request.mockEnabled(), request.mockBusinessScenarioId());
        ApiExecutionRuntimeModels.RunEnvelope envelope = executionEngine.createRunEnvelope(workspace.getId(), "API", "接口调试", draftDefinition.getDefinitionName());
        ApiExecutionRuntimeModels.RunStepComputation step = executionEngine.executeDefinition(draftDefinition, draftDefinition.getDefinitionName(), 1, context.variables(), context.environment());
        executionEngine.persistStep(envelope.report(), workspace.getId(), step);
        executionEngine.finalizeRunTaskAndReport(
                envelope.task(),
                envelope.report(),
                step.success() ? "SUCCESS" : "FAILED",
                step.response().errorMessage()
        );
        return new ApiRunResponse(
                envelope.task().getId(),
                envelope.report().getId(),
                envelope.task().getTaskName(),
                envelope.report().getReportName(),
                envelope.report().getResult(),
                envelope.report().getFailureSummary(),
                List.of(),
                List.of(step.response())
        );
    }

    public ApiRunResponse debugRunCaseDraft(String workspaceCode, ApiDebugCaseRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWorkspace(
                blankToFallback(request.workspaceCode(), workspaceCode)
        );
        workspaceScopeSupport.validateReadable(workspace.getId(), workspaceCode, "Current workspace cannot run the case");
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        ApiDefinitionCaseEntity persistedCase = null;
        if (request.caseId() != null) {
            persistedCase = executionEngine.requireCase(request.caseId());
            if (!persistedCase.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Case does not belong to the selected workspace");
            }
        }
        if (request.definitionId() == null) {
            throw new BadRequestException("Definition id cannot be blank");
        }
        ApiDefinitionEntity definition = executionEngine.requireDefinition(request.definitionId());
        if (!definition.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Definition does not belong to the selected workspace");
        }

        ApiRequestConfigInput config = request.requestConfig();
        String method = Optional.ofNullable(config.method()).orElse("").trim().toUpperCase();
        String path = Optional.ofNullable(config.path()).orElse("").trim();
        if (method.isEmpty() || path.isEmpty()) {
            throw new BadRequestException("Method and path cannot be blank");
        }

        ApiDefinitionCaseEntity draftCase = new ApiDefinitionCaseEntity();
        draftCase.setWorkspaceId(workspace.getId());
        draftCase.setDefinitionId(definition.getId());
        draftCase.setCaseName(blankToFallback(request.name(), "Unnamed case"));
        draftCase.setRequestJson(ApiAutomationJsonSupport.toJson(request.requestConfig(), "Failed to serialize case request"));
        draftCase.setAssertionsJson(ApiAutomationJsonSupport.toJson(defaultList(request.assertions()), "Failed to serialize case assertions"));
        draftCase.setPreprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.preProcessors(), "PRE"),
                "Failed to serialize case preprocessors"));
        draftCase.setPostprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.postProcessors(), "POST"),
                "Failed to serialize case postprocessors"));

        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(workspace.getId(), request.environmentId(), request.variableSetId(), null, request.mockApplicationId(), request.mockEnabled(), request.mockBusinessScenarioId());
        ApiExecutionRuntimeModels.RunEnvelope envelope = executionEngine.createRunEnvelope(workspace.getId(), "API", "接口用例调试", draftCase.getCaseName());
        ApiExecutionRuntimeModels.RunStepComputation step = executionEngine.executeCase(draftCase, draftCase.getCaseName(), 1, context.variables(), context.environment());
        executionEngine.persistStep(envelope.report(), workspace.getId(), step);
        executionEngine.finalizeRunTaskAndReport(
                envelope.task(),
                envelope.report(),
                step.success() ? "SUCCESS" : "FAILED",
                step.response().errorMessage()
        );
        if (persistedCase != null) {
            persistedCase.setLastRunResult(step.success() ? "SUCCESS" : "FAILED");
            persistedCase.setLastRunAt(LocalDateTime.now());
            persistedCase.setUpdatedAt(LocalDateTime.now());
            caseMapper.updateById(persistedCase);
            executionEngine.persistCaseRunHistory(
                    persistedCase,
                    envelope.report(),
                    step,
                    request.environmentId(),
                    request.variableSetId(),
                    context.contextSnapshotJson()
            );
        }
        return new ApiRunResponse(
                envelope.task().getId(),
                envelope.report().getId(),
                envelope.task().getTaskName(),
                envelope.report().getReportName(),
                envelope.report().getResult(),
                envelope.report().getFailureSummary(),
                List.of(),
                List.of(step.response())
        );
    }

    public ApiRunResponse runScenario(Long id, String workspaceCode, ApiRunRequest request) {
        ApiScenarioEntity scenario = executionEngine.requireScenario(id);
        workspaceScopeSupport.validateReadable(scenario.getWorkspaceId(), workspaceCode, "Current workspace cannot run the scenario");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(scenario.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        if (isLocalRunnerRun(request.runOn())) {
            return createLocalRunnerScenarioRun(scenario, workspace, request);
        }

        List<ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow> datasetRows = List.of();
        if (request.testDatasetId() != null) {
            datasetRows = scenarioTestDatasetDomainService.readDatasetRows(scenario.getId(), scenario.getWorkspaceId(), request.testDatasetId());
        } else if (request.testDatasetEnabled() == null && scenario.getDataFileId() == null) {
            datasetRows = scenarioTestDatasetDomainService.readEnabledDatasetRows(scenario.getId(), scenario.getWorkspaceId());
        }
        if (!datasetRows.isEmpty()) {
            return runScenarioWithDatasetRows(scenario, request, datasetRows);
        }
        if (Boolean.TRUE.equals(scenario.getDataDrivenEnabled())) {
            return runScenarioWithDataRows(scenario, request);
        }
        return runScenarioWithPlans(scenario, request, List.of(new ScenarioRunPlan(1, 1, null, null)), true);
    }

    ApiRunResponse runScenarioAsSuiteItem(Long id, String workspaceCode, ApiRunRequest request) {
        ApiScenarioEntity scenario = executionEngine.requireScenario(id);
        workspaceScopeSupport.validateReadable(scenario.getWorkspaceId(), workspaceCode, "Current workspace cannot run the scenario");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(scenario.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        if (isLocalRunnerRun(request.runOn())) {
            return createLocalRunnerScenarioRun(scenario, workspace, request);
        }

        List<ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow> datasetRows = List.of();
        if (request.testDatasetId() != null) {
            datasetRows = scenarioTestDatasetDomainService.readDatasetRows(scenario.getId(), scenario.getWorkspaceId(), request.testDatasetId());
        } else if (request.testDatasetEnabled() == null && scenario.getDataFileId() == null) {
            datasetRows = scenarioTestDatasetDomainService.readEnabledDatasetRows(scenario.getId(), scenario.getWorkspaceId());
        }
        if (!datasetRows.isEmpty()) {
            return runScenarioWithPlans(scenario, request, buildDatasetRunPlans(request, datasetRows), false);
        }
        if (Boolean.TRUE.equals(scenario.getDataDrivenEnabled())) {
            if (scenario.getDataFileId() == null) {
                throw new BadRequestException("Scenario data file is not configured");
            }
            List<ApiDataFileDomainService.ApiDataFileRuntimeRow> rows = dataFileDomainService.readDataRows(scenario.getDataFileId(), scenario.getWorkspaceId());
            if (rows.isEmpty()) {
                throw new BadRequestException("Scenario data file has no data rows");
            }
            return runScenarioWithPlans(scenario, request, buildDataFileRunPlans(request, rows), false);
        }
        return runScenarioWithPlans(scenario, request, List.of(new ScenarioRunPlan(1, 1, null, null)), false);
    }

    private ApiRunResponse runScenarioWithDatasetRows(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            List<ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow> rows
    ) {
        if (rows.isEmpty()) {
            throw new BadRequestException("Scenario test dataset has no data rows");
        }
        return runScenarioWithPlans(scenario, request, buildDatasetRunPlans(request, rows), true);
    }

    private ApiRunResponse runScenarioWithDataRows(ApiScenarioEntity scenario, ApiRunRequest request) {
        if (scenario.getDataFileId() == null) {
            throw new BadRequestException("Scenario data file is not configured");
        }
        List<ApiDataFileDomainService.ApiDataFileRuntimeRow> rows = dataFileDomainService.readDataRows(scenario.getDataFileId(), scenario.getWorkspaceId());
        if (rows.isEmpty()) {
            throw new BadRequestException("Scenario data file has no data rows");
        }
        return runScenarioWithPlans(scenario, request, buildDataFileRunPlans(request, rows), true);
    }

    private List<ScenarioRunPlan> buildDatasetRunPlans(
            ApiRunRequest request,
            List<ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow> rows
    ) {
        List<ScenarioRunPlan> plans = new ArrayList<>();
        int sequence = 1;
        int loopCount = normalizeScenarioLoopCount(request.loopCount());
        for (int loopIndex = 1; loopIndex <= loopCount; loopIndex++) {
            for (ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow row : rows) {
                plans.add(new ScenarioRunPlan(sequence++, loopIndex, row, null));
            }
        }
        return plans;
    }

    private List<ScenarioRunPlan> buildDataFileRunPlans(
            ApiRunRequest request,
            List<ApiDataFileDomainService.ApiDataFileRuntimeRow> rows
    ) {
        List<ScenarioRunPlan> plans = new ArrayList<>();
        int sequence = 1;
        int loopCount = normalizeScenarioLoopCount(request.loopCount());
        for (int loopIndex = 1; loopIndex <= loopCount; loopIndex++) {
            for (ApiDataFileDomainService.ApiDataFileRuntimeRow row : rows) {
                plans.add(new ScenarioRunPlan(sequence++, loopIndex, null, row));
            }
        }
        return plans;
    }

    private ApiRunResponse runScenarioWithPlans(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            List<ScenarioRunPlan> plans,
            boolean persistHistory
    ) {
        if (plans.isEmpty()) {
            throw new BadRequestException("Scenario has no run units");
        }
        int threadCount = Math.min(normalizeScenarioThreadCount(request.threadCount()), plans.size());
        List<ScenarioRunPlanResult> results = threadCount <= 1
                ? runScenarioPlansSerial(scenario, request, plans)
                : runScenarioPlansInBatches(scenario, request, plans, threadCount);
        results.sort(Comparator.comparingInt(result -> result.plan().sequence()));

        ScenarioRunAggregate firstAggregate = results.getFirst().aggregate();
        boolean success = results.stream().allMatch(result -> result.aggregate().success());
        String failureSummary = results.stream()
                .filter(result -> !result.aggregate().success())
                .map(result -> describeScenarioPlanFailure(result.plan(), result.aggregate().failureSummary()))
                .findFirst()
                .orElse(null);
        List<ApiRunStepResultResponse> responses = results.stream()
                .flatMap(result -> result.aggregate().stepResults().stream())
                .toList();
        List<ApiExecutionSuiteDataIteration> dataIterations = plans.size() > 1 || plans.getFirst().hasDataRow()
                ? results.stream().map(this::toDataIteration).toList()
                : List.of();

        executionEngine.finalizeRunScenario(scenario, success, failureSummary, firstAggregate.envelope().task(), firstAggregate.envelope().report());
        if (persistHistory) {
            persistScenarioRunHistory(
                    scenario,
                    request,
                    firstAggregate.envelope().report().getId(),
                    success,
                    failureSummary,
                    dataIterations,
                    responses,
                    firstAggregate.contextSnapshotJson()
            );
        }
        return new ApiRunResponse(
                firstAggregate.envelope().task().getId(),
                firstAggregate.envelope().report().getId(),
                firstAggregate.envelope().task().getTaskName(),
                firstAggregate.envelope().report().getReportName(),
                success ? "SUCCESS" : "FAILED",
                failureSummary,
                dataIterations,
                responses
        );
    }

    private List<ScenarioRunPlanResult> runScenarioPlansSerial(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            List<ScenarioRunPlan> plans
    ) {
        List<ScenarioRunPlanResult> results = new ArrayList<>();
        for (ScenarioRunPlan plan : plans) {
            ScenarioRunPlanResult result = executeScenarioRunPlan(scenario, request, plan);
            results.add(result);
            if (!result.aggregate().success() && shouldStopOnScenarioPlanFailure(scenario)) {
                break;
            }
        }
        return results;
    }

    private List<ScenarioRunPlanResult> runScenarioPlansInBatches(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            List<ScenarioRunPlan> plans,
            int threadCount
    ) {
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        try {
            List<ScenarioRunPlanResult> results = new ArrayList<>();
            for (int index = 0; index < plans.size(); index += threadCount) {
                List<Callable<ScenarioRunPlanResult>> tasks = new ArrayList<>();
                for (ScenarioRunPlan plan : plans.subList(index, Math.min(index + threadCount, plans.size()))) {
                    tasks.add(() -> executeScenarioRunPlan(scenario, request, plan));
                }
                try {
                    List<Future<ScenarioRunPlanResult>> futures = executor.invokeAll(tasks);
                    for (Future<ScenarioRunPlanResult> future : futures) {
                        results.add(future.get());
                    }
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new BadRequestException("Scenario execution was interrupted");
                } catch (Exception exception) {
                    throw new BadRequestException("Scenario execution failed: " + exception.getMessage());
                }
                if (results.stream().anyMatch(result -> !result.aggregate().success()) && shouldStopOnScenarioPlanFailure(scenario)) {
                    break;
                }
            }
            return results;
        } finally {
            executor.shutdownNow();
        }
    }

    private ScenarioRunPlanResult executeScenarioRunPlan(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            ScenarioRunPlan plan
    ) {
        Map<String, String> rowValues = plan.rowValues();
        ApiRunRequest rowRequest = new ApiRunRequest(
                request.workspaceCode(),
                request.environmentId(),
                request.variableSetId(),
                request.branchName(),
                request.triggerSource(),
                request.runOn(),
                request.testDatasetEnabled(),
                request.testDatasetId(),
                request.loopCount(),
                request.threadCount(),
                request.mockEnabled(),
                request.mockApplicationId(),
                request.mockBusinessScenarioId(),
                rowValues,
                request.runnerId()
        );
        ScenarioRunAggregate aggregate = runScenarioOnce(scenario, rowRequest, rowValues, plan.sequence());
        return new ScenarioRunPlanResult(plan, aggregate);
    }

    private ApiRunResponse createLocalRunnerScenarioRun(
            ApiScenarioEntity scenario,
            WorkspaceEntity workspace,
            ApiRunRequest request
    ) {
        Long environmentId = request.environmentId() != null ? request.environmentId() : scenario.getDefaultEnvId();
        Long variableSetId = request.variableSetId() != null ? request.variableSetId() : scenario.getVariableSetId();
        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(
                scenario.getWorkspaceId(),
                environmentId,
                variableSetId,
                request.rowVariables(),
                request.mockApplicationId(),
                request.mockEnabled(),
                request.mockBusinessScenarioId()
        );

        ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector = ApiLocalRunnerPayloadSupport.artifactCollector();
        Map<String, Object> payload = buildApiLocalRunnerScenarioPayload(scenario, request, artifactCollector);

        RunnerTaskDetailResponse task = localRunnerService.createDebugTask(new CreateRunnerTaskCommand(
                scenario.getWorkspaceId(),
                workspace.getWorkspaceCode(),
                "api_scenario_" + scenario.getId() + "_" + System.currentTimeMillis(),
                "API_SCENARIO_RUN",
                "LOCAL_RUNNER",
                request.runnerId(),
                null,
                "1.0",
                "MANUAL",
                1,
                null,
                buildApiLocalRunnerTimeoutPolicy(scenario),
                buildApiLocalRunnerEnvironmentSnapshot(environmentId, context.environment()),
                buildApiLocalRunnerVariableSnapshot(variableSetId, context.variables()),
                Map.of(),
                artifactCollector.artifactRefs(),
                List.of(),
                Map.of(),
                payload
        ));

        return new ApiRunResponse(
                null,
                null,
                task == null ? null : task.runId(),
                null,
                "PENDING",
                "Local Runner task created",
                List.of(),
                List.of()
        );
    }

    private Map<String, Object> buildApiLocalRunnerTimeoutPolicy(ApiScenarioEntity scenario) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("taskTimeoutMs", scenario.getGlobalTimeoutMs() == null || scenario.getGlobalTimeoutMs() <= 0 ? 300000 : scenario.getGlobalTimeoutMs());
        values.put("requestTimeoutMs", 30000);
        values.put("scriptTimeoutMs", 1000);
        values.put("stepFailureRetryCount", scenario.getStepFailureRetryCount() == null ? 0 : scenario.getStepFailureRetryCount());
        values.put("defaultStepWaitMs", scenario.getDefaultStepWaitMs() == null ? 0 : scenario.getDefaultStepWaitMs());
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerCaseTimeoutPolicy(ApiExecutionRuntimeModels.ResolvedEnvironment environment) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("taskTimeoutMs", 300000);
        values.put("requestTimeoutMs", environment == null || environment.timeoutMs() == null ? 30000 : environment.timeoutMs());
        values.put("scriptTimeoutMs", 1000);
        values.put("stepFailureRetryCount", 0);
        values.put("defaultStepWaitMs", 0);
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerEnvironmentSnapshot(
            Long environmentId,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment
    ) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("environmentId", environmentId);
        values.put("baseUrl", environment == null ? null : environment.baseUrl());
        values.put("timeoutMs", environment == null ? null : environment.timeoutMs());
        values.put("defaultServiceKey", environment == null ? null : environment.defaultServiceKey());
        values.put("services", environment == null ? List.of() : environment.services());
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerVariableSnapshot(Long variableSetId, Map<String, String> variables) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("variableSetId", variableSetId);
        values.put("variables", variables == null ? Map.of() : new LinkedHashMap<>(variables));
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerCasePayload(
            ApiDefinitionCaseEntity apiCase,
            ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("apiCaseSnapshot", ApiLocalRunnerPayloadSupport.buildApiCaseSnapshot(apiCase, artifactCollector));
        Map<String, Object> runOptions = new LinkedHashMap<>();
        runOptions.put("formalReport", true);
        runOptions.put("debugMode", false);
        payload.put("runOptions", runOptions);
        return payload;
    }

    private Map<String, Object> buildApiLocalRunnerScenarioPayload(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector
    ) {
        Map<String, Object> scenarioSnapshot = new LinkedHashMap<>();
        scenarioSnapshot.put("scenarioId", scenario.getId());
        scenarioSnapshot.put("scenarioName", scenario.getScenarioName());
        scenarioSnapshot.put("steps", ApiLocalRunnerPayloadSupport.buildScenarioSteps(
                readScenarioSteps(scenario.getStepsJson()),
                Boolean.TRUE.equals(scenario.getContinueOnFailure()),
                caseMapper,
                artifactCollector
        ));
        scenarioSnapshot.put("assertions", readScenarioAssertions(scenario.getScenarioAssertionsJson()));

        Map<String, Object> runOptions = new LinkedHashMap<>();
        runOptions.put("stopOnFirstFailure", !Boolean.TRUE.equals(scenario.getContinueOnFailure()));
        runOptions.put("formalReport", true);
        runOptions.put("debugMode", false);
        runOptions.put("loopCount", normalizeScenarioLoopCount(request.loopCount()));
        runOptions.put("threadCount", normalizeScenarioThreadCount(request.threadCount()));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scenarioSnapshot", scenarioSnapshot);
        payload.put("runOptions", runOptions);
        return payload;
    }

    private boolean isLocalRunnerRun(String runOn) {
        String normalized = blankToNull(runOn);
        return "LOCAL".equalsIgnoreCase(normalized) || "LOCAL_RUNNER".equalsIgnoreCase(normalized);
    }

    private boolean shouldStopOnScenarioPlanFailure(ApiScenarioEntity scenario) {
        return "STOP_ON_ROW_FAILURE".equals(blankToFallback(scenario.getDataFailureStrategy(), "STOP_ON_ROW_FAILURE"));
    }

    private int normalizeScenarioLoopCount(Integer value) {
        if (value == null || value < 1) {
            return 1;
        }
        return Math.min(MAX_SCENARIO_LOOP_COUNT, value);
    }

    private int normalizeScenarioThreadCount(Integer value) {
        if (value == null || value < 1) {
            return 1;
        }
        return Math.min(MAX_SCENARIO_THREAD_COUNT, value);
    }

    private String describeScenarioPlanFailure(ScenarioRunPlan plan, String fallback) {
        String base = blankToFallback(fallback, "Scenario run failed");
        if (plan.hasDataRow()) {
            return "Loop " + plan.loopIndex() + ", row " + plan.rowIndex() + " failed: " + base;
        }
        return "Loop " + plan.loopIndex() + " failed: " + base;
    }

    private ScenarioRunAggregate runScenarioOnce(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            Map<String, String> rowVariables,
            int stepOrderStart
    ) {
        Long environmentId = request.environmentId() != null ? request.environmentId() : scenario.getDefaultEnvId();
        Long variableSetId = request.variableSetId() != null ? request.variableSetId() : scenario.getVariableSetId();
        ApiExecutionRuntimeModels.ExecutionContext context = executionEngine.buildExecutionContext(scenario.getWorkspaceId(), environmentId, variableSetId, request.rowVariables(), request.mockApplicationId(), request.mockEnabled(), request.mockBusinessScenarioId());
        for (ApiVariableItem variable : readVariables(scenario.getScenarioVariablesJson())) {
            if (variable.name() != null && !variable.name().isBlank()) {
                context.variables().putIfAbsent(variable.name().trim(), Optional.ofNullable(variable.value()).orElse(""));
            }
        }
        ApiExecutionRuntimeModels.RunEnvelope envelope = executionEngine.createRunEnvelope(scenario.getWorkspaceId(), "API", "接口场景", scenario.getScenarioName());
        List<ApiScenarioStepInput> steps = readScenarioSteps(scenario.getStepsJson());
        List<ApiRunStepResultResponse> responses = new ArrayList<>();
        boolean success = true;
        String failureSummary = null;
        int[] stepOrder = {stepOrderStart};
        Set<String> onceOnlyKeys = new java.util.HashSet<>();
        ApiScenarioExecutionSupport.ScenarioExecutionPolicy policy = ApiScenarioExecutionSupport.ScenarioExecutionPolicy.of(
                Boolean.TRUE.equals(scenario.getContinueOnFailure()),
                scenario.getGlobalTimeoutMs(),
                scenario.getStepFailureRetryCount(),
                scenario.getDefaultStepWaitMs()
        );
        for (ApiExecutionRuntimeModels.RunStepComputation computation : executionEngine.executeScenarioSteps(
                steps,
                stepOrder,
                context.variables(),
                context.environment(),
                workspaceService.requireWorkspaceById(scenario.getWorkspaceId()).getWorkspaceCode(),
                scenario.getWorkspaceId(),
                scenario.getId(),
                0,
                onceOnlyKeys,
                policy
        )) {
            executionEngine.persistStep(envelope.report(), scenario.getWorkspaceId(), computation);
            responses.add(computation.response());
            if (!computation.success()) {
                success = false;
                failureSummary = blankToFallback(computation.response().errorMessage(), computation.response().stepName() + " failed");
                if (!policy.continueOnFailure()) {
                    break;
                }
            }
        }

        if (responses.isEmpty()) {
            throw new BadRequestException("Scenario has no enabled steps to run");
        }

        List<ApiAssertionResult> scenarioAssertionResults = executionEngine.evaluateScenarioAssertions(readScenarioAssertions(scenario.getScenarioAssertionsJson()), responses);
        if (!scenarioAssertionResults.isEmpty()) {
            boolean assertionSuccess = scenarioAssertionResults.stream().allMatch(ApiAssertionResult::success);
            ApiExecutionRuntimeModels.RunStepComputation assertionComputation = new ApiExecutionRuntimeModels.RunStepComputation(assertionSuccess, new ApiRunStepResultResponse(
                    null,
                    null,
                    stepOrder[0],
                    "场景断言",
                    "ASSERTION",
                    null,
                    assertionSuccess,
                    0L,
                    null,
                    null,
                    scenarioAssertionResults,
                    List.of(),
                    List.of(),
                    assertionSuccess ? null : executionEngine.firstFailedMessage(scenarioAssertionResults),
                    LocalDateTime.now()
            ));
            executionEngine.persistStep(envelope.report(), scenario.getWorkspaceId(), assertionComputation);
            responses.add(assertionComputation.response());
            if (!assertionSuccess) {
                success = false;
                failureSummary = executionEngine.firstFailedMessage(scenarioAssertionResults);
            }
        }

        if (rowVariables == null) {
            executionEngine.finalizeRunScenario(scenario, success, failureSummary, envelope.task(), envelope.report());
        }
        return new ScenarioRunAggregate(envelope, success, failureSummary, responses, context.contextSnapshotJson());
    }

    private ApiRunResponse toScenarioRunResponse(ScenarioRunAggregate aggregate, List<ApiExecutionSuiteDataIteration> dataIterations) {
        return new ApiRunResponse(
                aggregate.envelope().task().getId(),
                aggregate.envelope().report().getId(),
                aggregate.envelope().task().getTaskName(),
                aggregate.envelope().report().getReportName(),
                aggregate.envelope().report().getResult(),
                aggregate.envelope().report().getFailureSummary(),
                dataIterations,
                aggregate.stepResults()
        );
    }

    private ApiExecutionSuiteDataIteration toDataIteration(ScenarioRunPlanResult result) {
        ScenarioRunPlan plan = result.plan();
        ScenarioRunAggregate rowRun = result.aggregate();
        long durationMs = rowRun.stepResults().stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(java.util.Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        return new ApiExecutionSuiteDataIteration(
                plan.loopIndex(),
                plan.rowIndex(),
                plan.caseDesc(),
                plan.rowValues(),
                rowRun.success() ? "SUCCESS" : "FAILED",
                rowRun.stepResults().stream()
                        .filter(item -> !Boolean.TRUE.equals(item.success()))
                        .map(ApiRunStepResultResponse::stepName)
                        .filter(java.util.Objects::nonNull)
                        .findFirst()
                        .orElse(null),
                rowRun.stepResults().size(),
                durationMs,
                rowRun.failureSummary()
        );
    }

    public PageResponse<ApiScenarioRunHistoryItem> listScenarioRunHistory(
            Long scenarioId,
            String workspaceCode,
            Integer pageNo,
            Integer pageSize
    ) {
        ApiScenarioEntity scenario = executionEngine.requireScenario(scenarioId);
        workspaceScopeSupport.validateReadable(scenario.getWorkspaceId(), workspaceCode, "Current workspace cannot access the scenario");
        List<ApiScenarioRunHistoryItem> items = scenarioRunHistoryMapper.selectList(new LambdaQueryWrapper<ApiScenarioRunHistoryEntity>()
                        .eq(ApiScenarioRunHistoryEntity::getScenarioId, scenarioId)
                        .orderByDesc(ApiScenarioRunHistoryEntity::getCreatedAt)
                        .orderByDesc(ApiScenarioRunHistoryEntity::getId))
                .stream()
                .map(this::toScenarioRunHistoryItem)
                .toList();
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 50);
        int fromIndex = Math.min((safePageNo - 1) * safePageSize, items.size());
        int toIndex = Math.min(fromIndex + safePageSize, items.size());
        return PageResponse.of(items.subList(fromIndex, toIndex), items.size(), safePageNo, safePageSize);
    }

    public ApiScenarioRunHistoryDetail getScenarioRunHistoryDetail(Long historyId, String workspaceCode) {
        ApiScenarioRunHistoryEntity history = requireScenarioRunHistory(historyId);
        workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the scenario run history");
        return toScenarioRunHistoryDetail(history);
    }

    private void persistScenarioRunHistory(
            ApiScenarioEntity scenario,
            ApiRunRequest request,
            Long reportId,
            boolean success,
            String failureSummary,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            List<ApiRunStepResultResponse> stepResults,
            String contextSnapshotJson
    ) {
        CurrentUserPrincipal currentUser = currentUserOrNull();
        long durationMs = stepResults.stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(java.util.Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        int successCount = (int) stepResults.stream().filter(ApiRunStepResultResponse::success).count();
        ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeInfo datasetInfo = request.testDatasetId() == null
                ? null
                : scenarioTestDatasetDomainService.getRuntimeDatasetInfo(scenario.getId(), scenario.getWorkspaceId(), request.testDatasetId());

        ApiScenarioRunHistoryEntity entity = new ApiScenarioRunHistoryEntity();
        entity.setWorkspaceId(scenario.getWorkspaceId());
        entity.setScenarioId(scenario.getId());
        entity.setScenarioName(scenario.getScenarioName());
        entity.setReportId(reportId);
        entity.setResult(success ? "SUCCESS" : "FAILED");
        entity.setFailureSummary(failureSummary);
        entity.setTotalCount(stepResults.size());
        entity.setSuccessCount(successCount);
        entity.setFailedCount(Math.max(0, stepResults.size() - successCount));
        entity.setSkippedCount(0);
        entity.setDurationMs(durationMs);
        entity.setEnvironmentId(request.environmentId() != null ? request.environmentId() : scenario.getDefaultEnvId());
        entity.setVariableSetId(request.variableSetId() != null ? request.variableSetId() : scenario.getVariableSetId());
        entity.setTestDatasetId(request.testDatasetId());
        entity.setTestDatasetName(datasetInfo == null ? scenario.getDataFileNameSnapshot() : datasetInfo.datasetName());
        entity.setLoopCount(normalizeScenarioLoopCount(request.loopCount()));
        entity.setThreadCount(normalizeScenarioThreadCount(request.threadCount()));
        entity.setDataIterationJson(ApiAutomationJsonSupport.toJson(dataIterations == null ? List.of() : dataIterations, "Failed to serialize scenario data iterations"));
        entity.setDetailJson(ApiAutomationJsonSupport.toJson(stepResults == null ? List.of() : stepResults, "Failed to serialize scenario run steps"));
        entity.setContextSnapshotJson(contextSnapshotJson);
        entity.setOperatorId(currentUser == null ? null : currentUser.userId());
        entity.setOperatorName(currentUser == null ? "系统调度" : currentUser.displayName());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioRunHistoryMapper.insert(entity);
    }

    private ApiScenarioRunHistoryItem toScenarioRunHistoryItem(ApiScenarioRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiScenarioRunHistoryItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getScenarioId(),
                entity.getScenarioName(),
                entity.getReportId(),
                entity.getResult(),
                entity.getFailureSummary(),
                entity.getTotalCount(),
                entity.getSuccessCount(),
                entity.getFailedCount(),
                entity.getSkippedCount(),
                entity.getDurationMs(),
                entity.getEnvironmentId(),
                entity.getVariableSetId(),
                entity.getTestDatasetId(),
                entity.getTestDatasetName(),
                entity.getLoopCount(),
                entity.getThreadCount(),
                entity.getOperatorId(),
                entity.getOperatorName(),
                entity.getCreatedAt()
        );
    }

    private ApiScenarioRunHistoryDetail toScenarioRunHistoryDetail(ApiScenarioRunHistoryEntity entity) {
        ApiScenarioRunHistoryItem item = toScenarioRunHistoryItem(entity);
        return new ApiScenarioRunHistoryDetail(
                item.id(),
                item.workspaceCode(),
                item.workspaceName(),
                item.scenarioId(),
                item.scenarioName(),
                item.reportId(),
                item.result(),
                item.failureSummary(),
                item.totalCount(),
                item.successCount(),
                item.failedCount(),
                item.skippedCount(),
                item.durationMs(),
                item.environmentId(),
                item.variableSetId(),
                item.testDatasetId(),
                item.testDatasetName(),
                item.loopCount(),
                item.threadCount(),
                item.operatorId(),
                item.operatorName(),
                item.createdAt(),
                entity.getContextSnapshotJson(),
                readScenarioDataIterations(entity.getDataIterationJson()),
                readScenarioStepResults(entity.getDetailJson())
        );
    }

    private ApiScenarioRunHistoryEntity requireScenarioRunHistory(Long historyId) {
        ApiScenarioRunHistoryEntity entity = historyId == null ? null : scenarioRunHistoryMapper.selectById(historyId);
        if (entity == null) {
            throw new NotFoundException("Scenario run history not found");
        }
        return entity;
    }

    private List<ApiExecutionSuiteDataIteration> readScenarioDataIterations(String json) {
        return ApiAutomationJsonSupport.readList(json, new com.fasterxml.jackson.core.type.TypeReference<>() {
        }, List.of());
    }

    private List<ApiRunStepResultResponse> readScenarioStepResults(String json) {
        return ApiAutomationJsonSupport.readList(json, new com.fasterxml.jackson.core.type.TypeReference<>() {
        }, List.of());
    }

    private CurrentUserPrincipal currentUserOrNull() {
        try {
            return CurrentUserContext.require();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private record ScenarioRunAggregate(
            ApiExecutionRuntimeModels.RunEnvelope envelope,
            boolean success,
            String failureSummary,
            List<ApiRunStepResultResponse> stepResults,
            String contextSnapshotJson
    ) {
    }

    private record ScenarioRunPlan(
            int sequence,
            int loopIndex,
            ApiScenarioTestDatasetDomainService.ApiScenarioDatasetRuntimeRow datasetRow,
            ApiDataFileDomainService.ApiDataFileRuntimeRow dataFileRow
    ) {
        boolean hasDataRow() {
            return datasetRow != null || dataFileRow != null;
        }

        Integer rowIndex() {
            if (datasetRow != null) {
                return datasetRow.rowIndex();
            }
            return dataFileRow == null ? null : dataFileRow.rowIndex();
        }

        String caseDesc() {
            if (datasetRow != null) {
                return datasetRow.caseDesc();
            }
            return dataFileRow == null ? null : dataFileRow.caseDesc();
        }

        Map<String, String> rowValues() {
            if (datasetRow != null) {
                return datasetRow.values();
            }
            return dataFileRow == null ? null : dataFileRow.values();
        }
    }

    private record ScenarioRunPlanResult(
            ScenarioRunPlan plan,
            ScenarioRunAggregate aggregate
    ) {
    }
}
