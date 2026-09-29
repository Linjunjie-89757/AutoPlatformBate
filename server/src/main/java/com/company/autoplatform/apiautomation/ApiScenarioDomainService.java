package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.settings.EnvConfigEntity;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.company.autoplatform.settings.ParamSetEntity;
import com.company.autoplatform.settings.ParamSetMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;

@Service
public class ApiScenarioDomainService {

    private static final String API_ENV_TYPE = "API";
    private static final String API_VARIABLE_SET_TYPE = "API_VARIABLE_SET";
    private static final String PAYMENT_CHANNEL_VARIABLE_SET_TYPE = "PAYMENT_CHANNEL";
    private static final String SCENARIO_RESOURCE_TYPE_DEFINITION = "DEFINITION";
    private static final String SCENARIO_RESOURCE_TYPE_CASE = "CASE";
    private static final String SCENARIO_STEP_API = "API";
    private static final String SCENARIO_STEP_API_CASE = "API_CASE";
    private static final String SCENARIO_STEP_CUSTOM_REQUEST = "CUSTOM_REQUEST";
    private static final String SCENARIO_STEP_API_SCENARIO = "API_SCENARIO";
    private static final String SCENARIO_STEP_IF_CONTROLLER = "IF_CONTROLLER";
    private static final String SCENARIO_STEP_LOOP_CONTROLLER = "LOOP_CONTROLLER";
    private static final String SCENARIO_STEP_ONCE_ONLY_CONTROLLER = "ONCE_ONLY_CONTROLLER";
    private static final String SCENARIO_STEP_CONSTANT_TIMER = "CONSTANT_TIMER";
    private static final String SCENARIO_STEP_SCRIPT = "SCRIPT";
    private static final int MAX_SCENARIO_LOOP_COUNT = 50;
    private static final int MAX_SCENARIO_WAIT_MS = 60000;
    private static final int DEFAULT_SCENARIO_GLOBAL_TIMEOUT_MS = 300000;
    private static final int MAX_SCENARIO_GLOBAL_TIMEOUT_MS = 3600000;
    private static final int MAX_SCENARIO_STEP_RETRY_COUNT = 5;

