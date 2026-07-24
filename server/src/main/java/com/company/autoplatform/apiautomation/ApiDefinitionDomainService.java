package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;

@Service
public class ApiDefinitionDomainService {

    private static final String SCENARIO_RESOURCE_TYPE_DEFINITION = "DEFINITION";

    private final ApiDefinitionMapper definitionMapper;
    private final ApiDefinitionModuleMapper definitionModuleMapper;
    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiScenarioMapper scenarioMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiDefinitionDomainService(
            ApiDefinitionMapper definitionMapper,
            ApiDefinitionModuleMapper definitionModuleMapper,
            ApiDefinitionCaseMapper caseMapper,
            ApiScenarioMapper scenarioMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.definitionMapper = definitionMapper;
        this.definitionModuleMapper = definitionModuleMapper;
        this.caseMapper = caseMapper;
        this.scenarioMapper = scenarioMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiDefinitionItem> listDefinitions(
            String workspaceCode,
            String keyword,
            Long moduleId,
            boolean includeDescendants,
            boolean rootOnly,
            Integer pageNo,
            Integer pageSize
    ) {
        Map<Long, WorkspaceEntity> readableWorkspaces = readableWorkspaceMap();
        LambdaQueryWrapper<ApiDefinitionEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiDefinitionEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(ApiDefinitionEntity::getDefinitionName, trimmedKeyword)
                    .or()
                    .like(ApiDefinitionEntity::getPath, trimmedKeyword)
                    .or()
                    .like(ApiDefinitionEntity::getHttpMethod, trimmedKeyword)
                    .or()
                    .like(ApiDefinitionEntity::getDirectoryName, trimmedKeyword)
                    .or()
                    .like(ApiDefinitionEntity::getTagsJson, trimmedKeyword));
        }
        DefinitionModuleFilter moduleFilter = resolveDefinitionModuleFilter(
                moduleId, workspaceCode, includeDescendants);
        if (rootOnly) {
            query.isNull(ApiDefinitionEntity::getModuleId)
                    .and(wrapper -> wrapper
                            .isNull(ApiDefinitionEntity::getDirectoryName)
                            .or()
                            .eq(ApiDefinitionEntity::getDirectoryName, ""));
        } else if (moduleFilter != null) {
            query.and(wrapper -> wrapper
                    .in(ApiDefinitionEntity::getModuleId, moduleFilter.moduleIds())
                    .or(legacy -> {
                        legacy.isNull(ApiDefinitionEntity::getModuleId);
                        if (includeDescendants) {
                            legacy.and(path -> path
                                    .eq(ApiDefinitionEntity::getDirectoryName, moduleFilter.modulePath())
                                    .or()
                                    .likeRight(ApiDefinitionEntity::getDirectoryName, moduleFilter.modulePath() + "/"));
                        } else {
                            legacy.eq(ApiDefinitionEntity::getDirectoryName, moduleFilter.modulePath());
                        }
                    }));
        }
        query.select(
                        ApiDefinitionEntity::getId,
                        ApiDefinitionEntity::getWorkspaceId,
                        ApiDefinitionEntity::getDefinitionName,
                        ApiDefinitionEntity::getHttpMethod,
                        ApiDefinitionEntity::getPath,
                        ApiDefinitionEntity::getDirectoryName,
                        ApiDefinitionEntity::getModuleId,
                        ApiDefinitionEntity::getDescription,
                        ApiDefinitionEntity::getTagsJson,
                        ApiDefinitionEntity::getLastRunResult,
                        ApiDefinitionEntity::getLastRunAt,
                        ApiDefinitionEntity::getUpdatedAt
                )
                .orderByDesc(ApiDefinitionEntity::getUpdatedAt)
                .orderByDesc(ApiDefinitionEntity::getId);

        int safePageNo = safePageNo(pageNo);
        if (pageSize == null || pageSize < 1) {
            List<ApiDefinitionItem> items = definitionMapper.selectList(query).stream()
                    .map(entity -> toDefinitionItem(entity, readableWorkspaces))
                    .toList();
            int compatiblePageSize = safePageSize(pageSize, items.size());
            return PageResponse.of(paginate(items, safePageNo, compatiblePageSize), items.size(), safePageNo, compatiblePageSize);
        }

        Page<ApiDefinitionEntity> page = definitionMapper.selectPage(new Page<>(safePageNo, pageSize), query);
        List<ApiDefinitionItem> items = page.getRecords().stream()
                .map(entity -> toDefinitionItem(entity, readableWorkspaces))
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public ApiDefinitionTreeSearchResult searchDefinitionTree(
            String workspaceCode,
            String keyword,
            Integer limit
    ) {
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword == null) {
            return new ApiDefinitionTreeSearchResult(List.of(), List.of(), 0, 0);
        }
        int safeLimit = Math.min(Math.max(Optional.ofNullable(limit).orElse(100), 1), 200);
        WorkspaceEntity scopedWorkspace = workspaceScopeSupport.resolveScopedWorkspace(workspaceCode);
        List<WorkspaceEntity> readableWorkspaceItems = scopedWorkspace == null
                ? workspaceService.listReadableWorkspaceEntities()
                : List.of(scopedWorkspace);
        if (readableWorkspaceItems.isEmpty()) {
            return new ApiDefinitionTreeSearchResult(List.of(), List.of(), 0, 0);
        }

