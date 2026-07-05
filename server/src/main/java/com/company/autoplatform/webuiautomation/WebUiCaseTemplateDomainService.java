package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.apiautomation.ApiWorkspaceScopeSupport;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.*;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.*;

@Service
public class WebUiCaseTemplateDomainService {

    private final WebUiCaseTemplateMapper templateMapper;
    private final WebUiCaseTemplateStepMapper templateStepMapper;
    private final WebUiElementMapper elementMapper;
    private final WebUiCaseDomainService caseDomainService;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final WebUiLocatorContextSupport locatorContextSupport;
    private final WebUiUploadArtifactBindingSupport uploadArtifactBindingSupport;

    public WebUiCaseTemplateDomainService(
            WebUiCaseTemplateMapper templateMapper,
            WebUiCaseTemplateStepMapper templateStepMapper,
            WebUiElementMapper elementMapper,
            WebUiCaseDomainService caseDomainService,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            WebUiLocatorContextSupport locatorContextSupport,
            WebUiUploadArtifactBindingSupport uploadArtifactBindingSupport
    ) {
        this.templateMapper = templateMapper;
        this.templateStepMapper = templateStepMapper;
        this.elementMapper = elementMapper;
        this.caseDomainService = caseDomainService;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.locatorContextSupport = locatorContextSupport;
        this.uploadArtifactBindingSupport = uploadArtifactBindingSupport;
    }

