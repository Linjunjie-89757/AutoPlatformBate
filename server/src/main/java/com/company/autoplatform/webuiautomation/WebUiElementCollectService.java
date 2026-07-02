package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.normalizeBrowserType;
import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.normalizeStepTimeout;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.CollectWebUiElementsRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectTaskCancelRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectTaskDegradeRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectTaskRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectTaskValidationTimeoutRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationCommandRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationCommandResponse;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationResultRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectCandidate;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectFilterDetail;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectFilterDetailsResponse;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectFilterLog;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectFilterSummary;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectResponse;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectTaskListItem;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectTaskResponse;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectValidationTarget;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectValidationResult;

@Service
public class WebUiElementCollectService {

    private static final int MAX_CANDIDATES = 120;
    private static final long LOCAL_RUNNER_IDEMPOTENCY_WINDOW_SECONDS = 10;
    private static final Pattern CSS_IDENTIFIER = Pattern.compile("^[A-Za-z_][A-Za-z0-9_-]*$");

    private final WebUiElementAiEnhancer aiEnhancer;
    private final WebUiLocatorSupport locatorSupport;
    private final WebUiElementCollectTaskMapper collectTaskMapper;
    private final WorkspaceService workspaceService;
    private final ObjectMapper objectMapper;
    private final Executor collectTaskExecutor;

    public WebUiElementCollectService(WebUiElementAiEnhancer aiEnhancer) {
        this(aiEnhancer, null, null, null, new ObjectMapper(), Runnable::run);
    }

    @Autowired
    public WebUiElementCollectService(
            WebUiElementAiEnhancer aiEnhancer,
            WebUiLocatorSupport locatorSupport,
            WebUiElementCollectTaskMapper collectTaskMapper,
            WorkspaceService workspaceService,
            ObjectMapper objectMapper
    ) {
        this(aiEnhancer, locatorSupport, collectTaskMapper, workspaceService, objectMapper, ForkJoinPool.commonPool());
    }

    WebUiElementCollectService(
            WebUiElementAiEnhancer aiEnhancer,
            WebUiLocatorSupport locatorSupport,
            WebUiElementCollectTaskMapper collectTaskMapper,
            WorkspaceService workspaceService,
            ObjectMapper objectMapper,
            Executor collectTaskExecutor
    ) {
        this.aiEnhancer = aiEnhancer;
        this.locatorSupport = locatorSupport;
        this.collectTaskMapper = collectTaskMapper;
        this.workspaceService = workspaceService;
        this.objectMapper = objectMapper == null ? new ObjectMapper() : objectMapper;
        this.collectTaskExecutor = collectTaskExecutor == null ? Runnable::run : collectTaskExecutor;
    }

    public WebUiElementCollectResponse collect(CollectWebUiElementsRequest request) {
        if (request.providerConnectionId() == null || blankToNull(request.modelName()) == null) {
            throw new BadRequestException("请选择 AI 采集模型");
        }
        String htmlText = blankToNull(request.htmlText());
        if (htmlText != null) {
            return collectFromHtml(htmlText, normalizeScope(request.scope()), "HTML", request, null);
        }

        String pageUrl = blankToNull(request.pageUrl());
        if (pageUrl == null) {
            throw new BadRequestException("页面 URL 或 HTML / DOM 内容不能为空");
        }
        return collectFromPage(pageUrl, request);
    }

    public WebUiElementCollectTaskResponse createLocalRunnerTask(String workspaceCode, LocalRunnerCollectTaskRequest request) {
        ensureTaskDependencies();
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity existingTask = findRecentReusableLocalRunnerTask(workspace.getId(), request);
        if (existingTask != null) {
            List<WebUiElementCollectCandidate> existingCandidates = readCandidates(existingTask.getCandidatesJson());
            WebUiElementCollectFilterSummary existingFilterSummary = readFilterSummary(existingTask.getFilterSummaryJson(), existingCandidates.size());
            return toTaskResponse(existingTask, existingCandidates, existingFilterSummary);
        }

        LocalDateTime now = LocalDateTime.now();
        int rawCount = request.rawCount() == null ? request.candidates() == null ? 0 : request.candidates().size() : Math.max(request.rawCount(), 0);

        WebUiElementCollectTaskEntity entity = new WebUiElementCollectTaskEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setRunnerId(blankToNull(request.runnerId()));
        entity.setSessionId(blankToNull(request.sessionId()));
        entity.setStatus("UPLOADED");
        entity.setSource("LOCAL_RUNNER_STATIC");
        entity.setActualUrl(blankToNull(request.actualUrl()));
        entity.setPageTitle(blankToNull(request.pageTitle()));
        entity.setModuleId(request.moduleId());
        entity.setPageId(request.pageId());
        entity.setPageName(blankToNull(request.pageName()));
        entity.setAiModelConfigId(request.providerConnectionId());
        entity.setAiModelName(blankToNull(request.modelName()));
        entity.setRawCount(rawCount);
        entity.setFinalCount(0);
        entity.setSnapshotJson(writeJson(request));
        entity.setCandidatesJson(writeJson(List.of()));
        entity.setFilterSummaryJson(writeJson(new WebUiElementCollectFilterSummary(rawCount, 0, 0, 0, 0)));
        entity.setFilterDetailsJson(writeJson(List.of()));
        entity.setCollectMessage("本地 Runner 页面素材已上传，等待后端处理");
        entity.setGlobalScreenshotBase64(blankToNull(request.screenshotBase64()));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity.setCompletedAt(null);
        collectTaskMapper.insert(entity);

        scheduleLocalRunnerTaskProcessing(entity.getId(), request, SecurityContextHolder.getContext().getAuthentication());

        return toTaskResponse(entity, List.of(), readFilterSummary(entity.getFilterSummaryJson(), 0));
    }

