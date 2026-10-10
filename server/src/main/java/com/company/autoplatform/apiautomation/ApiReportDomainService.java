package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.ReportMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiReportDomainService {

    private static final String OBJECT_TYPE_CASE = "API_CASE";
    private static final String OBJECT_TYPE_SCENARIO = "SCENARIO";
    private static final String OBJECT_TYPE_SUITE = "SUITE";
    private static final String CASE_KEY_PREFIX = "API_CASE:";
    private static final String SCENARIO_KEY_PREFIX = "SCENARIO:";
    private static final String SUITE_KEY_PREFIX = "SUITE:";

    private final ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper;
    private final ApiScenarioRunHistoryMapper scenarioRunHistoryMapper;
    private final ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper;
    private final ApiRunStepResultMapper runStepResultMapper;
    private final ReportMapper reportMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiReportDomainService(
            ApiDefinitionCaseRunHistoryMapper caseRunHistoryMapper,
            ApiScenarioRunHistoryMapper scenarioRunHistoryMapper,
            ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper,
            ApiRunStepResultMapper runStepResultMapper,
            ReportMapper reportMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.caseRunHistoryMapper = caseRunHistoryMapper;
        this.scenarioRunHistoryMapper = scenarioRunHistoryMapper;
        this.suiteRunHistoryMapper = suiteRunHistoryMapper;
        this.runStepResultMapper = runStepResultMapper;
        this.reportMapper = reportMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiAutomationReportItem> listReports(
            String workspaceCode,
            String objectType,
            String result,
            String keyword,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Boolean archived,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 100);
        ReportPage reportPage = findReportPage(new ReportQuery(
                workspaceCode,
                objectType,
                result,
                keyword,
                createdFrom,
                createdTo,
                archived
        ), safePageNo, safePageSize);
        return PageResponse.of(reportPage.items(), reportPage.total(), safePageNo, safePageSize);
    }

    public ApiAutomationReportAnalysis analyzeReports(
            String workspaceCode,
            String objectType,
            String result,
            String keyword,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Boolean archived
    ) {
        List<ApiAutomationReportItem> items = findReports(new ReportQuery(
                workspaceCode,
                objectType,
                result,
                keyword,
                createdFrom,
                createdTo,
                archived
        ));
        long totalCount = items.size();
        long failedCount = items.stream().filter(item -> !isSuccessLike(item.result())).count();
        long passedCount = items.stream().filter(item -> isSuccessLike(item.result())).count();
        long skippedCount = items.stream()
                .map(ApiAutomationReportItem::skippedCount)
                .filter(value -> value != null && value > 0)
                .mapToLong(Integer::longValue)
                .sum();
        Long averageDurationMs = items.stream()
                .map(ApiAutomationReportItem::durationMs)
                .filter(value -> value != null && value >= 0)
                .mapToLong(Long::longValue)
                .average()
                .stream()
                .mapToLong(Math::round)
                .boxed()
                .findFirst()
                .orElse(null);
        List<ApiAutomationReportItem> failedItems = items.stream()
                .filter(item -> !isSuccessLike(item.result()))
                .toList();
        return new ApiAutomationReportAnalysis(
                totalCount,
                passedCount,
                failedCount,
                skippedCount,
                totalCount == 0 ? 0.0 : (double) failedCount / totalCount,
                averageDurationMs,
                topFailureReasons(failedItems),
                topFailedObjects(failedItems),
                failedItems.stream().limit(10).toList()
        );
    }

    public ApiAutomationReportStatistics getReportStatistics(
            String workspaceCode,
            String objectType,
            String result,
            String keyword,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Boolean archived
    ) {
        List<ApiAutomationReportItem> items = findReports(new ReportQuery(
                workspaceCode,
                objectType,
                result,
                keyword,
                createdFrom,
                createdTo,
                archived
        ));
        return new ApiAutomationReportStatistics(
                trendPoints(items),
                resultDistribution(items),
                objectTypeDistribution(items),
                slowestRuns(items)
        );
    }

    public ApiAutomationReportDetail getReportDetail(String reportKey, String workspaceCode) {
        if (reportKey == null || reportKey.isBlank()) {
            throw new BadRequestException("Report key cannot be blank");
        }
        if (reportKey.startsWith(CASE_KEY_PREFIX)) {
            ApiDefinitionCaseRunHistoryEntity history = requireCaseHistory(parseHistoryId(reportKey, CASE_KEY_PREFIX));
            workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the report");
            return toCaseReportDetail(history);
        }
        if (reportKey.startsWith(SCENARIO_KEY_PREFIX)) {
            ApiScenarioRunHistoryEntity history = requireScenarioHistory(parseHistoryId(reportKey, SCENARIO_KEY_PREFIX));
            workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the report");
            return toScenarioReportDetail(history);
        }
        if (reportKey.startsWith(SUITE_KEY_PREFIX)) {
            ApiExecutionSuiteRunHistoryEntity history = requireSuiteHistory(parseHistoryId(reportKey, SUITE_KEY_PREFIX));
            workspaceScopeSupport.validateReadable(history.getWorkspaceId(), workspaceCode, "Current workspace cannot access the report");
            return toSuiteReportDetail(history);
        }
        throw new BadRequestException("Unsupported report key");
    }

    public String exportReportsCsv(
            String workspaceCode,
            String objectType,
            String result,
            String keyword,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Boolean archived
    ) {
        List<ApiAutomationReportItem> items = findReports(new ReportQuery(
                workspaceCode,
                objectType,
                result,
                keyword,
                createdFrom,
                createdTo,
                archived
        ));
        StringBuilder builder = new StringBuilder();
        builder.append("reportKey,objectType,result,objectName,reportName,totalCount,successCount,failedCount,durationMs,environmentName,variableSetName,operatorName,createdAt,archived,failureSummary\n");
        for (ApiAutomationReportItem item : items) {
            appendCsvRow(builder,
                    item.reportKey(),
                    item.objectType(),
                    item.result(),
                    item.objectName(),
                    item.reportName(),
                    item.totalCount(),
                    item.successCount(),
                    item.failedCount(),
                    item.durationMs(),
                    item.environmentName(),
                    item.variableSetName(),
                    item.operatorName(),
                    item.createdAt(),
                    Boolean.TRUE.equals(item.archived()),
                    item.failureSummary()
            );
        }
        return builder.toString();
    }

    public ApiAutomationReportDetail archiveReport(String reportKey, String workspaceCode) {
        ApiAutomationReportDetail detail = getReportDetail(reportKey, workspaceCode);
        if (detail.reportId() == null) {
            throw new BadRequestException("Report id cannot be blank");
        }
        ReportEntity report = reportMapper.selectById(detail.reportId());
        if (report == null) {
            throw new NotFoundException("Report not found");
        }
        workspaceScopeSupport.validateReadable(report.getWorkspaceId(), workspaceCode, "Current workspace cannot archive the report");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(report.getWorkspaceId()).getWorkspaceCode());
        report.setArchived(true);
        report.setUpdatedAt(LocalDateTime.now());
        reportMapper.updateById(report);
        return getReportDetail(reportKey, workspaceCode);
    }

    private List<ApiDefinitionCaseRunHistoryEntity> listCaseReportEntities(String workspaceCode) {
        LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiDefinitionCaseRunHistoryEntity::getWorkspaceId, workspaceCode);
        return caseRunHistoryMapper.selectList(query.orderByDesc(ApiDefinitionCaseRunHistoryEntity::getCreatedAt)
                        .orderByDesc(ApiDefinitionCaseRunHistoryEntity::getId));
    }

    private List<ApiExecutionSuiteRunHistoryEntity> listSuiteReportEntities(String workspaceCode) {
        LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiExecutionSuiteRunHistoryEntity::getWorkspaceId, workspaceCode);
        return suiteRunHistoryMapper.selectList(query.orderByDesc(ApiExecutionSuiteRunHistoryEntity::getCreatedAt)
                        .orderByDesc(ApiExecutionSuiteRunHistoryEntity::getId));
    }

    private List<ApiScenarioRunHistoryEntity> listScenarioReportEntities(String workspaceCode) {
        LambdaQueryWrapper<ApiScenarioRunHistoryEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiScenarioRunHistoryEntity::getWorkspaceId, workspaceCode);
        return scenarioRunHistoryMapper.selectList(query.orderByDesc(ApiScenarioRunHistoryEntity::getCreatedAt)
                        .orderByDesc(ApiScenarioRunHistoryEntity::getId));
    }

    private ReportPage findReportPage(ReportQuery query, int pageNo, int pageSize) {
        String normalizedType = normalizeObjectType(query.objectType());
        long candidateSize = Math.min((long) pageNo * pageSize, Integer.MAX_VALUE);
        long offset = (long) (pageNo - 1) * pageSize;
        List<ApiDefinitionCaseRunHistoryEntity> caseEntities = List.of();
        List<ApiScenarioRunHistoryEntity> scenarioEntities = List.of();
        List<ApiExecutionSuiteRunHistoryEntity> suiteEntities = List.of();
        long total = 0;
        if (normalizedType == null || OBJECT_TYPE_CASE.equals(normalizedType)) {
            total += caseRunHistoryMapper.selectCount(buildCaseReportCountQuery(query));
            caseEntities = caseRunHistoryMapper.selectPage(new Page<>(1, candidateSize, false), buildCaseReportQuery(query))
                    .getRecords();
        }
        if (normalizedType == null || OBJECT_TYPE_SCENARIO.equals(normalizedType)) {
            total += scenarioRunHistoryMapper.selectCount(buildScenarioReportCountQuery(query));
            scenarioEntities = scenarioRunHistoryMapper.selectPage(new Page<>(1, candidateSize, false), buildScenarioReportQuery(query))
                    .getRecords();
        }
        if (normalizedType == null || OBJECT_TYPE_SUITE.equals(normalizedType)) {
            total += suiteRunHistoryMapper.selectCount(buildSuiteReportCountQuery(query));
            suiteEntities = suiteRunHistoryMapper.selectPage(new Page<>(1, candidateSize, false), buildSuiteReportQuery(query))
                    .getRecords();
        }

        Map<Long, WorkspaceEntity> workspaces = workspaceService.listReadableWorkspaceEntities().stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, workspace -> workspace));
        List<Long> reportIds = new ArrayList<>();
        reportIds.addAll(caseEntities.stream().map(ApiDefinitionCaseRunHistoryEntity::getReportId).toList());
        reportIds.addAll(scenarioEntities.stream().map(ApiScenarioRunHistoryEntity::getReportId).toList());
        reportIds.addAll(suiteEntities.stream().map(ApiExecutionSuiteRunHistoryEntity::getReportId).toList());
        Map<Long, Boolean> archivedByReportId = loadArchivedByReportId(reportIds);
        List<ApiAutomationReportItem> items = new ArrayList<>();
        items.addAll(caseEntities.stream()
                .map(entity -> toCaseReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        items.addAll(scenarioEntities.stream()
                .map(entity -> toScenarioReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        items.addAll(suiteEntities.stream()
                .map(entity -> toSuiteReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        items = items.stream()
                .sorted(reportComparator())
                .skip(offset)
                .limit(pageSize)
                .toList();
        return new ReportPage(items, total);
    }

    private LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> buildCaseReportQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiDefinitionCaseRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "case_name", "run_result", "tb_api_definition_case_run_history");
        wrapper.orderByDesc(ApiDefinitionCaseRunHistoryEntity::getCreatedAt)
                .orderByDesc(ApiDefinitionCaseRunHistoryEntity::getId);
        return wrapper;
    }

    private LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> buildCaseReportCountQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiDefinitionCaseRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiDefinitionCaseRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "case_name", "run_result", "tb_api_definition_case_run_history");
        return wrapper;
    }

    private LambdaQueryWrapper<ApiScenarioRunHistoryEntity> buildScenarioReportQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiScenarioRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiScenarioRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "scenario_name", "result", "tb_api_scenario_run_history");
        wrapper.orderByDesc(ApiScenarioRunHistoryEntity::getCreatedAt)
                .orderByDesc(ApiScenarioRunHistoryEntity::getId);
        return wrapper;
    }

    private LambdaQueryWrapper<ApiScenarioRunHistoryEntity> buildScenarioReportCountQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiScenarioRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiScenarioRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "scenario_name", "result", "tb_api_scenario_run_history");
        return wrapper;
    }

    private LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> buildSuiteReportQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiExecutionSuiteRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "suite_name", "result", "tb_api_execution_suite_run_history");
        wrapper.orderByDesc(ApiExecutionSuiteRunHistoryEntity::getCreatedAt)
                .orderByDesc(ApiExecutionSuiteRunHistoryEntity::getId);
        return wrapper;
    }

    private LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> buildSuiteReportCountQuery(ReportQuery query) {
        LambdaQueryWrapper<ApiExecutionSuiteRunHistoryEntity> wrapper = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(wrapper, ApiExecutionSuiteRunHistoryEntity::getWorkspaceId, query.workspaceCode());
        applyCommonReportFilters(wrapper, query, "suite_name", "result", "tb_api_execution_suite_run_history");
        return wrapper;
    }

    private <T> void applyCommonReportFilters(
            LambdaQueryWrapper<T> wrapper,
            ReportQuery query,
            String objectNameColumn,
            String resultColumn,
            String tableName
    ) {
        String normalizedResult = blankToNull(query.result());
        if (normalizedResult != null) {
            wrapper.apply("UPPER(" + resultColumn + ") LIKE UPPER({0})", "%" + normalizedResult + "%");
        }
        String keyword = blankToNull(query.keyword());
        if (keyword != null) {
            String pattern = "%" + keyword.toUpperCase(Locale.ROOT) + "%";
            wrapper.apply("(UPPER(" + objectNameColumn + ") LIKE {0} OR UPPER(failure_summary) LIKE {0} OR UPPER(operator_name) LIKE {0} "
                    + "OR EXISTS (SELECT 1 FROM tb_exec_report r WHERE r.id = " + tableName + ".report_id AND UPPER(r.report_name) LIKE {0}))", pattern);
        }
        if (query.createdFrom() != null) {
            wrapper.apply("created_at >= {0}", query.createdFrom());
        }
        if (query.createdTo() != null) {
            wrapper.apply("created_at <= {0}", query.createdTo());
        }
        applyArchivedFilter(wrapper, query.archived(), tableName);
    }

    private <T> void applyArchivedFilter(LambdaQueryWrapper<T> wrapper, Boolean archived, String tableName) {
        boolean expectedArchived = archived != null && archived;
        if (expectedArchived) {
            wrapper.apply("EXISTS (SELECT 1 FROM tb_exec_report r WHERE r.id = " + tableName + ".report_id AND r.archived = {0})", true);
        } else {
            wrapper.apply("(" + tableName + ".report_id IS NULL OR NOT EXISTS (SELECT 1 FROM tb_exec_report r WHERE r.id = "
                    + tableName + ".report_id) OR EXISTS (SELECT 1 FROM tb_exec_report r WHERE r.id = "
                    + tableName + ".report_id AND (r.archived = {0} OR r.archived IS NULL)))", false);
        }
    }

    private ApiAutomationReportItem toCaseReportItem(ApiDefinitionCaseRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return toCaseReportItem(entity, workspace, isArchived(entity.getReportId()));
    }

    private ApiAutomationReportItem toCaseReportItem(
            ApiDefinitionCaseRunHistoryEntity entity,
            WorkspaceEntity workspace,
            boolean archived
    ) {
        return new ApiAutomationReportItem(
                CASE_KEY_PREFIX + entity.getId(),
                OBJECT_TYPE_CASE,
                entity.getId(),
                entity.getReportId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getCaseId(),
                entity.getCaseName(),
                entity.getCaseName(),
                entity.getRunResult(),
                entity.getFailureSummary(),
                1,
                isSuccessLike(entity.getRunResult()) ? 1 : 0,
                isSuccessLike(entity.getRunResult()) ? 0 : 1,
                0,
                entity.getStatusCode(),
                entity.getDurationMs(),
                entity.getResponseSize(),
                entity.getEnvironmentId(),
                entity.getEnvironmentName(),
                entity.getVariableSetId(),
                entity.getVariableSetName(),
                null,
                null,
                null,
                null,
                false,
                null,
                null,
                0,
                entity.getOperatorName(),
                entity.getCreatedAt(),
                archived
        );
    }

    private ApiAutomationReportItem toSuiteReportItem(ApiExecutionSuiteRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return toSuiteReportItem(entity, workspace, isArchived(entity.getReportId()));
    }

    private ApiAutomationReportItem toSuiteReportItem(
            ApiExecutionSuiteRunHistoryEntity entity,
            WorkspaceEntity workspace,
            boolean archived
    ) {
        return new ApiAutomationReportItem(
                SUITE_KEY_PREFIX + entity.getId(),
                OBJECT_TYPE_SUITE,
                entity.getId(),
                entity.getReportId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getSuiteId(),
                entity.getSuiteName(),
                entity.getSuiteName(),
                entity.getResult(),
                entity.getFailureSummary(),
                entity.getTotalCount(),
                entity.getSuccessCount(),
                entity.getFailedCount(),
                entity.getSkippedCount(),
                null,
                entity.getDurationMs(),
                null,
                entity.getEnvironmentId(),
                null,
                entity.getVariableSetId(),
                null,
                entity.getRunMode(),
                entity.getRunOn(),
                entity.getBranchName(),
                entity.getTriggerSource(),
                entity.getDataDrivenEnabled(),
                entity.getDataFileId(),
                entity.getDataFileName(),
                entity.getDataRowCount(),
                entity.getOperatorName(),
                entity.getCreatedAt(),
                archived
        );
    }

    private ApiAutomationReportItem toScenarioReportItem(ApiScenarioRunHistoryEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return toScenarioReportItem(entity, workspace, isArchived(entity.getReportId()));
    }

    private ApiAutomationReportItem toScenarioReportItem(
            ApiScenarioRunHistoryEntity entity,
            WorkspaceEntity workspace,
            boolean archived
    ) {
        return new ApiAutomationReportItem(
                SCENARIO_KEY_PREFIX + entity.getId(),
                OBJECT_TYPE_SCENARIO,
                entity.getId(),
                entity.getReportId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getScenarioId(),
                entity.getScenarioName(),
                entity.getScenarioName(),
                entity.getResult(),
                entity.getFailureSummary(),
                entity.getTotalCount(),
                entity.getSuccessCount(),
                entity.getFailedCount(),
                entity.getSkippedCount(),
                null,
                entity.getDurationMs(),
                null,
                entity.getEnvironmentId(),
                null,
                entity.getVariableSetId(),
                null,
                null,
                null,
                null,
                null,
                entity.getTestDatasetId() != null,
                entity.getTestDatasetId(),
                entity.getTestDatasetName(),
                entity.getDataIterationJson() == null ? 0 : readDataIterations(entity.getDataIterationJson()).size(),
                entity.getOperatorName(),
                entity.getCreatedAt(),
                archived
        );
    }

    private ApiAutomationReportDetail toCaseReportDetail(ApiDefinitionCaseRunHistoryEntity entity) {
        ApiAutomationReportItem item = toCaseReportItem(entity);
        return new ApiAutomationReportDetail(
                item.reportKey(),
                item.objectType(),
                item.historyId(),
                item.reportId(),
                item.workspaceCode(),
                item.workspaceName(),
                item.objectId(),
                item.objectName(),
                item.reportName(),
                item.result(),
                item.failureSummary(),
                item.totalCount(),
                item.successCount(),
                item.failedCount(),
                item.skippedCount(),
                item.statusCode(),
                item.durationMs(),
                item.responseSize(),
                item.environmentId(),
                item.environmentName(),
                item.variableSetId(),
                item.variableSetName(),
                item.runMode(),
                item.runOn(),
                null,
                null,
                null,
                null,
                item.branchName(),
                item.triggerSource(),
                item.dataDrivenEnabled(),
                item.dataFileId(),
                item.dataFileName(),
                item.dataRowCount(),
                item.operatorName(),
                item.createdAt(),
                item.archived(),
                entity.getContextSnapshotJson(),
                List.of(),
                List.of(),
                listRunStepResponses(entity.getReportId())
        );
    }

    private ApiAutomationReportDetail toSuiteReportDetail(ApiExecutionSuiteRunHistoryEntity entity) {
        ApiAutomationReportItem item = toSuiteReportItem(entity);
        return new ApiAutomationReportDetail(
                item.reportKey(),
                item.objectType(),
                item.historyId(),
                item.reportId(),
                item.workspaceCode(),
                item.workspaceName(),
                item.objectId(),
                item.objectName(),
                item.reportName(),
                item.result(),
                item.failureSummary(),
                item.totalCount(),
                item.successCount(),
                item.failedCount(),
                item.skippedCount(),
                item.statusCode(),
                item.durationMs(),
                item.responseSize(),
                item.environmentId(),
                item.environmentName(),
                item.variableSetId(),
                item.variableSetName(),
                item.runMode(),
                item.runOn(),
                entity.getContinueOnFailure(),
                entity.getGlobalTimeoutMs(),
                entity.getStepFailureRetryCount(),
                entity.getDefaultStepWaitMs(),
                item.branchName(),
                item.triggerSource(),
                item.dataDrivenEnabled(),
                item.dataFileId(),
                item.dataFileName(),
                item.dataRowCount(),
                item.operatorName(),
                item.createdAt(),
                item.archived(),
                entity.getContextSnapshotJson(),
                readSuiteDataIterations(entity.getDataIterationJson()),
                readSuiteItemSnapshots(entity.getItemSnapshotJson()),
                readSuiteStepResults(entity)
        );
    }

    private ApiAutomationReportDetail toScenarioReportDetail(ApiScenarioRunHistoryEntity entity) {
        ApiAutomationReportItem item = toScenarioReportItem(entity);
        return new ApiAutomationReportDetail(
                item.reportKey(),
                item.objectType(),
                item.historyId(),
                item.reportId(),
                item.workspaceCode(),
                item.workspaceName(),
                item.objectId(),
                item.objectName(),
                item.reportName(),
                item.result(),
                item.failureSummary(),
                item.totalCount(),
                item.successCount(),
                item.failedCount(),
                item.skippedCount(),
                item.statusCode(),
                item.durationMs(),
                item.responseSize(),
                item.environmentId(),
                item.environmentName(),
                item.variableSetId(),
                item.variableSetName(),
                item.runMode(),
                item.runOn(),
                null,
                null,
                null,
                null,
                item.branchName(),
                item.triggerSource(),
                item.dataDrivenEnabled(),
                item.dataFileId(),
                item.dataFileName(),
                item.dataRowCount(),
                item.operatorName(),
                item.createdAt(),
                item.archived(),
                entity.getContextSnapshotJson(),
                readDataIterations(entity.getDataIterationJson()),
                List.of(),
                readStepResults(entity.getDetailJson(), entity.getReportId())
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
                ApiAutomationJsonSupport.readList(entity.getAssertionResultsJson(), new TypeReference<>() {
                }, List.of()),
                ApiAutomationJsonSupport.readList(entity.getExtractionResultsJson(), new TypeReference<>() {
                }, List.of()),
                ApiAutomationJsonSupport.readList(entity.getProcessorResultsJson(), new TypeReference<>() {
                }, List.of()),
                entity.getErrorMessage(),
                entity.getCreatedAt()
        );
    }

    private List<ApiExecutionSuiteRunItemSnapshot> readSuiteItemSnapshots(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private List<ApiExecutionSuiteDataIteration> readSuiteDataIterations(String json) {
        return readDataIterations(json);
    }

    private List<ApiRunStepResultResponse> readSuiteStepResults(ApiExecutionSuiteRunHistoryEntity entity) {
        return readStepResults(entity.getDetailJson(), entity.getReportId());
    }

    private List<ApiExecutionSuiteDataIteration> readDataIterations(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private List<ApiRunStepResultResponse> readStepResults(String json, Long reportId) {
        List<ApiRunStepResultResponse> storedSteps = ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
        if (!storedSteps.isEmpty()) {
            return storedSteps;
        }
        return listRunStepResponses(reportId);
    }

    private ApiDefinitionCaseRunHistoryEntity requireCaseHistory(Long id) {
        ApiDefinitionCaseRunHistoryEntity entity = caseRunHistoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("API case report not found");
        }
        return entity;
    }

    private ApiExecutionSuiteRunHistoryEntity requireSuiteHistory(Long id) {
        ApiExecutionSuiteRunHistoryEntity entity = suiteRunHistoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Execution suite report not found");
        }
        return entity;
    }

    private ApiScenarioRunHistoryEntity requireScenarioHistory(Long id) {
        ApiScenarioRunHistoryEntity entity = scenarioRunHistoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Scenario report not found");
        }
        return entity;
    }

    private Long parseHistoryId(String reportKey, String prefix) {
        try {
            return Long.parseLong(reportKey.substring(prefix.length()));
        } catch (RuntimeException exception) {
            throw new BadRequestException("Invalid report key");
        }
    }

    private String normalizeObjectType(String objectType) {
        String normalized = blankToNull(objectType);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case OBJECT_TYPE_CASE, "CASE" -> OBJECT_TYPE_CASE;
            case OBJECT_TYPE_SCENARIO, "API_SCENARIO" -> OBJECT_TYPE_SCENARIO;
            case OBJECT_TYPE_SUITE, "EXECUTION_SUITE" -> OBJECT_TYPE_SUITE;
            default -> throw new BadRequestException("Unsupported report object type");
        };
    }

    private boolean containsIgnoreCase(String value, String expectedLowerCase) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(expectedLowerCase);
    }

    private boolean isSuccessLike(String result) {
        String normalized = result == null ? "" : result.toUpperCase(Locale.ROOT);
        return normalized.contains("SUCCESS") || normalized.contains("PASS") || normalized.contains("DONE");
    }

    private List<ApiAutomationReportItem> findReports(ReportQuery query) {
        List<ApiDefinitionCaseRunHistoryEntity> caseEntities = List.of();
        List<ApiScenarioRunHistoryEntity> scenarioEntities = List.of();
        List<ApiExecutionSuiteRunHistoryEntity> suiteEntities = List.of();
        List<ApiAutomationReportItem> items = new ArrayList<>();
        String normalizedType = normalizeObjectType(query.objectType());
        if (normalizedType == null || OBJECT_TYPE_CASE.equals(normalizedType)) {
            caseEntities = listCaseReportEntities(query.workspaceCode());
        }
        if (normalizedType == null || OBJECT_TYPE_SCENARIO.equals(normalizedType)) {
            scenarioEntities = listScenarioReportEntities(query.workspaceCode());
        }
        if (normalizedType == null || OBJECT_TYPE_SUITE.equals(normalizedType)) {
            suiteEntities = listSuiteReportEntities(query.workspaceCode());
        }
        Map<Long, WorkspaceEntity> workspaces = workspaceService.listReadableWorkspaceEntities().stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, workspace -> workspace));
        List<Long> reportIds = new ArrayList<>();
        reportIds.addAll(caseEntities.stream().map(ApiDefinitionCaseRunHistoryEntity::getReportId).toList());
        reportIds.addAll(scenarioEntities.stream().map(ApiScenarioRunHistoryEntity::getReportId).toList());
        reportIds.addAll(suiteEntities.stream().map(ApiExecutionSuiteRunHistoryEntity::getReportId).toList());
        List<Long> distinctReportIds = reportIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Boolean> archivedByReportId = distinctReportIds.isEmpty()
                ? Map.of()
                : reportMapper.selectBatchIds(distinctReportIds).stream()
                .collect(Collectors.toMap(ReportEntity::getId, report -> Boolean.TRUE.equals(report.getArchived())));
        items.addAll(caseEntities.stream()
                .map(entity -> toCaseReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        items.addAll(scenarioEntities.stream()
                .map(entity -> toScenarioReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        items.addAll(suiteEntities.stream()
                .map(entity -> toSuiteReportItem(entity, resolveWorkspace(workspaces, entity.getWorkspaceId()),
                        archivedByReportId.getOrDefault(entity.getReportId(), false)))
                .toList());
        String normalizedResult = blankToNull(query.result());
        if (normalizedResult != null) {
            String expected = normalizedResult.toUpperCase(Locale.ROOT);
            items = items.stream()
                    .filter(item -> item.result() != null && item.result().toUpperCase(Locale.ROOT).contains(expected))
                    .toList();
        }
        String normalizedKeyword = blankToNull(query.keyword());
        if (normalizedKeyword != null) {
            String expected = normalizedKeyword.toLowerCase(Locale.ROOT);
            items = items.stream()
                    .filter(item -> containsIgnoreCase(item.objectName(), expected)
                            || containsIgnoreCase(item.reportName(), expected)
                            || containsIgnoreCase(item.failureSummary(), expected)
                            || containsIgnoreCase(item.operatorName(), expected))
                    .toList();
        }
        if (query.createdFrom() != null) {
            items = items.stream()
                    .filter(item -> item.createdAt() != null && !item.createdAt().isBefore(query.createdFrom()))
                    .toList();
        }
        if (query.createdTo() != null) {
            items = items.stream()
                    .filter(item -> item.createdAt() != null && !item.createdAt().isAfter(query.createdTo()))
                    .toList();
        }
        Boolean archived = query.archived() == null ? Boolean.FALSE : query.archived();
        items = items.stream()
                .filter(item -> Boolean.TRUE.equals(item.archived()) == archived)
                .toList();
        return items.stream()
                .sorted(Comparator.comparing(ApiAutomationReportItem::createdAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed()
                        .thenComparing(ApiAutomationReportItem::historyId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private WorkspaceEntity resolveWorkspace(Map<Long, WorkspaceEntity> workspaces, Long workspaceId) {
        WorkspaceEntity workspace = workspaces.get(workspaceId);
        return workspace == null ? workspaceService.requireWorkspaceById(workspaceId) : workspace;
    }

    private Map<Long, Boolean> loadArchivedByReportId(List<Long> reportIds) {
        List<Long> distinctReportIds = reportIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (distinctReportIds.isEmpty()) {
            return Map.of();
        }
        return reportMapper.selectBatchIds(distinctReportIds).stream()
                .collect(Collectors.toMap(ReportEntity::getId, report -> Boolean.TRUE.equals(report.getArchived())));
    }

    private Comparator<ApiAutomationReportItem> reportComparator() {
        return Comparator.comparing(ApiAutomationReportItem::createdAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed()
                .thenComparing(ApiAutomationReportItem::historyId, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private List<ApiAutomationReportFailureBucket> topFailureReasons(List<ApiAutomationReportItem> failedItems) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (ApiAutomationReportItem item : failedItems) {
            String reason = failureReason(item);
            counts.put(reason, counts.getOrDefault(reason, 0L) + 1);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(entry -> new ApiAutomationReportFailureBucket(entry.getKey(), entry.getKey(), entry.getValue(), null))
                .toList();
    }

    private List<ApiAutomationReportFailureBucket> topFailedObjects(List<ApiAutomationReportItem> failedItems) {
        Map<String, FailedObjectAccumulator> counts = new LinkedHashMap<>();
        for (ApiAutomationReportItem item : failedItems) {
            String key = item.objectType() + ":" + item.objectId();
            FailedObjectAccumulator accumulator = counts.computeIfAbsent(key, ignored -> new FailedObjectAccumulator(item.objectName()));
            accumulator.count++;
            if (item.durationMs() != null) {
                accumulator.durationMs += item.durationMs();
            }
        }
        return counts.entrySet().stream()
                .sorted((left, right) -> Long.compare(right.getValue().count, left.getValue().count))
                .limit(5)
                .map(entry -> new ApiAutomationReportFailureBucket(
                        entry.getKey(),
                        entry.getValue().label,
                        entry.getValue().count,
                        entry.getValue().durationMs == 0 ? null : entry.getValue().durationMs
                ))
                .toList();
    }

    private String failureReason(ApiAutomationReportItem item) {
        String summary = blankToNull(item.failureSummary());
        if (summary != null) {
            return summary.length() > 120 ? summary.substring(0, 120) : summary;
        }
        if (item.statusCode() != null && item.statusCode() >= 400) {
            return "HTTP " + item.statusCode();
        }
        return "Execution failed";
    }

    private List<ApiAutomationReportTrendPoint> trendPoints(List<ApiAutomationReportItem> items) {
        Map<String, List<ApiAutomationReportItem>> grouped = items.stream()
                .filter(item -> item.createdAt() != null)
                .collect(Collectors.groupingBy(
                        item -> item.createdAt().toLocalDate().toString(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        return grouped.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> toTrendPoint(entry.getKey(), entry.getValue()))
                .toList();
    }

    private ApiAutomationReportTrendPoint toTrendPoint(String date, List<ApiAutomationReportItem> items) {
        long totalCount = items.size();
        long passedCount = items.stream().filter(item -> isSuccessLike(item.result())).count();
        long failedCount = totalCount - passedCount;
        long skippedCount = items.stream()
                .map(ApiAutomationReportItem::skippedCount)
                .filter(value -> value != null && value > 0)
                .mapToLong(Integer::longValue)
                .sum();
        Long averageDurationMs = averageDuration(items);
        return new ApiAutomationReportTrendPoint(
                date,
                totalCount,
                passedCount,
                failedCount,
                skippedCount,
                totalCount == 0 ? 0.0 : (double) failedCount / totalCount,
                averageDurationMs
        );
    }

    private List<ApiAutomationReportDistributionBucket> resultDistribution(List<ApiAutomationReportItem> items) {
        return items.stream()
                .collect(Collectors.groupingBy(
                        item -> normalizedResultKey(item.result()),
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> new ApiAutomationReportDistributionBucket(
                        entry.getKey(),
                        resultLabel(entry.getKey()),
                        entry.getValue().size(),
                        averageDuration(entry.getValue())
                ))
                .sorted((left, right) -> Long.compare(right.count(), left.count()))
                .toList();
    }

    private List<ApiAutomationReportDistributionBucket> objectTypeDistribution(List<ApiAutomationReportItem> items) {
        return items.stream()
                .collect(Collectors.groupingBy(
                        item -> item.objectType() == null ? "UNKNOWN" : item.objectType(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> new ApiAutomationReportDistributionBucket(
                        entry.getKey(),
                        objectTypeLabel(entry.getKey()),
                        entry.getValue().size(),
                        averageDuration(entry.getValue())
                ))
                .sorted((left, right) -> Long.compare(right.count(), left.count()))
                .toList();
    }

    private List<ApiAutomationReportItem> slowestRuns(List<ApiAutomationReportItem> items) {
        return items.stream()
                .filter(item -> item.durationMs() != null)
                .sorted(Comparator.comparing(ApiAutomationReportItem::durationMs, Comparator.reverseOrder()))
                .limit(10)
                .toList();
    }

    private Long averageDuration(List<ApiAutomationReportItem> items) {
        return items.stream()
                .map(ApiAutomationReportItem::durationMs)
                .filter(value -> value != null && value >= 0)
                .mapToLong(Long::longValue)
                .average()
                .stream()
                .mapToLong(Math::round)
                .boxed()
                .findFirst()
                .orElse(null);
    }

    private String normalizedResultKey(String result) {
        String normalized = blankToNull(result);
        if (normalized == null) {
            return "UNKNOWN";
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (isSuccessLike(normalized)) {
            return "SUCCESS";
        }
        if (normalized.contains("FAIL") || normalized.contains("ERROR")) {
            return "FAILED";
        }
        if (normalized.contains("NO_ASSERTION")) {
            return "NO_ASSERTION";
        }
        return normalized;
    }

    private String resultLabel(String key) {
        return switch (key) {
            case "SUCCESS" -> "通过";
            case "FAILED" -> "失败";
            case "NO_ASSERTION" -> "无断言";
            default -> key;
        };
    }

    private String objectTypeLabel(String key) {
        return switch (key) {
            case OBJECT_TYPE_CASE -> "接口用例";
            case OBJECT_TYPE_SUITE -> "执行套件";
            default -> key;
        };
    }

    private record ReportQuery(
            String workspaceCode,
            String objectType,
            String result,
            String keyword,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            Boolean archived
    ) {
    }

    private record ReportPage(List<ApiAutomationReportItem> items, long total) {
    }

    private boolean isArchived(Long reportId) {
        if (reportId == null) {
            return false;
        }
        ReportEntity report = reportMapper.selectById(reportId);
        return report != null && Boolean.TRUE.equals(report.getArchived());
    }

    private void appendCsvRow(StringBuilder builder, Object... values) {
        for (int index = 0; index < values.length; index++) {
            if (index > 0) {
                builder.append(',');
            }
            builder.append(escapeCsv(values[index]));
        }
        builder.append('\n');
    }

    private String escapeCsv(Object value) {
        if (value == null) {
            return "";
        }
        String text = value.toString();
        if (text.contains("\"") || text.contains(",") || text.contains("\n") || text.contains("\r")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    private static final class FailedObjectAccumulator {
        private final String label;
        private long count;
        private long durationMs;

        private FailedObjectAccumulator(String label) {
            this.label = label;
        }
    }
}
