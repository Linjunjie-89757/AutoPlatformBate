package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.execution.TaskEntity;
import com.company.autoplatform.execution.TaskMapper;
import com.company.autoplatform.settings.EnvConfigEntity;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.company.autoplatform.settings.MockApplicationEntity;
import com.company.autoplatform.settings.MockApplicationMapper;
import com.company.autoplatform.settings.MockBusinessScenarioEntity;
import com.company.autoplatform.settings.MockBusinessScenarioMapper;
import com.company.autoplatform.settings.MockReleaseEntity;
import com.company.autoplatform.settings.MockReleaseMapper;
import com.company.autoplatform.settings.MockExecutionCredentialService;
import com.company.autoplatform.settings.ParamSetEntity;
import com.company.autoplatform.settings.ParamSetMapper;
import com.company.autoplatform.settings.ParamSetVersionEntity;
import com.company.autoplatform.settings.ParamSetVersionMapper;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;
import static com.company.autoplatform.apiautomation.ApiExecutionRuntimeModels.*;

@Service
public class ApiExecutionEngineSupport {

    private static final String API_ENV_TYPE = "API";
    private static final String RESULT_PASSED = "PASSED";
    private static final String RESULT_NOT_PASSED = "NOT_PASSED";
    private static final String RESULT_NO_ASSERTION = "NO_ASSERTION";
    private static final String RESULT_FAILED = "FAILED";
    private static final String GLOBAL_VARIABLE_SET_TYPE = "GLOBAL";
    private static final String API_VARIABLE_SET_TYPE = "API_VARIABLE_SET";
    private static final String BUSINESS_VARIABLE_SET_TYPE = "BUSINESS";
    private static final String PAYMENT_CHANNEL_VARIABLE_SET_TYPE = "PAYMENT_CHANNEL";
    private static final String SCENARIO_RESOURCE_TYPE_DEFINITION = "DEFINITION";
    private static final String SCENARIO_RESOURCE_TYPE_CASE = "CASE";
    private static final String SCENARIO_STEP_API = "API";
    private static final String SCENARIO_STEP_API_CASE = "API_CASE";
    private static final String SCENARIO_STEP_CUSTOM_REQUEST = "CUSTOM_REQUEST";
    private static final String SCENARIO_STEP_API_SCENARIO = "API_SCENARIO";
    private static final String SCENARIO_STEP_REF_COPY = "COPY";
    private static final String SCENARIO_STEP_REF_REF = "REF";
    private static final String SCENARIO_STEP_REF_DIRECT = "DIRECT";
    private static final String SCENARIO_STEP_IF_CONTROLLER = "IF_CONTROLLER";
    private static final String SCENARIO_STEP_LOOP_CONTROLLER = "LOOP_CONTROLLER";
    private static final String SCENARIO_STEP_ONCE_ONLY_CONTROLLER = "ONCE_ONLY_CONTROLLER";
    private static final String SCENARIO_STEP_CONSTANT_TIMER = "CONSTANT_TIMER";
    private static final String SCENARIO_STEP_SCRIPT = "SCRIPT";
    private static final Set<String> SUCCESS_RESULTS = Set.of("SUCCESS", "FAILED");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ApiDefinitionMapper definitionMapper;
    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;
    private final ParamSetVersionMapper paramSetVersionMapper;
    private final MockApplicationMapper mockApplicationMapper;
    private final MockBusinessScenarioMapper mockBusinessScenarioMapper;
    private final MockReleaseMapper mockReleaseMapper;
    private final MockExecutionCredentialService executionCredentialService;
    private final TaskMapper taskMapper;
    private final ReportMapper reportMapper;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final WorkspaceService workspaceService;
    private final ApiAssertionEvaluator assertionEvaluator;
    private final ApiAssertionSupport assertionSupport;
    private final ApiRequestExecutionSupport requestExecutionSupport;
    private final ApiProcessorExecutor processorExecutor;
    private final ApiScenarioExecutionSupport scenarioExecutionSupport;
    private final ApiRunResultPersistenceSupport runResultPersistenceSupport;
    private final ApiRunFinalizerSupport runFinalizerSupport;
    private final ApiVariableResolver variableResolver;
    private final String mockPublicBaseUrl;