        Map<Long, WorkspaceEntity> readableWorkspaces = readableWorkspaceItems.stream()
                .collect(java.util.stream.Collectors.toMap(WorkspaceEntity::getId, item -> item));
        List<Long> workspaceIds = readableWorkspaceItems.stream().map(WorkspaceEntity::getId).toList();
        PageResponse<ApiDefinitionItem> definitionPage = listDefinitions(
                workspaceCode, trimmedKeyword, null, true, false, 1, safeLimit);

        LambdaQueryWrapper<ApiDefinitionModuleEntity> moduleQuery = new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .in(ApiDefinitionModuleEntity::getWorkspaceId, workspaceIds)
                .like(ApiDefinitionModuleEntity::getModuleName, trimmedKeyword)
                .select(
                        ApiDefinitionModuleEntity::getId,
                        ApiDefinitionModuleEntity::getWorkspaceId,
                        ApiDefinitionModuleEntity::getParentId,
                        ApiDefinitionModuleEntity::getModuleName,
                        ApiDefinitionModuleEntity::getSortOrder,
                        ApiDefinitionModuleEntity::getCreatedAt,
                        ApiDefinitionModuleEntity::getUpdatedAt)
                .orderByAsc(ApiDefinitionModuleEntity::getSortOrder)
                .orderByAsc(ApiDefinitionModuleEntity::getId);
        Page<ApiDefinitionModuleEntity> modulePage = definitionModuleMapper.selectPage(
                new Page<>(1, safeLimit), moduleQuery);

        java.util.LinkedHashSet<Long> matchedModuleIds = new java.util.LinkedHashSet<>();
        modulePage.getRecords().stream()
                .map(ApiDefinitionModuleEntity::getId)
                .forEach(matchedModuleIds::add);
        definitionPage.items().stream()
                .map(ApiDefinitionItem::moduleId)
                .filter(java.util.Objects::nonNull)
                .forEach(matchedModuleIds::add);

        if (matchedModuleIds.isEmpty()) {
            return new ApiDefinitionTreeSearchResult(
                    List.of(), definitionPage.items(), modulePage.getTotal(), definitionPage.total());
        }