    public WebUiElementCollectTaskResponse getLocalRunnerTask(String workspaceCode, Long taskId) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());
        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), candidates.size());
        return toTaskResponse(entity, candidates, filterSummary);
    }

    public PageResponse<WebUiElementCollectTaskListItem> listLocalRunnerTasks(
            String workspaceCode,
            String keyword,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        ensureTaskDependencies();
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(workspaceCode);
        LambdaQueryWrapper<WebUiElementCollectTaskEntity> query = new LambdaQueryWrapper<WebUiElementCollectTaskEntity>()
                .eq(WebUiElementCollectTaskEntity::getWorkspaceId, workspace.getId());
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            Long keywordId = parseLongOrNull(trimmedKeyword);
            query.and(wrapper -> {
                wrapper.like(WebUiElementCollectTaskEntity::getPageTitle, trimmedKeyword)
                        .or()
                        .like(WebUiElementCollectTaskEntity::getPageName, trimmedKeyword)
                        .or()
                        .like(WebUiElementCollectTaskEntity::getActualUrl, trimmedKeyword);
                if (keywordId != null) {
                    wrapper.or().eq(WebUiElementCollectTaskEntity::getId, keywordId);
                }
            });
        }
        String normalizedStatus = blankToNull(status);
        if (normalizedStatus != null) {
            query.eq(WebUiElementCollectTaskEntity::getStatus, normalizedStatus.toUpperCase(Locale.ROOT));
        }

        long safePageNo = pageNo == null || pageNo <= 0 ? 1 : pageNo;
        long safePageSize = pageSize == null || pageSize <= 0 ? 10 : pageSize;
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<WebUiElementCollectTaskEntity> page = collectTaskMapper.selectPage(
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(safePageNo, safePageSize),
                query.orderByDesc(WebUiElementCollectTaskEntity::getId)
        );
        List<WebUiElementCollectTaskListItem> items = page.getRecords().stream()
                .map(this::toTaskListItem)
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public void deleteLocalRunnerTask(String workspaceCode, Long taskId) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());
        if (!isTerminalStatus(entity.getStatus())) {
            throw new BadRequestException("采集任务仍在处理中，请先取消任务后再删除");
        }
        collectTaskMapper.deleteById(taskId);
    }

    public WebUiElementCollectFilterDetailsResponse getLocalRunnerTaskFilterDetails(String workspaceCode, Long taskId) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());
        return new WebUiElementCollectFilterDetailsResponse(
                entity.getId(),
                readFilterDetails(entity.getFilterDetailsJson())
        );
    }

    public LocalRunnerCollectValidationCommandResponse getLocalRunnerValidationCommand(
            String workspaceCode,
            Long taskId,
            LocalRunnerCollectValidationCommandRequest request
    ) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());
        String runnerId = blankToNull(request == null ? null : request.runnerId());
        String sessionId = blankToNull(request == null ? null : request.sessionId());
        String currentUrl = blankToNull(request == null ? null : request.currentUrl());
        reconcileLocalRunnerTaskBinding(entity, runnerId, sessionId, currentUrl, false);

        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        if (isTerminalStatus(entity.getStatus())) {
            return validationCommand(entity, false, "采集任务已结束，无法领取真机验证指令", List.of());
        }
        String status = blankToNull(entity.getStatus());
        if (!"WAITING_LOCAL_VALIDATION".equals(status) && !"VALIDATING".equals(status)) {
            return validationCommand(entity, false, "采集任务尚未进入真机验证阶段", List.of());
        }
        List<WebUiElementCollectValidationTarget> locators = buildRequestedValidationTargets(request, candidates);
        if (locators.isEmpty()) {
            return validationCommand(entity, false, "当前采集任务没有可验证定位器", List.of());
        }
        if ("WAITING_LOCAL_VALIDATION".equals(status)) {
            LocalDateTime now = LocalDateTime.now();
            entity.setStatus("VALIDATING");
            entity.setCollectMessage("本地 Runner 已领取真机验证指令，正在等待验证结果");
            entity.setUpdatedAt(now);
            collectTaskMapper.updateById(entity);
        }
        return validationCommand(entity, true, null, locators);
    }

    public LocalRunnerCollectValidationCommandResponse getLocalRunnerValidationCommandForRunner(
            Long taskId,
            LocalRunnerCollectValidationCommandRequest request
    ) {
        ensureTaskDependencies();
        WebUiElementCollectTaskEntity entity = requireTaskForRunner(
                taskId,
                request == null ? null : request.runnerId(),
                request == null ? null : request.sessionId(),
                request == null ? null : request.currentUrl()
        );
        return prepareLocalRunnerValidationCommand(entity, request);
    }

    public WebUiElementCollectTaskResponse submitLocalRunnerValidationResults(
            String workspaceCode,
            Long taskId,
            LocalRunnerCollectValidationResultRequest request
    ) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());

        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        if (isTerminalStatus(entity.getStatus())) {
            WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), candidates.size());
            return toTaskResponse(entity, candidates, filterSummary);
        }
        List<WebUiElementCollectCandidate> mergedCandidates = mergeValidationResults(candidates, request == null ? null : request.results());
        WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), mergedCandidates.size());
        LocalDateTime now = LocalDateTime.now();
        entity.setStatus("COMPLETED");
        entity.setCandidatesJson(writeJson(mergedCandidates));
        entity.setFinalCount(mergedCandidates.size());
        entity.setUpdatedAt(now);
        entity.setCompletedAt(now);
        collectTaskMapper.updateById(entity);

        return toTaskResponse(entity, mergedCandidates, filterSummary);
    }

    public WebUiElementCollectTaskResponse submitLocalRunnerValidationResultsForRunner(
            Long taskId,
            LocalRunnerCollectValidationResultRequest request
    ) {
        ensureTaskDependencies();
        WebUiElementCollectTaskEntity entity = requireTaskForRunner(taskId, request == null ? null : request.runnerId(), request == null ? null : request.sessionId(), null);
        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), candidates.size());
        if (isTerminalStatus(entity.getStatus())) {
            return toTaskResponse(entity, candidates, filterSummary);
        }
        List<WebUiElementCollectCandidate> mergedCandidates = mergeValidationResults(candidates, request == null ? null : request.results());
        LocalDateTime now = LocalDateTime.now();
        entity.setStatus("COMPLETED");
        entity.setCandidatesJson(writeJson(mergedCandidates));
        entity.setFinalCount(mergedCandidates.size());
        entity.setUpdatedAt(now);
        entity.setCompletedAt(now);
        collectTaskMapper.updateById(entity);
        return toTaskResponse(entity, mergedCandidates, filterSummary);
    }

    public WebUiElementCollectTaskResponse degradeLocalRunnerTask(
            String workspaceCode,
            Long taskId,
            LocalRunnerCollectTaskDegradeRequest request
    ) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());

        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), candidates.size());
        if (isTerminalStatus(entity.getStatus())) {
            return toTaskResponse(entity, candidates, filterSummary);
        }
        LocalDateTime now = LocalDateTime.now();
        String reason = blankToNull(request == null ? null : request.reason());
        if (reason == null) {
            reason = "Runner 真机验证失败，已降级为未验证候选";
        }

        entity.setStatus("DEGRADED");
        entity.setErrorMessage(reason);
        entity.setUpdatedAt(now);
        entity.setCompletedAt(now);
        collectTaskMapper.updateById(entity);

        return toTaskResponse(entity, candidates, filterSummary);
    }

    public WebUiElementCollectTaskResponse cancelLocalRunnerTask(
            String workspaceCode,
            Long taskId,
            LocalRunnerCollectTaskCancelRequest request
    ) {
        ensureTaskDependencies();
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceCode);
        WebUiElementCollectTaskEntity entity = requireTask(taskId, workspace.getId());
        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        WebUiElementCollectFilterSummary filterSummary = readFilterSummary(entity.getFilterSummaryJson(), candidates.size());
        if (isTerminalStatus(entity.getStatus())) {
            return toTaskResponse(entity, candidates, filterSummary);
        }

        String reason = blankToNull(request == null ? null : request.reason());
        if (reason == null) {
            reason = "用户取消采集任务";
        }
        LocalDateTime now = LocalDateTime.now();
        entity.setStatus("CANCELED");
        entity.setErrorMessage(reason);
        entity.setUpdatedAt(now);
        entity.setCompletedAt(now);
        collectTaskMapper.updateById(entity);

        return toTaskResponse(entity, candidates, filterSummary);
    }

    public WebUiElementCollectTaskResponse timeoutLocalRunnerValidation(
            String workspaceCode,
            Long taskId,
            LocalRunnerCollectTaskValidationTimeoutRequest request
    ) {
        String reason = blankToNull(request == null ? null : request.reason());
        if (reason == null) {
            reason = "Runner 真机验证超时，已降级为未验证候选";
        }
        return degradeLocalRunnerTask(workspaceCode, taskId, new LocalRunnerCollectTaskDegradeRequest(reason));
    }

    private void scheduleLocalRunnerTaskProcessing(Long taskId, LocalRunnerCollectTaskRequest request, Authentication authentication) {
        collectTaskExecutor.execute(() -> {
            try {
                SecurityContextHolder.getContext().setAuthentication(authentication);
                processLocalRunnerTaskAsync(taskId, request);
            } finally {
                SecurityContextHolder.clearContext();
            }
        });
    }

    private void processLocalRunnerTaskAsync(Long taskId, LocalRunnerCollectTaskRequest request) {
        try {
            updateTaskStatus(taskId, "RULE_CLEANING", "后端正在进行规则过滤、去重和稳定性评分");
            LocalRunnerCandidateProcessResult processResult = processLocalRunnerCandidates(request.candidates());
            if (isTaskCanceled(taskId)) {
                return;
            }

            updateTaskStatus(taskId, "AI_ANALYZING", "后端正在执行 AI 命名、分组和解释增强");
            WebUiElementAiEnhancer.Result aiResult = enhanceLocalRunnerCandidates(processResult.candidates(), request);
            List<WebUiElementCollectCandidate> candidates = aiResult.candidates();
            if (isTaskCanceled(taskId)) {
                return;
            }

            WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
            if (entity == null || isTerminalStatus(entity.getStatus())) {
                return;
            }

            LocalDateTime now = LocalDateTime.now();
            entity.setStatus(candidates.isEmpty() ? "COMPLETED" : "WAITING_LOCAL_VALIDATION");
            entity.setCandidatesJson(writeJson(candidates));
            entity.setFilterSummaryJson(writeJson(processResult.filterSummary()));
            entity.setFilterDetailsJson(writeJson(processResult.filterDetails()));
            entity.setCollectMessage(collectMessage(aiResult));
            entity.setFinalCount(candidates.size());
            entity.setUpdatedAt(now);
            entity.setCompletedAt(candidates.isEmpty() ? now : null);
            collectTaskMapper.updateById(entity);
        } catch (RuntimeException exception) {
            failLocalRunnerTask(taskId, "采集任务处理失败：" + readableError(exception));
        }
    }

    private void updateTaskStatus(Long taskId, String status, String message) {
        WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
        if (entity == null || isTerminalStatus(entity.getStatus())) {
            return;
        }
        entity.setStatus(status);
        entity.setCollectMessage(message);
        entity.setUpdatedAt(LocalDateTime.now());
        collectTaskMapper.updateById(entity);
    }

    private boolean isTaskCanceled(Long taskId) {
        WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
        return entity == null || "CANCELED".equals(blankToNull(entity.getStatus()));
    }

    private void failLocalRunnerTask(Long taskId, String message) {
        WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
        if (entity == null || isTerminalStatus(entity.getStatus())) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        entity.setStatus("FAILED");
        entity.setErrorMessage(message);
        entity.setCollectMessage(message);
        entity.setUpdatedAt(now);
        entity.setCompletedAt(now);
        collectTaskMapper.updateById(entity);
    }

    private WebUiElementCollectResponse collectFromPage(String pageUrl, CollectWebUiElementsRequest request) {
        try (Playwright playwright = Playwright.create();
             Browser browser = browserType(playwright, request.browserType())
                     .launch(new BrowserType.LaunchOptions().setHeadless(request.headless() == null || request.headless()));
             BrowserContext browserContext = browser.newContext()) {
            browserContext.setDefaultTimeout(normalizeStepTimeout(request.timeoutMs()));
            Page page = browserContext.newPage();
            page.navigate(pageUrl, new Page.NavigateOptions()
                    .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED));
            return collectFromHtml(page.content(), normalizeScope(request.scope()), "PLAYWRIGHT", request, page);
        } catch (RuntimeException exception) {
            throw new BadRequestException("页面采集失败：" + readableError(exception));
        }
    }

    private LocalRunnerCandidateProcessResult processLocalRunnerCandidates(List<WebUiElementCollectCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            WebUiElementCollectFilterSummary summary = new WebUiElementCollectFilterSummary(0, 0, 0, 0, 0);
            return new LocalRunnerCandidateProcessResult(List.of(), summary, List.of());
        }
        int emptyLocatorCount = 0;
        int duplicateCount = 0;
        int lowStabilityCount = 0;
        List<WebUiElementCollectFilterDetail> filterDetails = new ArrayList<>();
        Map<String, WebUiElementCollectCandidate> deduped = new LinkedHashMap<>();
        for (WebUiElementCollectCandidate candidate : candidates) {
            String locatorType = blankToNull(candidate.locatorType());
            String locatorValue = blankToNull(candidate.locatorValue());
            if (locatorType == null || locatorValue == null) {
                emptyLocatorCount += 1;
                filterDetails.add(filterDetail("EMPTY_LOCATOR", "空定位候选已过滤", false, candidate, filterDetails.size()));
                continue;
            }
            int confidence = normalizedConfidence(candidate.confidence());
            if (confidence < 60) {
                lowStabilityCount += 1;
                filterDetails.add(filterDetail("LOW_STABILITY", "低稳定性候选已过滤", true, candidate, filterDetails.size()));
                continue;
            }
            String key = locatorKey(locatorType, locatorValue);
            if (key == null || deduped.containsKey(key)) {
                duplicateCount += 1;
                filterDetails.add(filterDetail("DUPLICATE_LOCATOR", "重复定位器候选已合并", true, candidate, filterDetails.size()));
                continue;
            }
            deduped.put(key, normalizeLocalRunnerCandidate(candidate, confidence));
        }
        List<WebUiElementCollectCandidate> result = deduped.values().stream()
                .sorted(Comparator.comparing(WebUiElementCollectCandidate::confidence).reversed())
                .limit(MAX_CANDIDATES)
                .toList();
        WebUiElementCollectFilterSummary summary = new WebUiElementCollectFilterSummary(
                candidates.size(),
                emptyLocatorCount,
                duplicateCount,
                lowStabilityCount,
                result.size()
        );
        return new LocalRunnerCandidateProcessResult(result, summary, filterDetails);
    }

    private WebUiElementAiEnhancer.Result enhanceLocalRunnerCandidates(
            List<WebUiElementCollectCandidate> candidates,
            LocalRunnerCollectTaskRequest request
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return WebUiElementAiEnhancer.Result.enhanced(List.of(), "本地 Runner 未生成可增强候选");
        }
        CollectWebUiElementsRequest aiRequest = new CollectWebUiElementsRequest(
                blankToNull(request.actualUrl()),
                null,
                request.moduleId(),
                request.pageId(),
                blankToNull(request.pageName()),
                "AI",
                null,
                null,
                blankToNull(request.scope()),
                null,
                null,
                null,
                null,
                null,
                request.providerConnectionId(),
                request.modelName()
        );
        return aiEnhancer.enhance(candidates, aiRequest, "LOCAL_RUNNER_STATIC");
    }

    private String collectMessage(WebUiElementAiEnhancer.Result aiResult) {
        if (aiResult == null) {
            return null;
        }
        if (aiResult.enhanced()) {
            return aiResult.message();
        }
        String fallbackReason = blankToNull(aiResult.fallbackReason());
        return fallbackReason == null ? aiResult.message() : fallbackReason;
    }

    private WebUiElementCollectCandidate normalizeLocalRunnerCandidate(WebUiElementCollectCandidate candidate, int confidence) {
        WebUiElementCollectCandidate normalized = new WebUiElementCollectCandidate(
                normalizeStandardGroupName(candidate.groupName()),
                candidate.elementName(),
                candidate.locatorType(),
                candidate.locatorValue(),
                candidate.framePath(),
                candidate.shadowPath(),
                candidate.locatorCandidates(),
                confidence,
                candidate.reason(),
                candidate.tagName(),
                candidate.elementType(),
                candidate.text(),
                candidate.placeholder(),
                candidate.ariaLabel(),
                candidate.labelText(),
                candidate.nearbyHeading(),
                candidate.businessMeaning(),
                candidate.recommendedToSave(),
                candidate.notRecommendedReason(),
                candidate.maintenanceSuggestion(),
                candidate.stabilityNote(),
                candidate.validationStatus(),
                candidate.matchCount(),
                candidate.validationMessage(),
                candidate.screenshotBase64(),
                candidate.candidateSource(),
                candidate.saveBlockedReason()
        );
        return copyCandidate(
                normalized,
                "UNVERIFIED",
                null,
                "静态生成，尚未经过 Runner 真机验证",
                candidate.screenshotBase64(),
                candidate.recommendedToSave() == null || candidate.recommendedToSave(),
                candidate.notRecommendedReason(),
                "STATIC_RULE",
                candidate.saveBlockedReason()
        );
    }

    private List<WebUiElementCollectCandidate> mergeValidationResults(
            List<WebUiElementCollectCandidate> candidates,
            List<WebUiElementCollectValidationResult> results
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        if (results == null || results.isEmpty()) {
            return candidates;
        }
        Map<String, WebUiElementCollectValidationResult> resultMap = new LinkedHashMap<>();
        for (WebUiElementCollectValidationResult result : results) {
            String key = locatorKey(result.locatorType(), result.locatorValue());
            if (key != null) {
                resultMap.put(key, result);
            }
        }
        return candidates.stream()
                .map(candidate -> mergeValidationResult(candidate, resultMap.get(locatorKey(candidate.locatorType(), candidate.locatorValue()))))
                .toList();
    }

    private List<WebUiElementCollectValidationTarget> buildValidationTargets(List<WebUiElementCollectCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        Map<String, WebUiElementCollectValidationTarget> targets = new LinkedHashMap<>();
        for (WebUiElementCollectCandidate candidate : candidates) {
            String locatorType = blankToNull(candidate.locatorType());
            String locatorValue = blankToNull(candidate.locatorValue());
            String key = locatorKey(locatorType, locatorValue);
            if (key != null && !targets.containsKey(key)) {
                targets.put(key, new WebUiElementCollectValidationTarget(locatorType, locatorValue, candidate.framePath(), candidate.shadowPath()));
            }
        }
        return new ArrayList<>(targets.values());
    }

    private List<WebUiElementCollectValidationTarget> buildRequestedValidationTargets(
            LocalRunnerCollectValidationCommandRequest request,
            List<WebUiElementCollectCandidate> candidates
    ) {
        if (request == null || request.locators() == null || request.locators().isEmpty()) {
            return buildValidationTargets(candidates);
        }
        Map<String, WebUiElementCollectValidationTarget> targets = new LinkedHashMap<>();
        for (WebUiElementCollectValidationTarget item : request.locators()) {
            if (item == null) {
                continue;
            }
            String locatorType = blankToNull(item.locatorType());
            String locatorValue = blankToNull(item.locatorValue());
            String key = locatorKey(locatorType, locatorValue);
            if (key != null && !targets.containsKey(key)) {
                targets.put(key, new WebUiElementCollectValidationTarget(locatorType, locatorValue, item.framePath(), item.shadowPath()));
            }
        }
        return new ArrayList<>(targets.values());
    }

    private LocalRunnerCollectValidationCommandResponse validationCommand(
            WebUiElementCollectTaskEntity entity,
            boolean runnable,
            String reason,
            List<WebUiElementCollectValidationTarget> locators
    ) {
        return new LocalRunnerCollectValidationCommandResponse(
                entity.getId(),
                entity.getStatus(),
                runnable,
                reason,
                entity.getRunnerId(),
                entity.getSessionId(),
                locators == null ? List.of() : locators
        );
    }

    private WebUiElementCollectCandidate mergeValidationResult(
            WebUiElementCollectCandidate candidate,
            WebUiElementCollectValidationResult result
    ) {
        if (result == null) {
            return candidate;
        }
        String status = normalizeValidationStatus(result.validationStatus(), result.matchCount());
        String message = blankToNull(result.validationMessage());
        if (message == null) {
            message = "PASSED".equals(status) ? "真机验证通过" : "真机验证未通过";
        }
        boolean passed = "PASSED".equals(status);
        return copyCandidate(
                candidate,
                status,
                result.matchCount() == null ? 0 : Math.max(result.matchCount(), 0),
                message,
                blankToNull(result.screenshotBase64()) == null ? candidate.screenshotBase64() : result.screenshotBase64(),
                passed,
                passed ? null : "真机验证未通过，暂不建议保存",
                candidate.candidateSource(),
                passed ? null : "真机验证未通过，暂不建议保存"
        );
    }

    private String normalizeValidationStatus(String validationStatus, Integer matchCount) {
        String normalized = blankToNull(validationStatus);
        if ("PASSED".equals(normalized) || "FAILED".equals(normalized) || "MULTIPLE".equals(normalized)) {
            return normalized;
        }
        int count = matchCount == null ? 0 : matchCount;
        if (count == 1) {
            return "PASSED";
        }
        if (count > 1) {
            return "MULTIPLE";
        }
        return "FAILED";
    }

    private int normalizedConfidence(Integer confidence) {
        if (confidence == null) {
            return 0;
        }
        return Math.max(0, Math.min(100, confidence));
    }

    private String normalizeStandardGroupName(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return "未分类";
        }
        if ("顶部导航区".equals(normalized)
                || "筛选表单区".equals(normalized)
                || "操作按钮区".equals(normalized)
                || "数据表格区".equals(normalized)
                || "弹窗区".equals(normalized)
                || "侧边栏区".equals(normalized)
                || "未分类".equals(normalized)) {
            return normalized;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.matches(".*(顶部|导航|菜单|页头|header|nav|menu).*")) {
            return "顶部导航区";
        }
        if (lower.matches(".*(筛选|查询|搜索|检索|过滤|表单|输入|选择|filter|search|form).*")) {
            return "筛选表单区";
        }
        if (lower.matches(".*(操作|按钮|工具栏|新增|添加|编辑|删除|提交|保存|确定|取消|关闭|批量|action|button|toolbar).*")) {
            return "操作按钮区";
        }
        if (lower.matches(".*(表格|列表|清单|数据|table|list|grid).*")) {
            return "数据表格区";
        }
        if (lower.matches(".*(弹窗|抽屉|浮层|对话框|modal|dialog|drawer|popup).*")) {
            return "弹窗区";
        }
        if (lower.matches(".*(侧边|侧栏|边栏|aside|sidebar).*")) {
            return "侧边栏区";
        }
        return "未分类";
    }

    private WebUiElementCollectTaskResponse toTaskResponse(
            WebUiElementCollectTaskEntity entity,
            List<WebUiElementCollectCandidate> candidates,
            WebUiElementCollectFilterSummary filterSummary
    ) {
        return new WebUiElementCollectTaskResponse(
                entity.getId(),
                entity.getStatus(),
                collectCurrentStage(entity.getStatus()),
                collectProgressPercent(entity.getStatus()),
                entity.getSource(),
                entity.getRunnerId(),
                entity.getSessionId(),
                entity.getActualUrl(),
                entity.getPageTitle(),
                entity.getAiModelConfigId(),
                entity.getAiModelName(),
                entity.getRawCount(),
                entity.getFinalCount(),
                entity.getGlobalScreenshotBase64(),
                filterSummary,
                buildFilterLogs(filterSummary, entity),
                candidates,
                blankToNull(entity.getErrorMessage()) == null
                        ? defaultCollectMessage(entity)
                        : entity.getErrorMessage(),
                entity.getCreatedAt(),
                entity.getCompletedAt()
        );
    }

    private WebUiElementCollectTaskListItem toTaskListItem(WebUiElementCollectTaskEntity entity) {
        CollectTaskValidationSummary validationSummary = summarizeTaskValidation(readCandidates(entity.getCandidatesJson()));
        return new WebUiElementCollectTaskListItem(
                entity.getId(),
                entity.getStatus(),
                collectCurrentStage(entity.getStatus()),
                collectProgressPercent(entity.getStatus()),
                entity.getSource(),
                entity.getRunnerId(),
                entity.getSessionId(),
                entity.getActualUrl(),
                entity.getPageTitle(),
                entity.getModuleId(),
                entity.getPageId(),
                entity.getPageName(),
                entity.getAiModelConfigId(),
                entity.getAiModelName(),
                entity.getRawCount(),
                entity.getFinalCount(),
                validationSummary.passedCount(),
                validationSummary.failedCount(),
                validationSummary.multipleCount(),
                validationSummary.unverifiedCount(),
                validationSummary.screenshotEvidenceCount(),
                blankToNull(entity.getErrorMessage()) == null
                        ? defaultCollectMessage(entity)
                        : entity.getErrorMessage(),
                entity.getCreatedAt(),
                entity.getCompletedAt()
        );
    }

    private CollectTaskValidationSummary summarizeTaskValidation(List<WebUiElementCollectCandidate> candidates) {
        int passedCount = 0;
        int failedCount = 0;
        int multipleCount = 0;
        int unverifiedCount = 0;
        int screenshotEvidenceCount = 0;
        for (WebUiElementCollectCandidate candidate : candidates) {
            String validationStatus = blankToNull(candidate.validationStatus());
            if ("PASSED".equals(validationStatus)) {
                passedCount += 1;
            } else if ("FAILED".equals(validationStatus)) {
                failedCount += 1;
            } else if ("MULTIPLE".equals(validationStatus)) {
                multipleCount += 1;
            } else {
                unverifiedCount += 1;
            }
            if (blankToNull(candidate.screenshotBase64()) != null) {
                screenshotEvidenceCount += 1;
            }
        }
        return new CollectTaskValidationSummary(
                passedCount,
                failedCount,
                multipleCount,
                unverifiedCount,
                screenshotEvidenceCount
        );
    }

    private record CollectTaskValidationSummary(
            int passedCount,
            int failedCount,
            int multipleCount,
            int unverifiedCount,
            int screenshotEvidenceCount
    ) {
    }

    private Long parseLongOrNull(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String defaultCollectMessage(WebUiElementCollectTaskEntity entity) {
        String collectMessage = blankToNull(entity.getCollectMessage());
        if (collectMessage != null) {
            return collectMessage;
        }
        return "本地 Runner 静态采集完成，候选尚未经过真机验证";
    }

    private String collectCurrentStage(String status) {
        String normalized = blankToNull(status);
        if ("FAILED".equals(normalized)) {
            return "FAILED";
        }
        if ("CANCELED".equals(normalized)) {
            return "LOCAL_VALIDATE";
        }
        if ("DEGRADED".equals(normalized)) {
            return "LOCAL_VALIDATE";
        }
        if ("WAITING_LOCAL_VALIDATION".equals(normalized) || "VALIDATING".equals(normalized)) {
            return "LOCAL_VALIDATE";
        }
        if ("AI_ANALYZING".equals(normalized)) {
            return "AI_ANALYZE";
        }
        if ("RULE_CLEANING".equals(normalized) || "PROCESSING".equals(normalized)) {
            return "RULE_CLEAN";
        }
        if ("UPLOADED".equals(normalized) || "PENDING".equals(normalized)) {
            return "UPLOAD_SNAPSHOT";
        }
        return "FINALIZE";
    }

    private Integer collectProgressPercent(String status) {
        String normalized = blankToNull(status);
        if ("FAILED".equals(normalized)) {
            return 100;
        }
        if ("CANCELED".equals(normalized)) {
            return 100;
        }
        if ("DEGRADED".equals(normalized)) {
            return 80;
        }
        if ("WAITING_LOCAL_VALIDATION".equals(normalized) || "VALIDATING".equals(normalized)) {
            return 75;
        }
        if ("AI_ANALYZING".equals(normalized)) {
            return 55;
        }
        if ("RULE_CLEANING".equals(normalized) || "PROCESSING".equals(normalized)) {
            return 40;
        }
        if ("UPLOADED".equals(normalized) || "PENDING".equals(normalized)) {
            return 10;
        }
        return 100;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("采集快照序列化失败");
        }
    }

    private WebUiElementCollectTaskEntity findRecentReusableLocalRunnerTask(Long workspaceId, LocalRunnerCollectTaskRequest request) {
        String runnerId = blankToNull(request.runnerId());
        String sessionId = blankToNull(request.sessionId());
        String actualUrl = blankToNull(request.actualUrl());
        if (runnerId == null || sessionId == null || actualUrl == null) {
            return null;
        }
        LocalDateTime since = LocalDateTime.now().minusSeconds(LOCAL_RUNNER_IDEMPOTENCY_WINDOW_SECONDS);
        List<WebUiElementCollectTaskEntity> tasks = collectTaskMapper.selectList(new LambdaQueryWrapper<WebUiElementCollectTaskEntity>()
                .eq(WebUiElementCollectTaskEntity::getWorkspaceId, workspaceId)
                .eq(WebUiElementCollectTaskEntity::getRunnerId, runnerId)
                .eq(WebUiElementCollectTaskEntity::getSessionId, sessionId)
                .eq(WebUiElementCollectTaskEntity::getActualUrl, actualUrl)
                .ge(WebUiElementCollectTaskEntity::getCreatedAt, since)
                .orderByDesc(WebUiElementCollectTaskEntity::getId));
        return tasks.stream()
                .filter(task -> !isTerminalStatus(task.getStatus()))
                .findFirst()
                .orElse(null);
    }

    private WebUiElementCollectTaskEntity requireTask(Long taskId, Long workspaceId) {
        WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
        if (entity == null || !workspaceId.equals(entity.getWorkspaceId())) {
            throw new NotFoundException("采集任务不存在");
        }
        return entity;
    }

    private WebUiElementCollectTaskEntity requireTaskForRunner(Long taskId, String runnerId, String sessionId, String currentUrl) {
        if (taskId == null) {
            throw new BadRequestException("采集任务 ID 不能为空");
        }
        WebUiElementCollectTaskEntity entity = collectTaskMapper.selectById(taskId);
        if (entity == null) {
            throw new NotFoundException("采集任务不存在");
        }
        reconcileLocalRunnerTaskBinding(entity, runnerId, sessionId, currentUrl, true);
        return entity;
    }

    private void reconcileLocalRunnerTaskBinding(
            WebUiElementCollectTaskEntity entity,
            String runnerId,
            String sessionId,
            String currentUrl,
            boolean requireRunner
    ) {
        String taskRunnerId = blankToNull(entity.getRunnerId());
        String normalizedRunnerId = blankToNull(runnerId);
        if (taskRunnerId != null && (requireRunner || normalizedRunnerId != null) && !taskRunnerId.equals(normalizedRunnerId)) {
            throw new BadRequestException("Runner 与采集任务不匹配");
        }
        String normalizedCurrentUrl = blankToNull(currentUrl);
        String taskActualUrl = blankToNull(entity.getActualUrl());
        if (normalizedCurrentUrl != null && taskActualUrl != null && !isSameCollectPage(taskActualUrl, normalizedCurrentUrl)) {
            throw new BadRequestException("Runner 当前页面与采集任务页面不一致，请在目标业务页重新采集当前页");
        }
        String taskSessionId = blankToNull(entity.getSessionId());
        String normalizedSessionId = blankToNull(sessionId);
        boolean changed = false;
        if (taskRunnerId == null && normalizedRunnerId != null) {
            entity.setRunnerId(normalizedRunnerId);
            changed = true;
        }
        if (normalizedSessionId != null && !normalizedSessionId.equals(taskSessionId)) {
            entity.setSessionId(normalizedSessionId);
            changed = true;
        }
        if (changed) {
            entity.setUpdatedAt(LocalDateTime.now());
            collectTaskMapper.updateById(entity);
        }
    }

    private boolean isSameCollectPage(String taskUrl, String currentUrl) {
        String normalizedTaskUrl = normalizeCollectPageUrl(taskUrl);
        String normalizedCurrentUrl = normalizeCollectPageUrl(currentUrl);
        return normalizedTaskUrl != null && normalizedTaskUrl.equals(normalizedCurrentUrl);
    }

    private String normalizeCollectPageUrl(String value) {
        String trimmed = blankToNull(value);
        if (trimmed == null) {
            return null;
        }
        try {
            URI uri = URI.create(trimmed);
            String host = blankToNull(uri.getHost());
            if (host != null) {
                String path = blankToNull(uri.getPath());
                String port = uri.getPort() > 0 ? ":" + uri.getPort() : "";
                return stripTrailingSlash(host.toLowerCase(Locale.ROOT) + port + (path == null ? "" : path));
            }
        } catch (IllegalArgumentException ignored) {
            // Fall back to normalized string comparison below.
        }
        String normalized = trimmed.replaceFirst("(?i)^https?://", "");
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int hashIndex = normalized.indexOf('#');
        if (hashIndex >= 0) {
            normalized = normalized.substring(0, hashIndex);
        }
        return stripTrailingSlash(normalized.toLowerCase(Locale.ROOT));
    }

    private String stripTrailingSlash(String value) {
        String normalized = value;
        while (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private LocalRunnerCollectValidationCommandResponse prepareLocalRunnerValidationCommand(
            WebUiElementCollectTaskEntity entity,
            LocalRunnerCollectValidationCommandRequest request
    ) {
        List<WebUiElementCollectCandidate> candidates = readCandidates(entity.getCandidatesJson());
        if (isTerminalStatus(entity.getStatus())) {
            return validationCommand(entity, false, "采集任务已结束，无法领取真机验证指令", List.of());
        }
        String status = blankToNull(entity.getStatus());
        if (!"WAITING_LOCAL_VALIDATION".equals(status) && !"VALIDATING".equals(status)) {
            return validationCommand(entity, false, "采集任务尚未进入真机验证阶段", List.of());
        }
        List<WebUiElementCollectValidationTarget> locators = buildRequestedValidationTargets(request, candidates);
        if (locators.isEmpty()) {
            return validationCommand(entity, false, "当前采集任务没有可验证定位器", List.of());
        }
        if ("WAITING_LOCAL_VALIDATION".equals(status)) {
            LocalDateTime now = LocalDateTime.now();
            entity.setStatus("VALIDATING");
            entity.setCollectMessage("本地 Runner 已领取真机验证指令，正在等待验证结果");
            entity.setUpdatedAt(now);
            collectTaskMapper.updateById(entity);
        }
        return validationCommand(entity, true, null, locators);
    }

    private boolean isTerminalStatus(String status) {
        String normalized = blankToNull(status);
        return "COMPLETED".equals(normalized)
                || "FAILED".equals(normalized)
                || "DEGRADED".equals(normalized)
                || "CANCELED".equals(normalized);
    }

    private List<WebUiElementCollectCandidate> readCandidates(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<List<WebUiElementCollectCandidate>>() {
            });
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("采集候选反序列化失败");
        }
    }

    private List<WebUiElementCollectFilterDetail> readFilterDetails(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<List<WebUiElementCollectFilterDetail>>() {
            });
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("采集过滤明细反序列化失败");
        }
    }

    private WebUiElementCollectFilterSummary readFilterSummary(String json, int finalCount) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return new WebUiElementCollectFilterSummary(finalCount, 0, 0, 0, finalCount);
        }
        try {
            return objectMapper.readValue(normalized, WebUiElementCollectFilterSummary.class);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("采集过滤摘要反序列化失败");
        }
    }

    private List<WebUiElementCollectFilterLog> buildFilterLogs(
            WebUiElementCollectFilterSummary summary,
            WebUiElementCollectTaskEntity entity
    ) {
        if (summary == null) {
            return List.of();
        }
        List<WebUiElementCollectFilterLog> logs = new ArrayList<>();
        logs.add(filterLog("EMPTY_LOCATOR", summary.emptyLocatorCount(), "空定位候选已过滤"));
        logs.add(filterLog("DUPLICATE_LOCATOR", summary.duplicateCount(), "重复定位器候选已合并"));
        logs.add(filterLog("LOW_STABILITY", summary.lowStabilityCount(), "低稳定性候选已过滤"));
        String collectMessage = entity == null ? null : blankToNull(entity.getCollectMessage());
        int finalCount = entity == null || entity.getFinalCount() == null ? summary.finalCount() : entity.getFinalCount();
        if (collectMessage != null && blankToNull(entity.getAiModelName()) != null) {
            logs.add(new WebUiElementCollectFilterLog(
                    "AI_METADATA",
                    "AI_METADATA_ENHANCE",
                    finalCount,
                    collectMessage
            ));
        }
        logs.add(filterLog("FINAL_CANDIDATE", finalCount, "最终候选"));
        return logs;
    }

    private WebUiElementCollectFilterLog filterLog(String reason, Integer count, String message) {
        return new WebUiElementCollectFilterLog("STATIC_RULE", reason, count == null ? 0 : count, message);
    }

    private WebUiElementCollectFilterDetail filterDetail(
            String reason,
            String message,
            boolean recoverable,
            WebUiElementCollectCandidate candidate,
            int index
    ) {
        return new WebUiElementCollectFilterDetail(
                reason + "-" + index,
                "STATIC_RULE",
                reason,
                message,
                recoverable,
                candidate
        );
    }

    private void ensureTaskDependencies() {
        if (collectTaskMapper == null || workspaceService == null) {
            throw new BadRequestException("采集任务存储尚未初始化");
        }
    }

    private WebUiElementCollectResponse collectFromHtml(
            String htmlText,
            String scope,
            String source,
            CollectWebUiElementsRequest request,
            Page page
    ) {
        Document document = Jsoup.parse(htmlText);
        Map<String, WebUiElementCollectCandidate> candidates = new LinkedHashMap<>();
        collectFormControls(document, scope, candidates);
        collectButtons(document, scope, candidates);
        collectTables(document, scope, candidates);
        collectDialogs(document, scope, candidates);
        List<WebUiElementCollectCandidate> items = candidates.values()
                .stream()
                .sorted(Comparator.comparing(WebUiElementCollectCandidate::confidence).reversed())
                .limit(MAX_CANDIDATES)
                .toList();
        items = validateCandidates(page, items);
        if (items.isEmpty()) {
            return new WebUiElementCollectResponse(items, source, "未识别到可采集元素", false, null);
        }
        WebUiElementAiEnhancer.Result enhanced = aiEnhancer.enhance(items, request, source);
        List<WebUiElementCollectCandidate> enhancedCandidates = finalizeCandidates(page, items, enhanced.candidates());
        return new WebUiElementCollectResponse(
                enhancedCandidates,
                source,
                enhanced.message(),
                enhanced.enhanced(),
                enhanced.fallbackReason()
        );
    }

    private void collectFormControls(Document document, String scope, Map<String, WebUiElementCollectCandidate> candidates) {
        if (!scopeMatches(scope, "FORM")) {
            return;
        }
        for (Element element : document.select("input:not([type=hidden]), textarea, select")) {
            LocatorSuggestion locator = bestLocator(element);
            if (locator == null) {
                continue;
            }
            String name = readableName(
                    labelText(document, element),
                    attr(element, "aria-label"),
                    attr(element, "placeholder"),
                    attr(element, "name"),
                    attr(element, "id"),
                    element.tagName()
            );
            addCandidate(candidates, createCandidate(
                    document,
                    element,
                    "FORM",
                    "表单区",
                    suffixName(name, controlSuffix(element)),
                    locator.type(),
                    locator.value(),
                    locator.confidence(),
                    locator.reason()
            ));
        }
    }

    private void collectButtons(Document document, String scope, Map<String, WebUiElementCollectCandidate> candidates) {
        if (!scopeMatches(scope, "BUTTON")) {
            return;
        }
        for (Element element : document.select("button, input[type=button], input[type=submit], input[type=reset], a[role=button], [role=button]")) {
            LocatorSuggestion locator = buttonLocator(element);
            if (locator == null) {
                continue;
            }
            String name = readableName(
                    attr(element, "aria-label"),
                    attr(element, "value"),
                    element.ownText(),
                    attr(element, "title"),
                    attr(element, "id")
            );
            addCandidate(candidates, createCandidate(
                    document,
                    element,
                    "BUTTON",
                    "操作区",
                    suffixName(name, "按钮"),
                    locator.type(),
                    locator.value(),
                    locator.confidence(),
                    locator.reason()
            ));
        }
    }

    private void collectTables(Document document, String scope, Map<String, WebUiElementCollectCandidate> candidates) {
        if (!scopeMatches(scope, "TABLE")) {
            return;
        }
        for (Element element : document.select("table, .el-table, [role=table], [role=grid]")) {
            LocatorSuggestion locator = bestLocator(element);
            if (locator == null) {
                continue;
            }
            String name = readableName(attr(element, "aria-label"), attr(element, "id"), attr(element, "class"), "结果");
            addCandidate(candidates, createCandidate(
                    document,
                    element,
                    "TABLE",
                    "表格区",
                    suffixName(name, "表格"),
                    locator.type(),
                    locator.value(),
                    Math.max(locator.confidence() - 5, 60),
                    locator.reason()
            ));
        }
    }

    private void collectDialogs(Document document, String scope, Map<String, WebUiElementCollectCandidate> candidates) {
        if (!scopeMatches(scope, "DIALOG")) {
            return;
        }
        for (Element element : document.select("[role=dialog], dialog, .el-dialog, .modal, .ant-modal")) {
            LocatorSuggestion locator = bestLocator(element);
            if (locator == null) {
                continue;
            }
            String name = readableName(attr(element, "aria-label"), attr(element, "id"), firstHeadingText(element), "确认");
            addCandidate(candidates, createCandidate(
                    document,
                    element,
                    "DIALOG",
                    "弹窗区",
                    suffixName(name, "弹窗"),
                    locator.type(),
                    locator.value(),
                    Math.max(locator.confidence() - 8, 55),
                    locator.reason()
            ));
        }
    }

    private LocatorSuggestion buttonLocator(Element element) {
        String text = blankToNull(readableText(element));
        if (text != null) {
            return new LocatorSuggestion("ROLE", "button:" + text, 88, "按钮文本清晰，使用 role 定位可读性较好");
        }
        return bestLocator(element);
    }

    private LocatorSuggestion bestLocator(Element element) {
        String testId = firstAttr(element, "data-testid", "data-test", "data-cy", "data-qa");
        if (testId != null) {
            return new LocatorSuggestion("TEST_ID", testId, 96, "优先使用测试属性，稳定性最高");
        }
        String id = attr(element, "id");
        if (id != null) {
            String locator = CSS_IDENTIFIER.matcher(id).matches() ? "#" + id : "[id=\"" + cssAttributeEscape(id) + "\"]";
            return new LocatorSuggestion("CSS", locator, 92, "优先使用 id，定位稳定");
        }
        String name = attr(element, "name");
        if (name != null) {
            return new LocatorSuggestion("CSS", element.tagName() + "[name=\"" + cssAttributeEscape(name) + "\"]", 86, "使用 name 属性定位，适合表单元素");
        }
        String placeholder = attr(element, "placeholder");
        if (placeholder != null) {
            return new LocatorSuggestion("PLACEHOLDER", placeholder, 82, "使用 placeholder 定位，便于人工阅读");
        }
        String ariaLabel = attr(element, "aria-label");
        if (ariaLabel != null) {
            return new LocatorSuggestion("CSS", element.tagName() + "[aria-label=\"" + cssAttributeEscape(ariaLabel) + "\"]", 80, "使用 aria-label 属性定位");
        }
        String className = firstStableClass(element);
        if (className != null) {
            return new LocatorSuggestion("CSS", element.tagName() + "." + className, 66, "使用 class 作为兜底定位，保存前建议确认唯一性");
        }
        return new LocatorSuggestion("CSS", element.tagName(), 45, "仅识别到标签定位，建议补充 data-testid 或更稳定属性");
    }

    private WebUiElementCollectCandidate createCandidate(
            Document document,
            Element element,
            String elementType,
            String groupName,
            String elementName,
            String locatorType,
            String locatorValue,
            Integer confidence,
            String reason
    ) {
        return new WebUiElementCollectCandidate(
                normalizeStandardGroupName(groupName),
                elementName,
                locatorType,
                locatorValue,
                null,
                null,
                null,
                confidence,
                reason,
                element.tagName(),
                elementType,
                blankToNull(readableText(element)),
                attr(element, "placeholder"),
                attr(element, "aria-label"),
                labelText(document, element),
                nearbyHeadingText(element),
                null,
                confidence == null || confidence >= 60,
                confidence != null && confidence < 60 ? "定位器稳定性较低，建议人工确认后保存" : null,
                maintenanceSuggestion(locatorType, confidence),
                reason,
                "SKIPPED",
                null,
                "离线候选未执行浏览器验证",
                null,
                "RULE",
                null
        );
    }

    private List<WebUiElementCollectCandidate> validateCandidates(Page page, List<WebUiElementCollectCandidate> candidates) {
        if (page == null || locatorSupport == null || candidates.isEmpty()) {
            return candidates;
        }
        return candidates.stream()
                .map(candidate -> validateCandidate(page, candidate))
                .toList();
    }

    private List<WebUiElementCollectCandidate> finalizeCandidates(
            Page page,
            List<WebUiElementCollectCandidate> ruleCandidates,
            List<WebUiElementCollectCandidate> candidates
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        Map<String, WebUiElementCollectCandidate> ruleByLocator = new LinkedHashMap<>();
        for (WebUiElementCollectCandidate ruleCandidate : ruleCandidates) {
            ruleByLocator.put(locatorKey(ruleCandidate.locatorType(), ruleCandidate.locatorValue()), ruleCandidate);
        }
        Map<String, WebUiElementCollectCandidate> deduped = new LinkedHashMap<>();
        for (WebUiElementCollectCandidate candidate : candidates) {
            String key = locatorKey(candidate.locatorType(), candidate.locatorValue());
            if (key == null || deduped.containsKey(key)) {
                continue;
            }
            WebUiElementCollectCandidate normalized = ruleByLocator.containsKey(key)
                    ? withSaveMetadata(candidate, "RULE", candidate.saveBlockedReason(), candidate.recommendedToSave(), candidate.notRecommendedReason())
                    : ensureAiSupplementValidation(page, candidate);
            deduped.put(key, normalized);
        }
        return deduped.values().stream().limit(MAX_CANDIDATES).toList();
    }

    private WebUiElementCollectCandidate ensureAiSupplementValidation(Page page, WebUiElementCollectCandidate candidate) {
        WebUiElementCollectCandidate normalized = withSaveMetadata(candidate, "AI_SUPPLEMENT", candidate.saveBlockedReason(), candidate.recommendedToSave(), candidate.notRecommendedReason());
        if (page != null && locatorSupport != null) {
            normalized = validateCandidate(page, normalized);
        } else if (blankToNull(normalized.validationStatus()) == null || "SKIPPED".equals(normalized.validationStatus())) {
            normalized = copyCandidate(normalized, "AI_UNVERIFIED", null, "AI 补充候选未完成后端验证", normalized.screenshotBase64(), normalized.recommendedToSave(), normalized.notRecommendedReason(), normalized.candidateSource(), normalized.saveBlockedReason());
        }
        if (!"PASSED".equals(normalized.validationStatus())) {
            return blockSave(normalized, "AI 补充候选未完成后端验证，不能保存");
        }
        if (normalized.matchCount() == null || normalized.matchCount() != 1) {
            return blockSave(normalized, "AI 补充候选未唯一匹配，不能保存");
        }
        return normalized;
    }

    private WebUiElementCollectCandidate blockSave(WebUiElementCollectCandidate candidate, String reason) {
        return copyCandidate(candidate, candidate.validationStatus(), candidate.matchCount(), candidate.validationMessage(), candidate.screenshotBase64(), false, candidate.notRecommendedReason() == null ? reason : candidate.notRecommendedReason(), candidate.candidateSource(), reason);
    }

    private WebUiElementCollectCandidate withSaveMetadata(
            WebUiElementCollectCandidate candidate,
            String candidateSource,
            String saveBlockedReason,
            Boolean recommendedToSave,
            String notRecommendedReason
    ) {
        return copyCandidate(candidate, candidate.validationStatus(), candidate.matchCount(), candidate.validationMessage(), candidate.screenshotBase64(), recommendedToSave, notRecommendedReason, candidateSource, saveBlockedReason);
    }

    private WebUiElementCollectCandidate validateCandidate(Page page, WebUiElementCollectCandidate candidate) {
        try {
            Locator locator = locatorSupport.resolve(page, candidate.locatorType(), candidate.locatorValue());
            int count = locator.count();
            byte[] screenshot = null;
            if (count > 0) {
                locator.first().scrollIntoViewIfNeeded();
                screenshot = page.screenshot();
            }
            String status = count == 1 ? "PASSED" : count > 1 ? "MULTIPLE" : "FAILED";
            String message = count == 1
                    ? "定位器验证通过"
                    : count > 1 ? "定位器匹配到多个元素，建议人工确认唯一性" : "未找到匹配元素";
            return withValidation(candidate, status, count, message, screenshot);
        } catch (RuntimeException exception) {
            return withValidation(candidate, "FAILED", 0, readableError(exception), null);
        }
    }

    private WebUiElementCollectCandidate withValidation(
            WebUiElementCollectCandidate candidate,
            String validationStatus,
            Integer matchCount,
            String validationMessage,
            byte[] screenshot
    ) {
        return new WebUiElementCollectCandidate(
                normalizeStandardGroupName(candidate.groupName()),
                candidate.elementName(),
                candidate.locatorType(),
                candidate.locatorValue(),
                candidate.framePath(),
                candidate.shadowPath(),
                candidate.locatorCandidates(),
                candidate.confidence(),
                candidate.reason(),
                candidate.tagName(),
                candidate.elementType(),
                candidate.text(),
                candidate.placeholder(),
                candidate.ariaLabel(),
                candidate.labelText(),
                candidate.nearbyHeading(),
                candidate.businessMeaning(),
                candidate.recommendedToSave(),
                candidate.notRecommendedReason(),
                candidate.maintenanceSuggestion(),
                candidate.stabilityNote(),
                validationStatus,
                matchCount,
                validationMessage,
                screenshot == null ? null : Base64.getEncoder().encodeToString(screenshot),
                blankToNull(candidate.candidateSource()) == null ? "RULE" : candidate.candidateSource(),
                candidate.saveBlockedReason()
        );
    }

    private WebUiElementCollectCandidate copyCandidate(
            WebUiElementCollectCandidate candidate,
            String validationStatus,
            Integer matchCount,
            String validationMessage,
            String screenshotBase64,
            Boolean recommendedToSave,
            String notRecommendedReason,
            String candidateSource,
            String saveBlockedReason
    ) {
        return new WebUiElementCollectCandidate(
                normalizeStandardGroupName(candidate.groupName()),
                candidate.elementName(),
                candidate.locatorType(),
                candidate.locatorValue(),
                candidate.framePath(),
                candidate.shadowPath(),
                candidate.locatorCandidates(),
                candidate.confidence(),
                candidate.reason(),
                candidate.tagName(),
                candidate.elementType(),
                candidate.text(),
                candidate.placeholder(),
                candidate.ariaLabel(),
                candidate.labelText(),
                candidate.nearbyHeading(),
                candidate.businessMeaning(),
                recommendedToSave,
                notRecommendedReason,
                candidate.maintenanceSuggestion(),
                candidate.stabilityNote(),
                validationStatus,
                matchCount,
                validationMessage,
                screenshotBase64,
                blankToNull(candidateSource) == null ? "RULE" : candidateSource,
                saveBlockedReason
        );
    }

    private void addCandidate(Map<String, WebUiElementCollectCandidate> candidates, WebUiElementCollectCandidate candidate) {
        if (blankToNull(candidate.elementName()) == null || blankToNull(candidate.locatorValue()) == null) {
            return;
        }
        String key = candidate.locatorType() + "::" + candidate.locatorValue();
        candidates.putIfAbsent(key, candidate);
    }

    private String locatorKey(String locatorType, String locatorValue) {
        String normalizedType = blankToNull(locatorType);
        String normalizedValue = blankToNull(locatorValue);
        if (normalizedType == null || normalizedValue == null) {
            return null;
        }
        return normalizedType.toUpperCase(Locale.ROOT) + "::" + normalizedValue;
    }

    private String labelText(Document document, Element element) {
        String id = attr(element, "id");
        if (id != null) {
            Element label = document.selectFirst("label[for=\"" + cssAttributeEscape(id) + "\"]");
            if (label != null) {
                return label.text();
            }
        }
        Element parent = element.parent();
        if (parent != null && "label".equalsIgnoreCase(parent.tagName())) {
            return parent.text();
        }
        return null;
    }

    private String firstHeadingText(Element element) {
        Element heading = element.selectFirst("h1, h2, h3, h4, .el-dialog__title, .modal-title");
        return heading == null ? null : heading.text();
    }

    private String nearbyHeadingText(Element element) {
        Element current = element;
        while (current != null) {
            Element previousHeading = current.previousElementSibling();
            while (previousHeading != null) {
                if (previousHeading.is("h1, h2, h3, h4, .el-dialog__title, .modal-title")) {
                    return blankToNull(previousHeading.text());
                }
                previousHeading = previousHeading.previousElementSibling();
            }
            Element parent = current.parent();
            if (parent != null) {
                String heading = firstHeadingText(parent);
                if (blankToNull(heading) != null) {
                    return heading;
                }
            }
            current = parent;
        }
        return null;
    }

    private String maintenanceSuggestion(String locatorType, Integer confidence) {
        if ("TEST_ID".equalsIgnoreCase(locatorType)) {
            return "优先保留测试属性，适合长期维护";
        }
        if (confidence != null && confidence >= 85) {
            return "当前定位器较稳定，建议保存前确认页面唯一性";
        }
        return "建议研发补充 data-testid，或人工优化为更唯一的定位器";
    }

    private String firstAttr(Element element, String... names) {
        for (String name : names) {
            String value = attr(element, name);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String attr(Element element, String name) {
        return blankToNull(element.attr(name));
    }

    private String readableText(Element element) {
        String text = element.ownText();
        if (blankToNull(text) != null) {
            return text.trim();
        }
        return element.text();
    }

    private String readableName(String... values) {
        for (String value : values) {
            String normalized = blankToNull(value);
            if (normalized != null) {
                return cleanupName(normalized);
            }
        }
        return "未命名";
    }

    private String cleanupName(String value) {
        String normalized = value.replaceAll("\\s+", "");
        normalized = normalized.replace("请输入", "").replace("请填写", "").replace("请选择", "");
        normalized = normalized.replaceAll("[#._-]+", "");
        return normalized.isBlank() ? "未命名" : normalized;
    }

    private String suffixName(String name, String suffix) {
        if (name.endsWith(suffix)) {
            return name;
        }
        return name + suffix;
    }

    private String controlSuffix(Element element) {
        String tagName = element.tagName().toLowerCase(Locale.ROOT);
        if ("select".equals(tagName)) {
            return "下拉框";
        }
        if ("textarea".equals(tagName)) {
            return "文本域";
        }
        return "输入框";
    }

    private String firstStableClass(Element element) {
        List<String> classes = new ArrayList<>(element.classNames());
        return classes.stream()
                .filter(value -> !value.startsWith("is-"))
                .filter(value -> !value.startsWith("has-"))
                .filter(value -> !value.matches(".*\\d{3,}.*"))
                .filter(value -> CSS_IDENTIFIER.matcher(value).matches())
                .findFirst()
                .orElse(null);
    }

    private boolean scopeMatches(String scope, String target) {
        return "ALL".equals(scope) || target.equals(scope);
    }

    private String normalizeScope(String scope) {
        String normalized = blankToNull(scope);
        if (normalized == null) {
            return "ALL";
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private String cssAttributeEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String readableError(RuntimeException exception) {
        String message = blankToNull(exception.getMessage());
        if (message == null) {
            return "浏览器无法打开页面";
        }
        return message.length() > 300 ? message.substring(0, 300) : message;
    }

    private BrowserType browserType(Playwright playwright, String browserType) {
        return switch (normalizeBrowserType(browserType)) {
            case "FIREFOX" -> playwright.firefox();
            case "WEBKIT" -> playwright.webkit();
            default -> playwright.chromium();
        };
    }

    private record LocatorSuggestion(String type, String value, int confidence, String reason) {
    }

    private record LocalRunnerCandidateProcessResult(
            List<WebUiElementCollectCandidate> candidates,
            WebUiElementCollectFilterSummary filterSummary,
            List<WebUiElementCollectFilterDetail> filterDetails
    ) {
    }
}
