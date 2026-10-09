package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.apiautomation.ApiWorkspaceScopeSupport;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.*;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.*;

@Service
public class WebUiElementDomainService {

    private final WebUiElementMapper elementMapper;
    private final WebUiElementModuleMapper moduleMapper;
    private final WebUiElementPageMapper pageMapper;
    private final WebUiElementGroupMapper groupMapper;
    private final WebUiCaseStepMapper caseStepMapper;
    private final WebUiCaseMapper caseMapper;
    private final WebUiCaseTemplateStepMapper templateStepMapper;
    private final WebUiCaseTemplateMapper templateMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final WebUiLocatorValidationRunner locatorValidationRunner;
    private final WebUiLocatorContextSupport locatorContextSupport;

    public WebUiElementDomainService(
            WebUiElementMapper elementMapper,
            WebUiElementModuleMapper moduleMapper,
            WebUiElementPageMapper pageMapper,
            WebUiElementGroupMapper groupMapper,
            WebUiCaseStepMapper caseStepMapper,
            WebUiCaseMapper caseMapper,
            WebUiCaseTemplateStepMapper templateStepMapper,
            WebUiCaseTemplateMapper templateMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            WebUiLocatorValidationRunner locatorValidationRunner,
            WebUiLocatorContextSupport locatorContextSupport
    ) {
        this.elementMapper = elementMapper;
        this.moduleMapper = moduleMapper;
        this.pageMapper = pageMapper;
        this.groupMapper = groupMapper;
        this.caseStepMapper = caseStepMapper;
        this.caseMapper = caseMapper;
        this.templateStepMapper = templateStepMapper;
        this.templateMapper = templateMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.locatorValidationRunner = locatorValidationRunner;
        this.locatorContextSupport = locatorContextSupport;
    }

