package com.company.autoplatform.ai;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.casecenter.CaseDetailResponse;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.company.autoplatform.ai.AiCaseConfigDomainService.ResolvedRoleConfig;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class AiCaseService {

    private static final String ROLE_GENERATOR = AiCaseConfigDomainService.ROLE_GENERATOR;
    private static final String ROLE_REVIEWER = AiCaseConfigDomainService.ROLE_REVIEWER;
    public static final int DEFAULT_MAX_CASES = 50;
    public static final int SYSTEM_MAX_CASES = 200;
    public static final int FINAL_MAX_CASES = 200;

    private final AiCaseConfigDomainService aiCaseConfigDomainService;
    private final AiRequirementAssetDomainService aiRequirementAssetDomainService;
    private final AiPromptBuilderSupport aiPromptBuilderSupport;
    private final AiResponseParsingSupport aiResponseParsingSupport;
    private final WorkspaceService workspaceService;
    private final AiProviderClient aiProviderClient;
    private final AiProviderDomainService aiProviderDomainService;

    public AiCaseService(
            AiCaseConfigDomainService aiCaseConfigDomainService,
            AiRequirementAssetDomainService aiRequirementAssetDomainService,
            AiPromptBuilderSupport aiPromptBuilderSupport,
            AiResponseParsingSupport aiResponseParsingSupport,
            WorkspaceService workspaceService,
            AiProviderClient aiProviderClient,
            AiProviderDomainService aiProviderDomainService
    ) {
        this.aiCaseConfigDomainService = aiCaseConfigDomainService;
        this.aiRequirementAssetDomainService = aiRequirementAssetDomainService;
        this.aiPromptBuilderSupport = aiPromptBuilderSupport;
        this.aiResponseParsingSupport = aiResponseParsingSupport;
        this.workspaceService = workspaceService;
        this.aiProviderClient = aiProviderClient;
        this.aiProviderDomainService = aiProviderDomainService;
    }

    public AiCaseConfigResponse getConfig(String headerWorkspaceCode, String targetWorkspaceCode) {
        return aiCaseConfigDomainService.getConfig(headerWorkspaceCode, targetWorkspaceCode);
    }

    public AiCaseConfigItem createConfig(String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        return aiCaseConfigDomainService.createConfig(headerWorkspaceCode, request);
    }

    public AiCaseConfigItem updateConfig(Long id, String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        return aiCaseConfigDomainService.updateConfig(id, headerWorkspaceCode, request);
    }

    public TestAiCaseConfigResponse testConfig(String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        return aiCaseConfigDomainService.testConfig(headerWorkspaceCode, request);
    }

    public AiCaseConfigSecretResponse getConfigSecret(Long id, String headerWorkspaceCode) {
        return aiCaseConfigDomainService.getConfigSecret(id, headerWorkspaceCode);
    }

    public AiProviderConnectionSecretResponse getProviderSecret(Long id, String headerWorkspaceCode) {
        return aiProviderDomainService.getProviderSecret(id, headerWorkspaceCode);
    }

    public void validateGenerationImageSupport(List<Long> assetIds) {
        List<AiRequirementAssetEntity> assets = aiRequirementAssetDomainService.loadRequirementAssets(assetIds);
        if (assets.isEmpty()) {
            return;
        }
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_GENERATOR);
        if (!aiCaseConfigDomainService.supportsImageInputForGeneration(resolved)) {
            throw new BadRequestException("当前生成模型不支持图片识别，是否忽略图片并仅基于文本继续生成？");
        }
    }

    public GenerateAiCasesResponse generateCases(String headerWorkspaceCode, GenerateAiCasesRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode())
        );
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_GENERATOR);
        AiCaseConfigEntity config = resolved.roleConfig();
        int systemMaxCases = SYSTEM_MAX_CASES;
        int requestedMaxCases = request.maxCases() == null
                ? (config.getMaxCases() == null ? DEFAULT_MAX_CASES : config.getMaxCases())
                : request.maxCases();
        int effectiveMaxCases = Math.min(requestedMaxCases, SYSTEM_MAX_CASES);
        List<AiRequirementAssetEntity> assets = aiRequirementAssetDomainService.loadRequirementAssets(request.assetIds());
        if (!assets.isEmpty() && !aiCaseConfigDomainService.supportsImageInputForGeneration(resolved)) {
            throw new BadRequestException("The current AI config does not support image input. Remove the images or enable an image-capable model.");
        }
        List<AiProviderClient.ImageInput> imageInputs = aiRequirementAssetDomainService.toImageInputs(assets);
        boolean ignoredImages = false;
        String prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, effectiveMaxCases, assets, false);
        AiGeneratedCasesResult result;
        try {
            result = aiProviderClient.generate(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    imageInputs
            );
        } catch (BadRequestException exception) {
            if (assets.isEmpty() || !aiResponseParsingSupport.isImageInputUnsupportedError(exception)) {
                throw exception;
            }
            ignoredImages = true;
            prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, effectiveMaxCases, List.of(), false);
            result = aiProviderClient.generate(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    List.of()
            );
        }
        return new GenerateAiCasesResponse(
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                resolved.profile().provider(),
                config.getModel(),
                systemMaxCases,
                requestedMaxCases,
                effectiveMaxCases,
                result.generatedCases().size(),
                result.generatedCases(),
                result.coverageSummary(),
                result.remainingCoverageGaps(),
                result.warnings(),
                result.invalidCases(),
                result.rawContent(),
                ignoredImages
        );
    }

    public StreamedGenerateCasesResult streamGenerateCases(
            String headerWorkspaceCode,
            GenerateAiCasesRequest request,
            Consumer<AiStreamModelInfo> modelConsumer,
            Consumer<GeneratedCaseStreamUpdate> caseConsumer
    ) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode())
        );
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_GENERATOR);
        AiCaseConfigEntity config = resolved.roleConfig();
        int systemMaxCases = SYSTEM_MAX_CASES;
        int requestedMaxCases = request.maxCases() == null
                ? (config.getMaxCases() == null ? DEFAULT_MAX_CASES : config.getMaxCases())
                : request.maxCases();
        int effectiveMaxCases = Math.min(requestedMaxCases, SYSTEM_MAX_CASES);
        List<AiRequirementAssetEntity> assets = aiRequirementAssetDomainService.loadRequirementAssets(request.assetIds());
        if (!assets.isEmpty() && !aiCaseConfigDomainService.supportsImageInputForGeneration(resolved)) {
            throw new BadRequestException("The current AI config does not support image input. Remove the images or enable an image-capable model.");
        }
        List<AiProviderClient.ImageInput> imageInputs = aiRequirementAssetDomainService.toImageInputs(assets);
        if (modelConsumer != null) {
            modelConsumer.accept(new AiStreamModelInfo(resolved.profile().provider(), config.getModel()));
        }
        boolean ignoredImages = false;
        String prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, effectiveMaxCases, assets, true);
        List<GeneratedAiCaseItem> generatedCases = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<AiInvalidCaseItem> invalidCases = new ArrayList<>();
        StringBuilder rawOutput = new StringBuilder();
        StringBuilder lineBuffer = new StringBuilder();
        Consumer<String> deltaConsumer = delta -> {
            rawOutput.append(delta);
            lineBuffer.append(delta);
            aiResponseParsingSupport.drainCompleteLines(lineBuffer, line -> aiResponseParsingSupport.emitGeneratedCaseLine(
                    line,
                    effectiveMaxCases,
                    generatedCases,
                    warnings,
                    invalidCases,
                    rawOutput,
                    caseConsumer
            ));
        };

        AiProviderClient.StreamContentResult streamResult;
        try {
            streamResult = aiProviderClient.streamStructuredContentWithResult(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    imageInputs,
                    deltaConsumer
            );
        } catch (BadRequestException exception) {
            if (assets.isEmpty() || !aiResponseParsingSupport.isImageInputUnsupportedError(exception)) {
                throw exception;
            }
            ignoredImages = true;
            rawOutput.setLength(0);
            lineBuffer.setLength(0);
            generatedCases.clear();
            warnings.clear();
            invalidCases.clear();
            prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, effectiveMaxCases, List.of(), true);
            streamResult = aiProviderClient.streamStructuredContentWithResult(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    List.of(),
                    deltaConsumer
            );
        }
        String finalContent = streamResult.content();
        String rawContent = finalContent == null || finalContent.isBlank() ? rawOutput.toString() : finalContent;
        aiResponseParsingSupport.emitGeneratedCaseLine(
                lineBuffer.toString(),
                effectiveMaxCases,
                generatedCases,
                warnings,
                invalidCases,
                new StringBuilder(rawContent),
                caseConsumer
        );
        if (generatedCases.isEmpty()) {
            AiGeneratedCasesResult parsed = aiProviderClient.parseGeneratedCasesContent(rawContent, effectiveMaxCases);
            warnings.addAll(parsed.warnings());
            invalidCases.addAll(parsed.invalidCases());
            for (GeneratedAiCaseItem item : parsed.generatedCases()) {
                if (generatedCases.size() >= effectiveMaxCases) {
                    break;
                }
                generatedCases.add(item);
                if (caseConsumer != null) {
                    caseConsumer.accept(new GeneratedCaseStreamUpdate(
                            generatedCases.size() - 1,
                            item,
                            rawContent
                    ));
                }
            }
        }
        return new StreamedGenerateCasesResult(
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                resolved.profile().provider(),
                config.getModel(),
                systemMaxCases,
                requestedMaxCases,
                effectiveMaxCases,
                generatedCases.size(),
                generatedCases,
                blankToNull(aiResponseParsingSupport.generationCoverageSummary(rawContent)),
                aiResponseParsingSupport.generationRemainingCoverageGaps(rawContent),
                warnings,
                invalidCases,
                rawContent,
                streamResult.fallbackToComplete(),
                streamResult.fallbackReason(),
                ignoredImages
        );
    }

    public List<AiProviderConnectionItem> getProviders(String headerWorkspaceCode) {
        return aiProviderDomainService.getProviders(headerWorkspaceCode);
    }

    public AiProviderConnectionItem createProvider(String headerWorkspaceCode, SaveAiProviderConnectionRequest request) {
        return aiProviderDomainService.createProvider(headerWorkspaceCode, request);
    }

    public AiProviderConnectionItem updateProvider(Long id, String headerWorkspaceCode, SaveAiProviderConnectionRequest request) {
        return aiProviderDomainService.updateProvider(id, headerWorkspaceCode, request);
    }

    public PreviewAiProviderModelsResponse previewProviderModels(String headerWorkspaceCode, PreviewAiProviderModelsRequest request) {
        return aiProviderDomainService.previewProviderModels(headerWorkspaceCode, request);
    }

    @Transactional
    public void deleteProvider(Long id, String headerWorkspaceCode) {
        aiProviderDomainService.deleteProvider(id, headerWorkspaceCode);
    }

    public TestAiProviderConnectionResponse testProvider(Long id, String headerWorkspaceCode) {
        return aiProviderDomainService.testProvider(id, headerWorkspaceCode);
    }

    public FetchAiProviderModelsResponse fetchProviderModels(Long id, String headerWorkspaceCode) {
        return aiProviderDomainService.fetchProviderModels(id, headerWorkspaceCode);
    }

    public List<AiProviderModelItem> getProviderModels(Long id, String headerWorkspaceCode) {
        return aiProviderDomainService.getProviderModels(id, headerWorkspaceCode);
    }

    public AiProviderModelItem probeProviderModel(Long id, String headerWorkspaceCode, ProbeAiProviderModelRequest request) {
        return aiProviderDomainService.probeProviderModel(id, headerWorkspaceCode, request);
    }

    public AiCaseConfigResponse bootstrapConfigFromLegacy(String headerWorkspaceCode) {
        return aiCaseConfigDomainService.bootstrapConfigFromLegacy(headerWorkspaceCode);
    }

    public ImportRequirementDocumentResponse importRequirementDocument(String headerWorkspaceCode, MultipartFile file) {
        return aiRequirementAssetDomainService.importRequirementDocument(headerWorkspaceCode, file);
    }

    public List<AiRequirementAssetResponse> uploadRequirementAssets(String headerWorkspaceCode, List<MultipartFile> files) {
        return aiRequirementAssetDomainService.uploadRequirementAssets(headerWorkspaceCode, files);
    }

    public void deleteRequirementAsset(Long id, String headerWorkspaceCode) {
        aiRequirementAssetDomainService.deleteRequirementAsset(id, headerWorkspaceCode);
    }

    public AiRequirementAssetDownload downloadRequirementAsset(Long id, String headerWorkspaceCode) {
        return aiRequirementAssetDomainService.downloadRequirementAsset(id, headerWorkspaceCode);
    }

    public AiReviewResult reviewGeneratedCases(String headerWorkspaceCode, ReviewAiGeneratedCasesRequest request) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesReviewPrompt(config, request, false);
        return aiProviderClient.review(resolved.profile(), resolved.apiKey(), prompt);
    }

    public StreamedReviewResult streamReviewGeneratedCases(
            String headerWorkspaceCode,
            ReviewAiGeneratedCasesRequest request,
            Consumer<AiStreamModelInfo> modelConsumer,
            Consumer<ReviewCaseStreamUpdate> reviewConsumer
    ) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        if (modelConsumer != null) {
            modelConsumer.accept(new AiStreamModelInfo(resolved.profile().provider(), config.getModel()));
        }
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesReviewPrompt(config, request, true);
        Map<Integer, ReviewCaseStreamUpdate> updates = new LinkedHashMap<>();
        StringBuilder rawOutput = new StringBuilder();
        StringBuilder lineBuffer = new StringBuilder();
        Consumer<String> deltaConsumer = delta -> {
            rawOutput.append(delta);
            lineBuffer.append(delta);
            aiResponseParsingSupport.drainCompleteLines(lineBuffer, line -> aiResponseParsingSupport.emitReviewLine(
                    line,
                    request.generatedCases().size(),
                    rawOutput,
                    updates,
                    reviewConsumer
            ));
        };

        AiProviderClient.StreamContentResult streamResult = aiProviderClient.streamStructuredContentWithResult(
                resolved.profile(),
                resolved.apiKey(),
                prompt,
                deltaConsumer
        );
        String finalContent = streamResult.content();
        String rawContent = finalContent == null || finalContent.isBlank() ? rawOutput.toString() : finalContent;
        aiResponseParsingSupport.emitReviewLine(
                lineBuffer.toString(),
                request.generatedCases().size(),
                new StringBuilder(rawContent),
                updates,
                reviewConsumer
        );

        AiReviewResult reviewResult = aiResponseParsingSupport.buildStreamReviewResult(rawContent, updates);
        if (updates.isEmpty() && !request.generatedCases().isEmpty()) {
            aiResponseParsingSupport.emitCompleteReviewResultAsUpdates(reviewResult, rawContent, request.generatedCases().size(), updates, reviewConsumer);
        }
        return new StreamedReviewResult(
                resolved.profile().provider(),
                config.getModel(),
                reviewResult,
                rawContent,
                streamResult.fallbackToComplete(),
                streamResult.fallbackReason()
        );
    }

    public AiReviewResult reviewSavedCase(String headerWorkspaceCode, CaseDetailResponse detail) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        String prompt = aiPromptBuilderSupport.buildSavedCaseReviewPrompt(config, detail);
        return aiProviderClient.review(resolved.profile(), resolved.apiKey(), prompt);
    }


    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
    public record AiStreamModelInfo(
            String provider,
            String model
    ) {
    }

    public record GeneratedCaseStreamUpdate(
            Integer itemIndex,
            GeneratedAiCaseItem item,
            String rawOutput
    ) {
    }

    public record ReviewCaseStreamUpdate(
            Integer itemIndex,
            String status,
            String summary,
            String coverageComment,
            String evidenceComment,
            String reviewComment,
            String optimizationReason,
            String supplementReason,
            String coverageGap,
            GeneratedAiCaseItem optimizedCase,
            GeneratedAiCaseItem supplementCase,
            String rawOutput
    ) {
    }

    public record StreamedGenerateCasesResult(
            String workspaceCode,
            String workspaceName,
            String provider,
            String model,
            Integer systemMaxCases,
            Integer requestedMaxCases,
            Integer effectiveMaxCases,
            Integer actualGeneratedCount,
            List<GeneratedAiCaseItem> generatedCases,
            String coverageSummary,
            List<String> remainingCoverageGaps,
            List<String> warnings,
            List<AiInvalidCaseItem> invalidCases,
            String rawContent,
            boolean fallbackToComplete,
            String fallbackReason,
            boolean ignoredImages
    ) {
    }

    public record StreamedReviewResult(
            String provider,
            String model,
            AiReviewResult reviewResult,
            String rawContent,
            boolean fallbackToComplete,
            String fallbackReason
    ) {
    }
}