    public ApiExecutionEngineSupport(
            ApiDefinitionMapper definitionMapper,
            ApiDefinitionCaseMapper caseMapper,
            ApiScenarioMapper scenarioMapper,
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper,
            ParamSetVersionMapper paramSetVersionMapper,
            MockApplicationMapper mockApplicationMapper,
            MockBusinessScenarioMapper mockBusinessScenarioMapper,
            MockReleaseMapper mockReleaseMapper,
            MockExecutionCredentialService executionCredentialService,
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            ApiAssertionEvaluator assertionEvaluator,
            ApiAssertionSupport assertionSupport,
            ApiRequestExecutionSupport requestExecutionSupport,
            ApiProcessorExecutor processorExecutor,
            ApiScenarioExecutionSupport scenarioExecutionSupport,
            ApiRunResultPersistenceSupport runResultPersistenceSupport,
            ApiRunFinalizerSupport runFinalizerSupport,
            ApiVariableResolver variableResolver,
            WorkspaceService workspaceService,
            @Value("${autoplatform.mock.public-base-url:http://localhost:${server.port:8080}/api/mock}") String mockPublicBaseUrl
    ) {
        this.definitionMapper = definitionMapper;
        this.caseMapper = caseMapper;
        this.scenarioMapper = scenarioMapper;
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
        this.paramSetVersionMapper = paramSetVersionMapper;
        this.mockApplicationMapper = mockApplicationMapper;
        this.mockBusinessScenarioMapper = mockBusinessScenarioMapper;
        this.mockReleaseMapper = mockReleaseMapper;
        this.executionCredentialService = executionCredentialService;
        this.taskMapper = taskMapper;
        this.reportMapper = reportMapper;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.assertionEvaluator = assertionEvaluator;
        this.assertionSupport = assertionSupport;
        this.requestExecutionSupport = requestExecutionSupport;
        this.processorExecutor = processorExecutor;
        this.scenarioExecutionSupport = scenarioExecutionSupport;
        this.runResultPersistenceSupport = runResultPersistenceSupport;
        this.runFinalizerSupport = runFinalizerSupport;
        this.variableResolver = variableResolver;
        this.workspaceService = workspaceService;
        this.mockPublicBaseUrl = trimTrailingSlash(mockPublicBaseUrl);
    }
    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, (Long) null, null, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Long mockApplicationId, Boolean mockEnabled) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, mockApplicationId, mockEnabled, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Long mockApplicationId, Boolean mockEnabled, Long mockBusinessScenarioId) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, mockApplicationId, mockEnabled, mockBusinessScenarioId, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Long mockApplicationId, Boolean mockEnabled, Long mockBusinessScenarioId, Long mockReleaseId) {
        ResolvedEnvironment environment = resolveEnvironment(workspaceId, environmentId);
        environment = resolveMockEnvironment(workspaceId, environment, mockApplicationId, mockEnabled, mockBusinessScenarioId, mockReleaseId);
        Map<String, String> variables = new LinkedHashMap<>();
        List<RuntimeVariableSetSnapshot> variableSetSnapshots = new ArrayList<>();
        applyVariableSets(variables, listGlobalVariableSets(workspaceId), variableSetSnapshots);
        for (ApiVariableItem variable : defaultList(environment.variables())) {
            if (variable.name() != null) {
                variables.put(variable.name(), variable.value() == null ? "" : variable.value());
            }
        }
        putServiceVariables(variables, environment);
        putMockVariables(variables, environment);
        ParamSetEntity defaultVariableSet = null;
        if (environment.defaultVariableSetId() != null) {
            defaultVariableSet = requireVariableSet(environment.defaultVariableSetId());
            ensureVariableSetInWorkspace(defaultVariableSet, workspaceId);
            applyVariableSet(variables, defaultVariableSet, variableSetSnapshots);
        }
        ParamSetEntity runtimeVariableSet = null;
        if (variableSetId != null && (defaultVariableSet == null || !variableSetId.equals(defaultVariableSet.getId()))) {
            runtimeVariableSet = requireVariableSet(variableSetId);
            ensureVariableSetInWorkspace(runtimeVariableSet, workspaceId);
            applyVariableSet(variables, runtimeVariableSet, variableSetSnapshots);
        }
        ParamSetEntity effectiveVariableSet = runtimeVariableSet != null ? runtimeVariableSet : defaultVariableSet;
        variables = variableResolver.resolveVariableValues(variables);
        return new ExecutionContext(environment, variables, buildContextSnapshot(environment, effectiveVariableSet, variableSetSnapshots, variables));
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Map<String, String> rowVariables) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, rowVariables, null, null, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Map<String, String> rowVariables, Long mockApplicationId, Boolean mockEnabled) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, rowVariables, mockApplicationId, mockEnabled, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Map<String, String> rowVariables, Long mockApplicationId, Boolean mockEnabled, Long mockBusinessScenarioId) {
        return buildExecutionContext(workspaceId, environmentId, variableSetId, rowVariables, mockApplicationId, mockEnabled, mockBusinessScenarioId, null);
    }

    ExecutionContext buildExecutionContext(Long workspaceId, Long environmentId, Long variableSetId, Map<String, String> rowVariables, Long mockApplicationId, Boolean mockEnabled, Long mockBusinessScenarioId, Long mockReleaseId) {
        ExecutionContext context = buildExecutionContext(workspaceId, environmentId, variableSetId, mockApplicationId, mockEnabled, mockBusinessScenarioId, mockReleaseId);
        if (rowVariables != null) {
            rowVariables.forEach((key, value) -> {
                if (key != null && !key.isBlank()) {
                    context.variables().put(key.trim(), value == null ? "" : value);
                }
            });
        }
        Map<String, String> variables = variableResolver.resolveVariableValues(context.variables());
        return new ExecutionContext(context.environment(), variables, rebuildContextSnapshot(context.contextSnapshotJson(), context.environment(), variables));
    }

    private ResolvedEnvironment resolveEnvironment(Long workspaceId, Long environmentId) {
        if (environmentId == null) {
            return new ResolvedEnvironment(null, "", List.of(), emptyAuthConfig(), 10000, List.of(), null, null, null, null, null, null, null, null, null, null, null, List.of());
        }
        EnvConfigEntity environment = requireEnvironment(environmentId);
        if (!environment.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Environment must belong to the same workspace");
        }
        EnvironmentConfigPayload config = ApiAutomationJsonSupport.read(environment.getConfigJson(), EnvironmentConfigPayload.class,
                new EnvironmentConfigPayload(List.of(), emptyAuthConfig(), 10000, List.of(), null, null, null, List.of()));
        List<EnvironmentServiceEndpoint> services = normalizeServices(config.services(), environment.getBaseUrl());
        String defaultServiceKey = normalizeDefaultServiceKey(config.defaultServiceKey(), services);
        String baseUrl = services.stream()
                .filter(service -> service.key().equals(defaultServiceKey))
                .findFirst()
                .map(EnvironmentServiceEndpoint::baseUrl)
                .orElse(environment.getBaseUrl());
        return new ResolvedEnvironment(
                environment.getId(),
                baseUrl,
                defaultList(config.headers()),
                normalizeAuth(config.authConfig()),
                config.timeoutMs() == null ? 10000 : config.timeoutMs(),
                defaultList(config.variables()),
                config.defaultVariableSetId(),
                config.mockApplicationId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                defaultServiceKey,
                services
        );
    }

    private ResolvedEnvironment resolveMockEnvironment(Long workspaceId, ResolvedEnvironment environment, Long requestMockApplicationId, Boolean mockEnabled, Long mockBusinessScenarioId, Long mockReleaseId) {
        if (Boolean.FALSE.equals(mockEnabled)) {
            return copyEnvironmentWithMock(environment, null, null, null, null, null, null);
        }
        Long effectiveMockApplicationId = requestMockApplicationId != null ? requestMockApplicationId : environment.mockApplicationId();
        if (effectiveMockApplicationId == null) {
            return copyEnvironmentWithMock(environment, null, null, null, null, null, null);
        }
        MockApplicationEntity application = mockApplicationMapper.selectById(effectiveMockApplicationId);
        if (application == null || !application.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Mock application must belong to the same workspace");
        }
        if (application.getStatus() != null && application.getStatus() == 0) {
            throw new BadRequestException("Mock application is disabled");
        }
        MockBusinessScenarioEntity businessScenario = resolveMockBusinessScenario(workspaceId, application.getId(), mockBusinessScenarioId);
        MockReleaseEntity release = resolveMockRelease(application.getId(), workspaceId, mockReleaseId);
        String baseUrl = mockPublicBaseUrl + "/" + application.getAppCode();
        return copyEnvironmentWithMock(
                environment,
                application.getId(),
                application.getAppName(),
                application.getAppCode(),
                baseUrl,
                businessScenario == null ? null : businessScenario.getId(),
                businessScenario == null ? null : businessScenario.getScenarioName(),
                release == null ? null : release.getId(),
                release == null ? null : release.getVersionNo(),
                release == null ? null : executionCredentialService.issue(
                        workspaceService.requireWorkspaceById(workspaceId).getWorkspaceCode(),
                        application.getAppCode(),
                        release.getId())
        );
    }

    private MockBusinessScenarioEntity resolveMockBusinessScenario(Long workspaceId, Long mockApplicationId, Long mockBusinessScenarioId) {
        if (mockBusinessScenarioId == null) {
            return null;
        }
        MockBusinessScenarioEntity businessScenario = mockBusinessScenarioMapper.selectById(mockBusinessScenarioId);
        if (businessScenario == null
                || !workspaceId.equals(businessScenario.getWorkspaceId())
                || !mockApplicationId.equals(businessScenario.getAppId())) {
            throw new BadRequestException("Mock business scenario must belong to the selected Mock application");
        }
        if (businessScenario.getStatus() != null && businessScenario.getStatus() == 0) {
            throw new BadRequestException("Mock business scenario is disabled");
        }
        return businessScenario;
    }

    private ResolvedEnvironment copyEnvironmentWithMock(ResolvedEnvironment environment, Long mockApplicationId, String mockApplicationName, String mockApplicationCode, String mockBaseUrl, Long mockBusinessScenarioId, String mockBusinessScenarioName) {
        return copyEnvironmentWithMock(environment, mockApplicationId, mockApplicationName, mockApplicationCode, mockBaseUrl,
                mockBusinessScenarioId, mockBusinessScenarioName, null, null, null);
    }

    private ResolvedEnvironment copyEnvironmentWithMock(ResolvedEnvironment environment, Long mockApplicationId, String mockApplicationName, String mockApplicationCode, String mockBaseUrl, Long mockBusinessScenarioId, String mockBusinessScenarioName, Long mockReleaseId, Integer mockReleaseVersion, String mockExecutionToken) {
        return new ResolvedEnvironment(
                environment.environmentId(),
                mockBaseUrl == null ? environment.baseUrl() : mockBaseUrl,
                environment.headers(),
                environment.authConfig(),
                environment.timeoutMs(),
                environment.variables(),
                environment.defaultVariableSetId(),
                mockApplicationId,
                mockApplicationName,
                mockApplicationCode,
                mockBaseUrl,
                mockBusinessScenarioId,
                mockBusinessScenarioName,
                mockReleaseId,
                mockReleaseVersion,
                mockExecutionToken,
                environment.defaultServiceKey(),
                environment.services()
        );
    }

    private List<EnvironmentServiceEndpoint> normalizeServices(List<EnvironmentServiceEndpoint> services, String fallbackBaseUrl) {
        List<EnvironmentServiceEndpoint> normalized = defaultList(services).stream()
                .filter(service -> service != null
                        && service.key() != null && !service.key().isBlank()
                        && service.baseUrl() != null && !service.baseUrl().isBlank())
                .map(service -> new EnvironmentServiceEndpoint(
                        service.key().trim(),
                        service.name() == null || service.name().isBlank() ? service.key().trim() : service.name().trim(),
                        service.baseUrl().trim()
                ))
                .toList();
        if (!normalized.isEmpty()) {
            return normalized;
        }
        return List.of(new EnvironmentServiceEndpoint("default", "默认服务", Optional.ofNullable(fallbackBaseUrl).orElse("").trim()));
    }

    private String normalizeDefaultServiceKey(String defaultServiceKey, List<EnvironmentServiceEndpoint> services) {
        String normalized = Optional.ofNullable(defaultServiceKey).orElse("").trim();
        if (!normalized.isBlank() && services.stream().anyMatch(service -> service.key().equals(normalized))) {
            return normalized;
        }
        return services.isEmpty() ? "default" : services.getFirst().key();
    }

    private void putMockVariables(Map<String, String> variables, ResolvedEnvironment environment) {
        if (environment.mockApplicationId() == null) {
            return;
        }
        variables.put("MOCK_BASE_URL", Optional.ofNullable(environment.mockBaseUrl()).orElse(""));
        variables.put("MOCK_APP_CODE", Optional.ofNullable(environment.mockApplicationCode()).orElse(""));
        variables.put("MOCK_APP_NAME", Optional.ofNullable(environment.mockApplicationName()).orElse(""));
        if (environment.mockBusinessScenarioId() != null) {
            variables.put("MOCK_BUSINESS_SCENARIO_ID", String.valueOf(environment.mockBusinessScenarioId()));
            variables.put("MOCK_BUSINESS_SCENARIO_NAME", Optional.ofNullable(environment.mockBusinessScenarioName()).orElse(""));
        }
    }

    private void putServiceVariables(Map<String, String> variables, ResolvedEnvironment environment) {
        variables.put("BASE_URL", Optional.ofNullable(environment.baseUrl()).orElse(""));
        variables.put("DEFAULT_SERVICE_URL", Optional.ofNullable(environment.baseUrl()).orElse(""));
        variables.put("DEFAULT_SERVICE_KEY", Optional.ofNullable(environment.defaultServiceKey()).orElse(""));
        for (EnvironmentServiceEndpoint service : defaultList(environment.services())) {
            variables.put(service.key(), Optional.ofNullable(service.baseUrl()).orElse(""));
        }
    }

    private Integer resolveLatestVariableSetVersionNo(Long variableSetId) {
        if (variableSetId == null) {
            return null;
        }
        return paramSetVersionMapper.selectList(new LambdaQueryWrapper<ParamSetVersionEntity>()
                        .eq(ParamSetVersionEntity::getParamSetId, variableSetId)
                        .eq(ParamSetVersionEntity::getLatest, true)
                        .last("LIMIT 1"))
                .stream()
                .findFirst()
                .map(ParamSetVersionEntity::getVersionNo)
                .orElse(null);
    }

    private String rebuildContextSnapshot(String snapshotJson, ResolvedEnvironment environment, Map<String, String> variables) {
        RuntimeContextSnapshot snapshot = ApiAutomationJsonSupport.read(snapshotJson, RuntimeContextSnapshot.class,
                new RuntimeContextSnapshot(null, null, List.of(), null, Map.of()));
        return buildContextSnapshot(environment, snapshot.variableSet(), defaultList(snapshot.variableSets()), variables);
    }

    private String buildContextSnapshot(ResolvedEnvironment environment, ParamSetEntity effectiveVariableSet, List<RuntimeVariableSetSnapshot> variableSets, Map<String, String> variables) {
        RuntimeVariableSetSnapshot effectiveSnapshot = effectiveVariableSet == null
                ? null
                : new RuntimeVariableSetSnapshot(effectiveVariableSet.getId(), effectiveVariableSet.getParamName(), resolveLatestVariableSetVersionNo(effectiveVariableSet.getId()));
        return buildContextSnapshot(environment, effectiveSnapshot, variableSets, variables);
    }

    private String buildContextSnapshot(ResolvedEnvironment environment, RuntimeVariableSetSnapshot effectiveVariableSet, List<RuntimeVariableSetSnapshot> variableSets, Map<String, String> variables) {
        return ApiAutomationJsonSupport.toJson(new RuntimeContextSnapshot(
                environment.environmentId() == null ? null : new RuntimeEnvironmentSnapshot(
                        environment.environmentId(),
                        environment.baseUrl(),
                        environment.timeoutMs(),
                        environment.defaultServiceKey(),
                        defaultList(environment.services())
                ),
                effectiveVariableSet,
                defaultList(variableSets),
                environment.mockApplicationId() == null ? null : new RuntimeMockSnapshot(
                        environment.mockApplicationId(),
                        environment.mockApplicationName(),
                        environment.mockApplicationCode(),
                        environment.mockBaseUrl(),
                        environment.mockBusinessScenarioId(),
                        environment.mockBusinessScenarioName(),
                        environment.mockReleaseId(),
                        environment.mockReleaseVersion()
                ),
                maskRuntimeVariables(variables)
        ), "Failed to serialize API execution context snapshot");
    }

    private MockReleaseEntity activeMockRelease(Long mockApplicationId, Long workspaceId) {
        if (mockApplicationId == null) {
            return null;
        }
        LambdaQueryWrapper<MockReleaseEntity> query = new LambdaQueryWrapper<MockReleaseEntity>()
                .eq(MockReleaseEntity::getAppId, mockApplicationId)
                .eq(MockReleaseEntity::getActive, 1);
        if (workspaceId != null) {
            query.eq(MockReleaseEntity::getWorkspaceId, workspaceId);
        }
        return mockReleaseMapper.selectOne(query.orderByDesc(MockReleaseEntity::getVersionNo).last("LIMIT 1"));
    }

    private MockReleaseEntity resolveMockRelease(Long mockApplicationId, Long workspaceId, Long requestedReleaseId) {
        if (requestedReleaseId == null) {
            return activeMockRelease(mockApplicationId, workspaceId);
        }
        MockReleaseEntity release = mockReleaseMapper.selectOne(new LambdaQueryWrapper<MockReleaseEntity>()
                .eq(MockReleaseEntity::getId, requestedReleaseId)
                .eq(MockReleaseEntity::getAppId, mockApplicationId)
                .eq(workspaceId != null, MockReleaseEntity::getWorkspaceId, workspaceId));
        if (release == null) {
            throw new BadRequestException("Mock release must belong to the selected Mock application and workspace");
        }
        return release;
    }

    private List<ParamSetEntity> listGlobalVariableSets(Long workspaceId) {
        if (workspaceId == null) {
            return List.of();
        }
        return paramSetMapper.selectList(new LambdaQueryWrapper<ParamSetEntity>()
                .eq(ParamSetEntity::getWorkspaceId, workspaceId)
                .eq(ParamSetEntity::getParamType, GLOBAL_VARIABLE_SET_TYPE)
                .eq(ParamSetEntity::getStatus, 1)
                .orderByAsc(ParamSetEntity::getId));
    }

    private void applyVariableSets(Map<String, String> variables, List<ParamSetEntity> variableSets, List<RuntimeVariableSetSnapshot> snapshots) {
        for (ParamSetEntity variableSet : defaultList(variableSets)) {
            applyVariableSet(variables, variableSet, snapshots);
        }
    }

    private void applyVariableSet(Map<String, String> variables, ParamSetEntity variableSet, List<RuntimeVariableSetSnapshot> snapshots) {
        if (variableSet == null || variableSet.getStatus() != null && variableSet.getStatus() == 0) {
            return;
        }
        for (ApiVariableItem variable : readVariables(variableSet.getContentJson())) {
            if (variable.name() != null) {
                variables.put(variable.name(), variable.value() == null ? "" : variable.value());
            }
        }
        snapshots.add(new RuntimeVariableSetSnapshot(variableSet.getId(), variableSet.getParamName(), resolveLatestVariableSetVersionNo(variableSet.getId())));
    }

    private Map<String, String> maskRuntimeVariables(Map<String, String> variables) {
        LinkedHashMap<String, String> masked = new LinkedHashMap<>();
        if (variables == null) {
            return masked;
        }
        variables.forEach((key, value) -> masked.put(key, isSensitiveVariableName(key) ? "******" : Optional.ofNullable(value).orElse("")));
        return masked;
    }

    private boolean isSensitiveVariableName(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.toLowerCase(Locale.ROOT);
        return normalized.contains("password")
                || normalized.contains("passwd")
                || normalized.contains("secret")
                || normalized.contains("token")
                || normalized.contains("accesskey")
                || normalized.contains("privatekey");
    }

    private String trimTrailingSlash(String value) {
        String normalized = Optional.ofNullable(value).filter(item -> !item.isBlank()).orElse("http://localhost:8080/api/mock").trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    RunEnvelope createRunEnvelope(Long workspaceId, String engineType, String prefix, String targetName) {
        LocalDateTime now = LocalDateTime.now();
        TaskEntity task = new TaskEntity();
        task.setWorkspaceId(workspaceId);
        task.setTaskName(prefix + " - " + targetName);
        task.setEngineType(engineType);
        task.setTaskStatus("RUNNING");
        task.setSummary(targetName);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        ReportEntity report = new ReportEntity();
        report.setWorkspaceId(workspaceId);
        report.setTaskId(task.getId());
        report.setReportName(targetName + " @ " + now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        report.setResult("SUCCESS");
        report.setFailureSummary(null);
        report.setLogSource("API");
        report.setLogText(null);
        report.setAttachmentsJson("[]");
        report.setCreatedAt(now);
        report.setUpdatedAt(now);
        reportMapper.insert(report);
        return new RunEnvelope(task, report);
    }

    RunStepComputation executeDefinition(
            ApiDefinitionEntity definition,
            String stepName,
            int stepOrder,
            Map<String, String> variables,
            ResolvedEnvironment environment
    ) {
        ApiRequestConfigInput config = ApiAutomationJsonSupport.read(definition.getRequestJson(), ApiRequestConfigInput.class,
                new ApiRequestConfigInput(definition.getHttpMethod(), definition.getPath(), 10000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig()));
        List<ApiAssertionInput> assertions = readAssertions(definition.getAssertionsJson());
        List<ApiProcessorInput> preProcessors = readPreProcessors(definition);
        List<ApiProcessorInput> postProcessors = readPostProcessors(definition);

        long started = System.currentTimeMillis();
        try {
            MutableRequestConfig requestConfig = toMutableRequestConfig(config);
            List<ApiProcessorResult> processorResults = new ArrayList<>();
            List<ApiExtractionResult> extractionResults = new ArrayList<>();

            processorExecutor.executeProcessors("PRE", preProcessors, definition.getWorkspaceId(), requestConfig, null, null, environment, variables, processorResults, extractionResults);

            ApiRequestConfigInput resolvedConfig = toRequestConfig(requestConfig);
            ApiRequestExecutionSupport.ResolvedRequest request = requestExecutionSupport.resolveRequest(resolvedConfig, environment, variables, normalizeAuth(resolvedConfig.authConfig()));
            ApiRequestExecutionSupport.SentRequestResult sentRequest = requestExecutionSupport.sendRequest(request, resolvedConfig, environment, variables);
            HttpResponse<String> response = sentRequest.response();
            long durationMs = System.currentTimeMillis() - started;

            ApiResponseSnapshot responseSnapshot = new ApiResponseSnapshot(
                    response.statusCode(),
                    requestExecutionSupport.flattenHeaders(response.headers().map()),
                    response.body(),
                    response.headers().firstValue("content-type").orElse(null)
            );
            ApiRequestSnapshot requestSnapshot = new ApiRequestSnapshot(
                    request.method(),
                    request.url(),
                    sentRequest.headers(),
                    defaultList(resolvedConfig.queryParams()),
                    defaultList(resolvedConfig.cookies()),
                    request.bodyConfig() == null ? null : request.bodyConfig().type(),
                    request.bodyConfig() == null ? null : request.bodyConfig().contentType(),
                    request.bodyConfig() == null ? List.of() : defaultList(request.bodyConfig().formItems()),
                    request.bodyConfig() == null ? null : request.bodyConfig().fileName(),
                    request.bodyConfig() == null ? null : request.bodyConfig().contentType(),
                    request.body()
            );
            processorExecutor.executeProcessors("POST", postProcessors, definition.getWorkspaceId(), requestConfig, requestSnapshot, responseSnapshot, environment, variables, processorResults, extractionResults);

            List<ApiAssertionResult> assertionResults = evaluateAssertions(assertions, requestSnapshot, responseSnapshot, durationMs, variables);
            boolean success = assertionResults.stream().allMatch(ApiAssertionResult::success);
            String errorMessage = success ? null : firstFailedMessage(assertionResults);
            ApiRunStepResultResponse result = new ApiRunStepResultResponse(
                    null,
                    null,
                    stepOrder,
                    stepName,
                    definition.getId(),
                    success,
                    durationMs,
                    requestSnapshot,
                    responseSnapshot,
                    assertionResults,
                    extractionResults,
                    processorResults,
                    errorMessage,
                    LocalDateTime.now()
            );
            return new RunStepComputation(success, result);
        } catch (IOException | InterruptedException exception) {
            Thread.currentThread().interrupt();
            long durationMs = System.currentTimeMillis() - started;
            ApiRunStepResultResponse result = new ApiRunStepResultResponse(
                    null,
                    null,
                    stepOrder,
                    stepName,
                    definition.getId(),
                    false,
                    durationMs,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    exception.getMessage(),
                    LocalDateTime.now()
            );
            return new RunStepComputation(false, result);
        } catch (RuntimeException exception) {
            long durationMs = System.currentTimeMillis() - started;
            ApiRunStepResultResponse result = new ApiRunStepResultResponse(
                    null,
                    null,
                    stepOrder,
                    stepName,
                    definition.getId(),
                    false,
                    durationMs,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    exception.getMessage(),
                    LocalDateTime.now()
            );
            return new RunStepComputation(false, result);
        }
    }

    RunStepComputation executeCase(
            ApiDefinitionCaseEntity apiCase,
            String stepName,
            int stepOrder,
            Map<String, String> variables,
            ResolvedEnvironment environment
    ) {
        ApiDefinitionEntity definition = requireDefinition(apiCase.getDefinitionId());
        ensureDefinitionInWorkspace(definition, apiCase.getWorkspaceId(), "Case definition must belong to the same workspace");
        ApiDefinitionEntity runtimeDefinition = new ApiDefinitionEntity();
        ApiRequestConfigInput requestConfig = readStoredRequestConfig(apiCase.getRequestJson(), definition.getHttpMethod(), definition.getPath());
        runtimeDefinition.setId(definition.getId());
        runtimeDefinition.setWorkspaceId(apiCase.getWorkspaceId());
        runtimeDefinition.setDefinitionName(apiCase.getCaseName());
        runtimeDefinition.setHttpMethod(requestConfig.method());
        runtimeDefinition.setPath(requestConfig.path());
        runtimeDefinition.setRequestJson(apiCase.getRequestJson());
        runtimeDefinition.setAssertionsJson(apiCase.getAssertionsJson());
        runtimeDefinition.setPreprocessorsJson(apiCase.getPreprocessorsJson());
        runtimeDefinition.setPostprocessorsJson(apiCase.getPostprocessorsJson());
        runtimeDefinition.setExtractorsJson("[]");
        return executeDefinition(runtimeDefinition, stepName, stepOrder, variables, environment);
    }

    List<RunStepComputation> executeScenarioSteps(
            List<ApiScenarioStepInput> steps,
            int[] stepOrder,
            Map<String, String> variables,
            ResolvedEnvironment environment,
            String workspaceCode,
            Long workspaceId,
            Long rootScenarioId,
            int nestingDepth,
            Set<String> onceOnlyKeys,
            ApiScenarioExecutionSupport.ScenarioExecutionPolicy policy
    ) {
        return scenarioExecutionSupport.executeScenarioSteps(
                steps,
                stepOrder,
                variables,
                environment,
                workspaceCode,
                workspaceId,
                rootScenarioId,
                nestingDepth,
                onceOnlyKeys,
                policy,
                new ApiScenarioExecutionSupport.ScenarioExecutionDelegate() {
                    @Override
                    public String normalizeScenarioStepType(ApiScenarioStepInput step) {
                    return ApiExecutionEngineSupport.this.normalizeScenarioStepType(step);
                }

                @Override
                public String normalizeScenarioStepRefType(ApiScenarioStepInput step) {
                    return ApiExecutionEngineSupport.this.normalizeScenarioStepRefType(step);
                }

                @Override
                public Long normalizeScenarioResourceId(ApiScenarioStepInput step) {
                        return ApiExecutionEngineSupport.this.normalizeScenarioResourceId(step);
                    }

                    @Override
                    public ApiDefinitionEntity requireDefinition(Long id) {
                        return ApiExecutionEngineSupport.this.requireDefinition(id);
                    }

                    @Override
                    public ApiDefinitionCaseEntity requireCase(Long id) {
                        return ApiExecutionEngineSupport.this.requireCase(id);
                    }

                    @Override
                    public ApiScenarioEntity requireScenario(Long id) {
                        return ApiExecutionEngineSupport.this.requireScenario(id);
                    }

                    @Override
                    public void validateReadable(Long workspaceId, String workspaceCode, String message) {
                        ApiExecutionEngineSupport.this.validateReadable(workspaceId, workspaceCode, message);
                    }

                    @Override
                    public List<ApiScenarioStepInput> readScenarioSteps(String json) {
                        return ApiAutomationFormatSupport.readScenarioSteps(json);
                    }

                    @Override
                    public RunStepComputation executeDefinition(
                            ApiDefinitionEntity definition,
                            String stepName,
                            int stepOrder,
                            Map<String, String> variables,
                            ResolvedEnvironment environment
                    ) {
                        return ApiExecutionEngineSupport.this.executeDefinition(definition, stepName, stepOrder, variables, environment);
                    }

                    @Override
                    public RunStepComputation executeCase(
                            ApiDefinitionCaseEntity apiCase,
                            String stepName,
                            int stepOrder,
                            Map<String, String> variables,
                            ResolvedEnvironment environment
                    ) {
                        return ApiExecutionEngineSupport.this.executeCase(apiCase, stepName, stepOrder, variables, environment);
                    }

                    @Override
                    public RunStepComputation executeCustomRequestStep(
                            ApiScenarioStepInput step,
                            int stepOrder,
                            Map<String, String> variables,
                            ResolvedEnvironment environment,
                            Long workspaceId
                    ) {
                        return ApiExecutionEngineSupport.this.executeCustomRequestStep(step, stepOrder, variables, environment, workspaceId);
                    }
                }
        );
    }

    private RunStepComputation executeCustomRequestStep(
            ApiScenarioStepInput step,
            int stepOrder,
            Map<String, String> variables,
            ResolvedEnvironment environment,
            Long workspaceId
    ) {
        ApiRequestConfigInput requestConfig = step.requestConfig();
        if (requestConfig == null) {
            throw new BadRequestException("Custom request step requires request config");
        }
        ApiDefinitionEntity runtimeDefinition = new ApiDefinitionEntity();
        runtimeDefinition.setId(null);
        runtimeDefinition.setWorkspaceId(workspaceId);
        runtimeDefinition.setDefinitionName(blankToFallback(step.stepName(), requestConfig.method() + " " + requestConfig.path()));
        runtimeDefinition.setHttpMethod(Optional.ofNullable(requestConfig.method()).orElse("GET").trim().toUpperCase(Locale.ROOT));
        runtimeDefinition.setPath(Optional.ofNullable(requestConfig.path()).orElse(""));
        runtimeDefinition.setRequestJson(ApiAutomationJsonSupport.toJson(requestConfig, "Failed to serialize custom request"));
        runtimeDefinition.setAssertionsJson(ApiAutomationJsonSupport.toJson(defaultList(step.assertions()), "Failed to serialize custom request assertions"));
        runtimeDefinition.setPreprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(step.preProcessors(), "PRE"),
                "Failed to serialize custom request preprocessors"));
        runtimeDefinition.setPostprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(step.postProcessors(), "POST"),
                "Failed to serialize custom request postprocessors"));
        runtimeDefinition.setExtractorsJson("[]");
        return executeDefinition(runtimeDefinition, runtimeDefinition.getDefinitionName(), stepOrder, variables, environment);
    }

    private List<ApiAssertionResult> evaluateAssertions(
            List<ApiAssertionInput> assertions,
            ApiRequestSnapshot request,
            ApiResponseSnapshot response,
            long durationMs,
            Map<String, String> variables
    ) {
        return assertionEvaluator.evaluate(assertions, request, response, durationMs, variables);
    }

    void persistStep(ReportEntity report, Long workspaceId, RunStepComputation computation) {
        runResultPersistenceSupport.persistStep(report, workspaceId, computation);
    }

    void finalizeRunDefinition(ApiDefinitionEntity definition, boolean success, TaskEntity task, ReportEntity report, RunStepComputation step) {
        runFinalizerSupport.finalizeRunDefinition(definition, success, task, report, step);
    }

    void finalizeRunCase(ApiDefinitionCaseEntity apiCase, boolean success, TaskEntity task, ReportEntity report, RunStepComputation step) {
        runFinalizerSupport.finalizeRunCase(apiCase, success, task, report, step);
    }

    void finalizeRunScenario(ApiScenarioEntity scenario, boolean success, String failureSummary, TaskEntity task, ReportEntity report) {
        runFinalizerSupport.finalizeRunScenario(scenario, success, failureSummary, task, report);
    }

    void finalizeRunTaskAndReport(TaskEntity task, ReportEntity report, String result, String failureSummary) {
        runFinalizerSupport.finalizeRunTaskAndReport(task, report, result, failureSummary);
    }

    void persistCaseRunHistory(
            ApiDefinitionCaseEntity apiCase,
            ReportEntity report,
            RunStepComputation step,
            Long environmentId,
            Long variableSetId,
            String contextSnapshotJson
    ) {
        runResultPersistenceSupport.persistCaseRunHistory(apiCase, report, step, environmentId, variableSetId, contextSnapshotJson);
    }

    private String extractJsonValue(String body, String expression) throws IOException {
        if (body == null || body.isBlank()) {
            return "";
        }
        JsonNode current = OBJECT_MAPPER.readTree(body);
        String normalized = Optional.ofNullable(expression).orElse("").trim();
        if (normalized.startsWith("$.")) {
            normalized = normalized.substring(2);
        } else if (normalized.startsWith("$")) {
            normalized = normalized.substring(1);
        }
        if (normalized.isBlank()) {
            return current.isValueNode() ? current.asText() : current.toString();
        }
        for (String segment : normalized.split("\\.")) {
            Matcher matcher = Pattern.compile("([\\w-]+)(\\[(\\d+)])?").matcher(segment);
            if (!matcher.matches()) {
                return "";
            }
            current = current.path(matcher.group(1));
            if (matcher.group(3) != null) {
                current = current.path(Integer.parseInt(matcher.group(3)));
            }
        }
        return current.isMissingNode() || current.isNull() ? "" : (current.isValueNode() ? current.asText() : current.toString());
    }

    private String extractValue(ApiResponseSnapshot response, String sourceType, String expression) throws IOException {
        String type = Optional.ofNullable(sourceType).orElse("").trim().toUpperCase();
        return switch (type) {
            case "BODY_JSONPATH" -> extractJsonValue(response.body(), expression);
            case "HEADER" -> Optional.ofNullable(response.headers().get(expression)).orElse("");
            case "STATUS_CODE" -> String.valueOf(response.statusCode());
            default -> throw new BadRequestException("Unsupported extractor type: " + type);
        };
    }

    String firstFailedMessage(List<ApiAssertionResult> results) {
        return assertionSupport.firstFailedMessage(results);
    }

    private List<ApiProcessorInput> readPreProcessors(ApiDefinitionEntity entity) {
        return normalizeProcessors(ApiAutomationFormatSupport.readProcessorsJson(entity.getPreprocessorsJson()), "PRE");
    }

    private List<ApiProcessorInput> readPostProcessors(ApiDefinitionEntity entity) {
        return normalizePostProcessors(
                ApiAutomationFormatSupport.readProcessorsJson(entity.getPostprocessorsJson()),
                ApiAutomationFormatSupport.readExtractors(entity.getExtractorsJson())
        );
    }

    private List<ApiScenarioAssertionInput> normalizeScenarioAssertions(List<ApiScenarioAssertionInput> assertions) {
        List<ApiScenarioAssertionInput> normalized = new ArrayList<>();
        int index = 0;
        for (ApiScenarioAssertionInput assertion : defaultList(assertions)) {
            if (assertion == null || Boolean.FALSE.equals(assertion.enabled())) {
                continue;
            }
            String assertionType = blankToFallback(assertion.assertionType(), "ALL_STEPS_PASSED").toUpperCase(Locale.ROOT);
            String operator = blankToFallback(assertion.operator(), defaultScenarioAssertionOperator(assertionType)).toUpperCase(Locale.ROOT);
            normalized.add(new ApiScenarioAssertionInput(
                    blankToFallback(assertion.id(), "scenario-assertion-" + index++),
                    blankToFallback(assertion.name(), defaultScenarioAssertionName(assertionType)),
                    assertionType,
                    operator,
                    Optional.ofNullable(assertion.expectedValue()).orElse(""),
                    true
            ));
        }
        return normalized;
    }

    List<ApiAssertionResult> evaluateScenarioAssertions(
            List<ApiScenarioAssertionInput> assertions,
            List<ApiRunStepResultResponse> responses
    ) {
        List<ApiAssertionResult> results = new ArrayList<>();
        int failedCount = (int) defaultList(responses).stream().filter(step -> !step.success()).count();
        int stepCount = defaultList(responses).size();
        long totalDuration = defaultList(responses).stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(value -> value != null)
                .mapToLong(Long::longValue)
                .sum();
        for (ApiScenarioAssertionInput assertion : normalizeScenarioAssertions(assertions)) {
            String type = blankToFallback(assertion.assertionType(), "ALL_STEPS_PASSED").toUpperCase(Locale.ROOT);
            String actual = switch (type) {
                case "FAILED_COUNT_EQUALS", "FAILED_COUNT_LTE" -> String.valueOf(failedCount);
                case "TOTAL_DURATION_LT" -> String.valueOf(totalDuration);
                case "STEP_COUNT_EQUALS" -> String.valueOf(stepCount);
                default -> failedCount == 0 ? "true" : "false";
            };
            String expected = switch (type) {
                case "ALL_STEPS_PASSED" -> "true";
                default -> Optional.ofNullable(assertion.expectedValue()).orElse("0");
            };
            String condition = scenarioAssertionCondition(type, assertion.operator());
            ApiAssertionSupport.ApiAssertionComparison comparison = assertionSupport.compareValue(actual, condition, expected);
            results.add(new ApiAssertionResult(
                    assertion.id(),
                    "SCENARIO",
                    assertion.name(),
                    type,
                    condition,
                    expected,
                    actual,
                    comparison.success(),
                    comparison.message()
            ));
        }
        return results;
    }

    private String scenarioAssertionCondition(String assertionType, String operator) {
        String type = Optional.ofNullable(assertionType).orElse("").trim().toUpperCase(Locale.ROOT);
        if ("ALL_STEPS_PASSED".equals(type)) {
            return "EQUALS";
        }
        if ("FAILED_COUNT_LTE".equals(type)) {
            return "LT_OR_EQUALS";
        }
        if ("TOTAL_DURATION_LT".equals(type)) {
            return "LT";
        }
        return assertionSupport.normalizeAssertionCondition(operator, defaultScenarioAssertionOperator(type));
    }

    private String defaultScenarioAssertionOperator(String assertionType) {
        return switch (Optional.ofNullable(assertionType).orElse("").trim().toUpperCase(Locale.ROOT)) {
            case "FAILED_COUNT_LTE" -> "LT_OR_EQUALS";
            case "TOTAL_DURATION_LT" -> "LT";
            default -> "EQUALS";
        };
    }

    private String defaultScenarioAssertionName(String assertionType) {
        return switch (Optional.ofNullable(assertionType).orElse("").trim().toUpperCase(Locale.ROOT)) {
            case "FAILED_COUNT_EQUALS" -> "Failed count equals";
            case "FAILED_COUNT_LTE" -> "Failed count less than or equals";
            case "TOTAL_DURATION_LT" -> "Total duration less than";
            case "STEP_COUNT_EQUALS" -> "Step count equals";
            default -> "All steps passed";
        };
    }

    private void validateReadable(Long workspaceId, String workspaceCode, String message) {
        workspaceScopeSupport.validateReadable(workspaceId, workspaceCode, message);
    }

    ApiDefinitionEntity requireDefinition(Long id) {
        ApiDefinitionEntity entity = definitionMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API definition not found");
        }
        return entity;
    }

    ApiDefinitionCaseEntity requireCase(Long id) {
        ApiDefinitionCaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API case not found");
        }
        return entity;
    }

    ApiScenarioEntity requireScenario(Long id) {
        ApiScenarioEntity entity = scenarioMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API scenario not found");
        }
        return entity;
    }

    private EnvConfigEntity requireEnvironment(Long id) {
        EnvConfigEntity entity = envConfigMapper.selectById(id);
        if (entity == null || !ApiEnvironmentTypeSupport.isApiUsable(entity.getEnvType())) {
            throw new NotFoundException("API environment not found");
        }
        return entity;
    }

    private ParamSetEntity requireVariableSet(Long id) {
        ParamSetEntity entity = paramSetMapper.selectById(id);
        if (entity == null || !isApiRuntimeVariableSet(entity.getParamType())) {
            throw new NotFoundException("API variable set not found");
        }
        return entity;
    }

    private boolean isApiRuntimeVariableSet(String paramType) {
        return API_VARIABLE_SET_TYPE.equals(paramType)
                || BUSINESS_VARIABLE_SET_TYPE.equals(paramType)
                || PAYMENT_CHANNEL_VARIABLE_SET_TYPE.equals(paramType);
    }

    private void ensureVariableSetInWorkspace(ParamSetEntity variableSet, Long workspaceId) {
        if (!variableSet.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Variable set must belong to the same workspace");
        }
    }

    private void ensureDefinitionInWorkspace(ApiDefinitionEntity definition, Long workspaceId, String message) {
        if (!definition.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private ApiRequestConfigInput readStoredRequestConfig(String json, String methodFallback, String pathFallback) {
        return ApiAutomationJsonSupport.read(json, ApiRequestConfigInput.class,
                new ApiRequestConfigInput(methodFallback, pathFallback, 10000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig()));
    }

    private String normalizeScenarioStepType(ApiScenarioStepInput step) {
        String rawType = blankToNull(step.stepType());
        if (rawType == null) {
            String resourceType = Optional.ofNullable(step.resourceType()).orElse(SCENARIO_RESOURCE_TYPE_DEFINITION).trim().toUpperCase(Locale.ROOT);
            rawType = SCENARIO_RESOURCE_TYPE_CASE.equals(resourceType) ? SCENARIO_STEP_API_CASE : SCENARIO_STEP_API;
        }
        String normalized = rawType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case SCENARIO_RESOURCE_TYPE_DEFINITION -> SCENARIO_STEP_API;
            case SCENARIO_RESOURCE_TYPE_CASE -> SCENARIO_STEP_API_CASE;
            case SCENARIO_STEP_API, SCENARIO_STEP_API_CASE, SCENARIO_STEP_CUSTOM_REQUEST, SCENARIO_STEP_API_SCENARIO,
                 SCENARIO_STEP_IF_CONTROLLER, SCENARIO_STEP_LOOP_CONTROLLER, SCENARIO_STEP_ONCE_ONLY_CONTROLLER,
                 SCENARIO_STEP_CONSTANT_TIMER, SCENARIO_STEP_SCRIPT -> normalized;
            default -> throw new BadRequestException("Unsupported scenario step type: " + normalized);
        };
    }

    private String normalizeScenarioResourceTypeForStep(String stepType) {
        return switch (stepType) {
            case SCENARIO_STEP_API -> SCENARIO_RESOURCE_TYPE_DEFINITION;
            case SCENARIO_STEP_API_CASE -> SCENARIO_RESOURCE_TYPE_CASE;
            default -> null;
        };
    }

    private String normalizeScenarioStepRefType(ApiScenarioStepInput step) {
        String raw = blankToNull(step.refType());
        if (raw != null) {
            String normalized = raw.toUpperCase(Locale.ROOT);
            if (SCENARIO_STEP_REF_COPY.equals(normalized) || SCENARIO_STEP_REF_REF.equals(normalized) || SCENARIO_STEP_REF_DIRECT.equals(normalized)) {
                return normalized;
            }
        }
        String stepType = normalizeScenarioStepType(step);
        if (SCENARIO_STEP_API.equals(stepType) || SCENARIO_STEP_API_CASE.equals(stepType) || SCENARIO_STEP_API_SCENARIO.equals(stepType)) {
            return SCENARIO_STEP_REF_REF;
        }
        return SCENARIO_STEP_REF_DIRECT;
    }

    private Long normalizeScenarioResourceId(ApiScenarioStepInput step) {
        Long resourceId = step.resourceId();
        if (resourceId == null) {
            throw new BadRequestException("Scenario step resource cannot be blank");
        }
        return resourceId;
    }

    private MutableRequestConfig toMutableRequestConfig(ApiRequestConfigInput config) {
        return new MutableRequestConfig(
                Optional.ofNullable(config.method()).orElse("GET"),
                Optional.ofNullable(config.path()).orElse(""),
                config.timeoutMs(),
                new ArrayList<>(defaultList(config.queryParams())),
                new ArrayList<>(defaultList(config.headers())),
                new ArrayList<>(defaultList(config.cookies())),
                config.body() == null ? new ApiRequestBodyInput("NONE", null, List.of(), null, null, null) : config.body(),
                normalizeAuth(config.authConfig())
        );
    }

    private ApiRequestConfigInput toRequestConfig(MutableRequestConfig config) {
        return new ApiRequestConfigInput(
                config.method(),
                config.path(),
                config.timeoutMs(),
                config.queryParams(),
                config.headers(),
                config.cookies(),
                config.body(),
                config.authConfig()
        );
    }

}

