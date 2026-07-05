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
public class WebUiCaseDomainService {

    private final WebUiCaseMapper caseMapper;
    private final WebUiCaseStepMapper stepMapper;
    private final WebUiElementMapper elementMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;
    private final WebUiLocatorContextSupport locatorContextSupport;
    private final WebUiUploadArtifactBindingSupport uploadArtifactBindingSupport;

    public WebUiCaseDomainService(
            WebUiCaseMapper caseMapper,
            WebUiCaseStepMapper stepMapper,
            WebUiElementMapper elementMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport,
            WebUiLocatorContextSupport locatorContextSupport,
            WebUiUploadArtifactBindingSupport uploadArtifactBindingSupport
    ) {
        this.caseMapper = caseMapper;
        this.stepMapper = stepMapper;
        this.elementMapper = elementMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
        this.locatorContextSupport = locatorContextSupport;
        this.uploadArtifactBindingSupport = uploadArtifactBindingSupport;
    }

    public PageResponse<WebUiCaseItem> listCases(
            String workspaceCode,
            String keyword,
            String moduleName,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        LambdaQueryWrapper<WebUiCaseEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, WebUiCaseEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(WebUiCaseEntity::getCaseName, trimmedKeyword)
                    .or()
                    .like(WebUiCaseEntity::getDescription, trimmedKeyword));
        }
        String trimmedModuleName = blankToNull(moduleName);
        if (trimmedModuleName != null) {
            query.eq(WebUiCaseEntity::getModuleName, trimmedModuleName);
        }
        String normalizedStatus = blankToNull(status) == null ? null : normalizeStatus(status);
        if (normalizedStatus != null) {
            query.eq(WebUiCaseEntity::getStatus, normalizedStatus);
        }
        List<WebUiCaseItem> items = caseMapper.selectList(query.orderByDesc(WebUiCaseEntity::getUpdatedAt))
                .stream()
                .map(this::toCaseItem)
                .toList();
        int safePageNo = safePageNo(pageNo);
        int safePageSize = safePageSize(pageSize, items.size());
        return PageResponse.of(paginate(items, safePageNo, safePageSize), items.size(), safePageNo, safePageSize);
    }

    public WebUiCaseDetail getCase(Long id, String workspaceCode) {
        WebUiCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the web UI case");
        return toCaseDetail(entity);
    }

    @Transactional
    public WebUiCaseDetail createCase(String headerWorkspaceCode, SaveWebUiCaseRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        WebUiCaseEntity entity = new WebUiCaseEntity();
        fillCaseEntity(entity, workspace.getId(), request);
        LocalDateTime now = LocalDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        caseMapper.insert(entity);
        replaceSteps(entity.getId(), request.steps());
        return toCaseDetail(entity);
    }

    @Transactional
    public WebUiCaseDetail updateCase(Long id, String headerWorkspaceCode, SaveWebUiCaseRequest request) {
        WebUiCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the web UI case");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a web UI case to another workspace");
        }
        fillCaseEntity(entity, workspace.getId(), request);
        entity.setUpdatedAt(LocalDateTime.now());
        caseMapper.updateById(entity);
        deleteSteps(id);
        replaceSteps(id, request.steps());
        return toCaseDetail(entity);
    }

    @Transactional
    public void deleteCase(Long id, String workspaceCode) {
        WebUiCaseEntity entity = requireCase(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the web UI case");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        deleteSteps(id);
        caseMapper.deleteById(id);
    }

    private void fillCaseEntity(WebUiCaseEntity entity, Long workspaceId, SaveWebUiCaseRequest request) {
        entity.setWorkspaceId(workspaceId);
        entity.setModuleName(blankToNull(request.moduleName()));
        entity.setCaseName(request.caseName().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setBaseUrl(blankToNull(request.baseUrl()));
        entity.setBrowserType(normalizeBrowserType(request.browserType()));
        entity.setHeadless(request.headless() == null || request.headless());
        entity.setDefaultTimeoutMs(normalizeCaseTimeout(request.defaultTimeoutMs()));
        entity.setStatus(normalizeStatus(request.status()));
    }

    private void replaceSteps(Long caseId, List<SaveWebUiCaseStepRequest> requests) {
        List<SaveWebUiCaseStepRequest> sortedRequests = defaultList(requests).stream()
                .filter(request -> request != null)
                .sorted(Comparator.comparingInt(request -> request.sortOrder() == null ? Integer.MAX_VALUE : request.sortOrder()))
                .toList();
        int fallbackSortOrder = 1;
        for (SaveWebUiCaseStepRequest request : sortedRequests) {
            WebUiCaseStepEntity step = new WebUiCaseStepEntity();
            fillStepEntity(step, caseId, request, fallbackSortOrder++);
            LocalDateTime now = LocalDateTime.now();
            step.setCreatedAt(now);
            step.setUpdatedAt(now);
            stepMapper.insert(step);
        }
    }

    private void fillStepEntity(WebUiCaseStepEntity entity, Long caseId, SaveWebUiCaseStepRequest request, int fallbackSortOrder) {
        String stepType = normalizeStepType(request.stepType());
        String locatorType = blankToNull(request.locatorType());
        String locatorValue = blankToNull(request.locatorValue());
        String inputValue = blankToNull(request.inputValue());
        Long elementId = validateElementReference(caseId, request.elementId());
        validateStepRequirements(stepType, locatorType, locatorValue, inputValue);
        entity.setCaseId(caseId);
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

    private void deleteSteps(Long caseId) {
        stepMapper.delete(new LambdaQueryWrapper<WebUiCaseStepEntity>().eq(WebUiCaseStepEntity::getCaseId, caseId));
    }

    private Long validateElementReference(Long caseId, Long elementId) {
        if (elementId == null) {
            return null;
        }
        WebUiCaseEntity webUiCase = requireCase(caseId);
        WebUiElementEntity element = elementMapper.selectById(elementId);
        if (element == null || !element.getWorkspaceId().equals(webUiCase.getWorkspaceId())) {
            throw new BadRequestException("Referenced web UI element does not exist in current workspace");
        }
        return elementId;
    }

    private WebUiCaseEntity requireCase(Long id) {
        WebUiCaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Web UI case not found");
        }
        return entity;
    }

    private WebUiCaseItem toCaseItem(WebUiCaseEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiCaseItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleName(),
                entity.getCaseName(),
                entity.getDescription(),
                entity.getBaseUrl(),
                entity.getBrowserType(),
                entity.getHeadless(),
                entity.getDefaultTimeoutMs(),
                entity.getStatus(),
                countSteps(entity.getId()),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getUpdatedAt()
        );
    }

    private WebUiCaseDetail toCaseDetail(WebUiCaseEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new WebUiCaseDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getModuleName(),
                entity.getCaseName(),
                entity.getDescription(),
                entity.getBaseUrl(),
                entity.getBrowserType(),
                entity.getHeadless(),
                entity.getDefaultTimeoutMs(),
                entity.getStatus(),
                entity.getLastRunResult(),
                entity.getLastRunAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                listSteps(entity.getId())
        );
    }

    private List<WebUiCaseStepItem> listSteps(Long caseId) {
        return stepMapper.selectList(new LambdaQueryWrapper<WebUiCaseStepEntity>()
                        .eq(WebUiCaseStepEntity::getCaseId, caseId)
                        .orderByAsc(WebUiCaseStepEntity::getSortOrder)
                        .orderByAsc(WebUiCaseStepEntity::getId))
                .stream()
                .map(this::toStepItem)
                .toList();
    }

    private int countSteps(Long caseId) {
        Long count = stepMapper.selectCount(new LambdaQueryWrapper<WebUiCaseStepEntity>()
                .eq(WebUiCaseStepEntity::getCaseId, caseId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    private WebUiCaseStepItem toStepItem(WebUiCaseStepEntity entity) {
        return new WebUiCaseStepItem(
                entity.getId(),
                entity.getCaseId(),
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
