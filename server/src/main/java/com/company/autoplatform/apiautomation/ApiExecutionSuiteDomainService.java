package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.notification.NotificationDomainService;
import com.company.autoplatform.notification.NotificationModels;
import com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import com.company.autoplatform.runner.LocalRunnerService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.readScenarioSteps;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiExecutionSuiteDomainService {

    private static final int DEFAULT_SUITE_GLOBAL_TIMEOUT_MS = 300000;
    private static final int MAX_SUITE_GLOBAL_TIMEOUT_MS = 3600000;
    private static final int MAX_SUITE_STEP_RETRY_COUNT = 5;
    private static final int MAX_SUITE_STEP_WAIT_MS = 60000;

    private final ApiExecutionSuiteModuleMapper suiteModuleMapper;
    private final ApiExecutionSuiteMapper suiteMapper;
    private final ApiExecutionSuiteItemMapper suiteItemMapper;
    private final ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper;
    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final ApiDataFileDomainService dataFileDomainService;
    private final ObjectProvider<ApiExecutionDomainService> executionDomainServiceProvider;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final LocalRunnerService localRunnerService;
    private final NotificationDomainService notificationDomainService;

    public ApiExecutionSuiteDomainService(
            ApiExecutionSuiteModuleMapper suiteModuleMapper,
            ApiExecutionSuiteMapper suiteMapper,
            ApiExecutionSuiteItemMapper suiteItemMapper,
            ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper,
            ApiDefinitionCaseMapper caseMapper,
            ApiScenarioMapper scenarioMapper,
            ApiDataFileDomainService dataFileDomainService,
            ObjectProvider<ApiExecutionDomainService> executionDomainServiceProvider,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            LocalRunnerService localRunnerService,
            NotificationDomainService notificationDomainService
    ) {
        this.suiteModuleMapper = suiteModuleMapper;
        this.suiteMapper = suiteMapper;
        this.suiteItemMapper = suiteItemMapper;
        this.suiteRunHistoryMapper = suiteRunHistoryMapper;
        this.caseMapper = caseMapper;
        this.scenarioMapper = scenarioMapper;
        this.dataFileDomainService = dataFileDomainService;
        this.executionDomainServiceProvider = executionDomainServiceProvider;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.localRunnerService = localRunnerService;
        this.notificationDomainService = notificationDomainService;
    }

    public List<ApiExecutionSuiteModuleItem> listSuiteModules(String workspaceCode) {
        WorkspaceEntity scopedWorkspace = workspaceScopeSupport.resolveScopedWorkspace(workspaceCode);
        LambdaQueryWrapper<ApiExecutionSuiteModuleEntity> query = new LambdaQueryWrapper<>();
        if (scopedWorkspace != null) {
            query.eq(ApiExecutionSuiteModuleEntity::getWorkspaceId, scopedWorkspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(ApiExecutionSuiteModuleEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        List<ApiExecutionSuiteModuleEntity> modules = suiteModuleMapper.selectList(query
                .orderByAsc(ApiExecutionSuiteModuleEntity::getSortOrder)
                .orderByAsc(ApiExecutionSuiteModuleEntity::getId));
        Map<Long, Long> counts = suiteMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteEntity>())
                .stream()
                .filter(suite -> modules.stream().anyMatch(module -> module.getWorkspaceId().equals(suite.getWorkspaceId())))
                .filter(suite -> suite.getModuleId() != null)
                .collect(java.util.stream.Collectors.groupingBy(ApiExecutionSuiteEntity::getModuleId, java.util.stream.Collectors.counting()));
        return buildSuiteModuleTree(modules, counts, null);
    }

    public ApiExecutionSuiteModuleItem createSuiteModule(String headerWorkspaceCode, ApiExecutionSuiteModuleRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (request.parentId() != null) {
            ApiExecutionSuiteModuleEntity parent = requireSuiteModule(request.parentId());
            if (!parent.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
        }
        ensureSuiteModuleNameUnique(workspace.getId(), request.parentId(), null, request.name());
        ApiExecutionSuiteModuleEntity entity = new ApiExecutionSuiteModuleEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setParentId(request.parentId());
        entity.setModuleName(request.name().trim());
        entity.setSortOrder(nextSuiteModuleSort(workspace.getId(), request.parentId()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteModuleMapper.insert(entity);
        return toSuiteModuleItem(entity, 0L, List.of());
    }

    public ApiExecutionSuiteModuleItem updateSuiteModule(Long id, String workspaceCode, ApiExecutionSuiteModuleRequest request) {
        ApiExecutionSuiteModuleEntity entity = requireSuiteModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the execution suite module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        ensureSuiteModuleNameUnique(entity.getWorkspaceId(), entity.getParentId(), id, request.name());
        entity.setModuleName(request.name().trim());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteModuleMapper.updateById(entity);
        return toSuiteModuleItem(entity, countSuitesInModule(id), List.of());
    }

    public ApiExecutionSuiteModuleItem moveSuiteModule(Long id, String workspaceCode, MoveApiExecutionSuiteModuleRequest request) {
        ApiExecutionSuiteModuleEntity entity = requireSuiteModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot move the execution suite module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (request.parentId() != null) {
            ApiExecutionSuiteModuleEntity parent = requireSuiteModule(request.parentId());
            if (!parent.getWorkspaceId().equals(entity.getWorkspaceId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
            if (suiteModuleDescendantIds(entity.getWorkspaceId(), id).contains(request.parentId())) {
                throw new BadRequestException("Cannot move module under itself");
            }
        }
        ensureSuiteModuleNameUnique(entity.getWorkspaceId(), request.parentId(), id, entity.getModuleName());
        entity.setParentId(request.parentId());
        entity.setSortOrder(request.sortOrder() == null ? nextSuiteModuleSort(entity.getWorkspaceId(), request.parentId()) : request.sortOrder());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteModuleMapper.updateById(entity);
        return toSuiteModuleItem(entity, countSuitesInModule(id), List.of());
    }

    public void deleteSuiteModule(Long id, String workspaceCode) {
        ApiExecutionSuiteModuleEntity entity = requireSuiteModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the execution suite module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (suiteModuleMapper.selectCount(new LambdaQueryWrapper<ApiExecutionSuiteModuleEntity>()
                .eq(ApiExecutionSuiteModuleEntity::getParentId, id)) > 0) {
            throw new BadRequestException("Cannot delete a module that contains child modules");
        }
        if (suiteMapper.selectCount(new LambdaQueryWrapper<ApiExecutionSuiteEntity>()
                .eq(ApiExecutionSuiteEntity::getModuleId, id)) > 0) {
            throw new BadRequestException("Cannot delete a module that contains execution suites");
        }
        suiteModuleMapper.deleteById(id);
    }

    public PageResponse<ApiExecutionSuiteItem> listSuites(
            String workspaceCode,
            Long moduleId,
            String keyword,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<ApiExecutionSuiteEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiExecutionSuiteEntity::getWorkspaceId, workspaceCode);
        if (moduleId != null) {
            ApiExecutionSuiteModuleEntity module = requireSuiteModule(moduleId);
            workspaceScopeSupport.validateReadable(module.getWorkspaceId(), workspaceCode, "Current workspace cannot access the execution suite module");
            query.in(ApiExecutionSuiteEntity::getModuleId, suiteModuleDescendantIds(module.getWorkspaceId(), moduleId));
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper.like(ApiExecutionSuiteEntity::getSuiteName, trimmedKeyword)
                    .or()
                    .like(ApiExecutionSuiteEntity::getDescription, trimmedKeyword));
        }
        List<ApiExecutionSuiteItem> items = suiteMapper.selectList(query.orderByDesc(ApiExecutionSuiteEntity::getUpdatedAt))
                .stream()
                .map(this::toSuiteItem)
                .toList();
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? (items.isEmpty() ? 10 : items.size()) : pageSize;
        int fromIndex = Math.min((safePageNo - 1) * safePageSize, items.size());
        int toIndex = Math.min(fromIndex + safePageSize, items.size());
        return PageResponse.of(items.subList(fromIndex, toIndex), items.size(), safePageNo, safePageSize);
    }

    public ApiExecutionSuiteDetail getSuite(Long id, String workspaceCode) {
        ApiExecutionSuiteEntity entity = requireSuite(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the execution suite");
        return toSuiteDetail(entity);
    }

    public ApiExecutionSuiteDetail createSuite(String headerWorkspaceCode, SaveApiExecutionSuiteRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ApiExecutionSuiteEntity entity = new ApiExecutionSuiteEntity();
        fillSuiteEntity(entity, workspace, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteMapper.insert(entity);
        return toSuiteDetail(entity);
    }

    public ApiExecutionSuiteDetail updateSuite(Long id, String headerWorkspaceCode, SaveApiExecutionSuiteRequest request) {
        ApiExecutionSuiteEntity entity = requireSuite(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the execution suite");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move an execution suite to another workspace");
        }
        fillSuiteEntity(entity, workspace, request);
        entity.setUpdatedAt(LocalDateTime.now());
        suiteMapper.updateById(entity);
        return toSuiteDetail(entity);
    }

    public void deleteSuite(Long id, String workspaceCode) {
        ApiExecutionSuiteEntity entity = requireSuite(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the execution suite");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        suiteItemMapper.delete(new LambdaQueryWrapper<ApiExecutionSuiteItemEntity>()
                .eq(ApiExecutionSuiteItemEntity::getSuiteId, id));
        suiteMapper.deleteById(id);
    }

    public List<ApiExecutionSuiteItemDetail> listSuiteItems(Long suiteId, String workspaceCode) {
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot access the execution suite");
        return suiteItemMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteItemEntity>()
                        .eq(ApiExecutionSuiteItemEntity::getSuiteId, suiteId)
                        .orderByAsc(ApiExecutionSuiteItemEntity::getSortOrder)
                        .orderByAsc(ApiExecutionSuiteItemEntity::getId))
                .stream()
                .map(this::toSuiteItemDetail)
                .toList();
    }

    public ApiExecutionSuiteItemDetail addSuiteItem(Long suiteId, String workspaceCode, ApiExecutionSuiteItemRequest request) {
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the execution suite");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(suite.getWorkspaceId()).getWorkspaceCode());
        ResolvedSuiteItem resolved = resolveSuiteItem(suite.getWorkspaceId(), request.itemType(), request.itemId());
        ApiExecutionSuiteItemEntity entity = new ApiExecutionSuiteItemEntity();
        entity.setWorkspaceId(suite.getWorkspaceId());
        entity.setSuiteId(suiteId);
        entity.setItemType(resolved.itemType());
        entity.setItemId(request.itemId());
        entity.setItemNameSnapshot(resolved.itemName());
        entity.setSortOrder(nextSuiteItemSort(suiteId));
        entity.setEnabled(request.enabled() == null || request.enabled());
        entity.setDescription(blankToNull(request.description()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteItemMapper.insert(entity);
        return toSuiteItemDetail(entity);
    }

    public List<ApiExecutionSuiteItemDetail> reorderSuiteItems(Long suiteId, String workspaceCode, ApiExecutionSuiteItemOrderRequest request) {
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the execution suite");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(suite.getWorkspaceId()).getWorkspaceCode());
        for (ApiExecutionSuiteItemOrderInput item : request.items() == null ? List.<ApiExecutionSuiteItemOrderInput>of() : request.items()) {
            ApiExecutionSuiteItemEntity entity = requireSuiteItem(suiteId, item.id());
            entity.setSortOrder(item.sortOrder() == null ? entity.getSortOrder() : item.sortOrder());
            if (item.enabled() != null) {
                entity.setEnabled(item.enabled());
            }
            entity.setUpdatedAt(LocalDateTime.now());
            suiteItemMapper.updateById(entity);
        }
        return listSuiteItems(suiteId, workspaceCode);
    }

    public void deleteSuiteItem(Long suiteId, Long itemId, String workspaceCode) {
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the execution suite");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(suite.getWorkspaceId()).getWorkspaceCode());
        requireSuiteItem(suiteId, itemId);
        suiteItemMapper.deleteById(itemId);
    }

    public ApiRunResponse runSuite(Long suiteId, String workspaceCode, ApiRunRequest request) {
        if (WorkspaceScope.isAll(WorkspaceScope.normalize(workspaceCode))) {
            throw new BadRequestException("Please switch to a concrete workspace before running execution suite");
        }
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot run the execution suite");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(suite.getWorkspaceId()).getWorkspaceCode());
        List<ApiExecutionSuiteItemEntity> enabledItems = suiteItemMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteItemEntity>()
                        .eq(ApiExecutionSuiteItemEntity::getSuiteId, suiteId)
                        .eq(ApiExecutionSuiteItemEntity::getEnabled, true)
                        .orderByAsc(ApiExecutionSuiteItemEntity::getSortOrder)
                        .orderByAsc(ApiExecutionSuiteItemEntity::getId));
        if (enabledItems.isEmpty()) {
            throw new BadRequestException("Execution suite has no enabled items to run");
        }

        ApiRunRequest effectiveRequest = new ApiRunRequest(
                workspace.getWorkspaceCode(),
                request == null || request.environmentId() == null ? suite.getEnvironmentId() : request.environmentId(),
                request == null || request.variableSetId() == null ? suite.getVariableSetId() : request.variableSetId(),
                request == null || request.branchName() == null || request.branchName().isBlank() ? suite.getBranchName() : request.branchName(),
                request == null || request.triggerSource() == null || request.triggerSource().isBlank() ? "MANUAL" : request.triggerSource(),
                request == null || request.runOn() == null || request.runOn().isBlank() ? suite.getRunOn() : request.runOn(),
                null,
                null,
                null,
                null,
                request == null ? null : request.mockEnabled(),
                request == null ? null : request.mockApplicationId(),
                request == null ? null : request.mockBusinessScenarioId(),
                request == null ? null : request.rowVariables(),
                request == null ? null : request.runnerId()
        );
        SuiteExecutionPolicy policy = SuiteExecutionPolicy.of(
                Boolean.TRUE.equals(suite.getContinueOnFailure()),
                suite.getGlobalTimeoutMs(),
                suite.getStepFailureRetryCount(),
                suite.getDefaultStepWaitMs()
        );
        if (isLocalRunnerRun(effectiveRequest.runOn())) {
            return createLocalRunnerSuiteRun(suite, workspace, enabledItems, effectiveRequest, policy);
        }
        SuiteRunAggregate aggregate = runSuiteAggregate(suite, workspace, enabledItems, effectiveRequest, policy);
        suite.setLastRunResult(aggregate.success() ? "SUCCESS" : "FAILED");
        suite.setLastRunAt(LocalDateTime.now());
        suite.setUpdatedAt(LocalDateTime.now());
        suiteMapper.updateById(suite);
        String contextSnapshotJson = executionDomainServiceProvider.getObject().buildExecutionContextSnapshot(
                suite.getWorkspaceId(),
                effectiveRequest.environmentId(),
                effectiveRequest.variableSetId(),
                effectiveRequest.mockApplicationId(),
                effectiveRequest.mockEnabled()
        );
        ApiExecutionSuiteRunHistoryEntity history = persistSuiteRunHistory(suite, effectiveRequest, aggregate.success(), aggregate.failureSummary(), aggregate.stepResults(), aggregate.itemSnapshots(), aggregate.dataIterations(), aggregate.reportId(), contextSnapshotJson);
        ApiRunResponse response = new ApiRunResponse(
                aggregate.taskId(),
                aggregate.reportId(),
                "Execution suite",
                suite.getSuiteName(),
                aggregate.success() ? "SUCCESS" : "FAILED",
                aggregate.failureSummary(),
                aggregate.dataIterations(),
                aggregate.stepResults()
        );
        publishSuiteNotificationIfNeeded(suite, history, aggregate);
        return response;
    }

    private SuiteRunAggregate runSuiteAggregate(
            ApiExecutionSuiteEntity suite,
            WorkspaceEntity workspace,
            List<ApiExecutionSuiteItemEntity> enabledItems,
            ApiRunRequest effectiveRequest,
            SuiteExecutionPolicy policy
    ) {
        if (!Boolean.TRUE.equals(suite.getDataDrivenEnabled())) {
            return runSuiteOnce(enabledItems, workspace.getWorkspaceCode(), effectiveRequest, policy, null);
        }
        if (suite.getDataFileId() == null) {
            throw new BadRequestException("Execution suite data file is missing");
        }
        List<ApiDataFileDomainService.ApiDataFileRuntimeRow> rows = dataFileDomainService.readDataRows(suite.getDataFileId(), suite.getWorkspaceId());
        if (rows.isEmpty()) {
            throw new BadRequestException("Execution suite data file has no data rows");
        }
        List<ApiRunStepResultResponse> stepResults = new ArrayList<>();
        List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots = new ArrayList<>();
        List<ApiExecutionSuiteDataIteration> dataIterations = new ArrayList<>();
        Long taskId = null;
        Long reportId = null;
        boolean success = true;
        String failureSummary = null;
        for (ApiDataFileDomainService.ApiDataFileRuntimeRow row : rows) {
            ApiRunRequest rowRequest = new ApiRunRequest(
                    effectiveRequest.workspaceCode(),
                    effectiveRequest.environmentId(),
                   effectiveRequest.variableSetId(),
                   effectiveRequest.branchName(),
                   effectiveRequest.triggerSource(),
                   effectiveRequest.runOn(),
                   effectiveRequest.testDatasetEnabled(),
                    effectiveRequest.testDatasetId(),
                    effectiveRequest.loopCount(),
                    effectiveRequest.threadCount(),
                    effectiveRequest.mockEnabled(),
                    effectiveRequest.mockApplicationId(),
                    effectiveRequest.mockBusinessScenarioId(),
                    row.values(),
                    effectiveRequest.runnerId()
            );
            SuiteRunAggregate rowRun = runSuiteOnce(enabledItems, workspace.getWorkspaceCode(), rowRequest, policy, row);
            if (taskId == null) {
                taskId = rowRun.taskId();
                reportId = rowRun.reportId();
            }
            stepResults.addAll(rowRun.stepResults());
            itemSnapshots.addAll(rowRun.itemSnapshots());
            dataIterations.add(toDataIteration(row, rowRun));
            if (!rowRun.success()) {
                success = false;
                if (failureSummary == null) {
                    failureSummary = "Row " + row.rowIndex() + " failed: " + blankToFallback(rowRun.failureSummary(), "Suite row failed");
                }
                if ("STOP_ON_ROW_FAILURE".equals(blankToFallback(suite.getDataFailureStrategy(), "STOP_ON_ROW_FAILURE"))) {
                    break;
                }
            }
        }
        return new SuiteRunAggregate(taskId, reportId, success, failureSummary, stepResults, itemSnapshots, dataIterations);
    }

    private ApiRunResponse createLocalRunnerSuiteRun(
            ApiExecutionSuiteEntity suite,
            WorkspaceEntity workspace,
            List<ApiExecutionSuiteItemEntity> enabledItems,
            ApiRunRequest effectiveRequest,
            SuiteExecutionPolicy policy
    ) {
        ApiExecutionDomainService executionDomainService = executionDomainServiceProvider.getObject();
        ApiExecutionRuntimeModels.ExecutionContext context = executionDomainService.buildExecutionContextForSuiteLocalRunner(
                suite.getWorkspaceId(),
                effectiveRequest.environmentId(),
                effectiveRequest.variableSetId(),
                effectiveRequest.rowVariables(),
                effectiveRequest.mockApplicationId(),
                effectiveRequest.mockEnabled(),
                effectiveRequest.mockBusinessScenarioId()
        );
        String contextSnapshotJson = context.contextSnapshotJson();
        ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector = ApiLocalRunnerPayloadSupport.artifactCollector();
        Map<String, Object> payload = buildApiLocalRunnerSuitePayload(suite, enabledItems, effectiveRequest, policy, contextSnapshotJson, artifactCollector);

        RunnerTaskDetailResponse task = localRunnerService.createDebugTask(new CreateRunnerTaskCommand(
                suite.getWorkspaceId(),
                workspace.getWorkspaceCode(),
                "api_suite_" + suite.getId() + "_" + System.currentTimeMillis(),
                "API_SUITE_RUN",
                "LOCAL_RUNNER",
                effectiveRequest.runnerId(),
                null,
                "1.0",
                blankToFallback(effectiveRequest.triggerSource(), "MANUAL"),
                1,
                null,
                buildApiLocalRunnerSuiteTimeoutPolicy(policy),
                buildApiLocalRunnerSuiteEnvironmentSnapshot(effectiveRequest.environmentId(), context.environment(), contextSnapshotJson),
                buildApiLocalRunnerSuiteVariableSnapshot(effectiveRequest.variableSetId(), context.variables()),
                Map.of(),
                artifactCollector.artifactRefs(),
                ApiLocalRunnerPayloadSupport.defaultMaskingRules(),
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

    private Map<String, Object> buildApiLocalRunnerSuiteTimeoutPolicy(SuiteExecutionPolicy policy) {
        Map<String, Object> values = new java.util.LinkedHashMap<>();
        values.put("taskTimeoutMs", policy.globalTimeoutMs());
        values.put("requestTimeoutMs", 30000);
        values.put("scriptTimeoutMs", 1000);
        values.put("stepFailureRetryCount", policy.stepFailureRetryCount());
        values.put("defaultStepWaitMs", policy.defaultStepWaitMs());
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerSuiteEnvironmentSnapshot(
            Long environmentId,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            String contextSnapshotJson
    ) {
        Map<String, Object> values = new java.util.LinkedHashMap<>();
        values.put("environmentId", environmentId);
        values.put("baseUrl", environment == null ? null : environment.baseUrl());
        values.put("timeoutMs", environment == null ? null : environment.timeoutMs());
        values.put("defaultServiceKey", environment == null ? null : environment.defaultServiceKey());
        values.put("services", environment == null ? List.of() : environment.services());
        values.put("contextSnapshotJson", contextSnapshotJson);
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerSuiteVariableSnapshot(Long variableSetId, Map<String, String> variables) {
        Map<String, Object> values = new java.util.LinkedHashMap<>();
        values.put("variableSetId", variableSetId);
        values.put("variables", variables == null ? Map.of() : new java.util.LinkedHashMap<>(variables));
        return values;
    }

    private Map<String, Object> buildApiLocalRunnerSuitePayload(
            ApiExecutionSuiteEntity suite,
            List<ApiExecutionSuiteItemEntity> enabledItems,
            ApiRunRequest effectiveRequest,
            SuiteExecutionPolicy policy,
            String contextSnapshotJson,
            ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector
    ) {
        Map<String, Object> suiteSnapshot = new java.util.LinkedHashMap<>();
        suiteSnapshot.put("suiteId", suite.getId());
        suiteSnapshot.put("suiteName", suite.getSuiteName());
        suiteSnapshot.put("runMode", suite.getRunMode());
        suiteSnapshot.put("items", enabledItems.stream()
                .map(item -> buildApiLocalRunnerSuiteItem(item, artifactCollector))
                .toList());

        Map<String, Object> runOptions = new java.util.LinkedHashMap<>();
        runOptions.put("stopOnFirstFailure", !policy.continueOnFailure());
        runOptions.put("formalReport", true);
        runOptions.put("debugMode", false);
        runOptions.put("environmentId", effectiveRequest.environmentId());
        runOptions.put("variableSetId", effectiveRequest.variableSetId());
        runOptions.put("contextSnapshotJson", contextSnapshotJson);

        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("suiteSnapshot", suiteSnapshot);
        payload.put("runOptions", runOptions);
        return payload;
    }

    private Map<String, Object> buildApiLocalRunnerSuiteItem(
            ApiExecutionSuiteItemEntity item,
            ApiLocalRunnerPayloadSupport.ArtifactCollector artifactCollector
    ) {
        Map<String, Object> value = new java.util.LinkedHashMap<>();
        value.put("itemId", item.getId());
        value.put("resourceId", item.getItemId());
        value.put("itemType", item.getItemType());
        value.put("itemName", item.getItemNameSnapshot());
        value.put("sortOrder", item.getSortOrder());
        value.put("enabled", item.getEnabled());
        if ("API_CASE".equals(item.getItemType())) {
            ApiDefinitionCaseEntity apiCase = caseMapper.selectById(item.getItemId());
            value.put("caseSnapshot", ApiLocalRunnerPayloadSupport.buildApiCaseSnapshot(apiCase, artifactCollector));
            return value;
        }
        if ("SCENARIO".equals(item.getItemType())) {
            ApiScenarioEntity scenario = scenarioMapper.selectById(item.getItemId());
            if (scenario == null) {
                throw new NotFoundException("Scenario not found");
            }
            Map<String, Object> scenarioSnapshot = new java.util.LinkedHashMap<>();
            scenarioSnapshot.put("scenarioId", scenario.getId());
            scenarioSnapshot.put("scenarioName", scenario.getScenarioName());
            scenarioSnapshot.put("steps", ApiLocalRunnerPayloadSupport.buildScenarioSteps(
                    readScenarioSteps(scenario.getStepsJson()),
                    Boolean.TRUE.equals(scenario.getContinueOnFailure()),
                    caseMapper,
                    artifactCollector
            ));
            value.put("scenarioSnapshot", scenarioSnapshot);
            return value;
        }
        throw new BadRequestException("Unsupported execution suite item type");
    }

    private SuiteRunAggregate runSuiteOnce(
            List<ApiExecutionSuiteItemEntity> enabledItems,
            String workspaceCode,
            ApiRunRequest effectiveRequest,
            SuiteExecutionPolicy policy,
            ApiDataFileDomainService.ApiDataFileRuntimeRow dataRow
    ) {
        ApiExecutionDomainService executionDomainService = executionDomainServiceProvider.getObject();
        List<ApiRunStepResultResponse> stepResults = new ArrayList<>();
        Long taskId = null;
        Long reportId = null;
        String failureSummary = null;
        boolean success = true;
        List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots = new ArrayList<>();
        long suiteStartedAt = System.currentTimeMillis();
        for (ApiExecutionSuiteItemEntity item : enabledItems) {
            if (isSuiteTimedOut(suiteStartedAt, stepResults, policy)) {
                success = false;
                failureSummary = "Execution suite exceeded global timeout " + policy.globalTimeoutMs() + " ms";
                break;
            }
            applySuiteDefaultWaitIfNeeded(stepResults, policy);
            if (isSuiteTimedOut(suiteStartedAt, stepResults, policy)) {
                success = false;
                failureSummary = "Execution suite exceeded global timeout " + policy.globalTimeoutMs() + " ms";
                break;
            }
            ApiRunResponse itemRun = runSuiteItemWithRetry(executionDomainService, item, workspaceCode, effectiveRequest, policy);
            if (taskId == null) {
                taskId = itemRun.taskId();
                reportId = itemRun.reportId();
            }
            stepResults.addAll(decorateSuiteStepResults(itemRun.stepResults(), item, dataRow));
            itemSnapshots.add(toSuiteRunItemSnapshot(item, itemRun));
            if (!"SUCCESS".equals(itemRun.result())) {
                success = false;
                if (failureSummary == null) {
                    failureSummary = itemRun.failureSummary();
                }
                if (!policy.continueOnFailure()) {
                    break;
                }
            }
        }
        return new SuiteRunAggregate(
                taskId,
                reportId,
                success,
                failureSummary,
                stepResults,
                itemSnapshots,
                List.of()
        );
    }

    public PageResponse<ApiExecutionSuiteRunHistoryItem> listSuiteRunHistory(
            Long suiteId,
            String workspaceCode,
            Integer pageNo,
            Integer pageSize
    ) {
        ApiExecutionSuiteEntity suite = requireSuite(suiteId);
        workspaceScopeSupport.validateReadable(suite.getWorkspaceId(), workspaceCode, "Current workspace cannot access the execution suite");
        List<ApiExecutionSuiteRunHistoryItem> items = suiteRunHistoryMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity>()
                        .eq(ApiExecutionSuiteRunHistoryEntity::getSuiteId, suiteId)
                        .orderByDesc(ApiExecutionSuiteRunHistoryEntity::getCreatedAt)
                        .orderByDesc(ApiExecutionSuiteRunHistoryEntity::getId))
                .stream()
                .map(this::toSuiteRunHistoryItem)
                .toList();
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : pageSize;
        int fromIndex = Math.min((safePageNo - 1) * safePageSize, items.size());
        int toIndex = Math.min(fromIndex + safePageSize, items.size());
        return PageResponse.of(items.subList(fromIndex, toIndex), items.size(), safePageNo, safePageSize);
    }

    public ApiExecutionSuiteRunHistoryDetail getSuiteRunHistoryDetail(Long historyId, String workspaceCode) {
        ApiExecutionSuiteRunHistoryEntity history = requireSuiteRunHistory(historyId);
        workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the execution suite run history");
        return toSuiteRunHistoryDetail(history);
    }

    private List<ApiExecutionSuiteModuleItem> buildSuiteModuleTree(
            List<ApiExecutionSuiteModuleEntity> modules,
            Map<Long, Long> counts,
            Long parentId
    ) {
        return modules.stream()
                .filter(module -> parentId == null ? module.getParentId() == null : parentId.equals(module.getParentId()))
                .map(module -> {
                    List<ApiExecutionSuiteModuleItem> children = buildSuiteModuleTree(modules, counts, module.getId());
                    return toSuiteModuleItem(module, counts.getOrDefault(module.getId(), 0L), children);
                })
                .toList();
    }

    private ApiExecutionSuiteModuleItem toSuiteModuleItem(
            ApiExecutionSuiteModuleEntity entity,
            Long suiteCount,
            List<ApiExecutionSuiteModuleItem> children
    ) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiExecutionSuiteModuleItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getParentId(),
                entity.getModuleName(),
                entity.getSortOrder(),
                suiteCount,
                children
        );
    }

    private void fillSuiteEntity(ApiExecutionSuiteEntity entity, WorkspaceEntity workspace, SaveApiExecutionSuiteRequest request) {
        Long moduleId = request.moduleId();
        if (moduleId != null) {
            ApiExecutionSuiteModuleEntity module = requireSuiteModule(moduleId);
            if (!module.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Execution suite module must belong to the same workspace");
            }
        }
        entity.setWorkspaceId(workspace.getId());
        entity.setModuleId(moduleId);
        entity.setSuiteName(request.name().trim());
        entity.setPriority(normalizePriority(request.priority()));
        entity.setStatus(normalizeStatus(request.status()));
        entity.setDescription(blankToNull(request.description()));
        entity.setEnvironmentId(request.environmentId());
        entity.setVariableSetId(request.variableSetId());
        entity.setRunMode(normalizeRunMode(request.runMode()));
        entity.setRunOn(normalizeRunOn(request.runOn()));
        entity.setNotifyEnabled(request.notifyEnabled() == null || request.notifyEnabled());
        entity.setContinueOnFailure(request.continueOnFailure() == null || Boolean.TRUE.equals(request.continueOnFailure()));
        entity.setGlobalTimeoutMs(normalizeRange(request.globalTimeoutMs(), 300000, 1000, 3600000));
        entity.setStepFailureRetryCount(normalizeRange(request.stepFailureRetryCount(), 0, 0, 5));
        entity.setDefaultStepWaitMs(normalizeRange(request.defaultStepWaitMs(), 0, 0, 60000));
        entity.setScheduleEnabled(Boolean.TRUE.equals(request.scheduleEnabled()));
        entity.setCronExpression(normalizeSuiteCronExpression(request.scheduleEnabled(), request.cronExpression()));
        entity.setBranchName(blankToNull(request.branchName()));
        entity.setTriggerSource(blankToNull(request.triggerSource()));
        entity.setBranchNote(blankToNull(request.branchNote()));
        entity.setDataDrivenEnabled(Boolean.TRUE.equals(request.dataDrivenEnabled()));
        if (Boolean.TRUE.equals(entity.getDataDrivenEnabled())) {
            if (request.dataFileId() == null) {
                throw new BadRequestException("Data file is required when data driven execution is enabled");
            }
            ApiDataFileEntity dataFile = dataFileDomainService.requireDataFileInWorkspace(request.dataFileId(), workspace.getId());
            entity.setDataFileId(dataFile.getId());
            entity.setDataFileNameSnapshot(dataFile.getFileName());
            entity.setCaseDescColumn(blankToFallback(request.caseDescColumn(), dataFile.getCaseDescColumn()));
            entity.setDataFailureStrategy(normalizeDataFailureStrategy(request.dataFailureStrategy()));
        } else {
            entity.setDataFileId(null);
            entity.setDataFileNameSnapshot(null);
            entity.setCaseDescColumn(null);
            entity.setDataFailureStrategy("STOP_ON_ROW_FAILURE");
        }
    }

    private String normalizeDataFailureStrategy(String strategy) {
        String normalized = blankToFallback(strategy, "STOP_ON_ROW_FAILURE").trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "STOP_ON_ROW_FAILURE", "CONTINUE_ON_ROW_FAILURE" -> normalized;
            default -> throw new BadRequestException("Unsupported data failure strategy");
        };
    }

    private String normalizeSuiteCronExpression(Boolean scheduleEnabled, String cronExpression) {
        String expression = blankToNull(cronExpression);
        if (!Boolean.TRUE.equals(scheduleEnabled)) {
            return expression;
        }
        if (expression == null) {
            throw new BadRequestException("Cron expression is required when schedule is enabled");
        }
        try {
            CronExpression.parse(expression);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Invalid cron expression");
        }
        return expression;
    }

    private ApiExecutionSuiteItem toSuiteItem(ApiExecutionSuiteEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        ApiExecutionSuiteModuleEntity module = entity.getModuleId() == null ? null : suiteModuleMapper.selectById(entity.getModuleId());
        return new ApiExecutionSuiteItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleId(),
                module == null ? null : module.getModuleName(),
                entity.getSuiteName(),
                entity.getPriority(),
                entity.getStatus(),
                entity.getDescription(),
                entity.getEnvironmentId(),
                entity.getVariableSetId(),
                entity.getRunMode(),
                entity.getRunOn(),
                entity.getNotifyEnabled(),
                entity.getContinueOnFailure(),
                entity.getGlobalTimeoutMs(),
                entity.getStepFailureRetryCount(),
                entity.getDefaultStepWaitMs(),
                entity.getScheduleEnabled(),
                entity.getCronExpression(),
                entity.getBranchName(),
                entity.getTriggerSource(),
                entity.getBranchNote(),
                Boolean.TRUE.equals(entity.getDataDrivenEnabled()),
                entity.getDataFileId(),
                entity.getDataFileNameSnapshot(),
                entity.getCaseDescColumn(),
                entity.getDataFailureStrategy(),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiExecutionSuiteDetail toSuiteDetail(ApiExecutionSuiteEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        ApiExecutionSuiteModuleEntity module = entity.getModuleId() == null ? null : suiteModuleMapper.selectById(entity.getModuleId());
        return new ApiExecutionSuiteDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleId(),
                module == null ? null : module.getModuleName(),
                entity.getSuiteName(),
                entity.getPriority(),
                entity.getStatus(),
                entity.getDescription(),
                entity.getEnvironmentId(),
                entity.getVariableSetId(),
                entity.getRunMode(),
                entity.getRunOn(),
                entity.getNotifyEnabled(),
                entity.getContinueOnFailure(),
                entity.getGlobalTimeoutMs(),
                entity.getStepFailureRetryCount(),
                entity.getDefaultStepWaitMs(),
                entity.getScheduleEnabled(),
                entity.getCronExpression(),
                entity.getBranchName(),
                entity.getTriggerSource(),
                entity.getBranchNote(),
                Boolean.TRUE.equals(entity.getDataDrivenEnabled()),
                entity.getDataFileId(),
                entity.getDataFileNameSnapshot(),
                entity.getCaseDescColumn(),
                entity.getDataFailureStrategy(),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiExecutionSuiteItemDetail toSuiteItemDetail(ApiExecutionSuiteItemEntity entity) {
        return new ApiExecutionSuiteItemDetail(
                entity.getId(),
                entity.getSuiteId(),
                entity.getItemType(),
                entity.getItemId(),
                entity.getItemNameSnapshot(),
                entity.getSortOrder(),
                entity.getEnabled(),
                entity.getDescription(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiExecutionSuiteRunHistoryEntity persistSuiteRunHistory(
            ApiExecutionSuiteEntity suite,
            ApiRunRequest request,
            boolean success,
            String failureSummary,
            List<ApiRunStepResultResponse> stepResults,
            List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            Long reportId,
            String contextSnapshotJson
    ) {
        CurrentUserPrincipal currentUser = currentUserOrNull();
        long durationMs = stepResults.stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        int successCount = (int) stepResults.stream().filter(ApiRunStepResultResponse::success).count();
        ApiExecutionSuiteModuleEntity module = suite.getModuleId() == null ? null : suiteModuleMapper.selectById(suite.getModuleId());
        ApiExecutionSuiteRunHistoryEntity entity = new ApiExecutionSuiteRunHistoryEntity();
        entity.setWorkspaceId(suite.getWorkspaceId());
        entity.setSuiteId(suite.getId());
        entity.setSuiteName(suite.getSuiteName());
        entity.setModuleId(suite.getModuleId());
        entity.setModuleName(module == null ? null : module.getModuleName());
        entity.setPriority(suite.getPriority());
        entity.setReportId(reportId);
        entity.setResult(success ? "SUCCESS" : "FAILED");
        entity.setFailureSummary(failureSummary);
        entity.setTotalCount(stepResults.size());
        entity.setSuccessCount(successCount);
        entity.setFailedCount(Math.max(0, stepResults.size() - successCount));
        entity.setSkippedCount(0);
        entity.setDurationMs(durationMs);
        entity.setEnvironmentId(request.environmentId());
        entity.setVariableSetId(request.variableSetId());
        entity.setRunMode(suite.getRunMode());
        entity.setRunOn(suite.getRunOn());
        entity.setContinueOnFailure(Boolean.TRUE.equals(suite.getContinueOnFailure()));
        entity.setGlobalTimeoutMs(suite.getGlobalTimeoutMs());
        entity.setStepFailureRetryCount(suite.getStepFailureRetryCount());
        entity.setDefaultStepWaitMs(suite.getDefaultStepWaitMs());
        entity.setDataDrivenEnabled(Boolean.TRUE.equals(suite.getDataDrivenEnabled()));
        entity.setDataFileId(suite.getDataFileId());
        entity.setDataFileName(suite.getDataFileNameSnapshot());
        entity.setDataRowCount(dataIterations == null ? 0 : dataIterations.size());
        entity.setDataIterationJson(ApiAutomationJsonSupport.toJson(dataIterations == null ? List.of() : dataIterations, "Failed to serialize execution suite data iterations"));
        entity.setBranchName(blankToNull(request.branchName()));
        entity.setTriggerSource(blankToNull(request.triggerSource()));
        entity.setOperatorId(currentUser == null ? null : currentUser.userId());
        entity.setOperatorName(currentUser == null ? "系统调度" : currentUser.displayName());
        entity.setDetailJson(ApiAutomationJsonSupport.toJson(stepResults, "Failed to serialize execution suite run detail"));
        entity.setItemSnapshotJson(ApiAutomationJsonSupport.toJson(itemSnapshots, "Failed to serialize execution suite item snapshots"));
        entity.setContextSnapshotJson(contextSnapshotJson);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        suiteRunHistoryMapper.insert(entity);
        return entity;
    }

    private void publishSuiteNotificationIfNeeded(
            ApiExecutionSuiteEntity suite,
            ApiExecutionSuiteRunHistoryEntity history,
            SuiteRunAggregate aggregate
    ) {
        if (!Boolean.TRUE.equals(suite.getNotifyEnabled())) {
            return;
        }
        notificationDomainService.publishEvent(new NotificationModels.NotificationEvent(
                suite.getWorkspaceId(),
                aggregate.success()
                        ? NotificationDomainService.EVENT_API_SUITE_FINISHED
                        : NotificationDomainService.EVENT_API_SUITE_FAILED,
                aggregate.success()
                        ? "接口自动化套件执行完成"
                        : "接口自动化套件执行失败",
                "API_EXECUTION_SUITE",
                suite.getId(),
                suite.getSuiteName(),
                aggregate.success() ? "SUCCESS" : "FAILED",
                history.getTotalCount(),
                history.getSuccessCount(),
                history.getFailedCount(),
                history.getDurationMs(),
                aggregate.failureSummary(),
                "/automation/api?tab=suites&suiteId=" + suite.getId(),
                Map.of("historyId", history.getId())
        ));
    }

    private ApiExecutionSuiteRunHistoryItem toSuiteRunHistoryItem(ApiExecutionSuiteRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiExecutionSuiteRunHistoryItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
               workspace.getWorkspaceName(),
               entity.getSuiteId(),
               entity.getSuiteName(),
               entity.getModuleId(),
               entity.getModuleName(),
               entity.getPriority(),
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
               entity.getRunMode(),
               entity.getRunOn(),
               entity.getContinueOnFailure(),
               entity.getGlobalTimeoutMs(),
               entity.getStepFailureRetryCount(),
               entity.getDefaultStepWaitMs(),
               entity.getDataDrivenEnabled(),
               entity.getDataFileId(),
               entity.getDataFileName(),
               entity.getDataRowCount(),
               entity.getBranchName(),
               entity.getTriggerSource(),
               entity.getOperatorId(),
               entity.getOperatorName(),
               entity.getCreatedAt()
       );
    }

    private ApiExecutionSuiteRunHistoryDetail toSuiteRunHistoryDetail(ApiExecutionSuiteRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        List<ApiRunStepResultResponse> stepResults = ApiAutomationJsonSupport.readList(
                entity.getDetailJson(),
                new com.fasterxml.jackson.core.type.TypeReference<>() {
                },
                List.of()
        );
        List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots = ApiAutomationJsonSupport.readList(
                entity.getItemSnapshotJson(),
                new com.fasterxml.jackson.core.type.TypeReference<>() {
                },
                List.of()
        );
        return new ApiExecutionSuiteRunHistoryDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getSuiteId(),
                entity.getSuiteName(),
                entity.getModuleId(),
                entity.getModuleName(),
                entity.getPriority(),
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
                entity.getRunMode(),
                entity.getRunOn(),
                entity.getContinueOnFailure(),
               entity.getGlobalTimeoutMs(),
               entity.getStepFailureRetryCount(),
               entity.getDefaultStepWaitMs(),
                entity.getDataDrivenEnabled(),
                entity.getDataFileId(),
                entity.getDataFileName(),
                entity.getDataRowCount(),
                entity.getBranchName(),
                entity.getTriggerSource(),
                entity.getOperatorId(),
                entity.getOperatorName(),
                entity.getCreatedAt(),
                entity.getContextSnapshotJson(),
                readSuiteDataIterations(entity.getDataIterationJson()),
                itemSnapshots,
                stepResults
        );
    }

    private ApiExecutionSuiteRunItemSnapshot toSuiteRunItemSnapshot(ApiExecutionSuiteItemEntity item, ApiRunResponse itemRun) {
        List<ApiRunStepResultResponse> steps = itemRun.stepResults() == null ? List.of() : itemRun.stepResults();
        long durationMs = steps.stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        return new ApiExecutionSuiteRunItemSnapshot(
                item.getId(),
                item.getItemId(),
                item.getItemType(),
                item.getItemNameSnapshot(),
                item.getSortOrder(),
                item.getEnabled(),
                itemRun.result(),
                steps.size(),
                durationMs,
                itemRun.failureSummary()
        );
    }

    private List<ApiRunStepResultResponse> decorateSuiteStepResults(
            List<ApiRunStepResultResponse> responses,
            ApiExecutionSuiteItemEntity item,
            ApiDataFileDomainService.ApiDataFileRuntimeRow dataRow
    ) {
        if (responses == null || responses.isEmpty()) {
            return List.of();
        }
        String prefix = dataRow == null ? "" : "[Row " + dataRow.rowIndex()
                + (blankToNull(dataRow.caseDesc()) == null ? "" : " " + dataRow.caseDesc())
                + "] ";
        List<ApiRunStepResultResponse> next = new ArrayList<>();
        for (ApiRunStepResultResponse response : responses) {
            next.add(new ApiRunStepResultResponse(
                    response.id(),
                    response.reportId(),
                    response.stepOrder(),
                    prefix + response.stepName(),
                    response.stepKind(),
                    response.stepKey(),
                    response.parentStepKey(),
                    response.depth(),
                    response.definitionId(),
                    item.getId(),
                    item.getSortOrder(),
                    response.success(),
                    response.durationMs(),
                    response.request(),
                    response.response(),
                    response.assertionResults(),
                    response.extractionResults(),
                    response.processorResults(),
                    response.errorMessage(),
                    response.createdAt()
            ));
        }
        return next;
    }

    private ApiExecutionSuiteDataIteration toDataIteration(
            ApiDataFileDomainService.ApiDataFileRuntimeRow row,
            SuiteRunAggregate rowRun
    ) {
        long durationMs = rowRun.stepResults().stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        return new ApiExecutionSuiteDataIteration(
                1,
                row.rowIndex(),
                row.caseDesc(),
                row.values(),
                rowRun.success() ? "SUCCESS" : "FAILED",
                rowRun.stepResults().stream()
                        .filter(item -> !Boolean.TRUE.equals(item.success()))
                        .map(ApiRunStepResultResponse::stepName)
                        .filter(Objects::nonNull)
                        .findFirst()
                        .orElse(null),
                rowRun.stepResults().size(),
                durationMs,
                rowRun.failureSummary()
        );
    }

    private List<ApiExecutionSuiteDataIteration> readSuiteDataIterations(String json) {
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

    private ApiRunResponse runSuiteItemWithRetry(
            ApiExecutionDomainService executionDomainService,
            ApiExecutionSuiteItemEntity item,
            String workspaceCode,
            ApiRunRequest request,
            SuiteExecutionPolicy policy
    ) {
        ApiRunResponse current = runSuiteItem(executionDomainService, item, workspaceCode, request);
        List<ApiProcessorResult> retryLogs = new ArrayList<>();
        for (int attempt = 1; !"SUCCESS".equals(current.result()) && attempt <= policy.stepFailureRetryCount(); attempt++) {
            retryLogs.add(new ApiProcessorResult(
                    "SUITE",
                    "RETRY",
                    "失败重试",
                    true,
                    0L,
                    "Retry " + attempt + "/" + policy.stepFailureRetryCount(),
                    List.of(blankToFallback(current.failureSummary(), "Suite item failed")),
                    Map.of()
            ));
            current = runSuiteItem(executionDomainService, item, workspaceCode, request);
        }
        if (retryLogs.isEmpty() || current.stepResults() == null || current.stepResults().isEmpty()) {
            return current;
        }
        List<ApiRunStepResultResponse> nextSteps = new ArrayList<>(current.stepResults());
        ApiRunStepResultResponse first = nextSteps.getFirst();
        List<ApiProcessorResult> processorResults = new ArrayList<>(retryLogs);
        processorResults.addAll(first.processorResults() == null ? List.of() : first.processorResults());
        nextSteps.set(0, copyStepWithProcessorResults(first, processorResults));
        return new ApiRunResponse(
                current.taskId(),
                current.reportId(),
                current.taskName(),
                current.reportName(),
                current.result(),
                current.failureSummary(),
                current.dataIterations(),
                nextSteps
        );
    }

    private ApiRunResponse runSuiteItem(
            ApiExecutionDomainService executionDomainService,
            ApiExecutionSuiteItemEntity item,
            String workspaceCode,
            ApiRunRequest request
    ) {
        return switch (item.getItemType()) {
            case "API_CASE" -> executionDomainService.runCase(item.getItemId(), workspaceCode, request);
            case "SCENARIO" -> executionDomainService.runScenarioAsSuiteItem(item.getItemId(), workspaceCode, request);
            default -> throw new BadRequestException("Unsupported execution suite item type");
        };
    }

    private boolean isSuiteTimedOut(
            long startedAt,
            List<ApiRunStepResultResponse> stepResults,
            SuiteExecutionPolicy policy
    ) {
        return policy.globalTimeoutMs() > 0 && suiteElapsedMs(startedAt, stepResults) >= policy.globalTimeoutMs();
    }

    private long suiteElapsedMs(long startedAt, List<ApiRunStepResultResponse> stepResults) {
        long wallClockElapsedMs = System.currentTimeMillis() - startedAt;
        long reportedStepElapsedMs = stepResults.stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        return Math.max(wallClockElapsedMs, reportedStepElapsedMs);
    }

    private void applySuiteDefaultWaitIfNeeded(List<ApiRunStepResultResponse> stepResults, SuiteExecutionPolicy policy) {
        if (policy.defaultStepWaitMs() <= 0 || stepResults.isEmpty()) {
            return;
        }
        long started = System.currentTimeMillis();
        sleep(policy.defaultStepWaitMs());
        ApiRunStepResultResponse last = stepResults.getLast();
        List<ApiProcessorResult> processorResults = new ArrayList<>(last.processorResults() == null ? List.of() : last.processorResults());
        processorResults.add(new ApiProcessorResult(
                "SUITE",
                "DEFAULT_WAIT",
                "Suite default wait",
                true,
                System.currentTimeMillis() - started,
                "Default wait " + policy.defaultStepWaitMs() + " ms",
                List.of(),
                Map.of()
        ));
        stepResults.set(stepResults.size() - 1, copyStepWithProcessorResults(last, processorResults));
    }

    private ApiRunStepResultResponse copyStepWithProcessorResults(
            ApiRunStepResultResponse response,
            List<ApiProcessorResult> processorResults
    ) {
        return new ApiRunStepResultResponse(
                response.id(),
                response.reportId(),
                response.stepOrder(),
                response.stepName(),
                response.stepKind(),
                response.stepKey(),
                response.parentStepKey(),
                response.depth(),
                response.definitionId(),
                response.suiteItemId(),
                response.suiteItemOrder(),
                response.success(),
                response.durationMs(),
                response.request(),
                response.response(),
                response.assertionResults(),
                response.extractionResults(),
                processorResults,
                response.errorMessage(),
                response.createdAt()
        );
    }

    private void sleep(int delayMs) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Execution suite wait was interrupted");
        }
    }

    private record SuiteExecutionPolicy(
            boolean continueOnFailure,
            int globalTimeoutMs,
            int stepFailureRetryCount,
            int defaultStepWaitMs
    ) {
        static SuiteExecutionPolicy of(
                boolean continueOnFailure,
                Integer globalTimeoutMs,
                Integer stepFailureRetryCount,
                Integer defaultStepWaitMs
        ) {
            return new SuiteExecutionPolicy(
                    continueOnFailure,
                    normalizeGlobalTimeoutMs(globalTimeoutMs),
                    normalizeRetryCount(stepFailureRetryCount),
                    normalizeDefaultStepWaitMs(defaultStepWaitMs)
            );
        }

        private static int normalizeGlobalTimeoutMs(Integer value) {
            if (value == null || value <= 0) {
                return DEFAULT_SUITE_GLOBAL_TIMEOUT_MS;
            }
            return Math.max(1000, Math.min(MAX_SUITE_GLOBAL_TIMEOUT_MS, value));
        }

        private static int normalizeRetryCount(Integer value) {
            if (value == null || value < 0) {
                return 0;
            }
            return Math.min(MAX_SUITE_STEP_RETRY_COUNT, value);
        }

        private static int normalizeDefaultStepWaitMs(Integer value) {
            if (value == null || value < 0) {
                return 0;
            }
            return Math.min(MAX_SUITE_STEP_WAIT_MS, value);
        }
    }

    private ResolvedSuiteItem resolveSuiteItem(Long workspaceId, String itemType, Long itemId) {
        String normalizedType = itemType == null ? "" : itemType.trim().toUpperCase(Locale.ROOT);
        if ("API_CASE".equals(normalizedType)) {
            ApiDefinitionCaseEntity apiCase = caseMapper.selectById(itemId);
            if (apiCase == null || !workspaceId.equals(apiCase.getWorkspaceId())) {
                throw new BadRequestException("API case must belong to the same workspace");
            }
            return new ResolvedSuiteItem(normalizedType, apiCase.getCaseName());
        }
        if ("SCENARIO".equals(normalizedType)) {
            ApiScenarioEntity scenario = scenarioMapper.selectById(itemId);
            if (scenario == null || !workspaceId.equals(scenario.getWorkspaceId())) {
                throw new BadRequestException("Scenario must belong to the same workspace");
            }
            return new ResolvedSuiteItem(normalizedType, scenario.getScenarioName());
        }
        throw new BadRequestException("Unsupported execution suite item type");
    }

    private int nextSuiteItemSort(Long suiteId) {
        List<ApiExecutionSuiteItemEntity> siblings = suiteItemMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteItemEntity>()
                .eq(ApiExecutionSuiteItemEntity::getSuiteId, suiteId)
                .orderByDesc(ApiExecutionSuiteItemEntity::getSortOrder));
        return siblings.isEmpty() ? 0 : siblings.getFirst().getSortOrder() + 10;
    }

    private String normalizePriority(String priority) {
        String normalized = priority == null || priority.isBlank() ? "P1" : priority.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "P0", "P1", "P2", "P3" -> normalized;
            default -> "P1";
        };
    }

    private String normalizeStatus(String status) {
        String normalized = status == null || status.isBlank() ? "ACTIVE" : status.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE", "INACTIVE", "ARCHIVED" -> normalized;
            default -> "ACTIVE";
        };
    }

    private String normalizeRunMode(String runMode) {
        String normalized = runMode == null || runMode.isBlank() ? "SERIAL" : runMode.trim().toUpperCase(Locale.ROOT);
        return "PARALLEL".equals(normalized) ? "PARALLEL" : "SERIAL";
    }

    private String normalizeRunOn(String runOn) {
        String normalized = runOn == null || runOn.isBlank() ? "SERVER" : runOn.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "LOCAL", "LOCAL_RUNNER" -> "LOCAL";
            case "SERVER", "REMOTE" -> "SERVER";
            default -> "SERVER";
        };
    }

    private boolean isLocalRunnerRun(String runOn) {
        String normalized = blankToNull(runOn);
        return "LOCAL".equalsIgnoreCase(normalized) || "LOCAL_RUNNER".equalsIgnoreCase(normalized);
    }

    private Integer normalizeRange(Integer value, int fallback, int min, int max) {
        int normalized = value == null ? fallback : value;
        if (normalized < min) {
            return min;
        }
        return Math.min(normalized, max);
    }

    private void ensureSuiteModuleNameUnique(Long workspaceId, Long parentId, Long currentId, String name) {
        String trimmedName = blankToNull(name);
        if (trimmedName == null) {
            throw new BadRequestException("Module name cannot be blank");
        }
        LambdaQueryWrapper<ApiExecutionSuiteModuleEntity> query = new LambdaQueryWrapper<ApiExecutionSuiteModuleEntity>()
                .eq(ApiExecutionSuiteModuleEntity::getWorkspaceId, workspaceId)
                .eq(parentId != null, ApiExecutionSuiteModuleEntity::getParentId, parentId)
                .isNull(parentId == null, ApiExecutionSuiteModuleEntity::getParentId)
                .eq(ApiExecutionSuiteModuleEntity::getModuleName, trimmedName);
        if (currentId != null) {
            query.ne(ApiExecutionSuiteModuleEntity::getId, currentId);
        }
        if (suiteModuleMapper.selectCount(query) > 0) {
            throw new BadRequestException("Module name already exists");
        }
    }

    private int nextSuiteModuleSort(Long workspaceId, Long parentId) {
        List<ApiExecutionSuiteModuleEntity> siblings = suiteModuleMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteModuleEntity>()
                .eq(ApiExecutionSuiteModuleEntity::getWorkspaceId, workspaceId)
                .eq(parentId != null, ApiExecutionSuiteModuleEntity::getParentId, parentId)
                .isNull(parentId == null, ApiExecutionSuiteModuleEntity::getParentId)
                .orderByDesc(ApiExecutionSuiteModuleEntity::getSortOrder));
        return siblings.isEmpty() ? 0 : siblings.getFirst().getSortOrder() + 10;
    }

    private long countSuitesInModule(Long moduleId) {
        return suiteMapper.selectCount(new LambdaQueryWrapper<ApiExecutionSuiteEntity>()
                .eq(ApiExecutionSuiteEntity::getModuleId, moduleId));
    }

    private List<Long> suiteModuleDescendantIds(Long workspaceId, Long moduleId) {
        List<ApiExecutionSuiteModuleEntity> modules = suiteModuleMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteModuleEntity>()
                .eq(ApiExecutionSuiteModuleEntity::getWorkspaceId, workspaceId));
        List<Long> ids = new ArrayList<>();
        collectSuiteModuleDescendantIds(modules, moduleId, ids);
        return ids.isEmpty() ? List.of(moduleId) : ids;
    }

    private void collectSuiteModuleDescendantIds(List<ApiExecutionSuiteModuleEntity> modules, Long parentId, List<Long> ids) {
        ids.add(parentId);
        for (ApiExecutionSuiteModuleEntity module : modules) {
            if (parentId.equals(module.getParentId())) {
                collectSuiteModuleDescendantIds(modules, module.getId(), ids);
            }
        }
    }

    private record SuiteRunAggregate(
            Long taskId,
            Long reportId,
            boolean success,
            String failureSummary,
            List<ApiRunStepResultResponse> stepResults,
            List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots,
            List<ApiExecutionSuiteDataIteration> dataIterations
    ) {
    }

    private ApiExecutionSuiteModuleEntity requireSuiteModule(Long id) {
        ApiExecutionSuiteModuleEntity entity = suiteModuleMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Execution suite module not found");
        }
        return entity;
    }

    private ApiExecutionSuiteEntity requireSuite(Long id) {
        ApiExecutionSuiteEntity entity = suiteMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Execution suite not found");
        }
        return entity;
    }

    private ApiExecutionSuiteItemEntity requireSuiteItem(Long suiteId, Long itemId) {
        ApiExecutionSuiteItemEntity entity = suiteItemMapper.selectById(itemId);
        if (entity == null || !suiteId.equals(entity.getSuiteId())) {
            throw new NotFoundException("Execution suite item not found");
        }
        return entity;
    }

    private ApiExecutionSuiteRunHistoryEntity requireSuiteRunHistory(Long id) {
        ApiExecutionSuiteRunHistoryEntity entity = suiteRunHistoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Execution suite run history not found");
        }
        return entity;
    }

    private record ResolvedSuiteItem(String itemType, String itemName) {
    }
}