    private final ApiScenarioMapper scenarioMapper;
    private final ApiScenarioModuleMapper scenarioModuleMapper;
    private final ApiDefinitionMapper definitionMapper;
    private final ApiDefinitionCaseMapper caseMapper;
    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;
    private final ApiDataFileDomainService dataFileDomainService;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiScenarioDomainService(
            ApiScenarioMapper scenarioMapper,
            ApiScenarioModuleMapper scenarioModuleMapper,
            ApiDefinitionMapper definitionMapper,
            ApiDefinitionCaseMapper caseMapper,
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper,
            ApiDataFileDomainService dataFileDomainService,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.scenarioMapper = scenarioMapper;
        this.scenarioModuleMapper = scenarioModuleMapper;
        this.definitionMapper = definitionMapper;
        this.caseMapper = caseMapper;
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
        this.dataFileDomainService = dataFileDomainService;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiScenarioItem> listScenarios(
            String workspaceCode,
            Long moduleId,
            String keyword,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<ApiScenarioEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiScenarioEntity::getWorkspaceId, workspaceCode);
        if (moduleId != null) {
            ApiScenarioModuleEntity module = requireScenarioModule(moduleId);
            workspaceScopeSupport.validateReadable(module.getWorkspaceId(), workspaceCode, "Current workspace cannot access the scenario module");
            query.in(ApiScenarioEntity::getModuleId, scenarioModuleDescendantIds(module.getWorkspaceId(), moduleId));
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper.like(ApiScenarioEntity::getScenarioName, trimmedKeyword)
                    .or()
                    .like(ApiScenarioEntity::getDescription, trimmedKeyword));
        }
        String normalizedStatus = blankToNull(status);
        if (normalizedStatus != null) {
            query.eq(ApiScenarioEntity::getStatus, normalizedStatus.toUpperCase(Locale.ROOT));
        }
        int safePageNo = safePageNo(pageNo);
        if (pageSize == null || pageSize < 1) {
            List<ApiScenarioEntity> entities = scenarioMapper.selectList(query.orderByDesc(ApiScenarioEntity::getUpdatedAt));
            List<ApiScenarioItem> items = toScenarioItems(entities);
            int compatiblePageSize = safePageSize(pageSize, items.size());
            return PageResponse.of(paginate(items, safePageNo, compatiblePageSize), items.size(), safePageNo, compatiblePageSize);
        }
        Page<ApiScenarioEntity> page = scenarioMapper.selectPage(
                new Page<>(safePageNo, pageSize),
                query.orderByDesc(ApiScenarioEntity::getUpdatedAt));
        List<ApiScenarioItem> items = toScenarioItems(page.getRecords());
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public List<ApiScenarioModuleItem> listScenarioModules(String workspaceCode) {
        WorkspaceEntity scopedWorkspace = workspaceScopeSupport.resolveScopedWorkspace(workspaceCode);
        LambdaQueryWrapper<ApiScenarioModuleEntity> query = new LambdaQueryWrapper<>();
        if (scopedWorkspace != null) {
            query.eq(ApiScenarioModuleEntity::getWorkspaceId, scopedWorkspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(ApiScenarioModuleEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        List<ApiScenarioModuleEntity> modules = scenarioModuleMapper.selectList(query
                .orderByAsc(ApiScenarioModuleEntity::getSortOrder)
                .orderByAsc(ApiScenarioModuleEntity::getId));
        if (modules.isEmpty()) {
            return List.of();
        }
        List<Long> moduleWorkspaceIds = modules.stream()
                .map(ApiScenarioModuleEntity::getWorkspaceId)
                .distinct()
                .toList();
        Map<Long, Long> counts = scenarioMapper.selectList(new LambdaQueryWrapper<ApiScenarioEntity>()
                        .in(ApiScenarioEntity::getWorkspaceId, moduleWorkspaceIds)
                        .isNotNull(ApiScenarioEntity::getModuleId))
                .stream()
                .collect(Collectors.groupingBy(ApiScenarioEntity::getModuleId, Collectors.counting()));
        return buildScenarioModuleTree(modules, counts, null);
    }

    public ApiScenarioModuleItem createScenarioModule(String headerWorkspaceCode, ApiScenarioModuleRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (request.parentId() != null) {
            ApiScenarioModuleEntity parent = requireScenarioModule(request.parentId());
            if (!parent.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
        }
        ensureScenarioModuleNameUnique(workspace.getId(), request.parentId(), null, request.name());
        ApiScenarioModuleEntity entity = new ApiScenarioModuleEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setParentId(request.parentId());
        entity.setModuleName(request.name().trim());
        entity.setSortOrder(nextScenarioModuleSort(workspace.getId(), request.parentId()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioModuleMapper.insert(entity);
        return toScenarioModuleItem(entity, 0L, List.of());
    }

    public ApiScenarioModuleItem updateScenarioModule(Long id, String workspaceCode, ApiScenarioModuleRequest request) {
        ApiScenarioModuleEntity entity = requireScenarioModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the scenario module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        ensureScenarioModuleNameUnique(entity.getWorkspaceId(), entity.getParentId(), id, request.name());
        entity.setModuleName(request.name().trim());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioModuleMapper.updateById(entity);
        return toScenarioModuleItem(entity, countScenariosInModule(id), List.of());
    }

    public ApiScenarioModuleItem moveScenarioModule(Long id, String workspaceCode, MoveApiScenarioModuleRequest request) {
        ApiScenarioModuleEntity entity = requireScenarioModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot move the scenario module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (request.parentId() != null) {
            ApiScenarioModuleEntity parent = requireScenarioModule(request.parentId());
            if (!parent.getWorkspaceId().equals(entity.getWorkspaceId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
            if (scenarioModuleDescendantIds(entity.getWorkspaceId(), id).contains(request.parentId())) {
                throw new BadRequestException("Cannot move module under itself");
            }
        }
        ensureScenarioModuleNameUnique(entity.getWorkspaceId(), request.parentId(), id, entity.getModuleName());
        entity.setParentId(request.parentId());
        entity.setSortOrder(request.sortOrder() == null ? nextScenarioModuleSort(entity.getWorkspaceId(), request.parentId()) : request.sortOrder());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioModuleMapper.updateById(entity);
        return toScenarioModuleItem(entity, countScenariosInModule(id), List.of());
    }

    public void deleteScenarioModule(Long id, String workspaceCode) {
        ApiScenarioModuleEntity entity = requireScenarioModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the scenario module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (scenarioModuleMapper.selectCount(new LambdaQueryWrapper<ApiScenarioModuleEntity>()
                .eq(ApiScenarioModuleEntity::getParentId, id)) > 0) {
            throw new BadRequestException("Cannot delete a module that contains child modules");
        }
        if (scenarioMapper.selectCount(new LambdaQueryWrapper<ApiScenarioEntity>()
                .eq(ApiScenarioEntity::getModuleId, id)) > 0) {
            throw new BadRequestException("Cannot delete a module that contains scenarios");
        }
        scenarioModuleMapper.deleteById(id);
    }

    public ApiScenarioDetail getScenario(Long id, String workspaceCode) {
        ApiScenarioEntity entity = requireScenario(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the scenario");
        return toScenarioDetail(entity);
    }

    public ApiScenarioDetail createScenario(String headerWorkspaceCode, SaveApiScenarioRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ApiScenarioEntity entity = new ApiScenarioEntity();
        fillScenarioEntity(entity, workspace, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioMapper.insert(entity);
        return toScenarioDetail(entity);
    }

    public ApiScenarioDetail updateScenario(Long id, String headerWorkspaceCode, SaveApiScenarioRequest request) {
        ApiScenarioEntity entity = requireScenario(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the scenario");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a scenario to another workspace");
        }
        fillScenarioEntity(entity, workspace, request);
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioMapper.updateById(entity);
        return toScenarioDetail(entity);
    }

    public void deleteScenario(Long id, String workspaceCode) {
        ApiScenarioEntity entity = requireScenario(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the scenario");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        scenarioMapper.deleteById(id);
    }

    private void fillScenarioEntity(ApiScenarioEntity entity, WorkspaceEntity workspace, SaveApiScenarioRequest request) {
        List<ApiScenarioStepInput> steps = normalizeScenarioSteps(defaultList(request.steps()), workspace.getId());
        if (steps.isEmpty()) {
            throw new BadRequestException("Scenario must contain at least one step");
        }
        if (request.defaultEnvironmentId() != null) {
            EnvConfigEntity environment = requireEnvironment(request.defaultEnvironmentId());
            if (!environment.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Scenario environment must belong to the same workspace");
            }
        }
        if (request.variableSetId() != null) {
            ParamSetEntity variableSet = requireVariableSet(request.variableSetId());
            if (!variableSet.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Scenario variable set must belong to the same workspace");
            }
        }
        Long moduleId = request.moduleId() == null ? ensureDefaultScenarioModule(workspace.getId()) : request.moduleId();
        ApiScenarioModuleEntity module = requireScenarioModule(moduleId);
        if (!module.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Scenario module must belong to the same workspace");
        }
        entity.setWorkspaceId(workspace.getId());
        entity.setScenarioName(request.name().trim());
        entity.setDirectoryName(blankToNull(request.directoryName()));
        entity.setModuleId(moduleId);
        entity.setPriority(normalizeScenarioPriority(request.priority()));
        entity.setStatus(normalizeScenarioStatus(request.status()));
        entity.setDescription(blankToNull(request.description()));
        entity.setTagsJson(ApiAutomationJsonSupport.toJson(defaultList(request.tags()), "Failed to serialize tags"));
        entity.setStepsJson(ApiAutomationJsonSupport.toJson(steps, "Failed to serialize scenario steps"));
        entity.setScenarioVariablesJson(ApiAutomationJsonSupport.toJson(defaultList(request.scenarioVariables()), "Failed to serialize scenario variables"));
        entity.setScenarioAssertionsJson(ApiAutomationJsonSupport.toJson(normalizeScenarioAssertions(request.scenarioAssertions()), "Failed to serialize scenario assertions"));
        entity.setDefaultEnvId(request.defaultEnvironmentId());
        entity.setVariableSetId(request.variableSetId());
        entity.setContinueOnFailure(Boolean.TRUE.equals(request.continueOnFailure()));
        entity.setGlobalTimeoutMs(normalizeScenarioGlobalTimeoutMs(request.globalTimeoutMs()));
        entity.setStepFailureRetryCount(normalizeScenarioStepFailureRetryCount(request.stepFailureRetryCount()));
        entity.setDefaultStepWaitMs(normalizeScenarioDefaultStepWaitMs(request.defaultStepWaitMs()));
        entity.setDataDrivenEnabled(Boolean.TRUE.equals(request.dataDrivenEnabled()));
        if (Boolean.TRUE.equals(request.dataDrivenEnabled())) {
            if (request.dataFileId() == null) {
                throw new BadRequestException("Scenario data file cannot be blank when data driven is enabled");
            }
            ApiDataFileEntity dataFile = dataFileDomainService.requireDataFileInWorkspace(request.dataFileId(), workspace.getId());
            entity.setDataFileId(dataFile.getId());
            entity.setDataFileNameSnapshot(blankToFallback(request.dataFileNameSnapshot(), dataFile.getFileName()));
            entity.setCaseDescColumn(blankToFallback(request.caseDescColumn(), "caseDesc"));
            entity.setDataFailureStrategy(normalizeDataFailureStrategy(request.dataFailureStrategy()));
        } else {
            entity.setDataFileId(null);
            entity.setDataFileNameSnapshot(null);
            entity.setCaseDescColumn(blankToFallback(request.caseDescColumn(), "caseDesc"));
            entity.setDataFailureStrategy(normalizeDataFailureStrategy(request.dataFailureStrategy()));
        }
        entity.setRelatedCaseId(request.relatedCaseId());
    }

    private List<ApiScenarioItem> toScenarioItems(List<ApiScenarioEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        Map<Long, WorkspaceEntity> workspaces = workspaceService.listReadableWorkspaceEntities().stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity(), (left, right) -> left));
        List<Long> moduleIds = entities.stream()
                .map(ApiScenarioEntity::getModuleId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, ApiScenarioModuleEntity> modules = moduleIds.isEmpty()
                ? Map.of()
                : scenarioModuleMapper.selectBatchIds(moduleIds).stream()
                .collect(Collectors.toMap(ApiScenarioModuleEntity::getId, Function.identity(), (left, right) -> left));
        return entities.stream()
                .map(entity -> {
                    WorkspaceEntity workspace = workspaces.get(entity.getWorkspaceId());
                    if (workspace == null) {
                        workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
                    }
                    ApiScenarioModuleEntity module = entity.getModuleId() == null ? null : modules.get(entity.getModuleId());
                    if (entity.getModuleId() != null && module == null) {
                        module = scenarioModuleMapper.selectById(entity.getModuleId());
                    }
                    return toScenarioItem(entity, workspace, module);
                })
                .toList();
    }

    private ApiScenarioItem toScenarioItem(
            ApiScenarioEntity entity,
            WorkspaceEntity workspace,
            ApiScenarioModuleEntity module
    ) {
        List<ApiScenarioStepInput> steps = readScenarioSteps(entity.getStepsJson());
        return new ApiScenarioItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getScenarioName(),
                entity.getDirectoryName(),
                entity.getModuleId(),
                module == null ? null : module.getModuleName(),
                blankToFallback(entity.getPriority(), "P1"),
                blankToFallback(entity.getStatus(), "IN_PROGRESS"),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                countScenarioSteps(steps),
                entity.getDefaultEnvId(),
                entity.getVariableSetId(),
                Boolean.TRUE.equals(entity.getContinueOnFailure()),
                normalizeScenarioGlobalTimeoutMs(entity.getGlobalTimeoutMs()),
                normalizeScenarioStepFailureRetryCount(entity.getStepFailureRetryCount()),
                normalizeScenarioDefaultStepWaitMs(entity.getDefaultStepWaitMs()),
                Boolean.TRUE.equals(entity.getDataDrivenEnabled()),
                entity.getDataFileId(),
                entity.getDataFileNameSnapshot(),
                blankToFallback(entity.getCaseDescColumn(), "caseDesc"),
                normalizeDataFailureStrategy(entity.getDataFailureStrategy()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiScenarioDetail toScenarioDetail(ApiScenarioEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        ApiScenarioModuleEntity module = entity.getModuleId() == null ? null : scenarioModuleMapper.selectById(entity.getModuleId());
        return new ApiScenarioDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getScenarioName(),
                entity.getDirectoryName(),
                entity.getModuleId(),
                module == null ? null : module.getModuleName(),
                blankToFallback(entity.getPriority(), "P1"),
                blankToFallback(entity.getStatus(), "IN_PROGRESS"),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                entity.getDefaultEnvId(),
                entity.getVariableSetId(),
                Boolean.TRUE.equals(entity.getContinueOnFailure()),
                normalizeScenarioGlobalTimeoutMs(entity.getGlobalTimeoutMs()),
                normalizeScenarioStepFailureRetryCount(entity.getStepFailureRetryCount()),
                normalizeScenarioDefaultStepWaitMs(entity.getDefaultStepWaitMs()),
                Boolean.TRUE.equals(entity.getDataDrivenEnabled()),
                entity.getDataFileId(),
                entity.getDataFileNameSnapshot(),
                blankToFallback(entity.getCaseDescColumn(), "caseDesc"),
                normalizeDataFailureStrategy(entity.getDataFailureStrategy()),
                entity.getRelatedCaseId(),
                readVariables(entity.getScenarioVariablesJson()),
                readScenarioAssertions(entity.getScenarioAssertionsJson()),
                readScenarioSteps(entity.getStepsJson()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<ApiScenarioModuleItem> buildScenarioModuleTree(
            List<ApiScenarioModuleEntity> modules,
            Map<Long, Long> counts,
            Long parentId
    ) {
        return modules.stream()
                .filter(module -> parentId == null ? module.getParentId() == null : parentId.equals(module.getParentId()))
                .sorted(Comparator.comparing(ApiScenarioModuleEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(ApiScenarioModuleEntity::getId))
                .map(module -> {
                    List<ApiScenarioModuleItem> children = buildScenarioModuleTree(modules, counts, module.getId());
                    long childCount = children.stream().map(ApiScenarioModuleItem::scenarioCount).mapToLong(Long::longValue).sum();
                    long ownCount = Optional.ofNullable(counts.get(module.getId())).orElse(0L);
                    return toScenarioModuleItem(module, ownCount + childCount, children);
                })
                .toList();
    }

    private ApiScenarioModuleItem toScenarioModuleItem(ApiScenarioModuleEntity entity, Long count, List<ApiScenarioModuleItem> children) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiScenarioModuleItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getParentId(),
                entity.getModuleName(),
                entity.getSortOrder(),
                Optional.ofNullable(count).orElse(0L),
                defaultList(children)
        );
    }

    private List<ApiScenarioStepInput> normalizeScenarioSteps(List<ApiScenarioStepInput> steps, Long workspaceId) {
        List<ApiScenarioStepInput> normalized = new ArrayList<>();
        for (ApiScenarioStepInput step : steps) {
            if (step == null) {
                continue;
            }
            String stepType = normalizeScenarioStepType(step);
            Long resourceId = step.resourceId();
            ApiRequestConfigInput requestConfig = step.requestConfig();
            List<ApiScenarioStepInput> children = normalizeScenarioSteps(defaultList(step.children()), workspaceId);

            if (SCENARIO_STEP_API.equals(stepType)) {
                resourceId = normalizeScenarioResourceId(step);
                ApiDefinitionEntity definition = requireDefinition(resourceId);
                if (!definition.getWorkspaceId().equals(workspaceId)) {
                    throw new BadRequestException("Scenario steps must belong to the same workspace");
                }
                if ("COPY".equals(normalizeScenarioStepRefType(step, stepType))) {
                    requestConfig = normalizeScenarioRequestConfig(requestConfig);
                }
            } else if (SCENARIO_STEP_API_CASE.equals(stepType)) {
                resourceId = normalizeScenarioResourceId(step);
                ApiDefinitionCaseEntity apiCase = requireCase(resourceId);
                if (!apiCase.getWorkspaceId().equals(workspaceId)) {
                    throw new BadRequestException("Scenario steps must belong to the same workspace");
                }
                if ("COPY".equals(normalizeScenarioStepRefType(step, stepType))) {
                    requestConfig = normalizeScenarioRequestConfig(requestConfig);
                }
            } else if (SCENARIO_STEP_API_SCENARIO.equals(stepType)) {
                resourceId = normalizeScenarioResourceId(step);
                ApiScenarioEntity scenario = requireScenario(resourceId);
                if (!scenario.getWorkspaceId().equals(workspaceId)) {
                    throw new BadRequestException("Referenced scenario must belong to the same workspace");
                }
            } else if (SCENARIO_STEP_CUSTOM_REQUEST.equals(stepType)) {
                requestConfig = normalizeScenarioRequestConfig(requestConfig);
            } else if (SCENARIO_STEP_CONSTANT_TIMER.equals(stepType)) {
                children = List.of();
            } else if (SCENARIO_STEP_SCRIPT.equals(stepType)) {
                if (blankToNull(step.script()) == null) {
                    throw new BadRequestException("Script step content cannot be blank");
                }
                children = List.of();
            }

            normalized.add(new ApiScenarioStepInput(
                    blankToFallback(step.id(), "scenario-step-" + normalized.size()),
                    blankToNull(step.stepName()),
                    stepType,
                    normalizeScenarioStepRefType(step, stepType),
                    normalizeScenarioResourceTypeForStep(stepType),
                    resourceId,
                    !Boolean.FALSE.equals(step.enabled()),
                    requestConfig,
                    defaultList(step.assertions()),
                    normalizeProcessors(step.preProcessors(), "PRE"),
                    normalizeProcessors(step.postProcessors(), "POST"),
                    normalizeScenarioDelayMs(step.delayMs()),
                    blankToFallback(step.conditionType(), "EXPRESSION").toUpperCase(Locale.ROOT),
                    blankToNull(step.conditionExpression()),
                    normalizeLoopType(step.loopType()),
                    normalizeScenarioLoopCount(step.loopCount()),
                    blankToNull(step.foreachExpression()),
                    Optional.ofNullable(step.script()).orElse(""),
                    children
            ));
        }
        return normalized;
    }

    private String normalizeScenarioStepRefType(ApiScenarioStepInput step, String stepType) {
        String raw = blankToNull(step.refType());
        if (raw != null) {
            String normalized = raw.toUpperCase(Locale.ROOT);
            if ("COPY".equals(normalized) || "REF".equals(normalized) || "DIRECT".equals(normalized)) {
                return normalized;
            }
        }
        if (SCENARIO_STEP_API.equals(stepType) || SCENARIO_STEP_API_CASE.equals(stepType) || SCENARIO_STEP_API_SCENARIO.equals(stepType)) {
            return "REF";
        }
        return "DIRECT";
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

    private ApiScenarioEntity requireScenario(Long id) {
        ApiScenarioEntity entity = scenarioMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API scenario not found");
        }
        return entity;
    }

    private ApiScenarioModuleEntity requireScenarioModule(Long id) {
        ApiScenarioModuleEntity entity = scenarioModuleMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API scenario module not found");
        }
        return entity;
    }

    private ApiDefinitionEntity requireDefinition(Long id) {
        ApiDefinitionEntity entity = definitionMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API definition not found");
        }
        return entity;
    }

    private ApiDefinitionCaseEntity requireCase(Long id) {
        ApiDefinitionCaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API case not found");
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
                || PAYMENT_CHANNEL_VARIABLE_SET_TYPE.equals(paramType);
    }

    private void ensureScenarioModuleNameUnique(Long workspaceId, Long parentId, Long excludeId, String name) {
        String moduleName = blankToNull(name);
        if (moduleName == null) {
            throw new BadRequestException("Module name cannot be blank");
        }
        LambdaQueryWrapper<ApiScenarioModuleEntity> query = new LambdaQueryWrapper<ApiScenarioModuleEntity>()
                .eq(ApiScenarioModuleEntity::getWorkspaceId, workspaceId)
                .eq(ApiScenarioModuleEntity::getModuleName, moduleName);
        if (parentId == null) {
            query.isNull(ApiScenarioModuleEntity::getParentId);
        } else {
            query.eq(ApiScenarioModuleEntity::getParentId, parentId);
        }
        if (excludeId != null) {
            query.ne(ApiScenarioModuleEntity::getId, excludeId);
        }
        if (scenarioModuleMapper.selectCount(query) > 0) {
            throw new BadRequestException("Module name already exists");
        }
    }

    private int nextScenarioModuleSort(Long workspaceId, Long parentId) {
        LambdaQueryWrapper<ApiScenarioModuleEntity> query = new LambdaQueryWrapper<ApiScenarioModuleEntity>()
                .eq(ApiScenarioModuleEntity::getWorkspaceId, workspaceId);
        if (parentId == null) {
            query.isNull(ApiScenarioModuleEntity::getParentId);
        } else {
            query.eq(ApiScenarioModuleEntity::getParentId, parentId);
        }
        return scenarioModuleMapper.selectList(query).stream()
                .map(ApiScenarioModuleEntity::getSortOrder)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private long countScenariosInModule(Long moduleId) {
        return scenarioMapper.selectCount(new LambdaQueryWrapper<ApiScenarioEntity>()
                .eq(ApiScenarioEntity::getModuleId, moduleId));
    }

    private Long ensureDefaultScenarioModule(Long workspaceId) {
        List<ApiScenarioModuleEntity> modules = scenarioModuleMapper.selectList(new LambdaQueryWrapper<ApiScenarioModuleEntity>()
                .eq(ApiScenarioModuleEntity::getWorkspaceId, workspaceId)
                .isNull(ApiScenarioModuleEntity::getParentId)
                .eq(ApiScenarioModuleEntity::getModuleName, "默认模块"));
        if (!modules.isEmpty()) {
            return modules.get(0).getId();
        }
        ApiScenarioModuleEntity entity = new ApiScenarioModuleEntity();
        entity.setWorkspaceId(workspaceId);
        entity.setParentId(null);
        entity.setModuleName("默认模块");
        entity.setSortOrder(nextScenarioModuleSort(workspaceId, null));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioModuleMapper.insert(entity);
        return entity.getId();
    }

    private List<Long> scenarioModuleDescendantIds(Long workspaceId, Long moduleId) {
        List<ApiScenarioModuleEntity> modules = scenarioModuleMapper.selectList(new LambdaQueryWrapper<ApiScenarioModuleEntity>()
                .eq(ApiScenarioModuleEntity::getWorkspaceId, workspaceId));
        List<Long> ids = new ArrayList<>();
        collectScenarioModuleDescendantIds(modules, moduleId, ids);
        return ids.isEmpty() ? List.of(moduleId) : ids;
    }

    private void collectScenarioModuleDescendantIds(List<ApiScenarioModuleEntity> modules, Long parentId, List<Long> ids) {
        ids.add(parentId);
        for (ApiScenarioModuleEntity module : modules) {
            if (parentId.equals(module.getParentId())) {
                collectScenarioModuleDescendantIds(modules, module.getId(), ids);
            }
        }
    }

    private String normalizeScenarioPriority(String priority) {
        String normalized = blankToFallback(priority, "P1").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "P0", "P1", "P2", "P3" -> normalized;
            default -> "P1";
        };
    }

    private String normalizeScenarioStatus(String status) {
        String normalized = blankToFallback(status, "IN_PROGRESS").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ARCHIVED" -> normalized;
            default -> "IN_PROGRESS";
        };
    }

    private String normalizeDataFailureStrategy(String strategy) {
        String normalized = blankToFallback(strategy, "STOP_ON_ROW_FAILURE").toUpperCase(Locale.ROOT);
        return "CONTINUE_ON_ROW_FAILURE".equals(normalized) ? normalized : "STOP_ON_ROW_FAILURE";
    }

    private int safePageNo(Integer pageNo) {
        return pageNo == null || pageNo < 1 ? 1 : pageNo;
    }

    private int safePageSize(Integer pageSize, int total) {
        if (pageSize == null || pageSize < 1) {
            return total > 0 ? total : 10;
        }
        return pageSize;
    }

    private <T> List<T> paginate(List<T> items, int pageNo, int pageSize) {
        int fromIndex = Math.min((pageNo - 1) * pageSize, items.size());
        int toIndex = Math.min(fromIndex + pageSize, items.size());
        return items.subList(fromIndex, toIndex);
    }

    private int countScenarioSteps(List<ApiScenarioStepInput> steps) {
        int count = 0;
        for (ApiScenarioStepInput step : defaultList(steps)) {
            if (step == null) {
                continue;
            }
            count++;
            count += countScenarioSteps(step.children());
        }
        return count;
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

    private Long normalizeScenarioResourceId(ApiScenarioStepInput step) {
        Long resourceId = step.resourceId();
        if (resourceId == null) {
            throw new BadRequestException("Scenario step resource cannot be blank");
        }
        return resourceId;
    }

    private ApiRequestConfigInput normalizeScenarioRequestConfig(ApiRequestConfigInput requestConfig) {
        if (requestConfig == null) {
            throw new BadRequestException("Custom request step requires request config");
        }
        String method = Optional.ofNullable(requestConfig.method()).orElse("").trim().toUpperCase(Locale.ROOT);
        String path = Optional.ofNullable(requestConfig.path()).orElse("").trim();
        if (method.isBlank() || path.isBlank()) {
            throw new BadRequestException("Custom request method and path cannot be blank");
        }
        return new ApiRequestConfigInput(
                method,
                path,
                requestConfig.timeoutMs() == null || requestConfig.timeoutMs() <= 0 ? 10000 : requestConfig.timeoutMs(),
                defaultList(requestConfig.queryParams()),
                defaultList(requestConfig.headers()),
                defaultList(requestConfig.cookies()),
                requestConfig.body() == null ? new ApiRequestBodyInput("NONE", null, List.of(), null, null, null) : requestConfig.body(),
                normalizeAuth(requestConfig.authConfig())
        );
    }

    private Integer normalizeScenarioDelayMs(Integer delayMs) {
        if (delayMs == null) {
            return 1000;
        }
        return Math.max(1, Math.min(MAX_SCENARIO_WAIT_MS, delayMs));
    }

    private Integer normalizeScenarioGlobalTimeoutMs(Integer timeoutMs) {
        if (timeoutMs == null || timeoutMs <= 0) {
            return DEFAULT_SCENARIO_GLOBAL_TIMEOUT_MS;
        }
        return Math.max(1000, Math.min(MAX_SCENARIO_GLOBAL_TIMEOUT_MS, timeoutMs));
    }

    private Integer normalizeScenarioStepFailureRetryCount(Integer retryCount) {
        if (retryCount == null || retryCount < 0) {
            return 0;
        }
        return Math.min(MAX_SCENARIO_STEP_RETRY_COUNT, retryCount);
    }

    private Integer normalizeScenarioDefaultStepWaitMs(Integer waitMs) {
        if (waitMs == null || waitMs < 0) {
            return 0;
        }
        return Math.min(MAX_SCENARIO_WAIT_MS, waitMs);
    }

    private Integer normalizeScenarioLoopCount(Integer loopCount) {
        if (loopCount == null) {
            return 1;
        }
        return Math.max(0, Math.min(MAX_SCENARIO_LOOP_COUNT, loopCount));
    }

    private String normalizeLoopType(String loopType) {
        String normalized = Optional.ofNullable(loopType).orElse("FIXED").trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WHILE", "FOREACH" -> normalized;
            default -> "FIXED";
        };
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
}


