package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiRunHistoryDomainService {

    private static final String RESULT_PASSED = "PASSED";
    private static final String RESULT_NOT_PASSED = "NOT_PASSED";
    private static final String RESULT_NO_ASSERTION = "NO_ASSERTION";
    private static final String RESULT_FAILED = "FAILED";

    private final ApiDefinitionCaseMapper caseMapper;
    private final ApiDefinitionCaseChangeHistoryMapper caseChangeHistoryMapper;
    private final ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper;
    private final ApiRunStepResultMapper runStepResultMapper;
    private final ReportMapper reportMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiRunHistoryDomainService(
            ApiDefinitionCaseMapper caseMapper,
            ApiDefinitionCaseChangeHistoryMapper caseChangeHistoryMapper,
            ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper,
            ApiRunStepResultMapper runStepResultMapper,
            ReportMapper reportMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.caseMapper = caseMapper;
        this.caseChangeHistoryMapper = caseChangeHistoryMapper;
        this.caseRunHistoryMapper = caseRunHistoryMapper;
        this.runStepResultMapper = runStepResultMapper;
        this.reportMapper = reportMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiDefinitionCaseChangeHistoryItem> listCaseChangeHistory(Long caseId, String workspaceCode) {
        ApiDefinitionCaseEntity apiCase = requireCase(caseId);
        workspaceScopeSupport.validateReadable(apiCase.getWorkspaceId(), workspaceCode, "Current workspace cannot access the case");
        List<ApiDefinitionCaseChangeHistoryItem> items = caseChangeHistoryMapper.selectList(new LambdaQueryWrapper<ApiDefinitionCaseChangeHistoryEntity>()
                        .eq(ApiDefinitionCaseChangeHistoryEntity::getCaseId, caseId)
                        .orderByDesc(ApiDefinitionCaseChangeHistoryEntity::getCreatedAt))
                .stream()
                .map(this::toCaseChangeHistoryItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public PageResponse<ApiDefinitionCaseRunHistoryItem> listCaseRunHistory(Long caseId, String workspaceCode) {
        ApiDefinitionCaseEntity apiCase = requireCase(caseId);
        workspaceScopeSupport.validateReadable(apiCase.getWorkspaceId(), workspaceCode, "Current workspace cannot access the case");
        List<ApiDefinitionCaseRunHistoryEntity> histories = caseRunHistoryMapper.selectList(new LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity>()
                        .eq(ApiDefinitionCaseRunHistoryEntity::getCaseId, caseId)
                        .orderByDesc(ApiDefinitionCaseRunHistoryEntity::getCreatedAt));
        Map<Long, List<ApiRunStepResultResponse>> stepResultsByReportId = loadStepResultsByReportId(histories);
        List<ApiDefinitionCaseRunHistoryItem> items = histories.stream()
                .map(history -> toCaseRunHistoryItem(history, stepResultsByReportId))
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ApiDefinitionCaseRunHistoryDetail getCaseRunHistoryDetail(Long historyId, String workspaceCode) {
        ApiDefinitionCaseRunHistoryEntity history = requireCaseRunHistory(historyId);
        workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the case run history");
        return toCaseRunHistoryDetail(history);
    }

    public List<ApiRunStepResultResponse> listReportSteps(Long reportId, String workspaceCode) {
        ReportEntity report = requireReport(reportId);
        workspaceScopeSupport.validateReadable(report.getWorkspaceId(), workspaceCode, "Current workspace cannot access the report");
        return runStepResultMapper.selectList(new LambdaQueryWrapper<ApiRunStepResultEntity>()
                        .eq(ApiRunStepResultEntity::getReportId, reportId)
                        .orderByAsc(ApiRunStepResultEntity::getStepOrder))
                .stream()
                .map(this::toRunStepResponse)
                .toList();
    }

    private ApiDefinitionCaseChangeHistoryItem toCaseChangeHistoryItem(ApiDefinitionCaseChangeHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiDefinitionCaseChangeHistoryItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getCaseId(),
                entity.getDefinitionId(),
                entity.getCaseName(),
                entity.getChangeType(),
                entity.getChangeSummary(),
                entity.getOperatorId(),
                entity.getOperatorName(),
                entity.getCreatedAt()
        );
    }

    private ApiDefinitionCaseRunHistoryItem toCaseRunHistoryItem(
            ApiDefinitionCaseRunHistoryEntity entity,
            Map<Long, List<ApiRunStepResultResponse>> stepResultsByReportId
    ) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        List<ApiRunStepResultResponse> stepResults = stepResultsByReportId.getOrDefault(entity.getReportId(), List.of());
        return new ApiDefinitionCaseRunHistoryItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getCaseId(),
                entity.getDefinitionId(),
                entity.getCaseName(),
                entity.getReportId(),
                resolveCaseRunDisplayResult(entity.getRunResult(), stepResults),
                entity.getFailureSummary(),
                entity.getStatusCode(),
                entity.getDurationMs(),
                entity.getResponseSize(),
                entity.getEnvironmentId(),
                entity.getEnvironmentName(),
                entity.getVariableSetId(),
                entity.getVariableSetName(),
                entity.getOperatorName(),
                entity.getCreatedAt()
        );
    }

    private ApiDefinitionCaseRunHistoryDetail toCaseRunHistoryDetail(ApiDefinitionCaseRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        List<ApiRunStepResultResponse> stepResults = listRunStepResponses(entity.getReportId());
        return new ApiDefinitionCaseRunHistoryDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getCaseId(),
                entity.getDefinitionId(),
                entity.getCaseName(),
                entity.getReportId(),
                resolveCaseRunDisplayResult(entity.getRunResult(), stepResults),
                entity.getFailureSummary(),
                entity.getStatusCode(),
                entity.getDurationMs(),
                entity.getResponseSize(),
                entity.getEnvironmentId(),
                entity.getEnvironmentName(),
                entity.getVariableSetId(),
                entity.getVariableSetName(),
                entity.getOperatorName(),
                entity.getCreatedAt(),
                entity.getContextSnapshotJson(),
                stepResults
        );
    }

    private ApiRunStepResultResponse toRunStepResponse(ApiRunStepResultEntity entity) {
        return new ApiRunStepResultResponse(
                entity.getId(),
                entity.getReportId(),
                entity.getStepOrder(),
                entity.getStepName(),
                entity.getDefinitionId(),
                Boolean.TRUE.equals(entity.getSuccess()),
                entity.getDurationMs(),
                ApiAutomationJsonSupport.read(entity.getRequestSnapshotJson(), ApiRequestSnapshot.class, null),
                ApiAutomationJsonSupport.read(entity.getResponseSnapshotJson(), ApiResponseSnapshot.class, null),
                readAssertionResults(entity.getAssertionResultsJson()),
                readExtractionResults(entity.getExtractionResultsJson()),
                readProcessorResults(entity.getProcessorResultsJson()),
                entity.getErrorMessage(),
                entity.getCreatedAt()
        );
    }

    private List<ApiRunStepResultResponse> listRunStepResponses(Long reportId) {
        if (reportId == null) {
            return List.of();
        }
        return runStepResultMapper.selectList(new LambdaQueryWrapper<ApiRunStepResultEntity>()
                        .eq(ApiRunStepResultEntity::getReportId, reportId)
                        .orderByAsc(ApiRunStepResultEntity::getStepOrder))
                .stream()
                .map(this::toRunStepResponse)
                .toList();
    }

    private Map<Long, List<ApiRunStepResultResponse>> loadStepResultsByReportId(
            List<ApiDefinitionCaseRunHistoryEntity> histories
    ) {
        List<Long> reportIds = histories.stream()
                .map(ApiDefinitionCaseRunHistoryEntity::getReportId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (reportIds.isEmpty()) {
            return Map.of();
        }
        return runStepResultMapper.selectList(new LambdaQueryWrapper<ApiRunStepResultEntity>()
                        .in(ApiRunStepResultEntity::getReportId, reportIds)
                        .orderByAsc(ApiRunStepResultEntity::getReportId)
                        .orderByAsc(ApiRunStepResultEntity::getStepOrder))
                .stream()
                .map(this::toRunStepResponse)
                .collect(Collectors.groupingBy(ApiRunStepResultResponse::reportId));
    }

    private String resolveCaseRunDisplayResult(String runResult, List<ApiRunStepResultResponse> stepResults) {
        List<ApiAssertionResult> assertionResults = stepResults.stream()
                .flatMap(step -> defaultList(step.assertionResults()).stream())
                .toList();
        if (!assertionResults.isEmpty()) {
            if (assertionResults.stream().anyMatch(assertion -> !assertion.success())) {
                return RESULT_NOT_PASSED;
            }
            if (hasExecutionFailure(runResult, stepResults)) {
                return RESULT_FAILED;
            }
            return RESULT_PASSED;
        }
        return hasExecutionFailure(runResult, stepResults) ? RESULT_FAILED : RESULT_NO_ASSERTION;
    }

    private boolean hasExecutionFailure(String runResult, List<ApiRunStepResultResponse> stepResults) {
        return isFailedRunResult(runResult)
                || stepResults.stream().anyMatch(step -> !step.success() || (step.errorMessage() != null && !step.errorMessage().isBlank()));
    }

    private boolean isFailedRunResult(String runResult) {
        String normalized = Optional.ofNullable(runResult).orElse("").trim().toUpperCase(Locale.ROOT);
        return normalized.contains("FAIL") || normalized.contains("ERROR");
    }

    private ApiDefinitionCaseEntity requireCase(Long id) {
        ApiDefinitionCaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API case not found");
        }
        return entity;
    }

    private ApiDefinitionCaseRunHistoryEntity requireCaseRunHistory(Long id) {
        ApiDefinitionCaseRunHistoryEntity entity = caseRunHistoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API case run history not found");
        }
        return entity;
    }

    private ReportEntity requireReport(Long id) {
        ReportEntity entity = reportMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Report not found");
        }
        return entity;
    }

    private List<ApiAssertionResult> readAssertionResults(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private List<ApiExtractionResult> readExtractionResults(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private List<ApiProcessorResult> readProcessorResults(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private <T> List<T> defaultList(List<T> values) {
        return values == null ? List.of() : values;
    }
}