        List<ApiDefinitionModuleEntity> ancestors = definitionModuleMapper.selectAncestorModules(
                workspaceIds, List.copyOf(matchedModuleIds));
        Map<Long, String> pathMap = buildDefinitionModulePathMap(ancestors);
        Map<Long, Long> matchingDefinitionCounts = new HashMap<>();
        definitionPage.items().stream()
                .map(ApiDefinitionItem::moduleId)
                .filter(java.util.Objects::nonNull)
                .forEach(moduleId -> matchingDefinitionCounts.merge(moduleId, 1L, Long::sum));
        List<ApiDefinitionModuleItem> moduleTree = withDefinitionModuleDescendantCounts(
                buildDefinitionModuleTree(ancestors, pathMap, matchingDefinitionCounts, readableWorkspaces));
        return new ApiDefinitionTreeSearchResult(
                moduleTree,
                definitionPage.items(),
                modulePage.getTotal(),
                definitionPage.total());
    }

    public ApiDefinitionDetail getDefinition(Long id, String workspaceCode) {
        ApiDefinitionEntity entity = requireDefinition(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the definition");
        return toDefinitionDetail(entity);
    }

    public ApiDefinitionDetail createDefinition(String headerWorkspaceCode, SaveApiDefinitionRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ApiDefinitionEntity entity = new ApiDefinitionEntity();
        fillDefinitionEntity(entity, workspace, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        definitionMapper.insert(entity);
        return toDefinitionDetail(entity);
    }

    public ImportedApiDefinition importDefinition(String headerWorkspaceCode, SaveApiDefinitionRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ApiDefinitionEntity entity = findImportDuplicate(workspace.getId(), request);
        boolean created = entity == null;
        if (created) {
            entity = new ApiDefinitionEntity();
            fillDefinitionEntity(entity, workspace, request);
            entity.setCreatedAt(LocalDateTime.now());
            entity.setUpdatedAt(LocalDateTime.now());
            definitionMapper.insert(entity);
        } else {
            fillDefinitionEntity(entity, workspace, request);
            entity.setUpdatedAt(LocalDateTime.now());
            definitionMapper.updateById(entity);
        }
        return new ImportedApiDefinition(created, toDefinitionDetail(entity));
    }

    public ApiDefinitionDetail updateDefinition(Long id, String headerWorkspaceCode, SaveApiDefinitionRequest request) {
        ApiDefinitionEntity entity = requireDefinition(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the definition");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a definition to another workspace");
        }
        fillDefinitionEntity(entity, workspace, request);
        entity.setUpdatedAt(LocalDateTime.now());
        definitionMapper.updateById(entity);
        return toDefinitionDetail(entity);
    }

    public void deleteDefinition(Long id, String workspaceCode) {
        ApiDefinitionEntity entity = requireDefinition(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the definition");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        long caseCount = caseMapper.selectCount(new LambdaQueryWrapper<ApiDefinitionCaseEntity>()
                .eq(ApiDefinitionCaseEntity::getDefinitionId, id));
        if (caseCount > 0) {
            throw new BadRequestException("This definition is still referenced by cases");
        }
        long scenarioCount = countScenarioReferences(entity.getWorkspaceId(), SCENARIO_RESOURCE_TYPE_DEFINITION, id);
        if (scenarioCount > 0) {
            throw new BadRequestException("This definition is still referenced by scenarios");
        }
        definitionMapper.deleteById(id);
    }

    public List<ApiDefinitionModuleItem> listDefinitionModules(String workspaceCode) {
        WorkspaceEntity scopedWorkspace = workspaceScopeSupport.resolveScopedWorkspace(workspaceCode);
        List<WorkspaceEntity> readableWorkspaceItems = scopedWorkspace == null
                ? workspaceService.listReadableWorkspaceEntities()
                : List.of(scopedWorkspace);
        if (readableWorkspaceItems.isEmpty()) {
            return List.of();
        }

        Map<Long, WorkspaceEntity> readableWorkspaces = readableWorkspaceItems.stream()
                .collect(java.util.stream.Collectors.toMap(WorkspaceEntity::getId, item -> item));
        List<Long> workspaceIds = readableWorkspaceItems.stream().map(WorkspaceEntity::getId).toList();
        List<ApiDefinitionModuleEntity> modules = new ArrayList<>(definitionModuleMapper.selectList(
                new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .in(ApiDefinitionModuleEntity::getWorkspaceId, workspaceIds)
                .orderByAsc(ApiDefinitionModuleEntity::getSortOrder)
                .orderByAsc(ApiDefinitionModuleEntity::getId)));
        List<ApiDefinitionDirectoryCountRow> directoryCounts = definitionMapper.selectDirectoryCounts(workspaceIds);
        bindUnassignedDefinitionDirectories(directoryCounts, modules);
        Map<Long, String> pathMap = buildDefinitionModulePathMap(modules);
        Map<Long, Long> counts = new HashMap<>();
        for (ApiDefinitionModuleCountRow row : definitionMapper.selectModuleCounts(workspaceIds)) {
            counts.put(row.getModuleId(), Optional.ofNullable(row.getDefinitionCount()).orElse(0L));
        }
        List<ApiDefinitionModuleItem> tree = buildDefinitionModuleTree(
                modules, pathMap, counts, readableWorkspaces);
        return withDefinitionModuleDescendantCounts(tree);
    }

    public List<ApiDefinitionModuleItem> listDefinitionModuleChildren(String workspaceCode, Long parentId) {
        WorkspaceEntity scopedWorkspace = workspaceScopeSupport.resolveScopedWorkspace(workspaceCode);
        List<WorkspaceEntity> readableWorkspaceItems = scopedWorkspace == null
                ? workspaceService.listReadableWorkspaceEntities()
                : List.of(scopedWorkspace);
        if (readableWorkspaceItems.isEmpty()) {
            return List.of();
        }
        Map<Long, WorkspaceEntity> workspaces = readableWorkspaceItems.stream()
                .collect(java.util.stream.Collectors.toMap(WorkspaceEntity::getId, item -> item));
        List<Long> workspaceIds = readableWorkspaceItems.stream().map(WorkspaceEntity::getId).toList();

        List<ApiDefinitionDirectoryCountRow> unboundDirectories = definitionMapper.selectDirectoryCounts(workspaceIds);
        if (!unboundDirectories.isEmpty()) {
            List<ApiDefinitionModuleEntity> modules = new ArrayList<>(definitionModuleMapper.selectList(
                    new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                            .in(ApiDefinitionModuleEntity::getWorkspaceId, workspaceIds)));
            bindUnassignedDefinitionDirectories(unboundDirectories, modules);
        }

        String parentPath = "";
        if (parentId != null) {
            ApiDefinitionModuleEntity parent = requireDefinitionModule(parentId);
            workspaceScopeSupport.validateReadable(parent.getWorkspaceId(), workspaceCode,
                    "Current workspace cannot access the definition module");
            parentPath = String.join("/", definitionModuleMapper.selectAncestorNames(parentId));
        }

        String resolvedParentPath = parentPath;
        return definitionModuleMapper.selectChildNodes(workspaceIds, parentId).stream()
                .map(row -> {
                    WorkspaceEntity workspace = workspaces.get(row.getWorkspaceId());
                    if (workspace == null) {
                        workspace = workspaceService.requireWorkspaceById(row.getWorkspaceId());
                    }
                    boolean hasChildren = Boolean.TRUE.equals(row.getHasChildren());
                    String fullPath = resolvedParentPath.isBlank()
                            ? row.getModuleName()
                            : resolvedParentPath + "/" + row.getModuleName();
                    return new ApiDefinitionModuleItem(
                            row.getId(),
                            workspace.getWorkspaceCode(),
                            workspace.getWorkspaceName(),
                            row.getParentId(),
                            row.getModuleName(),
                            fullPath,
                            row.getSortOrder(),
                            Optional.ofNullable(row.getDefinitionCount()).orElse(0L),
                            Optional.ofNullable(row.getDirectDefinitionCount()).orElse(0L),
                            hasChildren,
                            !hasChildren,
                            List.of()
                    );
                })
                .toList();
    }

    public ApiDefinitionModuleItem createDefinitionModule(String headerWorkspaceCode, ApiDefinitionModuleRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (request.parentId() != null) {
            ApiDefinitionModuleEntity parent = requireDefinitionModule(request.parentId());
            if (!parent.getWorkspaceId().equals(workspace.getId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
        }
        ensureDefinitionModuleNameUnique(workspace.getId(), request.parentId(), null, request.name());
        ApiDefinitionModuleEntity entity = new ApiDefinitionModuleEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setParentId(request.parentId());
        entity.setModuleName(request.name().trim());
        entity.setSortOrder(nextDefinitionModuleSort(workspace.getId(), request.parentId()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        definitionModuleMapper.insert(entity);
        return toDefinitionModuleItem(entity, currentDefinitionModulePathMap(entity.getWorkspaceId()), 0L, List.of());
    }

    public ApiDefinitionModuleItem updateDefinitionModule(Long id, String workspaceCode, ApiDefinitionModuleRequest request) {
        ApiDefinitionModuleEntity entity = requireDefinitionModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the definition module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        String previousPath = getDefinitionModulePath(entity);
        ensureDefinitionModuleNameUnique(entity.getWorkspaceId(), entity.getParentId(), id, request.name());
        entity.setModuleName(request.name().trim());
        entity.setUpdatedAt(LocalDateTime.now());
        definitionModuleMapper.updateById(entity);
        String nextPath = getDefinitionModulePath(entity);
        syncDefinitionDirectoryPrefix(entity.getWorkspaceId(), previousPath, nextPath);
        return toDefinitionModuleItem(entity, currentDefinitionModulePathMap(entity.getWorkspaceId()), countDefinitionsInModule(entity.getWorkspaceId(), id), List.of());
    }

    public ApiDefinitionModuleItem moveDefinitionModule(Long id, String workspaceCode, MoveApiDefinitionModuleRequest request) {
        ApiDefinitionModuleEntity entity = requireDefinitionModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot move the definition module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        String previousPath = getDefinitionModulePath(entity);
        if (request.parentId() != null) {
            ApiDefinitionModuleEntity parent = requireDefinitionModule(request.parentId());
            if (!parent.getWorkspaceId().equals(entity.getWorkspaceId())) {
                throw new BadRequestException("Parent module must belong to the same workspace");
            }
            if (definitionModuleDescendantIds(entity.getWorkspaceId(), id).contains(request.parentId())) {
                throw new BadRequestException("Cannot move module under itself");
            }
        }
        ensureDefinitionModuleNameUnique(entity.getWorkspaceId(), request.parentId(), id, entity.getModuleName());
        entity.setParentId(request.parentId());
        entity.setSortOrder(request.sortOrder() == null ? nextDefinitionModuleSort(entity.getWorkspaceId(), request.parentId()) : request.sortOrder());
        entity.setUpdatedAt(LocalDateTime.now());
        definitionModuleMapper.updateById(entity);
        String nextPath = getDefinitionModulePath(entity);
        syncDefinitionDirectoryPrefix(entity.getWorkspaceId(), previousPath, nextPath);
        return toDefinitionModuleItem(entity, currentDefinitionModulePathMap(entity.getWorkspaceId()), countDefinitionsInModule(entity.getWorkspaceId(), id), List.of());
    }

    public void deleteDefinitionModule(Long id, String workspaceCode) {
        ApiDefinitionModuleEntity entity = requireDefinitionModule(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the definition module");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (definitionModuleMapper.selectCount(new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .eq(ApiDefinitionModuleEntity::getParentId, id)) > 0) {
            throw new BadRequestException("Cannot delete a module that contains child modules");
        }
        String modulePath = getDefinitionModulePath(entity);
        definitionMapper.update(null, new LambdaUpdateWrapper<ApiDefinitionEntity>()
                .eq(ApiDefinitionEntity::getWorkspaceId, entity.getWorkspaceId())
                .and(query -> query
                        .eq(ApiDefinitionEntity::getModuleId, id)
                        .or(legacy -> legacy
                                .isNull(ApiDefinitionEntity::getModuleId)
                                .eq(ApiDefinitionEntity::getDirectoryName, modulePath)))
                .set(ApiDefinitionEntity::getModuleId, null)
                .set(ApiDefinitionEntity::getDirectoryName, null)
                .set(ApiDefinitionEntity::getUpdatedAt, LocalDateTime.now()));
        definitionModuleMapper.deleteById(id);
    }

    private void fillDefinitionEntity(ApiDefinitionEntity entity, WorkspaceEntity workspace, SaveApiDefinitionRequest request) {
        entity.setWorkspaceId(workspace.getId());
        entity.setDefinitionName(request.name().trim());
        entity.setHttpMethod(request.requestConfig().method().trim().toUpperCase());
        entity.setPath(request.requestConfig().path().trim());
        entity.setDirectoryName(blankToNull(request.directoryName()));
        entity.setModuleId(ensureDefinitionModulePath(workspace.getId(), entity.getDirectoryName()));
        entity.setDescription(blankToNull(request.description()));
        entity.setTagsJson(ApiAutomationJsonSupport.toJson(defaultList(request.tags()), "Failed to serialize tags"));
        entity.setRequestJson(ApiAutomationJsonSupport.toJson(request.requestConfig(), "Failed to serialize request config"));
        entity.setAssertionsJson(ApiAutomationJsonSupport.toJson(defaultList(request.assertions()), "Failed to serialize assertions"));
        entity.setExtractorsJson(ApiAutomationJsonSupport.toJson(defaultList(request.extractors()), "Failed to serialize extractors"));
        entity.setPreprocessorsJson(ApiAutomationJsonSupport.toJson(normalizeProcessors(request.preProcessors(), "PRE"),
                "Failed to serialize pre-processors"));
        entity.setPostprocessorsJson(ApiAutomationJsonSupport.toJson(normalizePostProcessors(request.postProcessors(), request.extractors()),
                "Failed to serialize post-processors"));
    }

    private ApiDefinitionEntity findImportDuplicate(Long workspaceId, SaveApiDefinitionRequest request) {
        String method = request.requestConfig().method().trim().toUpperCase();
        String path = request.requestConfig().path().trim();
        LambdaQueryWrapper<ApiDefinitionEntity> query = new LambdaQueryWrapper<ApiDefinitionEntity>()
                .eq(ApiDefinitionEntity::getWorkspaceId, workspaceId)
                .eq(ApiDefinitionEntity::getHttpMethod, method)
                .eq(ApiDefinitionEntity::getPath, path);
        return definitionMapper.selectList(query.orderByDesc(ApiDefinitionEntity::getUpdatedAt))
                .stream()
                .findFirst()
                .orElse(null);
    }

    public record ImportedApiDefinition(boolean created, ApiDefinitionDetail detail) {
    }

    private ApiDefinitionItem toDefinitionItem(ApiDefinitionEntity entity, Map<Long, WorkspaceEntity> workspaces) {
        WorkspaceEntity workspace = workspaces.get(entity.getWorkspaceId());
        if (workspace == null) {
            workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        }
        return new ApiDefinitionItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleId(),
                entity.getDefinitionName(),
                entity.getHttpMethod(),
                entity.getPath(),
                entity.getDirectoryName(),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiDefinitionDetail toDefinitionDetail(ApiDefinitionEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiDefinitionDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getDefinitionName(),
                entity.getHttpMethod(),
                entity.getPath(),
                entity.getDirectoryName(),
                entity.getDescription(),
                readTags(entity.getTagsJson()),
                ApiAutomationJsonSupport.read(entity.getRequestJson(), ApiRequestConfigInput.class,
                        new ApiRequestConfigInput(entity.getHttpMethod(), entity.getPath(), 10000, List.of(), List.of(), List.of(),
                                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig())),
                readAssertions(entity.getAssertionsJson()),
                readExtractors(entity.getExtractorsJson()),
                readProcessorsJson(entity.getPreprocessorsJson()),
                readProcessorsJson(entity.getPostprocessorsJson()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiDefinitionModuleEntity requireDefinitionModule(Long id) {
        ApiDefinitionModuleEntity entity = definitionModuleMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API definition module not found");
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

    private List<ApiDefinitionModuleItem> buildDefinitionModuleTree(
            List<ApiDefinitionModuleEntity> modules,
            Map<Long, String> pathMap,
            Map<Long, Long> counts,
            Map<Long, WorkspaceEntity> workspaces
    ) {
        List<ApiDefinitionModuleEntity> roots = new ArrayList<>();
        Map<Long, List<ApiDefinitionModuleEntity>> childrenByParent = new HashMap<>();
        for (ApiDefinitionModuleEntity module : modules) {
            if (module.getParentId() == null) {
                roots.add(module);
            } else {
                childrenByParent.computeIfAbsent(module.getParentId(), ignored -> new ArrayList<>()).add(module);
            }
        }
        return buildDefinitionModuleTreeNodes(roots, childrenByParent, pathMap, counts, workspaces);
    }

    private List<ApiDefinitionModuleItem> buildDefinitionModuleTreeNodes(
            List<ApiDefinitionModuleEntity> modules,
            Map<Long, List<ApiDefinitionModuleEntity>> childrenByParent,
            Map<Long, String> pathMap,
            Map<Long, Long> counts,
            Map<Long, WorkspaceEntity> workspaces
    ) {
        return modules.stream()
                .map(module -> toDefinitionModuleItem(module, pathMap, counts.getOrDefault(module.getId(), 0L),
                        buildDefinitionModuleTreeNodes(
                                childrenByParent.getOrDefault(module.getId(), List.of()),
                                childrenByParent,
                                pathMap,
                                counts,
                                workspaces
                        ), workspaces))
                .toList();
    }

    private ApiDefinitionModuleItem toDefinitionModuleItem(
            ApiDefinitionModuleEntity entity,
            Map<Long, String> pathMap,
            Long definitionCount,
            List<ApiDefinitionModuleItem> children
    ) {
        return toDefinitionModuleItem(entity, pathMap, definitionCount, children, Map.of());
    }

    private ApiDefinitionModuleItem toDefinitionModuleItem(
            ApiDefinitionModuleEntity entity,
            Map<Long, String> pathMap,
            Long definitionCount,
            List<ApiDefinitionModuleItem> children,
            Map<Long, WorkspaceEntity> workspaces
    ) {
        WorkspaceEntity workspace = workspaces.get(entity.getWorkspaceId());
        if (workspace == null) {
            workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        }
        String path = pathMap.getOrDefault(entity.getId(), entity.getModuleName());
        return new ApiDefinitionModuleItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getParentId(),
                entity.getModuleName(),
                path,
                entity.getSortOrder(),
                definitionCount,
                definitionCount,
                !children.isEmpty(),
                true,
                children
        );
    }

    private List<ApiDefinitionModuleItem> withDefinitionModuleDescendantCounts(List<ApiDefinitionModuleItem> modules) {
        return modules.stream()
                .map(this::withDefinitionModuleDescendantCount)
                .toList();
    }

    private ApiDefinitionModuleItem withDefinitionModuleDescendantCount(ApiDefinitionModuleItem item) {
        List<ApiDefinitionModuleItem> children = withDefinitionModuleDescendantCounts(item.children());
        long childCount = children.stream()
                .map(ApiDefinitionModuleItem::definitionCount)
                .filter(java.util.Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
        return new ApiDefinitionModuleItem(
                item.id(),
                item.workspaceCode(),
                item.workspaceName(),
                item.parentId(),
                item.name(),
                item.fullPath(),
                item.sortOrder(),
                Optional.ofNullable(item.definitionCount()).orElse(0L) + childCount,
                item.directDefinitionCount(),
                item.hasChildren(),
                item.childrenLoaded(),
                children
        );
    }

    private Map<Long, String> currentDefinitionModulePathMap(Long workspaceId) {
        return buildDefinitionModulePathMap(definitionModuleMapper.selectList(new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .eq(ApiDefinitionModuleEntity::getWorkspaceId, workspaceId)));
    }

    private Map<Long, String> buildDefinitionModulePathMap(List<ApiDefinitionModuleEntity> modules) {
        Map<Long, ApiDefinitionModuleEntity> moduleMap = modules.stream()
                .collect(java.util.stream.Collectors.toMap(ApiDefinitionModuleEntity::getId, item -> item));
        Map<Long, String> pathMap = new HashMap<>();
        for (ApiDefinitionModuleEntity module : modules) {
            pathMap.put(module.getId(), buildDefinitionModulePath(module, moduleMap));
        }
        return pathMap;
    }

    private String buildDefinitionModulePath(ApiDefinitionModuleEntity module, Map<Long, ApiDefinitionModuleEntity> moduleMap) {
        List<String> names = new java.util.ArrayList<>();
        ApiDefinitionModuleEntity current = module;
        while (current != null) {
            names.add(current.getModuleName());
            current = current.getParentId() == null ? null : moduleMap.get(current.getParentId());
        }
        java.util.Collections.reverse(names);
        return String.join("/", names);
    }

    private String getDefinitionModulePath(ApiDefinitionModuleEntity module) {
        return currentDefinitionModulePathMap(module.getWorkspaceId()).getOrDefault(module.getId(), module.getModuleName());
    }

    private void ensureDefinitionModuleNameUnique(Long workspaceId, Long parentId, Long excludeId, String name) {
        LambdaQueryWrapper<ApiDefinitionModuleEntity> query = new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .eq(ApiDefinitionModuleEntity::getWorkspaceId, workspaceId)
                .eq(ApiDefinitionModuleEntity::getModuleName, name.trim());
        if (parentId == null) {
            query.isNull(ApiDefinitionModuleEntity::getParentId);
        } else {
            query.eq(ApiDefinitionModuleEntity::getParentId, parentId);
        }
        if (excludeId != null) {
            query.ne(ApiDefinitionModuleEntity::getId, excludeId);
        }
        if (definitionModuleMapper.selectCount(query) > 0) {
            throw new BadRequestException("Module name already exists");
        }
    }

    private int nextDefinitionModuleSort(Long workspaceId, Long parentId) {
        LambdaQueryWrapper<ApiDefinitionModuleEntity> query = new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                .eq(ApiDefinitionModuleEntity::getWorkspaceId, workspaceId);
        if (parentId == null) {
            query.isNull(ApiDefinitionModuleEntity::getParentId);
        } else {
            query.eq(ApiDefinitionModuleEntity::getParentId, parentId);
        }
        return definitionModuleMapper.selectList(query).stream()
                .map(ApiDefinitionModuleEntity::getSortOrder)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private Long ensureDefinitionModulePath(Long workspaceId, String directoryName) {
        String normalizedPath = normalizeDefinitionDirectoryPath(directoryName);
        if (normalizedPath == null) {
            return null;
        }
        List<ApiDefinitionModuleEntity> modules = new ArrayList<>(definitionModuleMapper.selectList(
                new LambdaQueryWrapper<ApiDefinitionModuleEntity>()
                        .eq(ApiDefinitionModuleEntity::getWorkspaceId, workspaceId)));
        ensureDefinitionModulePaths(
                List.of(new ApiDefinitionDirectoryCountRow(workspaceId, normalizedPath, 0L)), modules);
        Map<Long, String> pathMap = buildDefinitionModulePathMap(modules);
        return modules.stream()
                .filter(module -> normalizedPath.equals(pathMap.get(module.getId())))
                .map(ApiDefinitionModuleEntity::getId)
                .findFirst()
                .orElse(null);
    }

    private void ensureDefinitionModulePaths(
            List<ApiDefinitionDirectoryCountRow> directoryPaths,
            List<ApiDefinitionModuleEntity> modules
    ) {
        Map<Long, String> pathMap = buildDefinitionModulePathMap(modules);
        Map<DefinitionModulePathKey, ApiDefinitionModuleEntity> modulesByPath = new HashMap<>();
        Map<DefinitionModuleParentKey, Integer> maxSortByParent = new HashMap<>();
        for (ApiDefinitionModuleEntity module : modules) {
            modulesByPath.put(
                    new DefinitionModulePathKey(module.getWorkspaceId(), pathMap.get(module.getId())), module);
            maxSortByParent.merge(
                    new DefinitionModuleParentKey(module.getWorkspaceId(), module.getParentId()),
                    Optional.ofNullable(module.getSortOrder()).orElse(0),
                    Math::max
            );
        }

        List<ApiDefinitionDirectoryCountRow> sortedPaths = directoryPaths.stream()
                .filter(row -> normalizeDefinitionDirectoryPath(row.getDirectoryName()) != null)
                .sorted(java.util.Comparator.comparingInt(
                        row -> normalizeDefinitionDirectoryPath(row.getDirectoryName()).split("/").length))
                .toList();
        for (ApiDefinitionDirectoryCountRow row : sortedPaths) {
            Long parentId = null;
            String currentPath = "";
            for (String part : normalizeDefinitionDirectoryPath(row.getDirectoryName()).split("/")) {
                currentPath = currentPath.isEmpty() ? part : currentPath + "/" + part;
                DefinitionModulePathKey pathKey = new DefinitionModulePathKey(row.getWorkspaceId(), currentPath);
                ApiDefinitionModuleEntity module = modulesByPath.get(pathKey);
                if (module == null) {
                    DefinitionModuleParentKey parentKey = new DefinitionModuleParentKey(row.getWorkspaceId(), parentId);
                    int sortOrder = maxSortByParent.getOrDefault(parentKey, 0) + 1;
                    maxSortByParent.put(parentKey, sortOrder);

                    module = new ApiDefinitionModuleEntity();
                    module.setWorkspaceId(row.getWorkspaceId());
                    module.setParentId(parentId);
                    module.setModuleName(part);
                    module.setSortOrder(sortOrder);
                    module.setCreatedAt(LocalDateTime.now());
                    module.setUpdatedAt(LocalDateTime.now());
                    definitionModuleMapper.insert(module);
                    modules.add(module);
                    modulesByPath.put(pathKey, module);
                }
                parentId = module.getId();
            }
        }
    }

    private void bindUnassignedDefinitionDirectories(
            List<ApiDefinitionDirectoryCountRow> directoryCounts,
            List<ApiDefinitionModuleEntity> modules
    ) {
        if (directoryCounts.isEmpty()) {
            return;
        }
        ensureDefinitionModulePaths(directoryCounts, modules);
        Map<Long, String> pathMap = buildDefinitionModulePathMap(modules);
        Map<DefinitionModulePathKey, Long> moduleIdsByPath = new HashMap<>();
        for (ApiDefinitionModuleEntity module : modules) {
            moduleIdsByPath.put(
                    new DefinitionModulePathKey(module.getWorkspaceId(), pathMap.get(module.getId())),
                    module.getId()
            );
        }
        for (ApiDefinitionDirectoryCountRow row : directoryCounts) {
            String path = normalizeDefinitionDirectoryPath(row.getDirectoryName());
            Long moduleId = path == null ? null : moduleIdsByPath.get(
                    new DefinitionModulePathKey(row.getWorkspaceId(), path));
            if (moduleId != null) {
                definitionMapper.bindUnassignedDirectoryToModule(
                        row.getWorkspaceId(), row.getDirectoryName(), moduleId);
            }
        }
    }

    private long countDefinitionsInModule(Long workspaceId, Long moduleId) {
        List<Long> moduleIds = definitionModuleSubtreeIds(workspaceId, moduleId);
        return definitionMapper.selectCount(new LambdaQueryWrapper<ApiDefinitionEntity>()
                .eq(ApiDefinitionEntity::getWorkspaceId, workspaceId)
                .in(ApiDefinitionEntity::getModuleId, moduleIds));
    }

    private void syncDefinitionDirectoryPrefix(Long workspaceId, String sourcePath, String targetPath) {
        if (sourcePath == null || sourcePath.isBlank()) {
            return;
        }
        definitionMapper.selectList(new LambdaQueryWrapper<ApiDefinitionEntity>()
                        .eq(ApiDefinitionEntity::getWorkspaceId, workspaceId)
                        .and(query -> query
                                .eq(ApiDefinitionEntity::getDirectoryName, sourcePath)
                                .or()
                                .likeRight(ApiDefinitionEntity::getDirectoryName, sourcePath + "/"))
                        .select(ApiDefinitionEntity::getId, ApiDefinitionEntity::getDirectoryName))
                .forEach(definition -> {
                    String directory = definition.getDirectoryName();
                    if (directory == null) {
                        return;
                    }
                    if (directory.equals(sourcePath) || directory.startsWith(sourcePath + "/")) {
                        String suffix = directory.length() == sourcePath.length() ? "" : directory.substring(sourcePath.length());
                        definition.setDirectoryName(targetPath == null || targetPath.isBlank() ? blankToNull(suffix.replaceFirst("^/", "")) : targetPath + suffix);
                        definition.setUpdatedAt(LocalDateTime.now());
                        definitionMapper.updateById(definition);
                    }
                });
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
            if (resourceId.equals(normalizeScenarioResourceId(step))
                    && resourceType.equals(normalizeScenarioResourceTypeForStep(normalizeScenarioStepType(step)))) {
                return true;
            }
            if (containsScenarioReference(step.children(), resourceType, resourceId)) {
                return true;
            }
        }
        return false;
    }

    private List<ApiScenarioStepInput> readScenarioSteps(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private String normalizeScenarioStepType(ApiScenarioStepInput step) {
        String rawType = blankToNull(step.stepType());
        if (rawType != null) {
            return rawType.toUpperCase();
        }
        String resourceType = Optional.ofNullable(step.resourceType()).orElse("").trim().toUpperCase();
        if ("CASE".equals(resourceType)) {
            return "API_CASE";
        }
        if ("SCENARIO".equals(resourceType)) {
            return "API_SCENARIO";
        }
        return "API";
    }

    private String normalizeScenarioResourceTypeForStep(String stepType) {
        return switch (stepType) {
            case "API_CASE" -> "CASE";
            case "API_SCENARIO" -> "SCENARIO";
            default -> "DEFINITION";
        };
    }

    private Long normalizeScenarioResourceId(ApiScenarioStepInput step) {
        return step.resourceId();
    }

    private List<Long> definitionModuleDescendantIds(Long workspaceId, Long moduleId) {
        return definitionModuleSubtreeIds(workspaceId, moduleId).stream()
                .filter(id -> !id.equals(moduleId))
                .toList();
    }

    private List<Long> definitionModuleSubtreeIds(Long workspaceId, Long moduleId) {
        List<Long> ids = definitionModuleMapper.selectSubtreeIds(workspaceId, moduleId);
        return ids.isEmpty() ? List.of(moduleId) : ids;
    }

    private DefinitionModuleFilter resolveDefinitionModuleFilter(
            Long moduleId,
            String workspaceCode,
            boolean includeDescendants
    ) {
        if (moduleId == null) {
            return null;
        }
        ApiDefinitionModuleEntity module = requireDefinitionModule(moduleId);
        workspaceScopeSupport.validateReadable(module.getWorkspaceId(), workspaceCode, "Current workspace cannot access the definition module");
        return new DefinitionModuleFilter(
                includeDescendants
                        ? definitionModuleSubtreeIds(module.getWorkspaceId(), moduleId)
                        : List.of(moduleId),
                getDefinitionModulePath(module)
        );
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

    private Map<Long, WorkspaceEntity> readableWorkspaceMap() {
        return workspaceService.listReadableWorkspaceEntities().stream()
                .collect(java.util.stream.Collectors.toMap(WorkspaceEntity::getId, item -> item));
    }

    private String normalizeDefinitionDirectoryPath(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return null;
        }
        List<String> parts = java.util.Arrays.stream(normalized.replace('\\', '/').split("/"))
                .map(String::trim)
                .filter(part -> !part.isBlank())
                .toList();
        return parts.isEmpty() ? null : String.join("/", parts);
    }

    private record DefinitionModulePathKey(Long workspaceId, String path) {
    }

    private record DefinitionModuleParentKey(Long workspaceId, Long parentId) {
    }

    private record DefinitionModuleFilter(List<Long> moduleIds, String modulePath) {
    }
}

