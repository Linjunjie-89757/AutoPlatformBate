package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.PageResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiAutomationService {

    private final ApiDefinitionDomainService definitionDomainService;
    private final ApiCaseDomainService caseDomainService;
    private final ApiScenarioDomainService scenarioDomainService;
    private final ApiExecutionSuiteDomainService executionSuiteDomainService;
    private final ApiConfigDomainService configDomainService;
    private final ApiRunHistoryDomainService runHistoryDomainService;
    private final ApiReportDomainService reportDomainService;
    private final ApiDataFileDomainService dataFileDomainService;
    private final ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService;
    private final ApiDefinitionImportDomainService definitionImportDomainService;
    private final ObjectProvider<ApiExecutionDomainService> executionDomainServiceProvider;

    public ApiAutomationService(
            ApiDefinitionDomainService definitionDomainService,
            ApiCaseDomainService caseDomainService,
            ApiScenarioDomainService scenarioDomainService,
            ApiExecutionSuiteDomainService executionSuiteDomainService,
            ApiConfigDomainService configDomainService,
            ApiRunHistoryDomainService runHistoryDomainService,
            ApiReportDomainService reportDomainService,
            ApiDataFileDomainService dataFileDomainService,
            ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService,
            ApiDefinitionImportDomainService definitionImportDomainService,
            ObjectProvider<ApiExecutionDomainService> executionDomainServiceProvider
    ) {
        this.definitionDomainService = definitionDomainService;
        this.caseDomainService = caseDomainService;
        this.scenarioDomainService = scenarioDomainService;
        this.executionSuiteDomainService = executionSuiteDomainService;
        this.configDomainService = configDomainService;
        this.runHistoryDomainService = runHistoryDomainService;
        this.reportDomainService = reportDomainService;
        this.dataFileDomainService = dataFileDomainService;
        this.scenarioTestDatasetDomainService = scenarioTestDatasetDomainService;
        this.definitionImportDomainService = definitionImportDomainService;
        this.executionDomainServiceProvider = executionDomainServiceProvider;
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
        return definitionDomainService.listDefinitions(
                workspaceCode, keyword, moduleId, includeDescendants, rootOnly, pageNo, pageSize);
    }

    public ApiDefinitionDetail getDefinition(Long id, String workspaceCode) {
        return definitionDomainService.getDefinition(id, workspaceCode);
    }

    public PageResponse<ApiDefinitionCaseItem> listCases(
            String workspaceCode,
            Long definitionId,
            String keyword,
            Integer pageNo,
            Integer pageSize
    ) {
        return caseDomainService.listCases(workspaceCode, definitionId, keyword, pageNo, pageSize);
    }

    public ApiDefinitionCaseDetail getCase(Long id, String workspaceCode) {
        return caseDomainService.getCase(id, workspaceCode);
    }

    public PageResponse<ApiDefinitionCaseChangeHistoryItem> listCaseChangeHistory(Long caseId, String workspaceCode) {
        return runHistoryDomainService.listCaseChangeHistory(caseId, workspaceCode);
    }

    public PageResponse<ApiDefinitionCaseRunHistoryItem> listCaseRunHistory(Long caseId, String workspaceCode) {
        return runHistoryDomainService.listCaseRunHistory(caseId, workspaceCode);
    }

    public ApiDefinitionCaseRunHistoryDetail getCaseRunHistoryDetail(Long historyId, String workspaceCode) {
        return runHistoryDomainService.getCaseRunHistoryDetail(historyId, workspaceCode);
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
        return reportDomainService.listReports(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived, pageNo, pageSize);
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
        return reportDomainService.analyzeReports(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived);
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
        return reportDomainService.getReportStatistics(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived);
    }

    public ApiAutomationReportDetail getReportDetail(String reportKey, String workspaceCode) {
        return reportDomainService.getReportDetail(reportKey, workspaceCode);
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
        return reportDomainService.exportReportsCsv(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived);
    }

    public ApiRunResponse rerunReport(String reportKey, String workspaceCode, ApiRunRequest request) {
        ApiAutomationReportDetail report = reportDomainService.getReportDetail(reportKey, workspaceCode);
        ApiRunRequest rerunRequest = request == null ? new ApiRunRequest(null, report.environmentId(), report.variableSetId(), report.branchName(), "REPORT_RERUN") : request;
        if ("API_CASE".equals(report.objectType())) {
            return runCase(report.objectId(), workspaceCode, rerunRequest);
        }
        if ("SUITE".equals(report.objectType())) {
            return runExecutionSuite(report.objectId(), workspaceCode, rerunRequest);
        }
        throw new com.company.autoplatform.common.BadRequestException("Unsupported report object type");
    }

    public ApiAutomationReportDetail archiveReport(String reportKey, String workspaceCode) {
        return reportDomainService.archiveReport(reportKey, workspaceCode);
    }

    public ApiDefinitionDetail createDefinition(String headerWorkspaceCode, SaveApiDefinitionRequest request) {
        return definitionDomainService.createDefinition(headerWorkspaceCode, request);
    }

    public ApiDefinitionImportResult importDefinitions(String headerWorkspaceCode, ApiDefinitionImportRequest request) {
        return definitionImportDomainService.importContent(headerWorkspaceCode, request);
    }

    public ApiDefinitionImportResult importDefinitionFile(
            String headerWorkspaceCode,
            String bodyWorkspaceCode,
            String mode,
            String directoryName,
            Boolean groupByTags,
            org.springframework.web.multipart.MultipartFile file
    ) {
        return definitionImportDomainService.importFile(headerWorkspaceCode, bodyWorkspaceCode, mode, directoryName, groupByTags, file);
    }

    public ApiDefinitionDetail updateDefinition(Long id, String headerWorkspaceCode, SaveApiDefinitionRequest request) {
        return definitionDomainService.updateDefinition(id, headerWorkspaceCode, request);
    }

    public ApiDefinitionCaseDetail createCase(String headerWorkspaceCode, SaveApiDefinitionCaseRequest request) {
        return caseDomainService.createCase(headerWorkspaceCode, request);
    }

    public ApiDefinitionCaseDetail updateCase(Long id, String headerWorkspaceCode, SaveApiDefinitionCaseRequest request) {
        return caseDomainService.updateCase(id, headerWorkspaceCode, request);
    }

    public void deleteDefinition(Long id, String workspaceCode) {
        definitionDomainService.deleteDefinition(id, workspaceCode);
    }

    public void deleteCase(Long id, String workspaceCode) {
        caseDomainService.deleteCase(id, workspaceCode);
    }

    public List<ApiDefinitionModuleItem> listDefinitionModules(String workspaceCode) {
        return definitionDomainService.listDefinitionModules(workspaceCode);
    }

    public List<ApiDefinitionModuleItem> listDefinitionModuleChildren(String workspaceCode, Long parentId) {
        return definitionDomainService.listDefinitionModuleChildren(workspaceCode, parentId);
    }

    public ApiDefinitionTreeSearchResult searchDefinitionTree(String workspaceCode, String keyword, Integer limit) {
        return definitionDomainService.searchDefinitionTree(workspaceCode, keyword, limit);
    }

    public ApiDefinitionModuleItem createDefinitionModule(String headerWorkspaceCode, ApiDefinitionModuleRequest request) {
        return definitionDomainService.createDefinitionModule(headerWorkspaceCode, request);
    }

    public ApiDefinitionModuleItem updateDefinitionModule(Long id, String workspaceCode, ApiDefinitionModuleRequest request) {
        return definitionDomainService.updateDefinitionModule(id, workspaceCode, request);
    }

    public ApiDefinitionModuleItem moveDefinitionModule(Long id, String workspaceCode, MoveApiDefinitionModuleRequest request) {
        return definitionDomainService.moveDefinitionModule(id, workspaceCode, request);
    }

    public void deleteDefinitionModule(Long id, String workspaceCode) {
        definitionDomainService.deleteDefinitionModule(id, workspaceCode);
    }

    public PageResponse<ApiScenarioItem> listScenarios(
            String workspaceCode,
            Long moduleId,
            String keyword,
            String status,
            Integer pageNo,
            Integer pageSize
    ) {
        return scenarioDomainService.listScenarios(workspaceCode, moduleId, keyword, status, pageNo, pageSize);
    }

    public List<ApiScenarioModuleItem> listScenarioModules(String workspaceCode) {
        return scenarioDomainService.listScenarioModules(workspaceCode);
    }

    public ApiScenarioModuleItem createScenarioModule(String headerWorkspaceCode, ApiScenarioModuleRequest request) {
        return scenarioDomainService.createScenarioModule(headerWorkspaceCode, request);
    }

    public ApiScenarioModuleItem updateScenarioModule(Long id, String workspaceCode, ApiScenarioModuleRequest request) {
        return scenarioDomainService.updateScenarioModule(id, workspaceCode, request);
    }

    public ApiScenarioModuleItem moveScenarioModule(Long id, String workspaceCode, MoveApiScenarioModuleRequest request) {
        return scenarioDomainService.moveScenarioModule(id, workspaceCode, request);
    }

    public void deleteScenarioModule(Long id, String workspaceCode) {
        scenarioDomainService.deleteScenarioModule(id, workspaceCode);
    }

    public List<ApiExecutionSuiteModuleItem> listExecutionSuiteModules(String workspaceCode) {
        return executionSuiteDomainService.listSuiteModules(workspaceCode);
    }

    public ApiExecutionSuiteModuleItem createExecutionSuiteModule(String headerWorkspaceCode, ApiExecutionSuiteModuleRequest request) {
        return executionSuiteDomainService.createSuiteModule(headerWorkspaceCode, request);
    }

    public ApiExecutionSuiteModuleItem updateExecutionSuiteModule(Long id, String workspaceCode, ApiExecutionSuiteModuleRequest request) {
        return executionSuiteDomainService.updateSuiteModule(id, workspaceCode, request);
    }

    public ApiExecutionSuiteModuleItem moveExecutionSuiteModule(Long id, String workspaceCode, MoveApiExecutionSuiteModuleRequest request) {
        return executionSuiteDomainService.moveSuiteModule(id, workspaceCode, request);
    }

    public void deleteExecutionSuiteModule(Long id, String workspaceCode) {
        executionSuiteDomainService.deleteSuiteModule(id, workspaceCode);
    }

    public PageResponse<ApiExecutionSuiteItem> listExecutionSuites(
            String workspaceCode,
            Long moduleId,
            String keyword,
            Integer pageNo,
            Integer pageSize
    ) {
        return executionSuiteDomainService.listSuites(workspaceCode, moduleId, keyword, pageNo, pageSize);
    }

    public ApiExecutionSuiteDetail getExecutionSuite(Long id, String workspaceCode) {
        return executionSuiteDomainService.getSuite(id, workspaceCode);
    }

    public ApiExecutionSuiteDetail createExecutionSuite(String headerWorkspaceCode, SaveApiExecutionSuiteRequest request) {
        return executionSuiteDomainService.createSuite(headerWorkspaceCode, request);
    }

    public ApiExecutionSuiteDetail updateExecutionSuite(Long id, String headerWorkspaceCode, SaveApiExecutionSuiteRequest request) {
        return executionSuiteDomainService.updateSuite(id, headerWorkspaceCode, request);
    }

    public void deleteExecutionSuite(Long id, String workspaceCode) {
        executionSuiteDomainService.deleteSuite(id, workspaceCode);
    }

    public List<ApiExecutionSuiteItemDetail> listExecutionSuiteItems(Long suiteId, String workspaceCode) {
        return executionSuiteDomainService.listSuiteItems(suiteId, workspaceCode);
    }

    public ApiExecutionSuiteItemDetail addExecutionSuiteItem(Long suiteId, String workspaceCode, ApiExecutionSuiteItemRequest request) {
        return executionSuiteDomainService.addSuiteItem(suiteId, workspaceCode, request);
    }

    public List<ApiExecutionSuiteItemDetail> reorderExecutionSuiteItems(Long suiteId, String workspaceCode, ApiExecutionSuiteItemOrderRequest request) {
        return executionSuiteDomainService.reorderSuiteItems(suiteId, workspaceCode, request);
    }

    public void deleteExecutionSuiteItem(Long suiteId, Long itemId, String workspaceCode) {
        executionSuiteDomainService.deleteSuiteItem(suiteId, itemId, workspaceCode);
    }

    public ApiRunResponse runExecutionSuite(Long suiteId, String workspaceCode, ApiRunRequest request) {
        return executionSuiteDomainService.runSuite(suiteId, workspaceCode, request);
    }

    public PageResponse<ApiExecutionSuiteRunHistoryItem> listExecutionSuiteRunHistory(
            Long suiteId,
            String workspaceCode,
            Integer pageNo,
            Integer pageSize
    ) {
        return executionSuiteDomainService.listSuiteRunHistory(suiteId, workspaceCode, pageNo, pageSize);
    }

    public ApiExecutionSuiteRunHistoryDetail getExecutionSuiteRunHistoryDetail(Long historyId, String workspaceCode) {
        return executionSuiteDomainService.getSuiteRunHistoryDetail(historyId, workspaceCode);
    }

    public PageResponse<ApiScenarioRunHistoryItem> listScenarioRunHistory(
            Long scenarioId,
            String workspaceCode,
            Integer pageNo,
            Integer pageSize
    ) {
        return executionDomainServiceProvider.getObject().listScenarioRunHistory(scenarioId, workspaceCode, pageNo, pageSize);
    }

    public ApiScenarioRunHistoryDetail getScenarioRunHistoryDetail(Long historyId, String workspaceCode) {
        return executionDomainServiceProvider.getObject().getScenarioRunHistoryDetail(historyId, workspaceCode);
    }

    public ApiScenarioDetail getScenario(Long id, String workspaceCode) {
        return scenarioDomainService.getScenario(id, workspaceCode);
    }

    public ApiScenarioDetail createScenario(String headerWorkspaceCode, SaveApiScenarioRequest request) {
        return scenarioDomainService.createScenario(headerWorkspaceCode, request);
    }

    public ApiScenarioDetail updateScenario(Long id, String headerWorkspaceCode, SaveApiScenarioRequest request) {
        return scenarioDomainService.updateScenario(id, headerWorkspaceCode, request);
    }

    public void deleteScenario(Long id, String workspaceCode) {
        scenarioDomainService.deleteScenario(id, workspaceCode);
    }

    public PageResponse<ApiEnvironmentItem> listEnvironments(String workspaceCode) {
        return configDomainService.listEnvironments(workspaceCode);
    }

    public ApiEnvironmentItem createEnvironment(String headerWorkspaceCode, ApiEnvironmentRequest request) {
        return configDomainService.createEnvironment(headerWorkspaceCode, request);
    }

    public ApiEnvironmentItem updateEnvironment(Long id, String headerWorkspaceCode, ApiEnvironmentRequest request) {
        return configDomainService.updateEnvironment(id, headerWorkspaceCode, request);
    }

    public void deleteEnvironment(Long id, String workspaceCode) {
        configDomainService.deleteEnvironment(id, workspaceCode);
    }

    public PageResponse<ApiVariableSetItem> listVariableSets(String workspaceCode) {
        return configDomainService.listVariableSets(workspaceCode);
    }

    public ApiVariableSetItem createVariableSet(String headerWorkspaceCode, ApiVariableSetRequest request) {
        return configDomainService.createVariableSet(headerWorkspaceCode, request);
    }

    public ApiVariableSetItem updateVariableSet(Long id, String headerWorkspaceCode, ApiVariableSetRequest request) {
        return configDomainService.updateVariableSet(id, headerWorkspaceCode, request);
    }

    public void deleteVariableSet(Long id, String workspaceCode) {
        configDomainService.deleteVariableSet(id, workspaceCode);
    }

    public PageResponse<ApiDataFileItem> listDataFiles(String workspaceCode, String keyword, Integer pageNo, Integer pageSize) {
        return dataFileDomainService.listDataFiles(workspaceCode, keyword, pageNo, pageSize);
    }

    public ApiDataFileDetail getDataFile(Long id, String workspaceCode) {
        return dataFileDomainService.getDataFile(id, workspaceCode);
    }

    public ApiDataFileDetail uploadDataFile(
            String headerWorkspaceCode,
            String bodyWorkspaceCode,
            org.springframework.web.multipart.MultipartFile file,
            String fileName,
            String caseDescColumn,
            Boolean ignoreFirstLine
    ) {
        return dataFileDomainService.uploadDataFile(headerWorkspaceCode, bodyWorkspaceCode, file, fileName, caseDescColumn, ignoreFirstLine);
    }

    public ApiDataFileDetail updateDataFile(Long id, String headerWorkspaceCode, ApiDataFileUpdateRequest request) {
        return dataFileDomainService.updateDataFile(id, headerWorkspaceCode, request);
    }

    public void deleteDataFile(Long id, String workspaceCode) {
        dataFileDomainService.deleteDataFile(id, workspaceCode);
    }

    public ApiDataFilePreview previewDataFile(Long id, String workspaceCode) {
        return dataFileDomainService.previewDataFile(id, workspaceCode);
    }

    public List<ApiScenarioTestDatasetItem> listScenarioTestDatasets(Long scenarioId, String workspaceCode) {
        return scenarioTestDatasetDomainService.listDatasets(scenarioId, workspaceCode);
    }

    public ApiScenarioTestDatasetDetail getScenarioTestDataset(Long scenarioId, Long datasetId, String workspaceCode) {
        return scenarioTestDatasetDomainService.getDataset(scenarioId, datasetId, workspaceCode);
    }

    public ApiScenarioTestDatasetDetail createScenarioTestDataset(Long scenarioId, String workspaceCode, ApiScenarioTestDatasetSaveRequest request) {
        return scenarioTestDatasetDomainService.createDataset(scenarioId, workspaceCode, request);
    }

    public ApiScenarioTestDatasetDetail updateScenarioTestDataset(Long scenarioId, Long datasetId, String workspaceCode, ApiScenarioTestDatasetSaveRequest request) {
        return scenarioTestDatasetDomainService.updateDataset(scenarioId, datasetId, workspaceCode, request);
    }

    public ApiScenarioTestDatasetDetail importScenarioTestDatasetCsv(Long scenarioId, String workspaceCode, org.springframework.web.multipart.MultipartFile file, String datasetName) {
        return scenarioTestDatasetDomainService.importCsv(scenarioId, workspaceCode, file, datasetName);
    }

    public void deleteScenarioTestDataset(Long scenarioId, Long datasetId, String workspaceCode) {
        scenarioTestDatasetDomainService.deleteDataset(scenarioId, datasetId, workspaceCode);
    }

    public ApiRunResponse debugRunDefinition(Long id, String workspaceCode, ApiRunRequest request) {
        return executionDomainServiceProvider.getObject().debugRunDefinition(id, workspaceCode, request);
    }

    public ApiRunResponse runCase(Long id, String workspaceCode, ApiRunRequest request) {
        return executionDomainServiceProvider.getObject().runCase(id, workspaceCode, request);
    }

    public ApiRunResponse debugRunDefinitionDraft(String workspaceCode, ApiDebugDefinitionRequest request) {
        return executionDomainServiceProvider.getObject().debugRunDefinitionDraft(workspaceCode, request);
    }

    public ApiRunResponse debugRunCaseDraft(String workspaceCode, ApiDebugCaseRequest request) {
        return executionDomainServiceProvider.getObject().debugRunCaseDraft(workspaceCode, request);
    }

    public ApiRunResponse runScenario(Long id, String workspaceCode, ApiRunRequest request) {
        return executionDomainServiceProvider.getObject().runScenario(id, workspaceCode, request);
    }

    public List<ApiRunStepResultResponse> listReportSteps(Long reportId, String workspaceCode) {
        return runHistoryDomainService.listReportSteps(reportId, workspaceCode);
    }
}

