package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;

@Service
public class ApiCaseDomainService {

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

    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiDefinitionMapper definitionMapper;
    private final ApiDefinitionCaseChangeHistoryMapper caseChangeHistoryMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiCaseDomainService(
            ApiDefinitionCaseMapper caseMapper,
            ApiDefinitionMapper definitionMapper,
            ApiDefinitionCaseChangeHistoryMapper caseChangeHistoryMapper,
            ApiScenarioMapper scenarioMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.caseMapper = caseMapper;
        this.definitionMapper = definitionMapper;
        this.caseChangeHistoryMapper = caseChangeHistoryMapper;
        this.scenarioMapper = scenarioMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiDefinitionCaseItem> listCases(
            String workspaceCode,
            Long definitionId,
            String keyword,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<ApiDefinitionCaseEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiDefinitionCaseEntity::getWorkspaceId, workspaceCode);
        if (definitionId != null) {
            query.eq(ApiDefinitionCaseEntity::getDefinitionId, definitionId);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(ApiDefinitionCaseEntity::getCaseName, trimmedKeyword)
                    .or()
                    .like(ApiDefinitionCaseEntity::getDescription, trimmedKeyword));
        }
        int safePageNo = safePageNo(pageNo);
        if (pageSize == null || pageSize < 1) {
            List<ApiDefinitionCaseEntity> entities = caseMapper.selectList(query.orderByDesc(ApiDefinitionCaseEntity::getUpdatedAt));
            List<ApiDefinitionCaseItem> items = toCaseItems(entities);
            int compatiblePageSize = safePageSize(pageSize, items.size());
            return PageResponse.of(paginate(items, safePageNo, compatiblePageSize), items.size(), safePageNo, compatiblePageSize);
        }
        Page<ApiDefinitionCaseEntity> page = caseMapper.selectPage(
                new Page<>(safePageNo, pageSize),
                query.orderByDesc(ApiDefinitionCaseEntity::getUpdatedAt));
        List<ApiDefinitionCaseItem> items = toCaseItems(page.getRecords());
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public ApiDefinitionCaseDetail getCase(Long id, String workspaceCode) {
        ApiDefinitionCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the case");
        return toCaseDetail(entity);
    }

