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
    public static final int DEFAULT_MAX_CASES = 200;
    public static final int SYSTEM_MAX_CASES = 500;
    public static final int FINAL_MAX_CASES = 500;
    private static final int GENERATION_CAPACITY_PARTS = 4;
    private static final int TOTAL_CAPACITY_PARTS = 5;
    private static final int MAX_SELF_SUPPLEMENT_CASES = 20;

    private final AiCaseConfigDomainService aiCaseConfigDomainService;
    private final AiRequirementAssetDomainService aiRequirementAssetDomainService;
    private final AiPromptBuilderSupport aiPromptBuilderSupport;
    private final AiResponseParsingSupport aiResponseParsingSupport;
    private final WorkspaceService workspaceService;
    private final AiProviderClient aiProviderClient;
    private final AiProviderDomainService aiProviderDomainService;
    private final AiGenerationCaseQualityService generationCaseQualityService;

    public AiCaseService(
            AiCaseConfigDomainService aiCaseConfigDomainService,
            AiRequirementAssetDomainService aiRequirementAssetDomainService,
            AiPromptBuilderSupport aiPromptBuilderSupport,
            AiResponseParsingSupport aiResponseParsingSupport,
            WorkspaceService workspaceService,
            AiProviderClient aiProviderClient,
            AiProviderDomainService aiProviderDomainService,
            AiGenerationCaseQualityService generationCaseQualityService
    ) {
        this.aiCaseConfigDomainService = aiCaseConfigDomainService;
        this.aiRequirementAssetDomainService = aiRequirementAssetDomainService;
        this.aiPromptBuilderSupport = aiPromptBuilderSupport;
        this.aiResponseParsingSupport = aiResponseParsingSupport;
        this.workspaceService = workspaceService;
        this.aiProviderClient = aiProviderClient;
        this.aiProviderDomainService = aiProviderDomainService;
        this.generationCaseQualityService = generationCaseQualityService;
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

    AiCaseConfigEntity requireGeneratorConfig() {
        return aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_GENERATOR).roleConfig();
    }

    static int generationStageLimit(int taskTotalLimit) {
        int normalizedTotalLimit = Math.max(1, Math.min(taskTotalLimit, SYSTEM_MAX_CASES));
        return Math.max(1, normalizedTotalLimit * GENERATION_CAPACITY_PARTS / TOTAL_CAPACITY_PARTS);
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
        List<AiProviderClient.ImageInput> imageInputs = aiRequirementAssetDomainService.toImageInputs(assets);
        boolean ignoredImages = false;
        String prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, assets, false);
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
            prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, List.of(), false);
            result = aiProviderClient.generate(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    List.of()
            );
        }
        GenerationEnhancement enhancement = enhanceGeneratedCases(
                resolved,
                config,
                request,
                result,
                effectiveMaxCases
        );
        return new GenerateAiCasesResponse(
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                resolved.profile().provider(),
                config.getModel(),
                systemMaxCases,
                requestedMaxCases,
                effectiveMaxCases,
                enhancement.cases().size(),
                enhancement.cases(),
                result.coverageSummary(),
                result.remainingCoverageGaps(),
                enhancement.warnings(),
                enhancement.invalidCases(),
                result.rawContent(),
                ignoredImages,
                enhancement.selfCheck(),
                enhancement.selfSupplementCases()
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
        List<AiProviderClient.ImageInput> imageInputs = aiRequirementAssetDomainService.toImageInputs(assets);
        if (modelConsumer != null) {
            modelConsumer.accept(new AiStreamModelInfo(resolved.profile().provider(), config.getModel()));
        }
        boolean ignoredImages = false;
        String prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, assets, true);
        List<GeneratedAiCaseItem> generatedCases = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<AiInvalidCaseItem> invalidCases = new ArrayList<>();
        StringBuilder rawOutput = new StringBuilder();
        StringBuilder lineBuffer = new StringBuilder();
        Consumer<String> deltaConsumer = delta -> {
            rawOutput.append(delta);
            lineBuffer.append(delta);
            aiResponseParsingSupport.drainCompleteJsonValues(lineBuffer, value -> aiResponseParsingSupport.emitGeneratedCaseValue(
                    value,
                    effectiveMaxCases,
                    generatedCases,
                    warnings,
                    invalidCases,
                    rawOutput,
                    caseConsumer
            ));
            if (generatedCases.size() >= effectiveMaxCases) {
                throw new AiStreamLimitReachedException();
            }
        };

        AiProviderClient.StreamContentResult streamResult;
        boolean generationLimitReached = false;
        try {
            streamResult = streamStructuredContentWithImages(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    prompt,
                    imageInputs,
                    deltaConsumer
            );
        } catch (AiStreamLimitReachedException exception) {
            generationLimitReached = true;
            streamResult = new AiProviderClient.StreamContentResult(rawOutput.toString(), false, null);
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
            prompt = aiPromptBuilderSupport.buildGeneratorPrompt(config, request, workspace, List.of(), true);
            try {
                streamResult = aiProviderClient.streamStructuredContentWithResult(
                        resolved.profileWithMaxCases(effectiveMaxCases),
                        resolved.apiKey(),
                        prompt,
                        deltaConsumer
                );
            } catch (AiStreamLimitReachedException limitException) {
                generationLimitReached = true;
                streamResult = new AiProviderClient.StreamContentResult(rawOutput.toString(), false, null);
            }
        }
        String finalContent = streamResult.content();
        if (streamResult.fallbackToComplete()) {
            generatedCases.clear();
            warnings.clear();
            invalidCases.clear();
            lineBuffer.setLength(0);
        }
        String rawContent = streamResult.fallbackToComplete() || rawOutput.isEmpty()
                ? finalContent
                : rawOutput.toString();
        if (rawContent == null) {
            rawContent = "";
        }
        aiResponseParsingSupport.drainCompleteJsonValues(
                lineBuffer,
                value -> aiResponseParsingSupport.emitGeneratedCaseValue(
                        value,
                        effectiveMaxCases,
                        generatedCases,
                        warnings,
                        invalidCases,
                        new StringBuilder(rawOutput),
                        caseConsumer
                ));
        AiGeneratedCasesResult parsed = aiProviderClient.parseGeneratedCasesContent(rawContent, effectiveMaxCases);
        if (generatedCases.isEmpty()) {
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
        warnings.addAll(parsed.warnings());
        if (generationLimitReached) {
            warnings.add("已达到生成阶段有效候选上限，已主动结束模型流式输出。");
        }
        invalidCases.addAll(parsed.invalidCases());
        GenerationEnhancement enhancement = enhanceGeneratedCases(
                resolved,
                config,
                request,
                new AiGeneratedCasesResult(
                        generatedCases,
                        parsed.coverageSummary(),
                        parsed.remainingCoverageGaps(),
                        warnings,
                        invalidCases,
                        rawContent
                ),
                effectiveMaxCases
        );
        return new StreamedGenerateCasesResult(
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                resolved.profile().provider(),
                config.getModel(),
                systemMaxCases,
                requestedMaxCases,
                effectiveMaxCases,
                enhancement.cases().size(),
                enhancement.cases(),
                blankToNull(parsed.coverageSummary()),
                parsed.remainingCoverageGaps(),
                enhancement.warnings(),
                enhancement.invalidCases(),
                rawContent,
                streamResult.fallbackToComplete(),
                streamResult.fallbackReason(),
                generationLimitReached,
                ignoredImages,
                enhancement.selfCheck(),
                enhancement.selfSupplementCases()
        );
    }

    private GenerationEnhancement enhanceGeneratedCases(
            ResolvedRoleConfig resolved,
            AiCaseConfigEntity config,
            GenerateAiCasesRequest request,
            AiGeneratedCasesResult initialResult,
            int effectiveMaxCases
    ) {
        List<String> warnings = new ArrayList<>(initialResult.warnings() == null ? List.of() : initialResult.warnings());
        List<AiInvalidCaseItem> invalidCases = new ArrayList<>(initialResult.invalidCases() == null ? List.of() : initialResult.invalidCases());
        List<GeneratedAiCaseItem> initialCases = new ArrayList<>(initialResult.generatedCases() == null ? List.of() : initialResult.generatedCases());
        AiGenerationSelfCheckResult selfCheck;
        try {
            selfCheck = aiProviderClient.selfCheck(
                    resolved.profileWithMaxCases(effectiveMaxCases),
                    resolved.apiKey(),
                    aiPromptBuilderSupport.buildGenerationSelfCheckPrompt(config, request, initialCases)
            );
        } catch (RuntimeException exception) {
            warnings.add("生成模型自检失败，已保留初始生成用例：" + safeMessage(exception));
            AiGenerationCaseQualityService.QualityResult quality = generationCaseQualityService
                    .validateNormalizeAndDeduplicate(initialCases, invalidCases, effectiveMaxCases);
            warnings.addAll(quality.warnings());
            return new GenerationEnhancement(
                    quality.cases(),
                    warnings,
                    quality.invalidCases(),
                    AiGenerationSelfCheckResult.failed(exception.getMessage()),
                    List.of()
            );
        }

        if (selfCheck == null || !selfCheck.structured()) {
            warnings.add("生成模型自检返回内容无法解析，已保留初始生成用例。");
        }

        List<GeneratedAiCaseItem> selfSupplementCases = new ArrayList<>();
        List<String> missingGaps = selfCheck == null ? List.of() : selfCheck.missingCoverageGaps();
        int supplementLimit = Math.min(
                MAX_SELF_SUPPLEMENT_CASES,
                Math.max(0, effectiveMaxCases - initialCases.size())
        );
        if (selfCheck != null && selfCheck.structured() && !selfCheck.complete()
                && !missingGaps.isEmpty() && supplementLimit > 0) {
            try {
                AiGeneratedCasesResult supplement = aiProviderClient.generateSupplement(
                        resolved.profileWithMaxCases(supplementLimit),
                        resolved.apiKey(),
                        aiPromptBuilderSupport.buildGenerationSupplementPrompt(
                                config,
                                request,
                                initialCases,
                                missingGaps,
                                selfCheck.supplementGuidance()
                        ),
                        supplementLimit
                );
                for (GeneratedAiCaseItem item : supplement.generatedCases() == null ? List.<GeneratedAiCaseItem>of() : supplement.generatedCases()) {
                    if (selfSupplementCases.size() >= supplementLimit) {
                        break;
                    }
                    selfSupplementCases.add(withAiSource(item, "SELF_REVIEW_SUPPLEMENT"));
                }
                warnings.addAll(supplement.warnings() == null ? List.of() : supplement.warnings());
                invalidCases.addAll(supplement.invalidCases() == null ? List.of() : supplement.invalidCases());
            } catch (RuntimeException exception) {
                warnings.add("生成模型自补失败，已保留初始生成用例：" + safeMessage(exception));
            }
        }

        List<GeneratedAiCaseItem> combined = new ArrayList<>(initialCases);
        combined.addAll(selfSupplementCases);
        AiGenerationCaseQualityService.QualityResult quality = generationCaseQualityService
                .validateNormalizeAndDeduplicate(combined, invalidCases, effectiveMaxCases);
        warnings.addAll(quality.warnings());
        return new GenerationEnhancement(
                quality.cases(),
                warnings,
                quality.invalidCases(),
                selfCheck,
                selfSupplementCases
        );
    }

    private GeneratedAiCaseItem withAiSource(GeneratedAiCaseItem item, String aiSource) {
        return new GeneratedAiCaseItem(
                item.title(), item.caseType(), item.priority(), item.precondition(), item.steps(), item.expectedResult(),
                item.riskNotes(), item.testAngle(), item.generationReason(), item.requirementEvidence(), aiSource,
                item.reviewComment(), item.optimizationReason(), item.supplementReason(), item.coverageGap(),
                item.originalCaseSnapshot(), item.warnings(), item.aiReviewStatus(), item.aiReviewSummary(),
                item.manualEdited(), item.manualEditedByName(), item.manualEditedAt()
        );
    }

    private String safeMessage(RuntimeException exception) {
        return exception.getMessage() == null || exception.getMessage().isBlank()
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
    }

    private record GenerationEnhancement(
            List<GeneratedAiCaseItem> cases,
            List<String> warnings,
            List<AiInvalidCaseItem> invalidCases,
            AiGenerationSelfCheckResult selfCheck,
            List<GeneratedAiCaseItem> selfSupplementCases
    ) {
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

    public AiProviderModelItem updateProviderModelStatus(
            Long connectionId,
            Long modelId,
            String headerWorkspaceCode,
            boolean selectable
    ) {
        return aiProviderDomainService.updateProviderModelStatus(connectionId, modelId, headerWorkspaceCode, selectable);
    }

    @Transactional
    public void deleteProviderModel(Long connectionId, Long modelId, String headerWorkspaceCode) {
        aiProviderDomainService.deleteProviderModel(connectionId, modelId, headerWorkspaceCode);
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
        return reviewGeneratedCases(headerWorkspaceCode, request, true);
    }

    public ReviewedCasesResult reviewGeneratedCasesBatch(String headerWorkspaceCode, ReviewAiGeneratedCasesRequest request) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesReviewPrompt(config, request, false, false);
        return new ReviewedCasesResult(
                resolved.profile().provider(),
                config.getModel(),
                aiProviderClient.review(resolved.profile(), resolved.apiKey(), prompt)
        );
    }

    private AiReviewResult reviewGeneratedCases(
            String headerWorkspaceCode,
            ReviewAiGeneratedCasesRequest request,
            boolean allowSupplement
    ) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesReviewPrompt(config, request, false, allowSupplement);
        return aiProviderClient.review(resolved.profile(), resolved.apiKey(), prompt);
    }

    public AiReviewResult reviewCoverageSupplement(String headerWorkspaceCode, ReviewAiGeneratedCasesRequest request) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesCoverageSupplementPrompt(
                config,
                request,
                request.remainingCoverageGaps()
        );
        return aiProviderClient.review(resolved.profile(), resolved.apiKey(), prompt);
    }

    public StreamedReviewResult streamReviewGeneratedCases(
            String headerWorkspaceCode,
            ReviewAiGeneratedCasesRequest request,
            Consumer<AiStreamModelInfo> modelConsumer,
            Consumer<ReviewCaseStreamUpdate> reviewConsumer
    ) {
        return streamReviewGeneratedCases(headerWorkspaceCode, request, modelConsumer, reviewConsumer, true);
    }

    public StreamedReviewResult streamReviewGeneratedCases(
            String headerWorkspaceCode,
            ReviewAiGeneratedCasesRequest request,
            Consumer<AiStreamModelInfo> modelConsumer,
            Consumer<ReviewCaseStreamUpdate> reviewConsumer,
            boolean allowSupplement
    ) {
        ResolvedRoleConfig resolved = aiCaseConfigDomainService.requireResolvedRoleConfig(ROLE_REVIEWER);
        AiCaseConfigEntity config = resolved.roleConfig();
        if (modelConsumer != null) {
            modelConsumer.accept(new AiStreamModelInfo(resolved.profile().provider(), config.getModel()));
        }
        String prompt = aiPromptBuilderSupport.buildGeneratedCasesReviewPrompt(config, request, true, allowSupplement);
        Map<Integer, ReviewCaseStreamUpdate> updates = new LinkedHashMap<>();
        StringBuilder rawOutput = new StringBuilder();
        StringBuilder jsonBuffer = new StringBuilder();
        Consumer<String> deltaConsumer = delta -> {
            rawOutput.append(delta);
            jsonBuffer.append(delta);
            aiResponseParsingSupport.drainCompleteJsonValues(jsonBuffer, value -> aiResponseParsingSupport.emitReviewValue(
                    value,
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
        if (streamResult.fallbackToComplete()) {
            // The failed streaming attempt may contain only partial review objects.
            // The complete response is the sole source of truth in fallback mode.
            updates.clear();
            jsonBuffer.setLength(0);
        } else {
            aiResponseParsingSupport.drainCompleteJsonValues(jsonBuffer, value -> aiResponseParsingSupport.emitReviewValue(
                    value,
                    request.generatedCases().size(),
                    new StringBuilder(rawContent),
                    updates,
                    reviewConsumer
            ));
        }

        AiReviewResult reviewResult = aiResponseParsingSupport.buildStreamReviewResult(rawContent, updates);
        if (updates.isEmpty() && !request.generatedCases().isEmpty()) {
            aiResponseParsingSupport.emitCompleteReviewResultAsUpdates(reviewResult, rawContent, request.generatedCases().size(), updates, reviewConsumer);
        }
        aiResponseParsingSupport.validateReviewCompleteness(reviewResult, request.generatedCases().size(), rawContent);
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

    private AiProviderClient.StreamContentResult streamStructuredContentWithImages(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            Consumer<String> deltaConsumer
    ) {
        if (images == null || images.isEmpty()) {
            return aiProviderClient.streamStructuredContentWithResult(profile, apiKey, prompt, deltaConsumer);
        }
        return aiProviderClient.streamStructuredContentWithResult(profile, apiKey, prompt, images, deltaConsumer);
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
            String rawOutput,
            String candidateCaseId,
            String suggestedAction,
            Integer score,
            Double confidence,
            String reason,
            GeneratedAiCaseItem suggestedCase,
            List<String> mergeTargetCandidateIds,
            Integer sourceVersion,
            String sourceContentHash
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
            boolean generationLimitReached,
            boolean ignoredImages,
            AiGenerationSelfCheckResult selfCheck,
            List<GeneratedAiCaseItem> selfSupplementCases
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

    public record ReviewedCasesResult(
            String provider,
            String model,
            AiReviewResult reviewResult
    ) {
    }
}