    public PageResponse<WebUiCaseTemplateItem> listTemplates(
            String workspaceCode,
            String keyword,
            String moduleName,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<WebUiCaseTemplateEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiCaseTemplateEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(WebUiCaseTemplateEntity::getTemplateName, trimmedKeyword)
                    .or()
                    .like(WebUiCaseTemplateEntity::getDescription, trimmedKeyword));
        }
        String trimmedModuleName = blankToNull(moduleName);
        if (trimmedModuleName != null) {
            query.eq(WebUiCaseTemplateEntity::getModuleName, trimmedModuleName);
        }
        String normalizedStatus = blankToNull(status) == null ? null : normalizeStatus(status);
        if (normalizedStatus != null) {
            query.eq(WebUiCaseTemplateEntity::getStatus, normalizedStatus);
        }
        List<WebUiCaseTemplateItem> items = templateMapper.selectList(query.orderByDesc(WebUiCaseTemplateEntity::getUpdatedAt))
                .stream()
                .map(this::toTemplateItem)
                .toList();
        int safePageNo = safePageNo(pageNo);
        int safePageSize = safePageSize(pageSize, items.size());
        return PageResponse.of(paginate(items, safePageNo, safePageSize), items.size(), safePageNo, safePageSize);
    }

    public WebUiCaseTemplateDetail getTemplate(Long id, String workspaceCode) {
        WebUiCaseTemplateEntity entity = requireTemplate(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the web UI template");
        return toTemplateDetail(entity);
    }

    @Transactional
    public WebUiCaseTemplateDetail createTemplate(String headerWorkspaceCode, SaveWebUiCaseTemplateRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        WebUiCaseTemplateEntity entity = new WebUiCaseTemplateEntity();
        fillTemplateEntity(entity, workspace.getId(), request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        templateMapper.insert(entity);
        replaceSteps(entity.getId(), request.steps());
        return toTemplateDetail(entity);
    }

    @Transactional
    public WebUiCaseTemplateDetail updateTemplate(Long id, String headerWorkspaceCode, SaveWebUiCaseTemplateRequest request) {
        WebUiCaseTemplateEntity entity = requireTemplate(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the web UI template");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a web UI template to another workspace");
        }
        fillTemplateEntity(entity, workspace.getId(), request);
        entity.setUpdatedAt(LocalDateTime.now());
        templateMapper.updateById(entity);
        deleteSteps(id);
        replaceSteps(id, request.steps());
        return toTemplateDetail(entity);
    }

    @Transactional
    public WebUiCaseTemplateDetail saveCaseAsTemplate(Long caseId, String headerWorkspaceCode, SaveWebUiTemplateFromCaseRequest request) {
        WebUiCaseDetail source = caseDomainService.getCase(caseId, headerWorkspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode() == null ? source.workspaceCode() : request.workspaceCode()));
        if (!source.workspaceCode().equals(workspace.getWorkspaceCode())) {
            throw new BadRequestException("Cannot save a case as template in another workspace");
        }
        WebUiCaseTemplateEntity entity = new WebUiCaseTemplateEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setModuleName(source.moduleName());
        entity.setTemplateName(request.templateName().trim());
        entity.setDescription(blankToNull(request.description()) == null ? source.description() : blankToNull(request.description()));
        entity.setBaseUrl(source.baseUrl());
        entity.setBrowserType(normalizeBrowserType(source.browserType()));
        entity.setHeadless(source.headless() == null || source.headless());
        entity.setDefaultTimeoutMs(normalizeCaseTimeout(source.defaultTimeoutMs()));
        entity.setStatus(normalizeStatus(source.status()));
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        templateMapper.insert(entity);
        replaceSteps(entity.getId(), source.steps().stream().map(this::toSaveStepRequest).toList());
        return toTemplateDetail(entity);
    }

    @Transactional
    public void deleteTemplate(Long id, String workspaceCode) {
        WebUiCaseTemplateEntity entity = requireTemplate(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI template");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        deleteSteps(id);
        templateMapper.deleteById(id);
    }

    private void fillTemplateEntity(WebUiCaseTemplateEntity entity, Long workspaceId, SaveWebUiCaseTemplateRequest request) {
        entity.setWorkspaceId(workspaceId);
        entity.setModuleName(blankToNull(request.moduleName()));
        entity.setTemplateName(request.templateName().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setBaseUrl(blankToNull(request.baseUrl()));
        entity.setBrowserType(normalizeBrowserType(request.browserType()));
        entity.setHeadless(request.headless() == null || request.headless());
        entity.setDefaultTimeoutMs(normalizeCaseTimeout(request.defaultTimeoutMs()));
        entity.setStatus(normalizeStatus(request.status()));
    }

    private void replaceSteps(Long templateId, List<SaveWebUiCaseStepRequest> requests) {
        List<SaveWebUiCaseStepRequest> sortedRequests = defaultList(requests).stream()
                .filter(request -> request != null)
                .sorted(Comparator.comparingInt(request -> request.sortOrder() == null ? Integer.MAX_VALUE : request.sortOrder()))
                .toList();
        int fallbackSortOrder = 1;
        for (SaveWebUiCaseStepRequest request : sortedRequests) {
            WebUiCaseTemplateStepEntity step = new WebUiCaseTemplateStepEntity();
            fillStepEntity(step, templateId, request, fallbackSortOrder++);
            LocalDateTime now = LocalDateTime.now();
            step.setCreatedAt(now);
            step.setUpdatedAt(now);
            templateStepMapper.insert(step);
        }
    }

    private void fillStepEntity(WebUiCaseTemplateStepEntity entity, Long templateId, SaveWebUiCaseStepRequest request, int fallbackSortOrder) {
        String stepType = normalizeStepType(request.stepType());
        String locatorType = blankToNull(request.locatorType());
        String locatorValue = blankToNull(request.locatorValue());
        String inputValue = blankToNull(request.inputValue());
        Long elementId = validateElementReference(templateId, request.elementId());
        validateStepRequirements(stepType, locatorType, locatorValue, inputValue);
        entity.setTemplateId(templateId);
        entity.setStepName(request.stepName().trim());
        entity.setStepType(stepType);
        entity.setElementId(elementId);
        entity.setLocatorType(locatorType);
        entity.setLocatorValue(locatorValue);
        entity.setLocatorContextJson(locatorContextSupport.write(request.framePath(), request.shadowPath()));
        entity.setInputValue(inputValue);
        entity.setUploadArtifactJson(uploadArtifactBindingSupport.write(request.uploadArtifactBinding()));
        entity.setTimeoutMs(normalizeStepTimeout(request.timeoutMs()));
        entity.setContinueOnFailure(Boolean.TRUE.equals(request.continueOnFailure()));
        entity.setScreenshotPolicy(normalizeScreenshotPolicy(request.screenshotPolicy()));
        entity.setEnabled(request.enabled() == null || request.enabled());
        entity.setSortOrder(request.sortOrder() == null ? fallbackSortOrder : request.sortOrder());
    }

    private SaveWebUiCaseStepRequest toSaveStepRequest(WebUiCaseStepItem step) {
        return new SaveWebUiCaseStepRequest(
                step.stepName(),
                step.stepType(),
                step.elementId(),
                step.locatorType(),
                step.locatorValue(),
                step.framePath(),
                step.shadowPath(),
                step.inputValue(),
                step.uploadArtifactBinding(),
                step.timeoutMs(),
                step.continueOnFailure(),
                step.screenshotPolicy(),
                step.enabled(),
                step.sortOrder()
        );
    }

    private void deleteSteps(Long templateId) {
        templateStepMapper.delete(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                .eq(WebUiCaseTemplateStepEntity::getTemplateId, templateId));
    }

    private Long validateElementReference(Long templateId, Long elementId) {
        if (elementId == null) {
            return null;
        }
        WebUiCaseTemplateEntity template = requireTemplate(templateId);
        WebUiElementEntity element = elementMapper.selectById(elementId);
        if (element == null || !element.getWorkspaceId().equals(template.getWorkspaceId())) {
            throw new BadRequestException("Referenced web UI element does not exist in current workspace");
        }
        return elementId;
    }

    private WebUiCaseTemplateEntity requireTemplate(Long id) {
        WebUiCaseTemplateEntity entity = templateMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI template not found");
        }
        return entity;
    }

    private WebUiCaseTemplateItem toTemplateItem(WebUiCaseTemplateEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiCaseTemplateItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleName(),
                entity.getTemplateName(),
                entity.getDescription(),
                entity.getBaseUrl(),
                entity.getBrowserType(),
                entity.getHeadless(),
                entity.getDefaultTimeoutMs(),
                entity.getStatus(),
                countSteps(entity.getId()),
                entity.getUpdatedAt()
        );
    }

    private WebUiCaseTemplateDetail toTemplateDetail(WebUiCaseTemplateEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiCaseTemplateDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleName(),
                entity.getTemplateName(),
                entity.getDescription(),
                entity.getBaseUrl(),
                entity.getBrowserType(),
                entity.getHeadless(),
                entity.getDefaultTimeoutMs(),
                entity.getStatus(),
                countSteps(entity.getId()),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                listSteps(entity.getId())
        );
    }

    private List<WebUiCaseTemplateStepItem> listSteps(Long templateId) {
        return templateStepMapper.selectList(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                        .eq(WebUiCaseTemplateStepEntity::getTemplateId, templateId)
                        .orderByAsc(WebUiCaseTemplateStepEntity::getSortOrder)
                        .orderByAsc(WebUiCaseTemplateStepEntity::getId))
                .stream()
                .map(this::toStepItem)
                .toList();
    }

    private int countSteps(Long templateId) {
        Long count = templateStepMapper.selectCount(new LambdaQueryWrapper<WebUiCaseTemplateStepEntity>()
                .eq(WebUiCaseTemplateStepEntity::getTemplateId, templateId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private WebUiCaseTemplateStepItem toStepItem(WebUiCaseTemplateStepEntity entity) {
        return new WebUiCaseTemplateStepItem(
                entity.getId(),
                entity.getTemplateId(),
                entity.getStepName(),
                entity.getStepType(),
                entity.getElementId(),
                getElementName(entity.getElementId()),
                entity.getLocatorType(),
                entity.getLocatorValue(),
                locatorContextSupport.framePath(entity.getLocatorContextJson()),
                locatorContextSupport.shadowPath(entity.getLocatorContextJson()),
                entity.getInputValue(),
                uploadArtifactBindingSupport.read(entity.getUploadArtifactJson()),
                entity.getTimeoutMs(),
                entity.getContinueOnFailure(),
                entity.getScreenshotPolicy(),
                entity.getEnabled(),
                entity.getSortOrder()
        );
    }

    private String getElementName(Long elementId) {
        if (elementId == null) {
            return null;
        }
        WebUiElementEntity element = elementMapper.selectById(elementId);
        return element == null ? null : element.getElementName();
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
