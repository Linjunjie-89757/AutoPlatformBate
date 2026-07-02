package com.company.autoplatform.ai;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/cases/ai")
public class AiCaseController {

    private final AiCaseService aiCaseService;
    private final AiGenerationTaskService aiGenerationTaskService;
    private final AiGenerationTaskRunner aiGenerationTaskRunner;

    public AiCaseController(
            AiCaseService aiCaseService,
            AiGenerationTaskService aiGenerationTaskService,
            AiGenerationTaskRunner aiGenerationTaskRunner
    ) {
        this.aiCaseService = aiCaseService;
        this.aiGenerationTaskService = aiGenerationTaskService;
        this.aiGenerationTaskRunner = aiGenerationTaskRunner;
    }

    @GetMapping("/config")
    public ApiResponse<AiCaseConfigResponse> getConfig(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "targetWorkspaceCode", required = false) String targetWorkspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.getConfig(workspaceCode, targetWorkspaceCode));
    }

    @PostMapping("/config")
    public ApiResponse<AiCaseConfigItem> createConfig(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveAiCaseConfigRequest request
    ) {
        return ApiResponse.ok(aiCaseService.createConfig(workspaceCode, request), "AI config created");
    }

    @PutMapping("/config/{id}")
    public ApiResponse<AiCaseConfigItem> updateConfig(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveAiCaseConfigRequest request
    ) {
        return ApiResponse.ok(aiCaseService.updateConfig(id, workspaceCode, request), "AI config updated");
    }

    @PostMapping("/config/bootstrap-from-legacy")
    public ApiResponse<AiCaseConfigResponse> bootstrapConfigFromLegacy(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.bootstrapConfigFromLegacy(workspaceCode), "AI config bootstrapped from legacy");
    }

    @GetMapping("/providers")
    public ApiResponse<java.util.List<AiProviderConnectionItem>> getProviders(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.getProviders(workspaceCode));
    }

    @PostMapping("/providers")
    public ApiResponse<AiProviderConnectionItem> createProvider(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody SaveAiProviderConnectionRequest request
    ) {
        return ApiResponse.ok(aiCaseService.createProvider(workspaceCode, request), "AI provider created");
    }

    @PostMapping("/providers/preview-models")
    public ApiResponse<PreviewAiProviderModelsResponse> previewProviderModels(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody PreviewAiProviderModelsRequest request
    ) {
        return ApiResponse.ok(aiCaseService.previewProviderModels(workspaceCode, request), "AI provider models previewed");
    }

    @PutMapping("/providers/{id}")
    public ApiResponse<AiProviderConnectionItem> updateProvider(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody SaveAiProviderConnectionRequest request
    ) {
        return ApiResponse.ok(aiCaseService.updateProvider(id, workspaceCode, request), "AI provider updated");
    }

    @DeleteMapping("/providers/{id}")
    public ApiResponse<Void> deleteProvider(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        aiCaseService.deleteProvider(id, workspaceCode);
        return ApiResponse.ok(null, "AI provider deleted");
    }

    @PostMapping("/providers/{id}/test")
    public ApiResponse<TestAiProviderConnectionResponse> testProvider(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.testProvider(id, workspaceCode), "AI 服务连接测试完成");
    }

    @PostMapping("/providers/{id}/fetch-models")
    public ApiResponse<FetchAiProviderModelsResponse> fetchProviderModels(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.fetchProviderModels(id, workspaceCode), "AI provider models fetched");
    }

    @GetMapping("/providers/{id}/secret")
    public ApiResponse<AiProviderConnectionSecretResponse> getProviderSecret(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.getProviderSecret(id, workspaceCode));
    }

    @GetMapping("/providers/{id}/models")
    public ApiResponse<java.util.List<AiProviderModelItem>> getProviderModels(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.getProviderModels(id, workspaceCode));
    }

    @PostMapping("/providers/{id}/models/probe")
    public ApiResponse<AiProviderModelItem> probeProviderModel(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ProbeAiProviderModelRequest request
    ) {
        return ApiResponse.ok(aiCaseService.probeProviderModel(id, workspaceCode, request), "AI provider model probed");
    }

    @GetMapping("/config/{id}/secret")
    public ApiResponse<AiCaseConfigSecretResponse> getConfigSecret(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiCaseService.getConfigSecret(id, workspaceCode));
    }

    @PostMapping("/config/test")
    public ApiResponse<TestAiCaseConfigResponse> testConfig(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveAiCaseConfigRequest request
    ) {
        return ApiResponse.ok(aiCaseService.testConfig(workspaceCode, request), "AI 配置连接测试完成");
    }

    @PostMapping("/review")
    public ApiResponse<AiReviewResult> reviewGeneratedCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReviewAiGeneratedCasesRequest request
    ) {
        return ApiResponse.ok(aiCaseService.reviewGeneratedCases(workspaceCode, request), "AI cases reviewed");
    }

    @PostMapping("/generate")
    public ApiResponse<GenerateAiCasesResponse> generateCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody GenerateAiCasesRequest request
    ) {
        return ApiResponse.ok(aiCaseService.generateCases(workspaceCode, request), "AI cases generated");
    }

    @PostMapping("/tasks/image-support/validate")
    public ApiResponse<Void> validateTaskImageSupport(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody ValidateAiGenerationImageSupportRequest request
    ) {
        aiCaseService.validateGenerationImageSupport(request == null ? null : request.assetIds());
        return ApiResponse.ok(null, "AI generation image support validated");
    }

    @PostMapping("/tasks")
    public ApiResponse<AiGenerationTaskResponse> createTask(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateAiGenerationTaskRequest request
    ) {
        AiGenerationTaskResponse response = aiGenerationTaskService.createTask(workspaceCode, request);
        aiGenerationTaskRunner.runTask(response.taskId(), response.workspaceCode());
        return ApiResponse.ok(response, "AI generation task created");
    }

    @GetMapping("/tasks")
    public ApiResponse<java.util.List<AiGenerationTaskResponse>> listTasks(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiGenerationTaskService.listTasks(workspaceCode));
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<AiGenerationTaskResponse> getTask(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiGenerationTaskService.getTask(taskId, workspaceCode));
    }

    @GetMapping(value = "/tasks/{taskId}/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody streamTaskEvents(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return aiGenerationTaskService.streamTaskEvents(taskId, workspaceCode);
    }

    @PutMapping("/tasks/{taskId}")
    public ApiResponse<AiGenerationTaskResponse> updateTask(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody UpdateAiGenerationTaskRequest request
    ) {
        return ApiResponse.ok(aiGenerationTaskService.updateTask(taskId, workspaceCode, request), "AI generation task updated");
    }

    @DeleteMapping("/tasks/{taskId}")
    public ApiResponse<Void> deleteTask(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        aiGenerationTaskService.deleteTask(taskId, workspaceCode);
        return ApiResponse.ok(null, "AI generation task deleted");
    }

    @PostMapping("/tasks/{taskId}/cancel")
    public ApiResponse<AiGenerationTaskResponse> cancelTask(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(aiGenerationTaskService.cancelTask(taskId, workspaceCode), "AI generation task canceled");
    }

    @PostMapping("/tasks/{taskId}/retry")
    public ApiResponse<AiGenerationTaskResponse> retryTask(
            @PathVariable String taskId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        AiGenerationTaskResponse response = aiGenerationTaskService.retryTask(taskId, workspaceCode);
        aiGenerationTaskRunner.runTask(response.taskId(), response.workspaceCode());
        return ApiResponse.ok(response, "AI generation task retried");
    }

    @PostMapping("/requirement-import")
    public ApiResponse<ImportRequirementDocumentResponse> importRequirementDocument(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestPart("file") MultipartFile file
    ) {
        return ApiResponse.ok(aiCaseService.importRequirementDocument(workspaceCode, file), "Requirement document imported");
    }

    @PostMapping("/assets")
    public ApiResponse<java.util.List<AiRequirementAssetResponse>> uploadRequirementAssets(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestPart("files") java.util.List<MultipartFile> files
    ) {
        return ApiResponse.ok(aiCaseService.uploadRequirementAssets(workspaceCode, files), "Requirement assets uploaded");
    }

    @DeleteMapping("/assets/{id}")
    public ApiResponse<Void> deleteRequirementAsset(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        aiCaseService.deleteRequirementAsset(id, workspaceCode);
        return ApiResponse.ok(null, "Requirement asset deleted");
    }

    @GetMapping("/assets/{id}/download")
    public ResponseEntity<Resource> downloadRequirementAsset(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        var file = aiCaseService.downloadRequirementAsset(id, workspaceCode);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.fileSize())
                .body(file.resource());
    }
}
