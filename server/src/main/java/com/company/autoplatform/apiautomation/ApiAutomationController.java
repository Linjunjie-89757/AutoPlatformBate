package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@RestController
@RequestMapping("/api/automation/api")
public class ApiAutomationController {

    private final ApiAutomationService apiAutomationService;
    private final ApiAiCaseGenerationService apiAiCaseGenerationService;

    public ApiAutomationController(
            ApiAutomationService apiAutomationService,
            ApiAiCaseGenerationService apiAiCaseGenerationService
    ) {
        this.apiAutomationService = apiAutomationService;
        this.apiAiCaseGenerationService = apiAiCaseGenerationService;
    }

    @GetMapping("/definitions")
    public ApiResponse<PageResponse<ApiDefinitionItem>> listDefinitions(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long moduleId,
            @RequestParam(defaultValue = "true") boolean includeDescendants,
            @RequestParam(defaultValue = "false") boolean rootOnly,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listDefinitions(
                workspaceCode, keyword, moduleId, includeDescendants, rootOnly, pageNo, pageSize));
    }

    @GetMapping("/definitions/{id}")
    public ApiResponse<ApiDefinitionDetail> getDefinition(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getDefinition(id, workspaceCode));
    }

    @PostMapping("/definitions")
    public ApiResponse<ApiDefinitionDetail> createDefinition(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiDefinitionRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createDefinition(workspaceCode, request), "API definition created");
    }

    @PostMapping("/definitions/import")
    public ApiResponse<ApiDefinitionImportResult> importDefinitions(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDefinitionImportRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.importDefinitions(workspaceCode, request), "API definitions imported");
    }

    @PostMapping(value = "/definitions/import-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ApiDefinitionImportResult> importDefinitionFile(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "workspaceCode", required = false) String bodyWorkspaceCode,
            @RequestParam("mode") String mode,
            @RequestParam(required = false) String directoryName,
            @RequestParam(required = false) Boolean groupByTags,
            @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(
                apiAutomationService.importDefinitionFile(workspaceCode, bodyWorkspaceCode, mode, directoryName, groupByTags, file),
                "API definitions imported"
        );
    }

    @PutMapping("/definitions/{id}")
    public ApiResponse<ApiDefinitionDetail> updateDefinition(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiDefinitionRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateDefinition(id, workspaceCode, request), "API definition updated");
    }

    @DeleteMapping("/definitions/{id}")
    public ApiResponse<Void> deleteDefinition(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteDefinition(id, workspaceCode);
        return ApiResponse.ok(null, "API definition deleted");
    }

    @PostMapping("/definitions/{id}/debug-run")
    public ApiResponse<ApiRunResponse> debugRunDefinition(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) ApiRunRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.debugRunDefinition(id, workspaceCode,
                request == null ? new ApiRunRequest(null, null, null, null, null) : request));
    }

    @PostMapping("/definitions/debug-run")
    public ApiResponse<ApiRunResponse> debugRunDefinitionDraft(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDebugDefinitionRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.debugRunDefinitionDraft(workspaceCode, request));
    }

    @GetMapping("/cases")
    public ApiResponse<PageResponse<ApiDefinitionCaseItem>> listCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Long definitionId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listCases(workspaceCode, definitionId, keyword, pageNo, pageSize));
    }

    @GetMapping("/cases/{id}")
    public ApiResponse<ApiDefinitionCaseDetail> getCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getCase(id, workspaceCode));
    }

    @GetMapping("/cases/{id}/run-history")
    public ApiResponse<PageResponse<ApiDefinitionCaseRunHistoryItem>> listCaseRunHistory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listCaseRunHistory(id, workspaceCode));
    }

    @GetMapping("/cases/run-history/{historyId}")
    public ApiResponse<ApiDefinitionCaseRunHistoryDetail> getCaseRunHistoryDetail(
            @PathVariable Long historyId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getCaseRunHistoryDetail(historyId, workspaceCode));
    }

    @GetMapping("/reports")
    public ApiResponse<PageResponse<ApiAutomationReportItem>> listReports(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String objectType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) Boolean archived,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listReports(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived, pageNo, pageSize));
    }

    @GetMapping(value = {"/reports/export", "/reports-export"}, produces = "text/csv")
    public ResponseEntity<byte[]> exportReports(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String objectType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) Boolean archived
    ) {
        String csv = apiAutomationService.exportReportsCsv(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header("Content-Disposition", "attachment; filename=\"api-automation-reports.csv\"")
                .body(("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/reports/analysis")
    public ApiResponse<ApiAutomationReportAnalysis> analyzeReports(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String objectType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) Boolean archived
    ) {
        return ApiResponse.ok(apiAutomationService.analyzeReports(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived));
    }

    @GetMapping("/reports/statistics")
    public ApiResponse<ApiAutomationReportStatistics> getReportStatistics(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String objectType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) Boolean archived
    ) {
        return ApiResponse.ok(apiAutomationService.getReportStatistics(workspaceCode, objectType, result, keyword, createdFrom, createdTo, archived));
    }

    @PostMapping("/reports/{reportKey}/rerun")
    public ApiResponse<ApiRunResponse> rerunReport(
            @PathVariable String reportKey,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) ApiRunRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.rerunReport(reportKey, workspaceCode,
                request == null ? new ApiRunRequest(null, null, null, null, "REPORT_RERUN") : request), "Report rerun started");
    }

    @PatchMapping("/reports/{reportKey}/archive")
    public ApiResponse<ApiAutomationReportDetail> archiveReport(
            @PathVariable String reportKey,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.archiveReport(reportKey, workspaceCode), "Report archived");
    }

    @GetMapping("/reports/{reportKey}")
    public ApiResponse<ApiAutomationReportDetail> getReportDetail(
            @PathVariable String reportKey,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getReportDetail(reportKey, workspaceCode));
    }

    @GetMapping("/cases/{id}/change-history")
    public ApiResponse<PageResponse<ApiDefinitionCaseChangeHistoryItem>> listCaseChangeHistory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listCaseChangeHistory(id, workspaceCode));
    }

    @PostMapping("/cases")
    public ApiResponse<ApiDefinitionCaseDetail> createCase(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiDefinitionCaseRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createCase(workspaceCode, request), "API case created");
    }

    @PutMapping("/cases/{id}")
    public ApiResponse<ApiDefinitionCaseDetail> updateCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiDefinitionCaseRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateCase(id, workspaceCode, request), "API case updated");
    }

    @DeleteMapping("/cases/{id}")
    public ApiResponse<Void> deleteCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteCase(id, workspaceCode);
        return ApiResponse.ok(null, "API case deleted");
    }

    @GetMapping("/definition-modules")
    public ApiResponse<List<ApiDefinitionModuleItem>> listDefinitionModules(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listDefinitionModules(workspaceCode));
    }

    @GetMapping("/definition-modules/children")
    public ApiResponse<List<ApiDefinitionModuleItem>> listDefinitionModuleChildren(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Long parentId
    ) {
        return ApiResponse.ok(apiAutomationService.listDefinitionModuleChildren(workspaceCode, parentId));
    }

    @GetMapping("/definition-tree/search")
    public ApiResponse<ApiDefinitionTreeSearchResult> searchDefinitionTree(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam String keyword,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(apiAutomationService.searchDefinitionTree(workspaceCode, keyword, limit));
    }

    @PostMapping("/definition-modules")
    public ApiResponse<ApiDefinitionModuleItem> createDefinitionModule(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDefinitionModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createDefinitionModule(workspaceCode, request), "Definition module created");
    }

    @PutMapping("/definition-modules/{id}")
    public ApiResponse<ApiDefinitionModuleItem> updateDefinitionModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDefinitionModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateDefinitionModule(id, workspaceCode, request), "Definition module updated");
    }

    @PutMapping("/definition-modules/{id}/move")
    public ApiResponse<ApiDefinitionModuleItem> moveDefinitionModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody MoveApiDefinitionModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.moveDefinitionModule(id, workspaceCode, request), "Definition module moved");
    }

    @DeleteMapping("/definition-modules/{id}")
    public ApiResponse<Void> deleteDefinitionModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteDefinitionModule(id, workspaceCode);
        return ApiResponse.ok(null, "Definition module deleted");
    }

    @PostMapping("/cases/{id}/run")
    public ApiResponse<ApiRunResponse> runCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) ApiRunRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.runCase(id, workspaceCode,
                request == null ? new ApiRunRequest(null, null, null, null, null) : request));
    }

    @PostMapping("/cases/debug-run")
    public ApiResponse<ApiRunResponse> debugRunCaseDraft(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDebugCaseRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.debugRunCaseDraft(workspaceCode, request));
    }

    @PostMapping(value = "/ai-case-generation/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody streamGenerateApiCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody ApiAiCaseGenerationService.ApiAiCaseGenerationRequest request
    ) {
        return outputStream -> {
            try (java.io.Writer writer = new java.io.OutputStreamWriter(outputStream, java.nio.charset.StandardCharsets.UTF_8)) {
                apiAiCaseGenerationService.streamGenerate(workspaceCode, request, writer);
            }
        };
    }

    @GetMapping("/scenarios")
    public ApiResponse<PageResponse<ApiScenarioItem>> listScenarios(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Long moduleId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listScenarios(workspaceCode, moduleId, keyword, status, pageNo, pageSize));
    }

    @GetMapping("/scenario-modules")
    public ApiResponse<List<ApiScenarioModuleItem>> listScenarioModules(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listScenarioModules(workspaceCode));
    }

    @PostMapping("/scenario-modules")
    public ApiResponse<ApiScenarioModuleItem> createScenarioModule(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiScenarioModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createScenarioModule(workspaceCode, request), "Scenario module created");
    }

    @PutMapping("/scenario-modules/{id}")
    public ApiResponse<ApiScenarioModuleItem> updateScenarioModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiScenarioModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateScenarioModule(id, workspaceCode, request), "Scenario module updated");
    }

    @PutMapping("/scenario-modules/{id}/move")
    public ApiResponse<ApiScenarioModuleItem> moveScenarioModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody MoveApiScenarioModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.moveScenarioModule(id, workspaceCode, request), "Scenario module moved");
    }

    @DeleteMapping("/scenario-modules/{id}")
    public ApiResponse<Void> deleteScenarioModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteScenarioModule(id, workspaceCode);
        return ApiResponse.ok(null, "Scenario module deleted");
    }

    @GetMapping("/execution-suite-modules")
    public ApiResponse<List<ApiExecutionSuiteModuleItem>> listExecutionSuiteModules(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listExecutionSuiteModules(workspaceCode));
    }

    @PostMapping("/execution-suite-modules")
    public ApiResponse<ApiExecutionSuiteModuleItem> createExecutionSuiteModule(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiExecutionSuiteModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createExecutionSuiteModule(workspaceCode, request), "Execution suite module created");
    }

    @PutMapping("/execution-suite-modules/{id}")
    public ApiResponse<ApiExecutionSuiteModuleItem> updateExecutionSuiteModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiExecutionSuiteModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateExecutionSuiteModule(id, workspaceCode, request), "Execution suite module updated");
    }

    @PutMapping("/execution-suite-modules/{id}/move")
    public ApiResponse<ApiExecutionSuiteModuleItem> moveExecutionSuiteModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody MoveApiExecutionSuiteModuleRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.moveExecutionSuiteModule(id, workspaceCode, request), "Execution suite module moved");
    }

    @DeleteMapping("/execution-suite-modules/{id}")
    public ApiResponse<Void> deleteExecutionSuiteModule(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteExecutionSuiteModule(id, workspaceCode);
        return ApiResponse.ok(null, "Execution suite module deleted");
    }

    @GetMapping("/execution-suites")
    public ApiResponse<PageResponse<ApiExecutionSuiteItem>> listExecutionSuites(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Long moduleId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listExecutionSuites(workspaceCode, moduleId, keyword, pageNo, pageSize));
    }

    @GetMapping("/execution-suites/{id}")
    public ApiResponse<ApiExecutionSuiteDetail> getExecutionSuite(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getExecutionSuite(id, workspaceCode));
    }

    @PostMapping("/execution-suites")
    public ApiResponse<ApiExecutionSuiteDetail> createExecutionSuite(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiExecutionSuiteRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createExecutionSuite(workspaceCode, request), "Execution suite created");
    }

    @PutMapping("/execution-suites/{id}")
    public ApiResponse<ApiExecutionSuiteDetail> updateExecutionSuite(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiExecutionSuiteRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateExecutionSuite(id, workspaceCode, request), "Execution suite updated");
    }

    @DeleteMapping("/execution-suites/{id}")
    public ApiResponse<Void> deleteExecutionSuite(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteExecutionSuite(id, workspaceCode);
        return ApiResponse.ok(null, "Execution suite deleted");
    }

    @GetMapping("/execution-suites/{id}/items")
    public ApiResponse<List<ApiExecutionSuiteItemDetail>> listExecutionSuiteItems(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listExecutionSuiteItems(id, workspaceCode));
    }

    @PostMapping("/execution-suites/{id}/items")
    public ApiResponse<ApiExecutionSuiteItemDetail> addExecutionSuiteItem(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiExecutionSuiteItemRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.addExecutionSuiteItem(id, workspaceCode, request), "Execution suite item added");
    }

    @PutMapping("/execution-suites/{id}/items/reorder")
    public ApiResponse<List<ApiExecutionSuiteItemDetail>> reorderExecutionSuiteItems(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody ApiExecutionSuiteItemOrderRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.reorderExecutionSuiteItems(id, workspaceCode, request), "Execution suite items reordered");
    }

    @DeleteMapping("/execution-suites/{suiteId}/items/{itemId}")
    public ApiResponse<Void> deleteExecutionSuiteItem(
            @PathVariable Long suiteId,
            @PathVariable Long itemId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteExecutionSuiteItem(suiteId, itemId, workspaceCode);
        return ApiResponse.ok(null, "Execution suite item deleted");
    }

    @PostMapping("/execution-suites/{id}/run")
    public ApiResponse<ApiRunResponse> runExecutionSuite(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) ApiRunRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.runExecutionSuite(id, workspaceCode,
                request == null ? new ApiRunRequest(null, null, null, null, null) : request));
    }

    @GetMapping("/execution-suites/{id}/run-history")
    public ApiResponse<PageResponse<ApiExecutionSuiteRunHistoryItem>> listExecutionSuiteRunHistory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listExecutionSuiteRunHistory(id, workspaceCode, pageNo, pageSize));
    }

    @GetMapping("/execution-suites/run-history/{historyId}")
    public ApiResponse<ApiExecutionSuiteRunHistoryDetail> getExecutionSuiteRunHistoryDetail(
            @PathVariable Long historyId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getExecutionSuiteRunHistoryDetail(historyId, workspaceCode));
    }

    @GetMapping("/scenarios/{id}")
    public ApiResponse<ApiScenarioDetail> getScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getScenario(id, workspaceCode));
    }

    @GetMapping("/scenarios/{id}/run-history")
    public ApiResponse<PageResponse<ApiScenarioRunHistoryItem>> listScenarioRunHistory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listScenarioRunHistory(id, workspaceCode, pageNo, pageSize));
    }

    @GetMapping("/scenarios/run-history/{historyId}")
    public ApiResponse<ApiScenarioRunHistoryDetail> getScenarioRunHistoryDetail(
            @PathVariable Long historyId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getScenarioRunHistoryDetail(historyId, workspaceCode));
    }

    @PostMapping("/scenarios")
    public ApiResponse<ApiScenarioDetail> createScenario(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiScenarioRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createScenario(workspaceCode, request), "API scenario created");
    }

    @PutMapping("/scenarios/{id}")
    public ApiResponse<ApiScenarioDetail> updateScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveApiScenarioRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateScenario(id, workspaceCode, request), "API scenario updated");
    }

    @DeleteMapping("/scenarios/{id}")
    public ApiResponse<Void> deleteScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteScenario(id, workspaceCode);
        return ApiResponse.ok(null, "API scenario deleted");
    }

    @PostMapping("/scenarios/{id}/run")
    public ApiResponse<ApiRunResponse> runScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) ApiRunRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.runScenario(id, workspaceCode,
                request == null ? new ApiRunRequest(null, null, null, null, null) : request));
    }

    @GetMapping("/environments")
    public ApiResponse<PageResponse<ApiEnvironmentItem>> listEnvironments(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listEnvironments(workspaceCode));
    }

    @PostMapping("/environments")
    public ApiResponse<ApiEnvironmentItem> createEnvironment(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiEnvironmentRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createEnvironment(workspaceCode, request), "Environment created");
    }

    @PutMapping("/environments/{id}")
    public ApiResponse<ApiEnvironmentItem> updateEnvironment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiEnvironmentRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateEnvironment(id, workspaceCode, request), "Environment updated");
    }

    @DeleteMapping("/environments/{id}")
    public ApiResponse<Void> deleteEnvironment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteEnvironment(id, workspaceCode);
        return ApiResponse.ok(null, "Environment deleted");
    }

    @GetMapping("/variable-sets")
    public ApiResponse<PageResponse<ApiVariableSetItem>> listVariableSets(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listVariableSets(workspaceCode));
    }

    @PostMapping("/variable-sets")
    public ApiResponse<ApiVariableSetItem> createVariableSet(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiVariableSetRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createVariableSet(workspaceCode, request), "Variable set created");
    }

    @PutMapping("/variable-sets/{id}")
    public ApiResponse<ApiVariableSetItem> updateVariableSet(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiVariableSetRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateVariableSet(id, workspaceCode, request), "Variable set updated");
    }

    @DeleteMapping("/variable-sets/{id}")
    public ApiResponse<Void> deleteVariableSet(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteVariableSet(id, workspaceCode);
        return ApiResponse.ok(null, "Variable set deleted");
    }

    @GetMapping("/data-files")
    public ApiResponse<PageResponse<ApiDataFileItem>> listDataFiles(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(apiAutomationService.listDataFiles(workspaceCode, keyword, pageNo, pageSize));
    }

    @GetMapping("/data-files/{id}")
    public ApiResponse<ApiDataFileDetail> getDataFile(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getDataFile(id, workspaceCode));
    }

    @GetMapping("/data-files/{id}/preview")
    public ApiResponse<ApiDataFilePreview> previewDataFile(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.previewDataFile(id, workspaceCode));
    }

    @PostMapping(value = "/data-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ApiDataFileDetail> uploadDataFile(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "workspaceCode", required = false) String bodyWorkspaceCode,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) String caseDescColumn,
            @RequestParam(required = false) Boolean ignoreFirstLine
    ) {
        return ApiResponse.ok(
                apiAutomationService.uploadDataFile(workspaceCode, bodyWorkspaceCode, file, fileName, caseDescColumn, ignoreFirstLine),
                "Data file uploaded"
        );
    }

    @PutMapping("/data-files/{id}")
    public ApiResponse<ApiDataFileDetail> updateDataFile(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiDataFileUpdateRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateDataFile(id, workspaceCode, request), "Data file updated");
    }

    @DeleteMapping("/data-files/{id}")
    public ApiResponse<Void> deleteDataFile(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteDataFile(id, workspaceCode);
        return ApiResponse.ok(null, "Data file deleted");
    }

    @GetMapping("/scenarios/{scenarioId}/test-datasets")
    public ApiResponse<List<ApiScenarioTestDatasetItem>> listScenarioTestDatasets(
            @PathVariable Long scenarioId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listScenarioTestDatasets(scenarioId, workspaceCode));
    }

    @GetMapping("/scenarios/{scenarioId}/test-datasets/{datasetId}")
    public ApiResponse<ApiScenarioTestDatasetDetail> getScenarioTestDataset(
            @PathVariable Long scenarioId,
            @PathVariable Long datasetId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.getScenarioTestDataset(scenarioId, datasetId, workspaceCode));
    }

    @PostMapping("/scenarios/{scenarioId}/test-datasets")
    public ApiResponse<ApiScenarioTestDatasetDetail> createScenarioTestDataset(
            @PathVariable Long scenarioId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiScenarioTestDatasetSaveRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.createScenarioTestDataset(scenarioId, workspaceCode, request), "Scenario test dataset created");
    }

    @PutMapping("/scenarios/{scenarioId}/test-datasets/{datasetId}")
    public ApiResponse<ApiScenarioTestDatasetDetail> updateScenarioTestDataset(
            @PathVariable Long scenarioId,
            @PathVariable Long datasetId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ApiScenarioTestDatasetSaveRequest request
    ) {
        return ApiResponse.ok(apiAutomationService.updateScenarioTestDataset(scenarioId, datasetId, workspaceCode, request), "Scenario test dataset updated");
    }

    @PostMapping(value = "/scenarios/{scenarioId}/test-datasets/import-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ApiScenarioTestDatasetDetail> importScenarioTestDatasetCsv(
            @PathVariable Long scenarioId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String datasetName
    ) {
        return ApiResponse.ok(apiAutomationService.importScenarioTestDatasetCsv(scenarioId, workspaceCode, file, datasetName), "Scenario test dataset imported");
    }

    @DeleteMapping("/scenarios/{scenarioId}/test-datasets/{datasetId}")
    public ApiResponse<Void> deleteScenarioTestDataset(
            @PathVariable Long scenarioId,
            @PathVariable Long datasetId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        apiAutomationService.deleteScenarioTestDataset(scenarioId, datasetId, workspaceCode);
        return ApiResponse.ok(null, "Scenario test dataset deleted");
    }

    @GetMapping("/runs/reports/{id}/steps")
    public ApiResponse<List<ApiRunStepResultResponse>> listReportSteps(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(apiAutomationService.listReportSteps(id, workspaceCode));
    }
}
