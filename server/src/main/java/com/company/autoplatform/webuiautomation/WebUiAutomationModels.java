package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class WebUiAutomationModels {

    private WebUiAutomationModels() {
    }

    public record SaveWebUiCaseRequest(
            String workspaceCode,
            String moduleName,
            @NotBlank(message = "Case name cannot be blank") String caseName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            List<@Valid SaveWebUiCaseStepRequest> steps
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SaveWebUiCaseStepRequest(
            @NotBlank(message = "Step name cannot be blank") String stepName,
            String stepType,
            Long elementId,
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String inputValue,
            Integer timeoutMs,
            Boolean continueOnFailure,
            String screenshotPolicy,
            Boolean enabled,
            Integer sortOrder
    ) {
    }

    public record WebUiCaseItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String caseName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            Integer stepCount,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiCaseDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String caseName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<WebUiCaseStepItem> steps
    ) {
    }

    public record WebUiCaseStepItem(
            Long id,
            Long caseId,
            String stepName,
            String stepType,
            Long elementId,
            String elementName,
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String inputValue,
            Integer timeoutMs,
            Boolean continueOnFailure,
            String screenshotPolicy,
            Boolean enabled,
            Integer sortOrder
    ) {
    }

    public record SaveWebUiCaseTemplateRequest(
            String workspaceCode,
            String moduleName,
            @NotBlank(message = "Template name cannot be blank") String templateName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            List<@Valid SaveWebUiCaseStepRequest> steps
    ) {
    }

    public record SaveWebUiTemplateFromCaseRequest(
            String workspaceCode,
            @NotBlank(message = "Template name cannot be blank") String templateName,
            String description
    ) {
    }

    public record WebUiCaseTemplateItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String templateName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            Integer stepCount,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiCaseTemplateDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String templateName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            Integer stepCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<WebUiCaseTemplateStepItem> steps
    ) {
    }

    public record WebUiCaseTemplateStepItem(
            Long id,
            Long templateId,
            String stepName,
            String stepType,
            Long elementId,
            String elementName,
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String inputValue,
            Integer timeoutMs,
            Boolean continueOnFailure,
            String screenshotPolicy,
            Boolean enabled,
            Integer sortOrder
    ) {
    }

    public record SaveWebUiEnvironmentRequest(
            String workspaceCode,
            @NotBlank(message = "Environment name cannot be blank") String environmentName,
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Long defaultVariableSetId,
            Long mockApplicationId,
            Integer status
    ) {
    }

    public record WebUiEnvironmentItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String environmentName,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Integer status,
            String source,
            Long defaultVariableSetId,
            String defaultVariableSetName,
            Long mockApplicationId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiRunRequest(
            Long environmentId,
            Boolean headless,
            Long variableSetId,
            Boolean mockEnabled,
            Long mockApplicationId,
            Map<String, String> runtimeVariables,
            String runnerId,
            List<Map<String, Object>> artifactRefs
    ) {
    }

    public record WebUiBatchRunRequest(
            String batchName,
            List<Long> caseIds,
            Long environmentId,
            Boolean headless,
            Boolean stopOnFailure,
            Long variableSetId,
            Boolean mockEnabled,
            Long mockApplicationId,
            Map<String, String> runtimeVariables
    ) {
    }

    public record WebUiCiBatchRunRequest(
            @NotBlank(message = "Workspace code cannot be blank") String workspaceCode,
            String batchName,
            List<Long> caseIds,
            Long environmentId,
            Boolean headless,
            Boolean stopOnFailure,
            String externalBuildId,
            Long variableSetId,
            Map<String, String> runtimeVariables
    ) {
    }

    public record SaveWebUiCiTokenRequest(
            String workspaceCode,
            @NotBlank(message = "Token name cannot be blank") String tokenName
    ) {
    }

    public record DebugRunWebUiCaseRequest(
            Long caseId,
            Long environmentId,
            String workspaceCode,
            String moduleName,
            @NotBlank(message = "Case name cannot be blank") String caseName,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            Long variableSetId,
            Boolean mockEnabled,
            Long mockApplicationId,
            Map<String, String> runtimeVariables,
            List<@Valid SaveWebUiCaseStepRequest> steps
    ) {
    }

    public record ValidateWebUiLocatorRequest(
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            String browserType,
            Boolean headless,
            @NotBlank(message = "Locator type cannot be blank") String locatorType,
            @NotBlank(message = "Locator value cannot be blank") String locatorValue,
            Integer timeoutMs
    ) {
    }

    public record ValidateWebUiLocatorResponse(
            Boolean matched,
            Integer matchCount,
            String errorMessage,
            String screenshotBase64,
            String runnerRunId
    ) {
    }

    public record ApplyLocalRunnerElementValidationResultRequest(
            Boolean matched,
            Integer matchCount,
            String errorMessage,
            String screenshotBase64,
            String runnerRunId
    ) {
    }

    public record SaveWebUiElementRequest(
            String workspaceCode,
            Long pageId,
            Long groupId,
            @NotBlank(message = "Page name cannot be blank") String pageName,
            String groupName,
            @NotBlank(message = "Element name cannot be blank") String elementName,
            @NotBlank(message = "Locator type cannot be blank") String locatorType,
            @NotBlank(message = "Locator value cannot be blank") String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String description,
            String status,
            Long collectTaskId,
            String collectSource,
            Integer collectConfidence,
            String collectValidationStatus,
            Integer collectMatchCount,
            String collectValidationMessage,
            String collectScreenshotBase64
    ) {
    }

    public record ValidateWebUiElementRequest(
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            String browserType,
            Boolean headless,
            Integer timeoutMs
    ) {
    }

    public record BatchUpdateWebUiElementStatusRequest(
            List<Long> elementIds,
            @NotBlank(message = "Status cannot be blank") String status
    ) {
    }

    public record BatchMoveWebUiElementRequest(
            List<Long> elementIds,
            Long pageId,
            Long groupId
    ) {
    }

    public record BatchDeleteWebUiElementRequest(
            List<Long> elementIds
    ) {
    }

    public record BatchValidateWebUiElementRequest(
            List<Long> elementIds,
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            String browserType,
            Boolean headless,
            Integer timeoutMs
    ) {
    }

    public record WebUiElementBatchResult(
            Integer requestedCount,
            Integer updatedCount,
            Integer deletedCount,
            Integer blockedCount,
            List<WebUiElementBatchBlockedItem> blockedItems
    ) {
    }

    public record WebUiElementBatchBlockedItem(
            Long elementId,
            String elementName,
            Integer usageCount,
            String reason
    ) {
    }

    public record WebUiElementBatchValidateResult(
            Integer totalCount,
            Integer passedCount,
            Integer failedCount,
            List<WebUiElementValidateResultItem> results
    ) {
    }

    public record WebUiElementValidateResultItem(
            Long elementId,
            String elementName,
            Boolean matched,
            Integer matchCount,
            String errorMessage,
            String screenshotBase64
    ) {
    }

    public record CollectWebUiElementsRequest(
            String pageUrl,
            Long environmentId,
            Long moduleId,
            Long pageId,
            String pageName,
            String groupStrategy,
            Long groupId,
            String groupName,
            String scope,
            String htmlText,
            String screenshotNote,
            String browserType,
            Boolean headless,
            Integer timeoutMs,
            Long providerConnectionId,
            String modelName
    ) {
    }

    public record WebUiElementCollectCandidate(
            String groupName,
            String elementName,
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            List<WebUiElementCollectLocatorCandidate> locatorCandidates,
            Integer confidence,
            String reason,
            String tagName,
            String elementType,
            String text,
            String placeholder,
            String ariaLabel,
            String labelText,
            String nearbyHeading,
            String businessMeaning,
            Boolean recommendedToSave,
            String notRecommendedReason,
            String maintenanceSuggestion,
            String stabilityNote,
            String validationStatus,
            Integer matchCount,
            String validationMessage,
            String screenshotBase64,
            String candidateSource,
            String saveBlockedReason
    ) {
    }

    public record WebUiElementCollectLocatorCandidate(
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            Integer confidence,
            String reason
    ) {
    }

    public record WebUiElementCollectResponse(
            List<WebUiElementCollectCandidate> candidates,
            String source,
            String message,
            Boolean aiEnhanced,
            String fallbackReason
    ) {
    }

    public record LocalRunnerCollectTaskRequest(
            String runnerId,
            String sessionId,
            String actualUrl,
            String pageTitle,
            Long moduleId,
            Long pageId,
            String pageName,
            String scope,
            Long providerConnectionId,
            String modelName,
            Integer rawCount,
            String screenshotBase64,
            List<WebUiElementCollectCandidate> candidates
    ) {
    }

    public record WebUiElementCollectTaskResponse(
            Long taskId,
            String status,
            String currentStage,
            Integer progressPercent,
            String source,
            String runnerId,
            String sessionId,
            String actualUrl,
            String pageTitle,
            Long aiModelConfigId,
            String aiModelName,
            Integer rawCount,
            Integer finalCount,
            String globalScreenshotBase64,
            WebUiElementCollectFilterSummary filterSummary,
            List<WebUiElementCollectFilterLog> filterLogs,
            List<WebUiElementCollectCandidate> candidates,
            String message,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {
    }

    public record WebUiElementCollectTaskListItem(
            Long taskId,
            String status,
            String currentStage,
            Integer progressPercent,
            String source,
            String runnerId,
            String sessionId,
            String actualUrl,
            String pageTitle,
            Long moduleId,
            Long pageId,
            String pageName,
            Long aiModelConfigId,
            String aiModelName,
            Integer rawCount,
            Integer finalCount,
            Integer validationPassedCount,
            Integer validationFailedCount,
            Integer validationMultipleCount,
            Integer validationUnverifiedCount,
            Integer screenshotEvidenceCount,
            String message,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {
    }

    public record LocalRunnerCollectValidationResultRequest(
            String runnerId,
            String sessionId,
            List<WebUiElementCollectValidationResult> results
    ) {
    }

    public record LocalRunnerCollectValidationCommandRequest(
            String runnerId,
            String sessionId,
            String currentUrl,
            List<WebUiElementCollectValidationTarget> locators
    ) {
    }

    public record LocalRunnerCollectValidationCommandResponse(
            Long taskId,
            String status,
            Boolean runnable,
            String reason,
            String runnerId,
            String sessionId,
            List<WebUiElementCollectValidationTarget> locators
    ) {
    }

    public record WebUiElementCollectValidationTarget(
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath
    ) {
    }

    public record LocalRunnerCollectTaskDegradeRequest(
            String reason
    ) {
    }

    public record LocalRunnerCollectTaskCancelRequest(
            String reason
    ) {
    }

    public record LocalRunnerCollectTaskValidationTimeoutRequest(
            String reason
    ) {
    }

    public record WebUiElementCollectValidationResult(
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String validationStatus,
            Integer matchCount,
            String validationMessage,
            String screenshotBase64
    ) {
    }

    public record WebUiElementCollectFilterSummary(
            Integer originalCount,
            Integer emptyLocatorCount,
            Integer duplicateCount,
            Integer lowStabilityCount,
            Integer finalCount
    ) {
    }

    public record WebUiElementCollectFilterLog(
            String stage,
            String reason,
            Integer count,
            String message
    ) {
    }

    public record WebUiElementCollectFilterDetailsResponse(
            Long taskId,
            List<WebUiElementCollectFilterDetail> details
    ) {
    }

    public record WebUiElementCollectFilterDetail(
            String id,
            String stage,
            String reason,
            String message,
            Boolean recoverable,
            WebUiElementCollectCandidate candidate
    ) {
    }

    public record WebUiElementQualityCheckResult(
            Integer totalElements,
            Integer highRiskCount,
            Integer mediumRiskCount,
            Integer lowRiskCount,
            List<WebUiElementQualityIssue> issues
    ) {
    }

    public record WebUiElementQualityIssue(
            String id,
            String level,
            String title,
            String description,
            Long elementId,
            String elementName,
            Long pageId,
            Long groupId,
            String pageName,
            String groupName,
            String locatorType,
            String locatorValue,
            Integer usageCount,
            String lastValidateResult,
            LocalDateTime lastValidateAt
    ) {
    }

    public record WebUiElementItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long pageId,
            Long groupId,
            String pageName,
            String groupName,
            String elementName,
            String locatorType,
            String locatorValue,
            List<Map<String, Object>> framePath,
            List<Object> shadowPath,
            String description,
            String status,
            String lastValidateResult,
            LocalDateTime lastValidateAt,
            String lastValidateMessage,
            Integer lastMatchCount,
            String lastLocalRunnerRunId,
            Long collectTaskId,
            String collectSource,
            Integer collectConfidence,
            String collectValidationStatus,
            Integer collectMatchCount,
            String collectValidationMessage,
            String collectScreenshotBase64,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Integer usageCount
    ) {
    }

    public record WebUiElementReferenceItem(
            String sourceType,
            Long sourceId,
            String sourceName,
            String moduleName,
            Long stepId,
            String stepName,
            String stepType,
            String locatorType,
            String locatorValue,
            Boolean enabled,
            Integer sortOrder,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiElementReferenceSyncResult(
            Integer caseStepCount,
            Integer templateStepCount,
            Integer totalCount
    ) {
    }

    public record SaveWebUiElementPageRequest(
            String workspaceCode,
            Long moduleId,
            String moduleName,
            @NotBlank(message = "Page name cannot be blank") String pageName,
            String pagePath,
            String description,
            Integer sortOrder,
            String status
    ) {
    }

    public record SaveWebUiElementGroupRequest(
            String workspaceCode,
            Long pageId,
            @NotBlank(message = "Group name cannot be blank") String groupName,
            String description,
            Integer sortOrder,
            String status
    ) {
    }

    public record SaveWebUiElementModuleRequest(
            String workspaceCode,
            @NotBlank(message = "Module name cannot be blank") String moduleName,
            String description,
            Integer sortOrder,
            String status
    ) {
    }

    public record WebUiElementPageItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long moduleId,
            String moduleName,
            String pageName,
            String pagePath,
            String description,
            Integer sortOrder,
            String status,
            Integer groupCount,
            Integer elementCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiElementModuleItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String description,
            Integer sortOrder,
            String status,
            Integer pageCount,
            Integer elementCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiElementGroupItem(
            Long id,
            Long pageId,
            String workspaceCode,
            String workspaceName,
            String groupName,
            String description,
            Integer sortOrder,
            String status,
            Integer elementCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiElementTreeNode(
            String id,
            Long rawId,
            String type,
            String label,
            Integer elementCount,
            List<WebUiElementTreeNode> children
    ) {
    }

    public record WebUiRunSummary(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long batchId,
            Integer batchSortOrder,
            Long caseId,
            String caseName,
            Long environmentId,
            String environmentName,
            String status,
            String browserType,
            Boolean headless,
            String baseUrl,
            Long durationMs,
            String failureSummary,
            Integer totalSteps,
            Integer passedSteps,
            Integer failedSteps,
            Integer skippedSteps,
            String operatorName,
            String executionLocation,
            String localRunnerRunId,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            LocalDateTime createdAt
    ) {
    }

    public record WebUiRunStepResult(
            Long id,
            Long caseStepId,
            String stepName,
            String stepType,
            String status,
            String locatorType,
            String locatorValue,
            String inputValueSnapshot,
            Long durationMs,
            String errorMessage,
            Long screenshotArtifactId,
            String screenshotUrl,
            Integer sortOrder,
            LocalDateTime startedAt,
            LocalDateTime finishedAt
    ) {
    }

    public record WebUiRunDetail(
            WebUiRunSummary summary,
            WebUiExecutionContextSupport.ExecutionContextSnapshot context,
            List<WebUiRunStepResult> steps
    ) {
    }

    public record WebUiRunResponse(
            Long runId,
            Long batchId,
            Long caseId,
            String caseName,
            String status,
            Long durationMs,
            String failureSummary,
            Integer totalSteps,
            Integer passedSteps,
            Integer failedSteps,
            Integer skippedSteps,
            List<WebUiRunStepResult> stepResults
    ) {
    }

    public record WebUiLocalRunnerRunResponse(
            WebUiRunResponse run,
            RunnerTaskDetailResponse runnerTask
    ) {
    }

    public record WebUiRunBatchSummary(
            Long id,
            String workspaceCode,
            String workspaceName,
            String batchName,
            String source,
            Long environmentId,
            String environmentName,
            String status,
            Integer totalCases,
            Integer successCases,
            Integer failedCases,
            Long durationMs,
            String failureSummary,
            String operatorName,
            Long ciTokenId,
            String externalBuildId,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            LocalDateTime createdAt
    ) {
    }

    public record WebUiRunBatchDetail(
            WebUiRunBatchSummary summary,
            List<WebUiRunSummary> runs
    ) {
    }

    public record WebUiBatchRunResponse(
            Long batchId,
            String batchName,
            String status,
            Integer totalCases,
            Integer successCases,
            Integer failedCases,
            Long durationMs,
            String failureSummary,
            List<WebUiRunSummary> runs
    ) {
    }

    public record WebUiCiBatchRunResponse(
            Long batchId,
            String batchName,
            String status,
            Boolean passed,
            Integer totalCases,
            Integer successCases,
            Integer failedCases,
            Long durationMs,
            String failureSummary,
            String externalBuildId,
            String reportUrl,
            String summaryText,
            List<WebUiCiFailedRunSummary> failedRuns,
            List<WebUiRunSummary> runs
    ) {
    }

    public record WebUiCiFailedRunSummary(
            Long runId,
            Long caseId,
            String caseName,
            String status,
            String failureSummary,
            String reportUrl
    ) {
    }

    public record WebUiCiTokenSummary(
            Long id,
            String workspaceCode,
            String workspaceName,
            String tokenName,
            Integer status,
            String createdBy,
            LocalDateTime lastUsedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiCiTokenCreated(
            Long id,
            String workspaceCode,
            String workspaceName,
            String tokenName,
            Integer status,
            String createdBy,
            LocalDateTime lastUsedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String token
    ) {
    }

    public record SaveWebUiReportShareRequest(
            String shareType,
            Long targetId,
            Integer expiresInDays
    ) {
    }

    public record WebUiReportShareSummary(
            Long id,
            String workspaceCode,
            String workspaceName,
            String shareType,
            Long targetId,
            Integer status,
            LocalDateTime expiresAt,
            String createdBy,
            LocalDateTime lastAccessedAt,
            Integer accessCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiReportShareCreated(
            Long id,
            String workspaceCode,
            String workspaceName,
            String shareType,
            Long targetId,
            Integer status,
            LocalDateTime expiresAt,
            String createdBy,
            LocalDateTime lastAccessedAt,
            Integer accessCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String token,
            String shareUrl
    ) {
    }

    public record WebUiSharedReport(
            String shareType,
            WebUiRunDetail run,
            WebUiRunBatchDetail batch,
            LocalDateTime expiresAt,
            LocalDateTime generatedAt
    ) {
    }
}
