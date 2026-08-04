package com.company.autoplatform.apiautomation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class ApiAutomationModels {

    private ApiAutomationModels() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiKeyValueInput(
            String key,
            String value,
            String description,
            Boolean enabled,
            String paramType,
            Boolean required,
            Boolean encode,
            Integer minLength,
            Integer maxLength,
            String fileName,
            String contentType,
            String fileBase64
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAuthCredentialInput(
            String userName,
            String password
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAuthConfigInput(
            String authType,
            ApiAuthCredentialInput basicAuth,
            ApiAuthCredentialInput digestAuth
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiRequestBodyInput(
            String type,
            String rawText,
            List<ApiKeyValueInput> formItems,
            String contentType,
            String fileName,
            String binaryBase64
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiSchemaFieldInput(
            String location,
            String fieldPath,
            String name,
            String type,
            String format,
            Boolean required,
            String description,
            Object example,
            Object defaultValue,
            List<String> enumValues,
            Integer minLength,
            Integer maxLength,
            String minimum,
            String maximum,
            String responseCode
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAssertionItemInput(
            String header,
            String expression,
            String variableName,
            String condition,
            String expectedValue,
            Boolean enabled
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAssertionGroupInput(
            List<ApiAssertionItemInput> assertions,
            String responseFormat
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAssertionInput(
            String type,
            String subject,
            String operator,
            String expectedValue,
            String id,
            String assertionType,
            String name,
            Boolean enabled,
            String description,
            String condition,
            List<ApiAssertionItemInput> assertions,
            String assertionBodyType,
            ApiAssertionGroupInput jsonPathAssertion,
            ApiAssertionGroupInput xpathAssertion,
            ApiAssertionGroupInput regexAssertion,
            List<ApiAssertionItemInput> variableAssertionItems,
            String scriptLanguage,
            String script
    ) {
        public ApiAssertionInput(String type, String subject, String operator, String expectedValue) {
            this(type, subject, operator, expectedValue, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiExtractorInput(
            String name,
            String sourceType,
            String expression
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiProcessorExtractItemInput(
            String name,
            String sourceType,
            String expression,
            Boolean enabled,
            String variableName,
            String description,
            String variableType,
            String extractType,
            String extractScope,
            String expressionMatchingRule,
            String resultMatchingRule,
            Integer resultMatchingRuleNum,
            String responseFormat
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiProcessorInput(
            String id,
            String processorType,
            String name,
            Boolean enabled,
            String description,
            String scriptLanguage,
            String script,
            Integer delayMs,
            Long dataSourceId,
            String dataSourceName,
            Integer queryTimeout,
            String variableNames,
            List<ApiKeyValueInput> extractParams,
            String resultVariable,
            List<ApiProcessorExtractItemInput> extractors
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiRequestConfigInput(
            @NotBlank(message = "HTTP method cannot be blank") String method,
            @NotBlank(message = "Path cannot be blank") String path,
            Integer timeoutMs,
            List<ApiKeyValueInput> queryParams,
            List<ApiKeyValueInput> headers,
            List<ApiKeyValueInput> cookies,
            ApiRequestBodyInput body,
            ApiAuthConfigInput authConfig,
            List<ApiSchemaFieldInput> schemaFields
    ) {
        public ApiRequestConfigInput(
                String method,
                String path,
                Integer timeoutMs,
                List<ApiKeyValueInput> queryParams,
                List<ApiKeyValueInput> headers,
                List<ApiKeyValueInput> cookies,
                ApiRequestBodyInput body,
                ApiAuthConfigInput authConfig
        ) {
            this(method, path, timeoutMs, queryParams, headers, cookies, body, authConfig, List.of());
        }
    }

    public record SaveApiDefinitionRequest(
            String workspaceCode,
            @NotBlank(message = "Definition name cannot be blank") String name,
            String directoryName,
            String description,
            List<String> tags,
            @Valid @NotNull(message = "Request config cannot be blank") ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiExtractorInput> extractors,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiDefinitionImportRequest(
            String workspaceCode,
            @NotBlank(message = "Import mode cannot be blank") String mode,
            String inputType,
            String url,
            String content,
            String directoryName,
            Boolean groupByTags
    ) {
        public ApiDefinitionImportRequest(
                String workspaceCode,
                String mode,
                String inputType,
                String url,
                String content,
                String directoryName
        ) {
            this(workspaceCode, mode, inputType, url, content, directoryName, null);
        }
    }

    public record ApiDefinitionImportItem(
            Long id,
            String name,
            String method,
            String path,
            String directoryName
    ) {
    }

    public record ApiDefinitionImportError(
            String name,
            String method,
            String path,
            String message
    ) {
    }

    public record ApiDefinitionImportResult(
            int createdCount,
            int failedCount,
            List<ApiDefinitionImportItem> items,
            List<ApiDefinitionImportError> errors
    ) {
    }

    public record ApiDefinitionItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long moduleId,
            String name,
            String method,
            String path,
            String directoryName,
            String description,
            List<String> tags,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDefinitionDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            String method,
            String path,
            String directoryName,
            String description,
            List<String> tags,
            ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiExtractorInput> extractors,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDefinitionModuleRequest(
            String workspaceCode,
            Long parentId,
            @NotBlank(message = "Module name cannot be blank") String name
    ) {
    }

    public record MoveApiDefinitionModuleRequest(
            Long parentId,
            Integer sortOrder
    ) {
    }

    public record ApiDefinitionModuleItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long parentId,
            String name,
            String fullPath,
            Integer sortOrder,
            Long definitionCount,
            Long directDefinitionCount,
            Boolean hasChildren,
            Boolean childrenLoaded,
            List<ApiDefinitionModuleItem> children
    ) {
    }

    public record ApiDefinitionTreeSearchResult(
            List<ApiDefinitionModuleItem> modules,
            List<ApiDefinitionItem> definitions,
            long moduleTotal,
            long definitionTotal
    ) {
    }

    public record SaveApiDefinitionCaseRequest(
            String workspaceCode,
            @NotNull(message = "Definition id cannot be blank") Long definitionId,
            @NotBlank(message = "Case name cannot be blank") String name,
            String description,
            List<String> tags,
            @Valid @NotNull(message = "Request config cannot be blank") ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors
    ) {
    }

    public record ApiDefinitionCaseItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long definitionId,
            String definitionName,
            String name,
            String method,
            String path,
            String description,
            List<String> tags,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDefinitionCaseDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long definitionId,
            String definitionName,
            String name,
            String method,
            String path,
            String description,
            List<String> tags,
            ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiExtractorInput> extractors,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDefinitionCaseRunHistoryItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long caseId,
            Long definitionId,
            String caseName,
            Long reportId,
            String result,
            String failureSummary,
            Integer statusCode,
            Long durationMs,
            Long responseSize,
            Long environmentId,
            String environmentName,
            Long variableSetId,
            String variableSetName,
            String operator,
            LocalDateTime createdAt
    ) {
    }

    public record ApiDefinitionCaseRunHistoryDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long caseId,
            Long definitionId,
            String caseName,
            Long reportId,
            String result,
            String failureSummary,
            Integer statusCode,
            Long durationMs,
            Long responseSize,
            Long environmentId,
            String environmentName,
            Long variableSetId,
            String variableSetName,
            String operator,
            LocalDateTime createdAt,
            String contextSnapshotJson,
            List<ApiRunStepResultResponse> stepResults
    ) {
    }

    public record ApiDefinitionCaseChangeHistoryItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long caseId,
            Long definitionId,
            String caseName,
            String changeType,
            String changeSummary,
            Long operatorId,
            String operatorName,
            LocalDateTime createdAt
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiScenarioStepInput(
            String id,
            String stepName,
            String stepType,
            String refType,
            String resourceType,
            Long resourceId,
            Boolean enabled,
            ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            Integer delayMs,
            String conditionType,
            String conditionExpression,
            String loopType,
            Integer loopCount,
            String foreachExpression,
            String script,
            List<@Valid ApiScenarioStepInput> children
    ) {
        public ApiScenarioStepInput(String stepName, String resourceType, Long resourceId, Boolean enabled) {
            this(null, stepName, null, null, resourceType, resourceId, enabled, null, null, null, null,
                    null, null, null, null, null, null, null, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiScenarioAssertionInput(
            String id,
            String name,
            String assertionType,
            String operator,
            String expectedValue,
            Boolean enabled
    ) {
    }

    public record ApiScenarioModuleRequest(
            String workspaceCode,
            Long parentId,
            @NotBlank(message = "Module name cannot be blank") String name
    ) {
    }

    public record MoveApiScenarioModuleRequest(
            Long parentId,
            Integer sortOrder
    ) {
    }

    public record ApiScenarioModuleItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long parentId,
            String name,
            Integer sortOrder,
            Long scenarioCount,
            List<ApiScenarioModuleItem> children
    ) {
    }

    public record ApiExecutionSuiteModuleRequest(
            String workspaceCode,
            Long parentId,
            @NotBlank(message = "Module name cannot be blank") String name
    ) {
    }

    public record MoveApiExecutionSuiteModuleRequest(
            Long parentId,
            Integer sortOrder
    ) {
    }

    public record ApiExecutionSuiteModuleItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long parentId,
            String name,
            Integer sortOrder,
            Long suiteCount,
            List<ApiExecutionSuiteModuleItem> children
    ) {
    }

    public record SaveApiExecutionSuiteRequest(
            String workspaceCode,
            Long moduleId,
            @NotBlank(message = "Suite name cannot be blank") String name,
            String priority,
            String status,
            String description,
            Long environmentId,
            Long variableSetId,
            Long mockApplicationId,
            Long mockReleaseId,
            String runMode,
            String runOn,
            Boolean notifyEnabled,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean scheduleEnabled,
            String cronExpression,
            String branchName,
            String triggerSource,
            String branchNote,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String caseDescColumn,
            String dataFailureStrategy
    ) {
    }

    public record ApiExecutionSuiteItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long moduleId,
            String moduleName,
            String name,
            String priority,
            String status,
            String description,
            Long environmentId,
            Long variableSetId,
            Long mockApplicationId,
            Long mockReleaseId,
            String runMode,
            String runOn,
            Boolean notifyEnabled,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean scheduleEnabled,
            String cronExpression,
            String branchName,
            String triggerSource,
            String branchNote,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileNameSnapshot,
            String caseDescColumn,
            String dataFailureStrategy,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiExecutionSuiteDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long moduleId,
            String moduleName,
            String name,
            String priority,
            String status,
            String description,
            Long environmentId,
                Long variableSetId,
                Long mockApplicationId,
                Long mockReleaseId,
                String runMode,
            String runOn,
            Boolean notifyEnabled,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean scheduleEnabled,
            String cronExpression,
            String branchName,
            String triggerSource,
            String branchNote,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileNameSnapshot,
            String caseDescColumn,
            String dataFailureStrategy,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiExecutionSuiteItemRequest(
            @NotBlank(message = "Item type cannot be blank") String itemType,
            @NotNull(message = "Item id cannot be blank") Long itemId,
            Boolean enabled,
            String description
    ) {
    }

    public record ApiExecutionSuiteItemOrderRequest(
            List<ApiExecutionSuiteItemOrderInput> items
    ) {
    }

    public record ApiExecutionSuiteItemOrderInput(
            @NotNull(message = "Suite item id cannot be blank") Long id,
            Integer sortOrder,
            Boolean enabled
    ) {
    }

    public record ApiExecutionSuiteItemDetail(
            Long id,
            Long suiteId,
            String itemType,
            Long itemId,
            String itemName,
            Integer sortOrder,
            Boolean enabled,
            String description,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiExecutionSuiteRunHistoryItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long suiteId,
            String suiteName,
            Long moduleId,
            String moduleName,
            String priority,
            Long reportId,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Long durationMs,
            Long environmentId,
            Long variableSetId,
            String runMode,
            String runOn,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileName,
            Integer dataRowCount,
            String branchName,
            String triggerSource,
            Long operatorId,
            String operatorName,
            LocalDateTime createdAt
    ) {
    }

    public record ApiExecutionSuiteRunHistoryDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long suiteId,
            String suiteName,
            Long moduleId,
            String moduleName,
            String priority,
            Long reportId,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Long durationMs,
            Long environmentId,
            Long variableSetId,
            String runMode,
            String runOn,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileName,
            Integer dataRowCount,
            String branchName,
            String triggerSource,
            Long operatorId,
            String operatorName,
            LocalDateTime createdAt,
            String contextSnapshotJson,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots,
            List<ApiRunStepResultResponse> stepResults
    ) {
    }

    public record ApiExecutionSuiteDataIteration(
            Integer loopIndex,
            Integer rowIndex,
            String caseDesc,
            Map<String, String> rowValues,
            String result,
            String failedStep,
            Integer stepCount,
            Long durationMs,
            String failureSummary
    ) {
    }

    public record ApiExecutionSuiteRunItemSnapshot(
            Long suiteItemId,
            Long itemId,
            String itemType,
            String itemName,
            Integer sortOrder,
            Boolean enabled,
            String result,
            Integer stepCount,
            Long durationMs,
            String failureSummary
    ) {
    }

    public record ApiScenarioRunHistoryItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long scenarioId,
            String scenarioName,
            Long reportId,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Long durationMs,
            Long environmentId,
            Long variableSetId,
            Long testDatasetId,
            String testDatasetName,
            Integer loopCount,
            Integer threadCount,
            Long operatorId,
            String operatorName,
            LocalDateTime createdAt
    ) {
    }

    public record ApiScenarioRunHistoryDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long scenarioId,
            String scenarioName,
            Long reportId,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Long durationMs,
            Long environmentId,
            Long variableSetId,
            Long testDatasetId,
            String testDatasetName,
            Integer loopCount,
            Integer threadCount,
            Long operatorId,
            String operatorName,
            LocalDateTime createdAt,
            String contextSnapshotJson,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            List<ApiRunStepResultResponse> stepResults
    ) {
    }

    public record SaveApiScenarioRequest(
            String workspaceCode,
            @NotBlank(message = "Scenario name cannot be blank") String name,
            String directoryName,
            Long moduleId,
            String priority,
            String status,
            String description,
            List<String> tags,
            Long defaultEnvironmentId,
            Long variableSetId,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileNameSnapshot,
            String caseDescColumn,
            String dataFailureStrategy,
            Long relatedCaseId,
            List<ApiVariableItem> scenarioVariables,
            List<ApiScenarioAssertionInput> scenarioAssertions,
            List<@Valid ApiScenarioStepInput> steps
    ) {
    }

    public record ApiScenarioItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            String directoryName,
            Long moduleId,
            String moduleName,
            String priority,
            String status,
            String description,
            List<String> tags,
            Integer stepCount,
            Long defaultEnvironmentId,
            Long variableSetId,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileNameSnapshot,
            String caseDescColumn,
            String dataFailureStrategy,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiScenarioDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            String directoryName,
            Long moduleId,
            String moduleName,
            String priority,
            String status,
            String description,
            List<String> tags,
            Long defaultEnvironmentId,
            Long variableSetId,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileNameSnapshot,
            String caseDescColumn,
            String dataFailureStrategy,
            Long relatedCaseId,
            List<ApiVariableItem> scenarioVariables,
            List<ApiScenarioAssertionInput> scenarioAssertions,
            List<ApiScenarioStepInput> steps,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiEnvironmentRequest(
            String workspaceCode,
            @NotBlank(message = "Environment name cannot be blank") String name,
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            List<ApiKeyValueInput> headers,
            ApiAuthConfigInput authConfig,
            Integer timeoutMs,
            Long defaultVariableSetId,
            Long mockApplicationId,
            Integer status
    ) {
    }

    public record ApiEnvironmentItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            String baseUrl,
            List<ApiKeyValueInput> headers,
            ApiAuthConfigInput authConfig,
            Integer timeoutMs,
            Long defaultVariableSetId,
            Long mockApplicationId,
            Integer status
    ) {
    }

    public record ApiVariableItem(
            String name,
            String value,
            Boolean sensitive
    ) {
    }

    public record ApiVariableSetRequest(
            String workspaceCode,
            @NotBlank(message = "Variable set name cannot be blank") String name,
            List<ApiVariableItem> variables,
            Integer status
    ) {
    }

    public record ApiVariableSetItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            List<ApiVariableItem> variables,
            Integer status
    ) {
    }

    public record ApiDataFileUpdateRequest(
            String workspaceCode,
            @NotBlank(message = "Data file name cannot be blank") String fileName,
            String caseDescColumn,
            Boolean ignoreFirstLine
    ) {
    }

    public record ApiDataFileItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String fileName,
            String originalFileName,
            String fileType,
            String encoding,
            String delimiter,
            Boolean ignoreFirstLine,
            String caseDescColumn,
            Integer rowCount,
            List<String> columns,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDataFileDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String fileName,
            String originalFileName,
            String fileType,
            String encoding,
            String delimiter,
            Boolean ignoreFirstLine,
            String caseDescColumn,
            Integer rowCount,
            List<String> columns,
            List<ApiDataFileRowPreview> previewRows,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiDataFilePreview(
            Long id,
            List<String> columns,
            List<ApiDataFileRowPreview> rows,
            Integer rowCount
    ) {
    }

    public record ApiDataFileRowPreview(
            Integer rowIndex,
            String caseDesc,
            Map<String, String> values
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiScenarioTestDatasetColumn(
            @NotBlank(message = "Column name cannot be blank") String name,
            String sourceType
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiScenarioTestDatasetRow(
            Integer rowIndex,
            Map<String, String> values
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiScenarioTestDatasetSaveRequest(
            @NotBlank(message = "Test dataset name cannot be blank") String datasetName,
            Boolean enabled,
            String sourceType,
            Long sourceFileId,
            String caseDescColumn,
            List<ApiScenarioTestDatasetColumn> columns,
            List<ApiScenarioTestDatasetRow> rows
    ) {
    }

    public record ApiScenarioTestDatasetItem(
            Long id,
            Long scenarioId,
            String datasetName,
            Boolean enabled,
            String sourceType,
            String caseDescColumn,
            Integer rowCount,
            List<ApiScenarioTestDatasetColumn> columns,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiScenarioTestDatasetDetail(
            Long id,
            Long scenarioId,
            String datasetName,
            Boolean enabled,
            String sourceType,
            Long sourceFileId,
            String caseDescColumn,
            Integer rowCount,
            List<ApiScenarioTestDatasetColumn> columns,
            List<ApiScenarioTestDatasetRow> rows,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ApiRunRequest(
            String workspaceCode,
            Long environmentId,
            Long variableSetId,
            String branchName,
            String triggerSource,
            String runOn,
            Boolean testDatasetEnabled,
            Long testDatasetId,
            Integer loopCount,
            Integer threadCount,
            Boolean mockEnabled,
            Long mockApplicationId,
            Long mockBusinessScenarioId,
            Map<String, String> rowVariables,
            String runnerId,
            Long mockReleaseId
    ) {
        public ApiRunRequest(String workspaceCode, Long environmentId, Long variableSetId, String branchName, String triggerSource) {
            this(workspaceCode, environmentId, variableSetId, branchName, triggerSource, null, null, null, null, null, null, null, null, null, null, null);
        }

        public ApiRunRequest(
                String workspaceCode,
                Long environmentId,
                Long variableSetId,
                String branchName,
                String triggerSource,
                String runOn,
                Boolean testDatasetEnabled,
                Long testDatasetId,
                Integer loopCount,
                Integer threadCount,
                Boolean mockEnabled,
                Long mockApplicationId,
                Long mockBusinessScenarioId,
                Map<String, String> rowVariables,
                String runnerId
        ) {
            this(workspaceCode, environmentId, variableSetId, branchName, triggerSource, runOn, testDatasetEnabled,
                    testDatasetId, loopCount, threadCount, mockEnabled, mockApplicationId, mockBusinessScenarioId,
                    rowVariables, runnerId, null);
        }
    }

    public record ApiDebugDefinitionRequest(
            String workspaceCode,
            Long definitionId,
            String name,
            @Valid @NotNull(message = "Request config cannot be blank") ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiExtractorInput> extractors,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            Long environmentId,
            Long variableSetId,
            Boolean mockEnabled,
            Long mockApplicationId,
            Long mockBusinessScenarioId
    ) {
        public ApiDebugDefinitionRequest(
                String workspaceCode,
                Long definitionId,
                String name,
                ApiRequestConfigInput requestConfig,
                List<ApiAssertionInput> assertions,
                List<ApiExtractorInput> extractors,
                List<ApiProcessorInput> preProcessors,
                List<ApiProcessorInput> postProcessors,
                Long environmentId,
                Long variableSetId,
                Boolean mockEnabled,
                Long mockApplicationId
        ) {
            this(workspaceCode, definitionId, name, requestConfig, assertions, extractors, preProcessors, postProcessors,
                    environmentId, variableSetId, mockEnabled, mockApplicationId, null);
        }
    }

    public record ApiDebugCaseRequest(
            String workspaceCode,
            Long caseId,
            Long definitionId,
            String name,
            @Valid @NotNull(message = "Request config cannot be blank") ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            Long environmentId,
            Long variableSetId,
            Boolean mockEnabled,
            Long mockApplicationId,
            Long mockBusinessScenarioId
    ) {
        public ApiDebugCaseRequest(
                String workspaceCode,
                Long caseId,
                Long definitionId,
                String name,
                ApiRequestConfigInput requestConfig,
                List<ApiAssertionInput> assertions,
                List<ApiProcessorInput> preProcessors,
                List<ApiProcessorInput> postProcessors,
                Long environmentId,
                Long variableSetId,
                Boolean mockEnabled,
                Long mockApplicationId
        ) {
            this(workspaceCode, caseId, definitionId, name, requestConfig, assertions, preProcessors, postProcessors,
                    environmentId, variableSetId, mockEnabled, mockApplicationId, null);
        }
    }

    public record ApiRequestSnapshot(
            String method,
            String url,
            Map<String, String> headers,
            List<ApiKeyValueInput> queryParams,
            List<ApiKeyValueInput> cookies,
            String bodyType,
            String bodyContentType,
            List<ApiKeyValueInput> bodyFormItems,
            String bodyFileName,
            String bodyFileContentType,
            String body
    ) {
    }

    public record ApiResponseSnapshot(
            Integer statusCode,
            Map<String, String> headers,
            String body,
            String contentType
    ) {
    }

    public record ApiAssertionResult(
            String id,
            String type,
            String name,
            String subject,
            String condition,
            String expectedValue,
            String actualValue,
            boolean success,
            String message
    ) {
        public ApiAssertionResult(String type, String subject, boolean success, String message) {
            this(null, type, null, subject, null, null, null, success, message);
        }
    }

    public record ApiExtractionResult(
            String name,
            boolean success,
            String value,
            String message
    ) {
    }

    public record ApiAutomationReportItem(
            String reportKey,
            String objectType,
            Long historyId,
            Long reportId,
            String workspaceCode,
            String workspaceName,
            Long objectId,
            String objectName,
            String reportName,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Integer statusCode,
            Long durationMs,
            Long responseSize,
            Long environmentId,
            String environmentName,
            Long variableSetId,
            String variableSetName,
            String runMode,
            String runOn,
            String branchName,
            String triggerSource,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileName,
            Integer dataRowCount,
            String operatorName,
            LocalDateTime createdAt,
            Boolean archived
    ) {
    }

    public record ApiAutomationReportDetail(
            String reportKey,
            String objectType,
            Long historyId,
            Long reportId,
            String workspaceCode,
            String workspaceName,
            Long objectId,
            String objectName,
            String reportName,
            String result,
            String failureSummary,
            Integer totalCount,
            Integer successCount,
            Integer failedCount,
            Integer skippedCount,
            Integer statusCode,
            Long durationMs,
            Long responseSize,
            Long environmentId,
            String environmentName,
            Long variableSetId,
            String variableSetName,
            String runMode,
            String runOn,
            Boolean continueOnFailure,
            Integer globalTimeoutMs,
            Integer stepFailureRetryCount,
            Integer defaultStepWaitMs,
            String branchName,
            String triggerSource,
            Boolean dataDrivenEnabled,
            Long dataFileId,
            String dataFileName,
            Integer dataRowCount,
            String operatorName,
            LocalDateTime createdAt,
            Boolean archived,
            String contextSnapshotJson,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            List<ApiExecutionSuiteRunItemSnapshot> itemSnapshots,
            List<ApiRunStepResultResponse> stepResults
    ) {
    }

    public record ApiAutomationReportAnalysis(
            long totalCount,
            long passedCount,
            long failedCount,
            long skippedCount,
            double failureRate,
            Long averageDurationMs,
            List<ApiAutomationReportFailureBucket> failureReasons,
            List<ApiAutomationReportFailureBucket> topFailedObjects,
            List<ApiAutomationReportItem> recentFailures
    ) {
    }

    public record ApiAutomationReportFailureBucket(
            String key,
            String label,
            long count,
            Long durationMs
    ) {
    }

    public record ApiAutomationReportStatistics(
            List<ApiAutomationReportTrendPoint> trendPoints,
            List<ApiAutomationReportDistributionBucket> resultDistribution,
            List<ApiAutomationReportDistributionBucket> objectTypeDistribution,
            List<ApiAutomationReportItem> slowestRuns
    ) {
    }

    public record ApiAutomationReportTrendPoint(
            String date,
            long totalCount,
            long passedCount,
            long failedCount,
            long skippedCount,
            double failureRate,
            Long averageDurationMs
    ) {
    }

    public record ApiAutomationReportDistributionBucket(
            String key,
            String label,
            long count,
            Long durationMs
    ) {
    }

    public record ApiProcessorResult(
            String stage,
            String processorType,
            String name,
            boolean success,
            Long durationMs,
            String message,
            List<String> logs,
            Map<String, String> outputVariables
    ) {
    }

    public record ApiRunStepResultResponse(
            Long id,
            Long reportId,
            Integer stepOrder,
            String stepName,
            String stepKind,
            String stepKey,
            String parentStepKey,
            Integer depth,
            Long definitionId,
            Long suiteItemId,
            Integer suiteItemOrder,
            boolean success,
            Long durationMs,
            ApiRequestSnapshot request,
            ApiResponseSnapshot response,
            List<ApiAssertionResult> assertionResults,
            List<ApiExtractionResult> extractionResults,
            List<ApiProcessorResult> processorResults,
            String errorMessage,
            LocalDateTime createdAt
    ) {
        public ApiRunStepResultResponse(
                Long id,
                Long reportId,
                Integer stepOrder,
                String stepName,
                Long definitionId,
                boolean success,
                Long durationMs,
                ApiRequestSnapshot request,
                ApiResponseSnapshot response,
                List<ApiAssertionResult> assertionResults,
                List<ApiExtractionResult> extractionResults,
                List<ApiProcessorResult> processorResults,
                String errorMessage,
                LocalDateTime createdAt
        ) {
            this(id, reportId, stepOrder, stepName, "REQUEST", defaultStepKey(stepOrder), null, 0, definitionId, null, null, success, durationMs, request, response,
                    assertionResults, extractionResults, processorResults, errorMessage, createdAt);
        }

        public ApiRunStepResultResponse(
                Long id,
                Long reportId,
                Integer stepOrder,
                String stepName,
                String stepKind,
                Long definitionId,
                boolean success,
                Long durationMs,
                ApiRequestSnapshot request,
                ApiResponseSnapshot response,
                List<ApiAssertionResult> assertionResults,
                List<ApiExtractionResult> extractionResults,
                List<ApiProcessorResult> processorResults,
                String errorMessage,
                LocalDateTime createdAt
        ) {
            this(id, reportId, stepOrder, stepName, stepKind, defaultStepKey(stepOrder), null, 0, definitionId, null, null, success, durationMs, request, response,
                    assertionResults, extractionResults, processorResults, errorMessage, createdAt);
        }

        public ApiRunStepResultResponse(
                Long id,
                Long reportId,
                Integer stepOrder,
                String stepName,
                String stepKind,
                Long definitionId,
                Long suiteItemId,
                Integer suiteItemOrder,
                boolean success,
                Long durationMs,
                ApiRequestSnapshot request,
                ApiResponseSnapshot response,
                List<ApiAssertionResult> assertionResults,
                List<ApiExtractionResult> extractionResults,
                List<ApiProcessorResult> processorResults,
                String errorMessage,
                LocalDateTime createdAt
        ) {
            this(id, reportId, stepOrder, stepName, stepKind, defaultStepKey(stepOrder), null, 0, definitionId, suiteItemId, suiteItemOrder, success, durationMs, request, response,
                    assertionResults, extractionResults, processorResults, errorMessage, createdAt);
        }

        public ApiRunStepResultResponse(
                Long id,
                Long reportId,
                Integer stepOrder,
                String stepName,
                String stepKind,
                String stepKey,
                String parentStepKey,
                Integer depth,
                Long definitionId,
                boolean success,
                Long durationMs,
                ApiRequestSnapshot request,
                ApiResponseSnapshot response,
                List<ApiAssertionResult> assertionResults,
                List<ApiExtractionResult> extractionResults,
                List<ApiProcessorResult> processorResults,
                String errorMessage,
                LocalDateTime createdAt
        ) {
            this(id, reportId, stepOrder, stepName, stepKind, stepKey, parentStepKey, depth, definitionId, null, null, success, durationMs, request, response,
                    assertionResults, extractionResults, processorResults, errorMessage, createdAt);
        }

        private static String defaultStepKey(Integer stepOrder) {
            return stepOrder == null ? null : "step-" + stepOrder;
        }
    }

    public record ApiRunResponse(
            Long taskId,
            Long reportId,
            String taskName,
            String reportName,
            String result,
            String failureSummary,
            List<ApiExecutionSuiteDataIteration> dataIterations,
            List<ApiRunStepResultResponse> stepResults
    ) {
    }
}