    public PageResponse<WebUiElementItem> listElements(
            String workspaceCode,
            String keyword,
            Long moduleId,
            Long pageId,
            Long groupId,
            String pageName,
            String groupName,
            String status,
            Long collectTaskId,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<WebUiElementEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiElementEntity::getWorkspaceId, workspaceCode);
        if (moduleId != null) {
            List<Long> pageIds = pageMapper.selectList(new LambdaQueryWrapper<WebUiElementPageEntity>()
                            .select(WebUiElementPageEntity::getId)
                            .eq(WebUiElementPageEntity::getModuleId, moduleId))
                    .stream()
                    .map(WebUiElementPageEntity::getId)
                    .toList();
            if (pageIds.isEmpty()) {
                return PageResponse.of(List.of(), 0, safePageNo(pageNo), safePageSize(pageSize, 0));
            }
            query.in(WebUiElementEntity::getPageId, pageIds);
        }
        if (pageId != null) {
            query.eq(WebUiElementEntity::getPageId, pageId);
        }
        if (groupId != null) {
            query.eq(WebUiElementEntity::getGroupId, groupId);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(WebUiElementEntity::getElementName, trimmedKeyword)
                    .or()
                    .like(WebUiElementEntity::getLocatorValue, trimmedKeyword)
                    .or()
                    .like(WebUiElementEntity::getDescription, trimmedKeyword));
        }
        String trimmedPageName = blankToNull(pageName);
        if (trimmedPageName != null) {
            query.eq(WebUiElementEntity::getPageName, trimmedPageName);
        }
        String trimmedGroupName = blankToNull(groupName);
        if (trimmedGroupName != null) {
            query.eq(WebUiElementEntity::getGroupName, trimmedGroupName);
        }
        String normalizedStatus = blankToNull(status) == null ? null : normalizeStatus(status);
        if (normalizedStatus != null) {
            query.eq(WebUiElementEntity::getStatus, normalizedStatus);
        }
        if (collectTaskId != null) {
            query.eq(WebUiElementEntity::getCollectTaskId, collectTaskId);
        }
        int safePageNo = safePageNo(pageNo);
        LambdaQueryWrapper<WebUiElementEntity> orderedQuery = query
                .orderByAsc(WebUiElementEntity::getPageName)
                .orderByAsc(WebUiElementEntity::getGroupName)
                .orderByDesc(WebUiElementEntity::getUpdatedAt);
        if (pageSize == null || pageSize < 1) {
            List<WebUiElementItem> items = elementMapper.selectList(orderedQuery).stream()
                    .map(this::toElementItem)
                    .toList();
            int compatiblePageSize = safePageSize(pageSize, items.size());
            return PageResponse.of(paginate(items, safePageNo, compatiblePageSize), items.size(), safePageNo, compatiblePageSize);
        }
        Page<WebUiElementEntity> page = elementMapper.selectPage(
                new Page<>(safePageNo, pageSize), orderedQuery);
        List<WebUiElementItem> items = page.getRecords().stream()
                .map(this::toElementItem)
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public WebUiElementQualityCheckResult checkElementQuality(
            String workspaceCode,
            String keyword,
            Long moduleId,
            Long pageId,
            Long groupId,
            String pageName,
            String groupName,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        PageResponse<WebUiElementItem> page = listElements(
                workspaceCode,
                keyword,
                moduleId,
                pageId,
                groupId,
                pageName,
                groupName,
                status,
                null,
                pageNo,
                pageSize == null ? 500 : pageSize
        );
        List<WebUiElementQualityIssue> issues = page.items().stream()
                .flatMap(item -> buildQualityIssues(item).stream())
                .toList();
        int highRiskCount = Math.toIntExact(issues.stream().filter(issue -> "HIGH".equals(issue.level())).count());
        int mediumRiskCount = Math.toIntExact(issues.stream().filter(issue -> "MEDIUM".equals(issue.level())).count());
        int lowRiskCount = Math.toIntExact(issues.stream().filter(issue -> "LOW".equals(issue.level())).count());
        return new WebUiElementQualityCheckResult(page.items().size(), highRiskCount, mediumRiskCount, lowRiskCount, issues);
    }

    @Transactional
    public WebUiElementBatchResult batchUpdateStatus(String workspaceCode, BatchUpdateWebUiElementStatusRequest request) {
        List<Long> elementIds = normalizeElementIds(request.elementIds());
        String status = normalizeStatus(request.status());
        LocalDateTime now = LocalDateTime.now();
        int updatedCount = 0;
        for (Long id : elementIds) {
            WebUiElementEntity entity = requireElement(id);
            workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot edit the web UI element");
            workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
            entity.setStatus(status);
            entity.setUpdatedAt(now);
            elementMapper.updateById(entity);
            updatedCount += 1;
        }
        return new WebUiElementBatchResult(elementIds.size(), updatedCount, 0, 0, List.of());
    }

    @Transactional
    public WebUiElementBatchResult batchMoveElements(String workspaceCode, BatchMoveWebUiElementRequest request) {
        List<Long> elementIds = normalizeElementIds(request.elementIds());
        WebUiElementPageEntity page = requirePage(request.pageId());
        workspaceScopeSupport.validateReadable(page.getWorkspaceId(), workspaceCode, "Current workspace cannot move elements to this web UI element page");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(page.getWorkspaceId()).getWorkspaceCode());
        WebUiElementGroupEntity group = request.groupId() == null ? null : requireGroup(request.groupId());
        if (group != null) {
            if (!group.getWorkspaceId().equals(page.getWorkspaceId())) {
                throw new BadRequestException("Element group does not exist in current workspace");
            }
            if (!group.getPageId().equals(page.getId())) {
                throw new BadRequestException("Element group does not belong to selected page");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        int updatedCount = 0;
        for (Long id : elementIds) {
            WebUiElementEntity entity = requireElement(id);
            workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot move the web UI element");
            if (!entity.getWorkspaceId().equals(page.getWorkspaceId())) {
                throw new BadRequestException("Cannot move a web UI element to another workspace");
            }
            entity.setPageId(page.getId());
            entity.setPageName(page.getPageName());
            entity.setGroupId(group == null ? null : group.getId());
            entity.setGroupName(group == null ? null : group.getGroupName());
            entity.setUpdatedAt(now);
            elementMapper.updateById(entity);
            updatedCount += 1;
        }
        return new WebUiElementBatchResult(elementIds.size(), updatedCount, 0, 0, List.of());
    }

    @Transactional
    public WebUiElementBatchResult batchDeleteElements(String workspaceCode, BatchDeleteWebUiElementRequest request) {
        List<Long> elementIds = normalizeElementIds(request.elementIds());
        List<WebUiElementBatchBlockedItem> blockedItems = elementIds.stream()
                .map(id -> {
                    WebUiElementEntity entity = requireElement(id);
                    workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI element");
                    int usageCount = countUsage(id);
                    if (usageCount <= 0) {
                        return null;
                    }
                    return new WebUiElementBatchBlockedItem(id, entity.getElementName(), usageCount, "元素仍被用例或模板引用");
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        if (!blockedItems.isEmpty()) {
            return new WebUiElementBatchResult(elementIds.size(), 0, 0, blockedItems.size(), blockedItems);
        }

        int deletedCount = 0;
        for (Long id : elementIds) {
            WebUiElementEntity entity = requireElement(id);
            workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI element");
            workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
            elementMapper.deleteById(id);
            deletedCount += 1;
        }
        return new WebUiElementBatchResult(elementIds.size(), 0, deletedCount, 0, List.of());
    }

    @Transactional
    public WebUiElementBatchValidateResult batchValidateElements(String workspaceCode, BatchValidateWebUiElementRequest request) {
        List<Long> elementIds = normalizeElementIds(request.elementIds());
        String baseUrl = request.baseUrl().trim();
        String browserType = normalizeBrowserType(request.browserType());
        boolean headless = request.headless() == null || request.headless();
        int timeoutMs = normalizeStepTimeout(request.timeoutMs());

        List<WebUiElementValidateResultItem> results = elementIds.stream()
                .map(id -> {
                    WebUiElementEntity entity = requireElement(id);
                    workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot validate the web UI element");
                    return validateElementEntity(entity, baseUrl, browserType, headless, timeoutMs);
                })
                .toList();
        int passedCount = Math.toIntExact(results.stream().filter(WebUiElementValidateResultItem::matched).count());
        int failedCount = results.size() - passedCount;
        return new WebUiElementBatchValidateResult(results.size(), passedCount, failedCount, results);
    }

    public PageResponse<WebUiElementPageItem> listPages(String workspaceCode) {
        LambdaQueryWrapper<WebUiElementPageEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiElementPageEntity::getWorkspaceId, workspaceCode);
        List<WebUiElementPageItem> items = pageMapper.selectList(query
                        .orderByAsc(WebUiElementPageEntity::getModuleId)
                        .orderByAsc(WebUiElementPageEntity::getSortOrder)
                        .orderByAsc(WebUiElementPageEntity::getId))
                .stream()
                .map(this::toPageItem)
                .toList();
        return PageResponse.of(items, items.size(), 1, items.isEmpty() ? 1 : items.size());
    }

    public PageResponse<WebUiElementModuleItem> listModules(String workspaceCode) {
        LambdaQueryWrapper<WebUiElementModuleEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiElementModuleEntity::getWorkspaceId, workspaceCode);
        List<WebUiElementModuleItem> items = moduleMapper.selectList(query
                        .orderByAsc(WebUiElementModuleEntity::getSortOrder)
                        .orderByAsc(WebUiElementModuleEntity::getId))
                .stream()
                .map(this::toModuleItem)
                .toList();
        return PageResponse.of(items, items.size(), 1, items.isEmpty() ? 1 : items.size());
    }

    public PageResponse<WebUiElementGroupItem> listGroups(String workspaceCode, Long pageId) {
        LambdaQueryWrapper<WebUiElementGroupEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiElementGroupEntity::getWorkspaceId, workspaceCode);
        if (pageId != null) {
            query.eq(WebUiElementGroupEntity::getPageId, pageId);
        }
        List<WebUiElementGroupItem> items = groupMapper.selectList(query
                        .orderByAsc(WebUiElementGroupEntity::getSortOrder)
                        .orderByAsc(WebUiElementGroupEntity::getId))
                .stream()
                .map(this::toGroupItem)
                .toList();
        return PageResponse.of(items, items.size(), 1, items.isEmpty() ? 1 : items.size());
    }

    public List<WebUiElementTreeNode> getElementTree(String workspaceCode) {
        List<WebUiElementPageItem> pages = listPages(workspaceCode).items();
        return pages.stream()
                .map(page -> new WebUiElementTreeNode(
                        "page-" + page.id(),
                        page.id(),
                        "PAGE",
                        page.pageName(),
                        page.elementCount(),
                        listGroups(workspaceCode, page.id()).items().stream()
                                .map(group -> new WebUiElementTreeNode(
                                        "group-" + group.id(),
                                        group.id(),
                                        "GROUP",
                                        group.groupName(),
                                        group.elementCount(),
                                        List.of()
                                ))
                                .toList()
                ))
                .toList();
    }

    @Transactional
    public WebUiElementPageItem createPage(String headerWorkspaceCode, SaveWebUiElementPageRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        WebUiElementPageEntity entity = new WebUiElementPageEntity();
        fillPageEntity(entity, workspace.getId(), request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        pageMapper.insert(entity);
        return toPageItem(entity);
    }

    @Transactional
    public WebUiElementModuleItem createModule(String headerWorkspaceCode, SaveWebUiElementModuleRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        WebUiElementModuleEntity entity = new WebUiElementModuleEntity();
        fillModuleEntity(entity, workspace.getId(), request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        moduleMapper.insert(entity);
        return toModuleItem(entity);
    }

    @Transactional
    public WebUiElementPageItem updatePage(Long id, String headerWorkspaceCode, SaveWebUiElementPageRequest request) {
        WebUiElementPageEntity entity = requirePage(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the web UI element page");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a web UI element page to another workspace");
        }
        fillPageEntity(entity, workspace.getId(), request);
        entity.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(entity);
        refreshElementPageSnapshot(entity);
        return toPageItem(entity);
    }

    @Transactional
    public void deletePage(Long id, String workspaceCode) {
        WebUiElementPageEntity entity = requirePage(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI element page");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (countGroupsByPage(id) > 0 || countElementsByPage(id) > 0) {
            throw new BadRequestException("Element page contains groups or elements and cannot be deleted");
        }
        pageMapper.deleteById(id);
    }

    @Transactional
    public WebUiElementGroupItem createGroup(String headerWorkspaceCode, SaveWebUiElementGroupRequest request) {
        WebUiElementPageEntity page = requirePage(request.pageId());
        workspaceScopeSupport.validateReadable(page.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot create group under this web UI element page");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(page.getWorkspaceId()).getWorkspaceCode());
        WebUiElementGroupEntity entity = new WebUiElementGroupEntity();
        fillGroupEntity(entity, page, request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        groupMapper.insert(entity);
        return toGroupItem(entity);
    }

    @Transactional
    public WebUiElementGroupItem updateGroup(Long id, String headerWorkspaceCode, SaveWebUiElementGroupRequest request) {
        WebUiElementGroupEntity entity = requireGroup(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the web UI element group");
        WebUiElementPageEntity page = requirePage(request.pageId() == null ? entity.getPageId() : request.pageId());
        if (!entity.getWorkspaceId().equals(page.getWorkspaceId())) {
            throw new BadRequestException("Cannot move a web UI element group to another workspace");
        }
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillGroupEntity(entity, page, request);
        entity.setUpdatedAt(LocalDateTime.now());
        groupMapper.updateById(entity);
        refreshElementGroupSnapshot(entity);
        return toGroupItem(entity);
    }

    @Transactional
    public void deleteGroup(Long id, String workspaceCode) {
        WebUiElementGroupEntity entity = requireGroup(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI element group");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        if (countElementsByGroup(id) > 0) {
            throw new BadRequestException("Element group contains elements and cannot be deleted");
        }
        groupMapper.deleteById(id);
    }

    public WebUiElementItem getElement(Long id, String workspaceCode) {
        WebUiElementEntity entity = requireElement(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the web UI element");
        return toElementItem(entity);
    }

    public List<WebUiElementReferenceItem> listElementReferences(Long id, String workspaceCode) {
        WebUiElementEntity element = requireElement(id);
        workspaceScopeSupport.validateReadable(element.getWorkspaceId(), workspaceCode, "Current workspace cannot access the web UI element references");

        List<WebUiElementReferenceItem> caseReferences = caseStepMapper.selectList(new LambdaQueryWrapper<WebUiCaseStepEntity>()
                        .eq(WebUiCaseStepEntity::getElementId, id)
                        .orderByAsc(WebUiCaseStepEntity::getCaseId)
                        .orderByAsc(WebUiCaseStepEntity::getSortOrder))
                .stream()
                .map(step -> {
                    WebUiCaseEntity webCase = caseMapper.selectById(step.getCaseId());
                    if (webCase == null || !element.getWorkspaceId().equals(webCase.getWorkspaceId())) {
                        return null;
                    }
                    return new WebUiElementReferenceItem(
                            "CASE",
                            webCase.getId(),
                            webCase.getCaseName(),
                            webCase.getModuleName(),
                            step.getId(),
                            step.getStepName(),
                            step.getStepType(),
                            step.getLocatorType(),
                            step.getLocatorValue(),
                            step.getEnabled(),
                            step.getSortOrder(),
                            step.getUpdatedAt()
                    );
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        List<WebUiElementReferenceItem> templateReferences = templateStepMapper.selectList(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                        .eq(WebUiCaseTemplateStepEntity::getElementId, id)
                        .orderByAsc(WebUiCaseTemplateStepEntity::getTemplateId)
                        .orderByAsc(WebUiCaseTemplateStepEntity::getSortOrder))
                .stream()
                .map(step -> {
                    WebUiCaseTemplateEntity template = templateMapper.selectById(step.getTemplateId());
                    if (template == null || !element.getWorkspaceId().equals(template.getWorkspaceId())) {
                        return null;
                    }
                    return new WebUiElementReferenceItem(
                            "TEMPLATE",
                            template.getId(),
                            template.getTemplateName(),
                            template.getModuleName(),
                            step.getId(),
                            step.getStepName(),
                            step.getStepType(),
                            step.getLocatorType(),
                            step.getLocatorValue(),
                            step.getEnabled(),
                            step.getSortOrder(),
                            step.getUpdatedAt()
                    );
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        return java.util.stream.Stream.concat(caseReferences.stream(), templateReferences.stream()).toList();
    }

    @Transactional
    public WebUiElementReferenceSyncResult syncElementReferenceLocators(Long id, String workspaceCode) {
        WebUiElementEntity element = requireElement(id);
        workspaceScopeSupport.validateReadable(element.getWorkspaceId(), workspaceCode, "Current workspace cannot sync the web UI element references");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(element.getWorkspaceId()).getWorkspaceCode());

        LocalDateTime now = LocalDateTime.now();
        int caseStepCount = 0;
        for (WebUiCaseStepEntity step : caseStepMapper.selectList(new LambdaQueryWrapper<WebUiCaseStepEntity>()
                .eq(WebUiCaseStepEntity::getElementId, id))) {
            WebUiCaseEntity webCase = caseMapper.selectById(step.getCaseId());
            if (webCase == null || !element.getWorkspaceId().equals(webCase.getWorkspaceId())) {
                continue;
            }
            step.setLocatorType(element.getLocatorType());
            step.setLocatorValue(element.getLocatorValue());
            step.setLocatorContextJson(element.getLocatorContextJson());
            step.setUpdatedAt(now);
            caseStepMapper.updateById(step);
            caseStepCount += 1;
        }

        int templateStepCount = 0;
        for (WebUiCaseTemplateStepEntity step : templateStepMapper.selectList(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                .eq(WebUiCaseTemplateStepEntity::getElementId, id))) {
            WebUiCaseTemplateEntity template = templateMapper.selectById(step.getTemplateId());
            if (template == null || !element.getWorkspaceId().equals(template.getWorkspaceId())) {
                continue;
            }
            step.setLocatorType(element.getLocatorType());
            step.setLocatorValue(element.getLocatorValue());
            step.setLocatorContextJson(element.getLocatorContextJson());
            step.setUpdatedAt(now);
            templateStepMapper.updateById(step);
            templateStepCount += 1;
        }

        return new WebUiElementReferenceSyncResult(caseStepCount, templateStepCount, caseStepCount + templateStepCount);
    }

    @Transactional
    public WebUiElementItem createElement(String headerWorkspaceCode, SaveWebUiElementRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        WebUiElementEntity entity = new WebUiElementEntity();
        fillElementEntity(entity, workspace.getId(), request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        elementMapper.insert(entity);
        return toElementItem(entity);
    }

    @Transactional
    public WebUiElementItem updateElement(Long id, String headerWorkspaceCode, SaveWebUiElementRequest request) {
        WebUiElementEntity entity = requireElement(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the web UI element");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a web UI element to another workspace");
        }
        fillElementEntity(entity, workspace.getId(), request);
        entity.setUpdatedAt(LocalDateTime.now());
        elementMapper.updateById(entity);
        return toElementItem(entity);
    }

    @Transactional
    public void deleteElement(Long id, String workspaceCode) {
        WebUiElementEntity entity = requireElement(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI element");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        int usageCount = countUsage(id);
        if (usageCount > 0) {
            throw new BadRequestException("Element is referenced by " + usageCount + " web UI steps and cannot be deleted");
        }
        elementMapper.deleteById(id);
    }

    @Transactional
    public ValidateWebUiLocatorResponse validateElement(Long id, String workspaceCode, ValidateWebUiElementRequest request) {
        WebUiElementEntity entity = requireElement(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot validate the web UI element");
        WebUiElementValidateResultItem result = validateElementEntity(
                entity,
                request.baseUrl().trim(),
                normalizeBrowserType(request.browserType()),
                request.headless() == null || request.headless(),
                normalizeStepTimeout(request.timeoutMs())
        );
        return new ValidateWebUiLocatorResponse(
                result.matched(),
                result.matchCount(),
                result.errorMessage(),
                result.screenshotBase64(),
                null
        );
    }

    @Transactional
    public ValidateWebUiLocatorResponse applyLocalRunnerElementValidationResult(
            Long id,
            String workspaceCode,
            ApplyLocalRunnerElementValidationResultRequest request
    ) {
        WebUiElementEntity entity = requireElement(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot validate the web UI element");
        boolean matched = Boolean.TRUE.equals(request.matched());
        int matchCount = request.matchCount() == null ? 0 : Math.max(request.matchCount(), 0);
        entity.setLastValidateResult(matched ? "PASSED" : "FAILED");
        entity.setLastValidateAt(LocalDateTime.now());
        entity.setLastValidateMessage(blankToNull(request.errorMessage()));
        entity.setLastMatchCount(matchCount);
        entity.setLastLocalRunnerRunId(blankToNull(request.runnerRunId()));
        entity.setUpdatedAt(LocalDateTime.now());
        elementMapper.updateById(entity);
        return new ValidateWebUiLocatorResponse(
                matched,
                matchCount,
                request.errorMessage(),
                request.screenshotBase64(),
                entity.getLastLocalRunnerRunId()
        );
    }

    private WebUiElementValidateResultItem validateElementEntity(
            WebUiElementEntity entity,
            String baseUrl,
            String browserType,
            boolean headless,
            int timeoutMs
    ) {
        WebUiLocatorValidationRunner.LocatorValidationResult result = locatorValidationRunner.validate(
                new WebUiLocatorValidationRunner.LocatorValidationContext(
                        baseUrl,
                        browserType,
                        headless,
                        entity.getLocatorType(),
                        entity.getLocatorValue(),
                        timeoutMs
                )
        );
        entity.setLastValidateResult(result.matched() ? "PASSED" : "FAILED");
        entity.setLastValidateAt(LocalDateTime.now());
        entity.setLastValidateMessage(blankToNull(result.errorMessage()));
        entity.setLastMatchCount(result.matchCount());
        entity.setUpdatedAt(LocalDateTime.now());
        elementMapper.updateById(entity);
        return new WebUiElementValidateResultItem(
                entity.getId(),
                entity.getElementName(),
                result.matched(),
                result.matchCount(),
                result.errorMessage(),
                result.screenshotBytes() == null ? null : java.util.Base64.getEncoder().encodeToString(result.screenshotBytes())
        );
    }

    private void fillElementEntity(WebUiElementEntity entity, Long workspaceId, SaveWebUiElementRequest request) {
        entity.setWorkspaceId(workspaceId);
        WebUiElementPageEntity page = resolveElementPage(workspaceId, request);
        WebUiElementGroupEntity group = resolveElementGroup(workspaceId, page, request);
        entity.setPageId(page == null ? null : page.getId());
        entity.setGroupId(group == null ? null : group.getId());
        entity.setPageName(page == null ? request.pageName().trim() : page.getPageName());
        entity.setGroupName(group == null ? blankToNull(request.groupName()) : group.getGroupName());
        entity.setElementName(request.elementName().trim());
        entity.setLocatorType(normalizeLocatorType(request.locatorType()));
        entity.setLocatorValue(request.locatorValue().trim());
        entity.setLocatorContextJson(locatorContextSupport.write(request.framePath(), request.shadowPath()));
        entity.setDescription(blankToNull(request.description()));
        entity.setStatus(normalizeStatus(request.status()));
        if (request.collectTaskId() != null) {
            entity.setCollectTaskId(request.collectTaskId());
            entity.setCollectSource(blankToNull(request.collectSource()));
            entity.setCollectConfidence(clampConfidence(request.collectConfidence()));
            entity.setCollectValidationStatus(blankToNull(request.collectValidationStatus()));
            entity.setCollectMatchCount(request.collectMatchCount() == null ? null : Math.max(request.collectMatchCount(), 0));
            entity.setCollectValidationMessage(blankToNull(request.collectValidationMessage()));
            entity.setCollectScreenshotBase64(blankToNull(request.collectScreenshotBase64()));
        }
    }

    private WebUiElementPageEntity resolveElementPage(Long workspaceId, SaveWebUiElementRequest request) {
        if (request.pageId() == null) {
            return null;
        }
        WebUiElementPageEntity page = requirePage(request.pageId());
        if (!page.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Element page does not exist in current workspace");
        }
        return page;
    }

    private WebUiElementGroupEntity resolveElementGroup(Long workspaceId, WebUiElementPageEntity page, SaveWebUiElementRequest request) {
        if (request.groupId() == null) {
            return null;
        }
        WebUiElementGroupEntity group = requireGroup(request.groupId());
        if (!group.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Element group does not exist in current workspace");
        }
        if (page != null && !group.getPageId().equals(page.getId())) {
            throw new BadRequestException("Element group does not belong to selected page");
        }
        return group;
    }

    private void fillPageEntity(WebUiElementPageEntity entity, Long workspaceId, SaveWebUiElementPageRequest request) {
        entity.setWorkspaceId(workspaceId);
        WebUiElementModuleEntity module = resolvePageModule(workspaceId, request);
        entity.setModuleId(module.getId());
        entity.setPageName(request.pageName().trim());
        entity.setPagePath(blankToNull(request.pagePath()));
        entity.setDescription(blankToNull(request.description()));
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        entity.setStatus(normalizeStatus(request.status()));
    }

    private void fillModuleEntity(WebUiElementModuleEntity entity, Long workspaceId, SaveWebUiElementModuleRequest request) {
        entity.setWorkspaceId(workspaceId);
        entity.setModuleName(request.moduleName().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        entity.setStatus(normalizeStatus(request.status()));
    }

    private void fillGroupEntity(WebUiElementGroupEntity entity, WebUiElementPageEntity page, SaveWebUiElementGroupRequest request) {
        entity.setWorkspaceId(page.getWorkspaceId());
        entity.setPageId(page.getId());
        entity.setGroupName(request.groupName().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        entity.setStatus(normalizeStatus(request.status()));
    }

    private WebUiElementEntity requireElement(Long id) {
        WebUiElementEntity entity = elementMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI element not found");
        }
        return entity;
    }

    private WebUiElementPageEntity requirePage(Long id) {
        if (id == null) {
            throw new BadRequestException("Element page is required");
        }
        WebUiElementPageEntity entity = pageMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI element page not found");
        }
        return entity;
    }

    private WebUiElementGroupEntity requireGroup(Long id) {
        if (id == null) {
            throw new BadRequestException("Element group is required");
        }
        WebUiElementGroupEntity entity = groupMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI element group not found");
        }
        return entity;
    }

    private WebUiElementModuleEntity resolvePageModule(Long workspaceId, SaveWebUiElementPageRequest request) {
        if (request.moduleId() != null) {
            WebUiElementModuleEntity module = requireModule(request.moduleId());
            if (!module.getWorkspaceId().equals(workspaceId)) {
                throw new BadRequestException("Element module does not exist in current workspace");
            }
            return module;
        }
        String moduleName = blankToNull(request.moduleName());
        if (moduleName != null) {
            WebUiElementModuleEntity existing = moduleMapper.selectOne(new LambdaQueryWrapper<WebUiElementModuleEntity>()
                    .eq(WebUiElementModuleEntity::getWorkspaceId, workspaceId)
                    .eq(WebUiElementModuleEntity::getModuleName, moduleName)
                    .last("LIMIT 1"));
            if (existing != null) {
                return existing;
            }
            WebUiElementModuleEntity created = new WebUiElementModuleEntity();
            created.setWorkspaceId(workspaceId);
            created.setModuleName(moduleName);
            created.setDescription(null);
            created.setSortOrder(0);
            created.setStatus("ENABLED");
            LocalDateTime now = LocalDateTime.now();
            created.setCreatedAt(now);
            created.setUpdatedAt(now);
            moduleMapper.insert(created);
            return created;
        }
        return ensureDefaultModule(workspaceId);
    }

    private WebUiElementModuleEntity ensureDefaultModule(Long workspaceId) {
        WebUiElementModuleEntity existing = moduleMapper.selectOne(new LambdaQueryWrapper<WebUiElementModuleEntity>()
                .eq(WebUiElementModuleEntity::getWorkspaceId, workspaceId)
                .eq(WebUiElementModuleEntity::getModuleName, "默认模块")
                .last("LIMIT 1"));
        if (existing != null) {
            return existing;
        }
        WebUiElementModuleEntity created = new WebUiElementModuleEntity();
        created.setWorkspaceId(workspaceId);
        created.setModuleName("默认模块");
        created.setDescription("系统自动创建，用于承载未指定模块的页面对象");
        created.setSortOrder(0);
        created.setStatus("ENABLED");
        LocalDateTime now = LocalDateTime.now();
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        moduleMapper.insert(created);
        return created;
    }

    private WebUiElementModuleEntity requireModule(Long id) {
        if (id == null) {
            throw new BadRequestException("Element module is required");
        }
        WebUiElementModuleEntity entity = moduleMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI element module not found");
        }
        return entity;
    }

    private WebUiElementItem toElementItem(WebUiElementEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiElementItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getPageId(),
                entity.getGroupId(),
                entity.getPageName(),
                entity.getGroupName(),
                entity.getElementName(),
                entity.getLocatorType(),
                entity.getLocatorValue(),
                locatorContextSupport.framePath(entity.getLocatorContextJson()),
                locatorContextSupport.shadowPath(entity.getLocatorContextJson()),
                entity.getDescription(),
                entity.getStatus(),
                entity.getLastValidateResult(),
                entity.getLastValidateAt(),
                entity.getLastValidateMessage(),
                entity.getLastMatchCount(),
                entity.getLastLocalRunnerRunId(),
                entity.getCollectTaskId(),
                entity.getCollectSource(),
                entity.getCollectConfidence(),
                entity.getCollectValidationStatus(),
                entity.getCollectMatchCount(),
                entity.getCollectValidationMessage(),
                entity.getCollectScreenshotBase64(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                countUsage(entity.getId())
        );
    }

    private WebUiElementPageItem toPageItem(WebUiElementPageEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        WebUiElementModuleEntity module = entity.getModuleId() == null ? ensureDefaultModule(entity.getWorkspaceId()) : moduleMapper.selectById(entity.getModuleId());
        if (entity.getModuleId() == null || module == null) {
            module = ensureDefaultModule(entity.getWorkspaceId());
            entity.setModuleId(module.getId());
            entity.setUpdatedAt(LocalDateTime.now());
            pageMapper.updateById(entity);
        }
        return new WebUiElementPageItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                module.getId(),
                module.getModuleName(),
                entity.getPageName(),
                entity.getPagePath(),
                entity.getDescription(),
                entity.getSortOrder(),
                entity.getStatus(),
                countGroupsByPage(entity.getId()),
                countElementsByPage(entity.getId()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private WebUiElementModuleItem toModuleItem(WebUiElementModuleEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiElementModuleItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleName(),
                entity.getDescription(),
                entity.getSortOrder(),
                entity.getStatus(),
                countPagesByModule(entity.getId()),
                countElementsByModule(entity.getId()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private WebUiElementGroupItem toGroupItem(WebUiElementGroupEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiElementGroupItem(
                entity.getId(),
                entity.getPageId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getGroupName(),
                entity.getDescription(),
                entity.getSortOrder(),
                entity.getStatus(),
                countElementsByGroup(entity.getId()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private void refreshElementPageSnapshot(WebUiElementPageEntity page) {
        elementMapper.selectList(new LambdaQueryWrapper<WebUiElementEntity>()
                        .eq(WebUiElementEntity::getPageId, page.getId()))
                .forEach(element -> {
                    element.setPageName(page.getPageName());
                    element.setUpdatedAt(LocalDateTime.now());
                    elementMapper.updateById(element);
                });
    }

    private void refreshElementGroupSnapshot(WebUiElementGroupEntity group) {
        elementMapper.selectList(new LambdaQueryWrapper<WebUiElementEntity>()
                        .eq(WebUiElementEntity::getGroupId, group.getId()))
                .forEach(element -> {
                    element.setGroupName(group.getGroupName());
                    element.setUpdatedAt(LocalDateTime.now());
                    elementMapper.updateById(element);
                });
    }

    private int countUsage(Long elementId) {
        Long caseStepCount = caseStepMapper.selectCount(new LambdaQueryWrapper<WebUiCaseStepEntity>()
                .eq(WebUiCaseStepEntity::getElementId, elementId));
        Long templateStepCount = templateStepMapper.selectCount(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                .eq(WebUiCaseTemplateStepEntity::getElementId, elementId));
        return Math.toIntExact((caseStepCount == null ? 0 : caseStepCount) + (templateStepCount == null ? 0 : templateStepCount));
    }

    private int countGroupsByPage(Long pageId) {
        Long count = groupMapper.selectCount(new LambdaQueryWrapper<WebUiElementGroupEntity>()
                .eq(WebUiElementGroupEntity::getPageId, pageId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private int countPagesByModule(Long moduleId) {
        Long count = pageMapper.selectCount(new LambdaQueryWrapper<WebUiElementPageEntity>()
                .eq(WebUiElementPageEntity::getModuleId, moduleId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private int countElementsByModule(Long moduleId) {
        List<Long> pageIds = pageMapper.selectList(new LambdaQueryWrapper<WebUiElementPageEntity>()
                        .select(WebUiElementPageEntity::getId)
                        .eq(WebUiElementPageEntity::getModuleId, moduleId))
                .stream()
                .map(WebUiElementPageEntity::getId)
                .toList();
        if (pageIds.isEmpty()) {
            return 0;
        }
        Long count = elementMapper.selectCount(new LambdaQueryWrapper<WebUiElementEntity>()
                .in(WebUiElementEntity::getPageId, pageIds));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private int countElementsByPage(Long pageId) {
        Long count = elementMapper.selectCount(new LambdaQueryWrapper<WebUiElementEntity>()
                .eq(WebUiElementEntity::getPageId, pageId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private int countElementsByGroup(Long groupId) {
        Long count = elementMapper.selectCount(new LambdaQueryWrapper<WebUiElementEntity>()
                .eq(WebUiElementEntity::getGroupId, groupId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private List<Long> normalizeElementIds(List<Long> elementIds) {
        if (elementIds == null || elementIds.isEmpty()) {
            throw new BadRequestException("Element ids cannot be empty");
        }
        List<Long> normalized = elementIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            throw new BadRequestException("Element ids cannot be empty");
        }
        return normalized;
    }

    private List<WebUiElementQualityIssue> buildQualityIssues(WebUiElementItem item) {
        java.util.ArrayList<WebUiElementQualityIssue> issues = new java.util.ArrayList<>();
        if (blankToNull(item.locatorValue()) == null) {
            issues.add(toQualityIssue(item, "empty-locator", "HIGH", "定位器为空", "该元素没有可执行的定位值，运行时一定无法定位。"));
        }
        if ("FAILED".equals(item.lastValidateResult())) {
            issues.add(toQualityIssue(item, "validate-failed", "HIGH", "最近验证失败",
                    blankToNull(item.lastValidateMessage()) == null ? "最近一次验证未找到元素，建议重新确认页面和定位器。" : item.lastValidateMessage()));
        }
        if (isBroadLocator(item)) {
            issues.add(toQualityIssue(item, "broad-locator", "MEDIUM", "定位器过宽", "定位器可能匹配到多个通用组件，建议补充唯一属性、文本或层级约束。"));
        }
        if (isValidateTooOld(item.lastValidateAt())) {
            issues.add(toQualityIssue(item, "validate-old", "MEDIUM", item.lastValidateAt() == null ? "从未验证" : "长时间未验证", "建议在当前环境重新验证一次，避免页面改版后元素失效。"));
        }
        if (item.groupId() == null && blankToNull(item.groupName()) == null) {
            issues.add(toQualityIssue(item, "no-group", "LOW", "未归入分组", "元素没有归入页面分组，元素数量增多后会影响维护效率。"));
        }
        if (item.usageCount() == null || item.usageCount() == 0) {
            issues.add(toQualityIssue(item, "unused", "LOW", "暂无引用", "该元素暂未被用例或模板引用，可确认是否为备用元素或冗余元素。"));
        }
        return issues;
    }

    private WebUiElementQualityIssue toQualityIssue(WebUiElementItem item, String type, String level, String title, String description) {
        return new WebUiElementQualityIssue(
                item.id() + "-" + type,
                level,
                title,
                description,
                item.id(),
                item.elementName(),
                item.pageId(),
                item.groupId(),
                item.pageName(),
                item.groupName(),
                item.locatorType(),
                item.locatorValue(),
                item.usageCount(),
                item.lastValidateResult(),
                item.lastValidateAt()
        );
    }

    private boolean isBroadLocator(WebUiElementItem item) {
        String locator = blankToNull(item.locatorValue());
        if (locator == null) {
            return false;
        }
        String normalized = locator.toLowerCase(Locale.ROOT);
        if ("CSS".equals(item.locatorType())) {
            return List.of(
                    "button",
                    "input",
                    "select",
                    "textarea",
                    "a",
                    ".el-button",
                    ".el-input",
                    ".el-select",
                    ".el-table",
                    ".el-dialog",
                    ".ant-btn",
                    ".ant-input"
            ).contains(normalized);
        }
        if ("XPATH".equals(item.locatorType())) {
            return List.of("//button", "//input", "//a", "//*").contains(normalized);
        }
        return "TEXT".equals(item.locatorType()) && normalized.length() <= 1;
    }

    private boolean isValidateTooOld(LocalDateTime validateAt) {
        if (validateAt == null) {
            return true;
        }
        return Duration.between(validateAt, LocalDateTime.now()).toDays() > 30;
    }

    private Integer clampConfidence(Integer confidence) {
        if (confidence == null) {
            return null;
        }
        return Math.max(0, Math.min(100, confidence));
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