    public ApiDefinitionCaseDetail createCase(String headerWorkspaceCode, SaveApiDefinitionCaseRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ApiDefinitionEntity definition = requireDefinition(request.definitionId());
        ensureDefinitionInWorkspace(definition, workspace.getId(), "Case definition must belong to the same workspace");
        ApiDefinitionCaseEntity entity = new ApiDefinitionCaseEntity();
        fillCaseEntity(entity, workspace, definition, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        caseMapper.insert(entity);
        recordCaseChangeHistory(entity, "CREATE", "创建用例");
        return toCaseDetail(entity);
    }

    public ApiDefinitionCaseDetail updateCase(Long id, String headerWorkspaceCode, SaveApiDefinitionCaseRequest request) {
        ApiDefinitionCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the case");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a case to another workspace");
        }
        ApiDefinitionEntity definition = requireDefinition(request.definitionId());
        ensureDefinitionInWorkspace(definition, workspace.getId(), "Case definition must belong to the same workspace");
        fillCaseEntity(entity, workspace, definition, request);
        entity.setUpdatedAt(LocalDateTime.now());
        caseMapper.updateById(entity);
        recordCaseChangeHistory(entity, "UPDATE", "更新用例");
        return toCaseDetail(entity);
    }

    public void deleteCase(Long id, String workspaceCode) {
        ApiDefinitionCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the case");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        long scenarioCount = countScenarioReferences(entity.getWorkspaceId(), SCENARIO_RESOURCE_TYPE_CASE, id);
        if (scenarioCount > 0) {
            throw new BadRequestException("This case is still referenced by scenarios");
        }
        caseMapper.deleteById(id);
    }

    private void fillCaseEntity(ApiDefinitionCaseEntity entity, WorkspaceEntity workspace, ApiDefinitionEntity definition, SaveApiDefinitionCaseRequest request) {
        entity.setWorkspaceId(workspace.getId());
        entity.setDefinitionId(definition.getId());
        entity.setCaseName(request.name().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setTagsJson(ApiAutomationJsonSupport.toJson(defaultList(request.tags()), "Failed to serialize case tags"));
        entity.setRequestJson(ApiAutomationJsonSupport.toJson(request.requestConfig(), "Failed to serialize case request config"));
        entity.setAssertionsJson(ApiAutomationJsonSupport.toJson(defaultList(request.assertions()), "Failed to serialize case assertions"));
        entity.setPreprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.preProcessors(), "PRE"),
                "Failed to serialize case pre-processors"));
        entity.setPostprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.postProcessors(), "POST"),
                "Failed to serialize case post-processors"));
    }

    private void recordCaseChangeHistory(ApiDefinitionCaseEntity entity, String changeType, String changeSummary) {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        ApiDefinitionCaseChangeHistoryEntity history = new ApiDefinitionCaseChangeHistoryEntity();
        history.setWorkspaceId(entity.getWorkspaceId());
        history.setDefinitionId(entity.getDefinitionId());
        history.setCaseId(entity.getId());
        history.setCaseName(entity.getCaseName());
        history.setChangeType(changeType);
        history.setChangeSummary(changeSummary);
        history.setOperatorId(currentUser.userId());
        history.setOperatorName(currentUser.displayName());
        history.setCreatedAt(LocalDateTime.now());
        history.setUpdatedAt(LocalDateTime.now());
        caseChangeHistoryMapper.insert(history);
    }

    private List<ApiDefinitionCaseItem> toCaseItems(List<ApiDefinitionCaseEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        Map<Long, WorkspaceEntity> workspaces = workspaceService.listReadableWorkspaceEntities().stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity(), (left, right) -> left));
        List<Long> definitionIds = entities.stream()
                .map(ApiDefinitionCaseEntity::getDefinitionId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, ApiDefinitionEntity> definitions = definitionIds.isEmpty()
                ? Map.of()
                : definitionMapper.selectBatchIds(definitionIds).stream()
                .collect(Collectors.toMap(ApiDefinitionEntity::getId, Function.identity(), (left, right) -> left));
        return entities.stream()
                .map(entity -> {
                    WorkspaceEntity workspace = workspaces.get(entity.getWorkspaceId());
                    if (workspace == null) {
                        workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
                    }
                    ApiDefinitionEntity definition = definitions.get(entity.getDefinitionId());
                    if (definition == null) {
                        definition = requireDefinition(entity.getDefinitionId());
                    }
                    return toCaseItem(entity, workspace, definition);
                })
                .toList();
    }

    private ApiDefinitionCaseItem toCaseItem(
            ApiDefinitionCaseEntity entity,
            WorkspaceEntity workspace,
            ApiDefinitionEntity definition
    ) {
        ApiRequestConfigInput requestConfig = readStoredRequestConfig(entity.getRequestJson(), definition.getHttpMethod(), definition.getPath());
        return new ApiDefinitionCaseItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                definition.getId(),
                definition.getDefinitionName(),
                entity.getCaseName(),
                requestConfig.method(),
                requestConfig.path(),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiDefinitionCaseDetail toCaseDetail(ApiDefinitionCaseEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        ApiDefinitionEntity definition = requireDefinition(entity.getDefinitionId());
        ApiRequestConfigInput requestConfig = readStoredRequestConfig(entity.getRequestJson(), definition.getHttpMethod(), definition.getPath());
        return new ApiDefinitionCaseDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                definition.getId(),
                definition.getDefinitionName(),
                entity.getCaseName(),
                requestConfig.method(),
                requestConfig.path(),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                requestConfig,
                readAssertions(entity.getAssertionsJson()),
                List.of(),
                readProcessorsJson(entity.getPreprocessorsJson()),
                readProcessorsJson(entity.getPostprocessorsJson()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
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

    private void ensureDefinitionInWorkspace(ApiDefinitionEntity definition, Long workspaceId, String message) {
        if (!definition.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private long countScenarioReferences(Long workspaceId, String resourceType, Long resourceId) {
        return scenarioMapper.selectList(new LambdaQueryWrapper<ApiScenarioEntity>()
                        .eq(ApiScenarioEntity::getWorkspaceId, workspaceId))
                .stream()
                .filter(entity -> containsScenarioReference(readScenarioSteps(entity.getStepsJson()), resourceType, resourceId))
                .count();
    }

    private boolean containsScenarioReference(List<ApiScenarioStepInput> steps, String resourceType, Long resourceId) {
        for (ApiScenarioStepInput step : defaultList(steps)) {
            if (step == null) {
                continue;
            }
            String normalizedResourceType = normalizeScenarioResourceTypeForStep(normalizeScenarioStepType(step));
            if (resourceType.equals(normalizedResourceType) && resourceId.equals(step.resourceId())) {
                return true;
            }
            if (containsScenarioReference(step.children(), resourceType, resourceId)) {
                return true;
            }
        }
        return false;
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

    private ApiRequestConfigInput readStoredRequestConfig(String json, String methodFallback, String pathFallback) {
        return ApiAutomationJsonSupport.read(json, ApiRequestConfigInput.class,
                new ApiRequestConfigInput(methodFallback, pathFallback, 10000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig()));
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
}

