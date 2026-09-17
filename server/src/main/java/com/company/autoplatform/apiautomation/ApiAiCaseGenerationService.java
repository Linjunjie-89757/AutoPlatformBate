package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.ai.AiProviderClient;
import com.company.autoplatform.ai.AiProviderConnectionEntity;
import com.company.autoplatform.ai.AiProviderConnectionMapper;
import com.company.autoplatform.ai.AiProviderRequestProfile;
import com.company.autoplatform.ai.AiSecretCodec;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.Writer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiAiCaseGenerationService {

    private static final int MAX_GENERATED_CASES = 80;
    private static final Logger log = LoggerFactory.getLogger(ApiAiCaseGenerationService.class);

    private final AiProviderConnectionMapper aiProviderConnectionMapper;
    private final WorkspaceService workspaceService;
    private final AiSecretCodec aiSecretCodec;
    private final AiProviderClient aiProviderClient;
    private final ApiAiCaseGenerationPromptSupport promptSupport;
    private final ApiAiCaseGenerationParsingSupport parsingSupport;
    private final ApiAiCaseGenerationEventSupport eventSupport;
    private final int defaultRequestTimeoutSeconds;

    public ApiAiCaseGenerationService(
            AiProviderConnectionMapper aiProviderConnectionMapper,
            WorkspaceService workspaceService,
            AiSecretCodec aiSecretCodec,
            AiProviderClient aiProviderClient,
            ApiAiCaseGenerationPromptSupport promptSupport,
            ApiAiCaseGenerationParsingSupport parsingSupport,
            ApiAiCaseGenerationEventSupport eventSupport,
            @Value("${app.ai.request-timeout-seconds:60}") int defaultRequestTimeoutSeconds
    ) {
        this.aiProviderConnectionMapper = aiProviderConnectionMapper;
        this.workspaceService = workspaceService;
        this.aiSecretCodec = aiSecretCodec;
        this.aiProviderClient = aiProviderClient;
        this.promptSupport = promptSupport;
        this.parsingSupport = parsingSupport;
        this.eventSupport = eventSupport;
        this.defaultRequestTimeoutSeconds = Math.max(10, Math.min(600, defaultRequestTimeoutSeconds));
    }

    public void streamGenerate(String headerWorkspaceCode, ApiAiCaseGenerationRequest request, Writer writer) throws IOException {
        try {
            WorkspaceEntity workspace = resolveWorkspace(headerWorkspaceCode, request.workspaceCode());
            ResolvedAiProvider provider = resolveProvider(request.providerConnectionId(), request.modelName());
            List<ApiAiCaseGenerationOption> options = normalizeOptions(request.options());
            int targetCount = resolveTargetCount(request.caseCount(), options.size());
            List<ApiAiCaseGenerationSlot> slots = buildSlots(options, targetCount);
            eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("started", null, null, null, slots.size(), null, null, null));
            int completed = 0;
            try {
                Map<String, ApiAiGeneratedCaseOutline> outlines;
                try {
                    outlines = streamGenerateOutlines(workspace, provider, request, slots, writer);
                } catch (Exception exception) {
                    log.warn("API AI case outline generation failed, definitionId={}, definitionName={}, model={}, targetCount={}",
                            request.definitionId(), request.definitionName(), provider.profile().model(), slots.size(), exception);
                    String message = stageFailureMessage("\u5927\u7eb2\u751f\u6210\u9636\u6bb5\u5931\u8d25", exception);
                    for (ApiAiCaseGenerationSlot slot : slots) {
                        eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("item_failed", slot.id(), slot.group(), slot.type(), slots.size(), null, null, message));
                    }
                    eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("completed", null, null, null, slots.size(), null, null, "\u5927\u7eb2\u751f\u6210\u5931\u8d25"));
                    return;
                }
                completed = generateCasesFromOutlines(workspace, provider, request, slots, outlines, writer);
            } catch (Exception exception) {
                log.warn("API AI case generation failed, definitionId={}, definitionName={}, model={}, targetCount={}",
                        request.definitionId(), request.definitionName(), provider.profile().model(), slots.size(), exception);
                for (ApiAiCaseGenerationSlot slot : slots) {
                    eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("item_failed", slot.id(), slot.group(), slot.type(), slots.size(), null, null,
                            stageFailureMessage("\u7528\u4f8b\u751f\u6210\u9636\u6bb5\u5931\u8d25", exception)));
                }
            }
            eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("completed", null, null, null, slots.size(), null, null,
                    completed == slots.size() ? null : "\u90e8\u5206\u7528\u4f8b\u751f\u6210\u5931\u8d25"));
        } catch (Exception exception) {
            eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("failed", null, null, null, null, null, null, exception.getMessage()));
        }
    }

    private Map<String, ApiAiGeneratedCaseOutline> streamGenerateOutlines(
            WorkspaceEntity workspace,
            ResolvedAiProvider provider,
            ApiAiCaseGenerationRequest request,
            List<ApiAiCaseGenerationSlot> slots,
            Writer writer
    ) {
        String prompt = promptSupport.buildOutlinePrompt(workspace, request, slots);
        Map<String, ApiAiCaseGenerationSlot> slotById = new LinkedHashMap<>();
        for (ApiAiCaseGenerationSlot slot : slots) {
            slotById.put(slot.id(), slot);
        }
        Map<String, ApiAiGeneratedCaseOutline> outlines = new LinkedHashMap<>();
        StringBuilder lineBuffer = new StringBuilder();
        String content = aiProviderClient.streamStructuredContent(provider.profile(), provider.apiKey(), prompt, delta -> {
            appendAndEmitOutlineLines(delta, lineBuffer, slotById, outlines, writer);
        });
        appendAndEmitOutlineLines("\n", lineBuffer, slotById, outlines, writer);
        emitRemainingOutlines(content, slots, outlines, writer);
        return outlines;
    }

    private int generateCasesFromOutlines(
            WorkspaceEntity workspace,
            ResolvedAiProvider provider,
            ApiAiCaseGenerationRequest request,
            List<ApiAiCaseGenerationSlot> slots,
            Map<String, ApiAiGeneratedCaseOutline> outlines,
            Writer writer
    ) throws IOException {
        int completed = 0;
        for (int index = 0; index < slots.size(); index++) {
            ApiAiCaseGenerationSlot slot = slots.get(index);
            ApiAiGeneratedCaseOutline outline = outlines.get(slot.id());
            if (outline == null) {
                eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("item_failed", slot.id(), slot.group(), slot.type(), slots.size(), null, null,
                        "AI \u672a\u8fd4\u56de\u8be5\u7528\u4f8b\u5927\u7eb2"));
                continue;
            }
            try {
                ApiAiGeneratedCaseDraft draft = generateOneCaseFromOutline(workspace, provider, request, slot, outline, index + 1, slots.size());
                eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("item_completed", slot.id(), slot.group(), slot.type(), slots.size(), draft, outline, null));
                completed += 1;
            } catch (RuntimeException exception) {
                log.warn("API AI case detail generation failed, definitionId={}, itemId={}, itemIndex={}, total={}, type={}, model={}",
                        request.definitionId(), slot.id(), index + 1, slots.size(), slot.type(), provider.profile().model(), exception);
                eventSupport.writeEvent(writer, new ApiAiCaseGenerationEvent("item_failed", slot.id(), slot.group(), slot.type(), slots.size(), null, outline,
                        "\u7b2c " + (index + 1) + "/" + slots.size() + " \u6761\u8be6\u60c5\u751f\u6210\u5931\u8d25\uff08" + slot.type() + "\uff09\uff1a"
                                + exceptionMessage(exception)));
            }
        }
        return completed;
    }

    private void appendAndEmitOutlineLines(
            String delta,
            StringBuilder lineBuffer,
            Map<String, ApiAiCaseGenerationSlot> slotById,
            Map<String, ApiAiGeneratedCaseOutline> outlines,
            Writer writer
    ) {
        if (delta == null || delta.isEmpty()) {
            return;
        }
        lineBuffer.append(delta);
        int lineBreakIndex;
        while ((lineBreakIndex = eventSupport.indexOfLineBreak(lineBuffer)) >= 0) {
            String line = lineBuffer.substring(0, lineBreakIndex).trim();
            int removeEnd = lineBreakIndex + 1;
            if (removeEnd < lineBuffer.length() && lineBuffer.charAt(lineBreakIndex) == '\r' && lineBuffer.charAt(removeEnd) == '\n') {
                removeEnd += 1;
            }
            lineBuffer.delete(0, removeEnd);
            emitOutlineLine(line, slotById, outlines, writer);
        }
    }

    private void emitOutlineLine(
            String line,
            Map<String, ApiAiCaseGenerationSlot> slotById,
            Map<String, ApiAiGeneratedCaseOutline> outlines,
            Writer writer
    ) {
        if (line == null || line.isBlank() || line.startsWith("```")) {
            return;
        }
        try {
            ApiAiGeneratedCaseOutlineLine parsed = parsingSupport.parseGeneratedCaseOutlineLine(line);
            ApiAiCaseGenerationSlot slot = slotById.get(parsed.id());
            if (slot == null || outlines.containsKey(slot.id()) || parsed.outline() == null) {
                return;
            }
            ApiAiGeneratedCaseOutline normalized = normalizeOutline(parsed.outline(), slot);
            outlines.put(slot.id(), normalized);
            eventSupport.writeUnchecked(writer, new ApiAiCaseGenerationEvent("item_outline", slot.id(), slot.group(), slot.type(), slotById.size(), null, normalized, null));
        } catch (RuntimeException exception) {
            // Ignore partial or non-NDJSON lines. Full-content parsing below is the fallback.
        }
    }

    private void emitRemainingOutlines(
            String content,
            List<ApiAiCaseGenerationSlot> slots,
            Map<String, ApiAiGeneratedCaseOutline> outlines,
            Writer writer
    ) {
        if (content == null || content.isBlank() || outlines.size() >= slots.size()) {
            return;
        }
        List<ApiAiGeneratedCaseOutlineLine> parsedLines = parsingSupport.parseOutlinesFromNdjson(content);
        Map<String, ApiAiCaseGenerationSlot> slotById = new LinkedHashMap<>();
        for (ApiAiCaseGenerationSlot slot : slots) {
            slotById.put(slot.id(), slot);
        }
        for (ApiAiGeneratedCaseOutlineLine parsed : parsedLines) {
            ApiAiCaseGenerationSlot slot = slotById.get(parsed.id());
            if (slot == null || outlines.containsKey(slot.id()) || parsed.outline() == null) {
                continue;
            }
            ApiAiGeneratedCaseOutline normalized = normalizeOutline(parsed.outline(), slot);
            outlines.put(slot.id(), normalized);
            eventSupport.writeUnchecked(writer, new ApiAiCaseGenerationEvent("item_outline", slot.id(), slot.group(), slot.type(), slots.size(), null, normalized, null));
        }
    }

    private ApiAiGeneratedCaseDraft generateOneCaseFromOutline(
            WorkspaceEntity workspace,
            ResolvedAiProvider provider,
            ApiAiCaseGenerationRequest request,
            ApiAiCaseGenerationSlot slot,
            ApiAiGeneratedCaseOutline outline,
            int index,
            int total
    ) {
        String prompt = promptSupport.buildPrompt(workspace, request, slot, outline, index, total);
        String content = aiProviderClient.requestStructuredContent(provider.profile(), provider.apiKey(), prompt);
        return normalizeDraft(parsingSupport.parseDraft(content), request, slot, index);
    }

    private ApiAiGeneratedCaseDraft normalizeDraft(
            ApiAiGeneratedCaseDraft draft,
            ApiAiCaseGenerationRequest request,
            ApiAiCaseGenerationSlot slot,
            int index
    ) {
        ApiRequestConfigInput sourceRequest = request.requestConfig();
        ApiRequestConfigInput generatedRequest = draft.requestConfig();
        String method = firstNonBlank(generatedRequest == null ? null : generatedRequest.method(),
                sourceRequest == null ? null : sourceRequest.method(), "GET").toUpperCase(Locale.ROOT);
        String path = firstNonBlank(generatedRequest == null ? null : generatedRequest.path(),
                sourceRequest == null ? null : sourceRequest.path(), request.path(), "/");
        ApiRequestConfigInput requestConfig = new ApiRequestConfigInput(
                method,
                path,
                generatedRequest != null && generatedRequest.timeoutMs() != null
                        ? generatedRequest.timeoutMs()
                        : (sourceRequest == null ? 10000 : Optional.ofNullable(sourceRequest.timeoutMs()).orElse(10000)),
                defaultList(generatedRequest == null ? null : generatedRequest.queryParams(),
                        sourceRequest == null ? null : sourceRequest.queryParams()),
                defaultList(generatedRequest == null ? null : generatedRequest.headers(),
                        sourceRequest == null ? null : sourceRequest.headers()),
                defaultList(generatedRequest == null ? null : generatedRequest.cookies(),
                        sourceRequest == null ? null : sourceRequest.cookies()),
                generatedRequest != null && generatedRequest.body() != null
                        ? generatedRequest.body()
                        : (sourceRequest == null || sourceRequest.body() == null
                        ? new ApiRequestBodyInput("NONE", null, List.of(), null, null, null)
                        : sourceRequest.body()),
                generatedRequest != null && generatedRequest.authConfig() != null
                        ? normalizeAuth(generatedRequest.authConfig())
                        : normalizeAuth(sourceRequest == null ? null : sourceRequest.authConfig())
        );
        List<ApiAssertionInput> assertions = defaultList(draft.assertions(), request.assertions());
        if (assertions.isEmpty()) {
            assertions = List.of(new ApiAssertionInput("STATUS_CODE", "STATUS_CODE", "LT", slot.groupKey().equals("positive") ? "400" : "500"));
        }
        String expected = firstNonBlank(draft.expected(), defaultExpected(slot));
        return new ApiAiGeneratedCaseDraft(
                normalizeCaseName(draft.name(), slot, method, path, expected),
                blankToNull(draft.description()) == null ? defaultDescription(slot) : draft.description().trim(),
                normalizeTags(draft.tags(), slot),
                slot.group(),
                slot.groupKey(),
                slot.type(),
                slot.typeKey(),
                expected,
                requestConfig,
                assertions,
                defaultList(draft.preProcessors(), request.preProcessors()),
                defaultList(draft.postProcessors(), request.postProcessors())
        );
    }

    private ApiAiGeneratedCaseOutline normalizeOutline(ApiAiGeneratedCaseOutline outline, ApiAiCaseGenerationSlot slot) {
        String expected = firstNonBlank(outline.expected(), defaultExpected(slot));
        String name = normalizeCaseName(firstNonBlank(outline.name(), slot.type() + " \u2013 " + expected), slot, "", "", expected);
        String description = blankToNull(outline.description()) == null ? defaultDescription(slot) : outline.description().trim();
        return new ApiAiGeneratedCaseOutline(
                name,
                description,
                normalizeTags(outline.tags(), slot),
                slot.group(),
                slot.groupKey(),
                slot.type(),
                slot.typeKey(),
                expected
        );
    }

    private ResolvedAiProvider resolveProvider(Long providerConnectionId, String modelName) {
        if (providerConnectionId == null) {
            throw new BadRequestException("\u8bf7\u9009\u62e9 AI \u8fde\u63a5\u6c60\u6a21\u578b");
        }
        AiProviderConnectionEntity connection = aiProviderConnectionMapper.selectOne(new LambdaQueryWrapper<AiProviderConnectionEntity>()
                .eq(AiProviderConnectionEntity::getId, providerConnectionId)
                .eq(AiProviderConnectionEntity::getOwnerUserId, CurrentUserContext.get()));
        if (connection == null) {
            throw new BadRequestException("AI \u8fde\u63a5\u6c60\u914d\u7f6e\u4e0d\u5b58\u5728\u6216\u65e0\u6743\u8bbf\u95ee");
        }
        if (connection.getStatus() != null && connection.getStatus() == 0) {
            throw new BadRequestException("AI \u8fde\u63a5\u6c60\u914d\u7f6e\u5df2\u505c\u7528");
        }
        String resolvedModel = firstNonBlank(modelName, connection.getSelectedModelName(), null);
        if (resolvedModel == null) {
            throw new BadRequestException("\u8bf7\u9009\u62e9 AI \u6a21\u578b");
        }
        String apiKey = aiSecretCodec.decrypt(connection.getApiKeyCipherText());
        if (apiKey == null || apiKey.isBlank()) {
            throw new BadRequestException("AI \u8fde\u63a5\u6c60\u672a\u914d\u7f6e API Key");
        }
        String protocolType = firstNonBlank(connection.getProtocolType(), AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT);
        return new ResolvedAiProvider(new AiProviderRequestProfile(
                protocolType,
                providerForProtocolType(protocolType),
                resolvedModel,
                connection.getBaseUrl(),
                0.2,
                1.0,
                1,
                connection.getRequestTimeoutSeconds() == null ? defaultRequestTimeoutSeconds : connection.getRequestTimeoutSeconds()
        ), apiKey);
    }

    private WorkspaceEntity resolveWorkspace(String headerWorkspaceCode, String requestWorkspaceCode) {
        String target = WorkspaceScope.normalize(firstNonBlank(requestWorkspaceCode, headerWorkspaceCode, null));
        if (WorkspaceScope.isAll(target)) {
            return workspaceService.requireWritableWorkspace(requestWorkspaceCode);
        }
        return workspaceService.requireWritableWorkspace(target);
    }

    private List<ApiAiCaseGenerationOption> normalizeOptions(List<ApiAiCaseGenerationOption> options) {
        List<ApiAiCaseGenerationOption> normalized = new ArrayList<>();
        for (ApiAiCaseGenerationOption option : defaultList(options, List.<ApiAiCaseGenerationOption>of())) {
            if (option == null || blankToNull(option.key()) == null || blankToNull(option.label()) == null) {
                continue;
            }
            normalized.add(new ApiAiCaseGenerationOption(
                    blankToNull(option.id()),
                    option.key().trim(),
                    firstNonBlank(option.group(), "other"),
                    option.label().trim(),
                    firstNonBlank(option.groupLabel(), option.group(), "\u5176\u4ed6")
            ));
        }
        if (normalized.isEmpty()) {
            throw new BadRequestException("\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u79cd\u751f\u6210\u7c7b\u578b");
        }
        return normalized;
    }

    private int resolveTargetCount(String caseCount, int selectedCount) {
        if (caseCount == null || caseCount.isBlank() || "AUTO".equalsIgnoreCase(caseCount)) {
            return Math.min(Math.max(selectedCount, 1), 12);
        }
        try {
            return Math.max(1, Math.min(MAX_GENERATED_CASES, Integer.parseInt(caseCount.trim())));
        } catch (NumberFormatException exception) {
            return Math.min(Math.max(selectedCount, 1), 12);
        }
    }

    private List<ApiAiCaseGenerationSlot> buildSlots(List<ApiAiCaseGenerationOption> options, int targetCount) {
        List<ApiAiCaseGenerationSlot> slots = new ArrayList<>();
        for (int i = 0; i < targetCount; i++) {
            ApiAiCaseGenerationOption option = options.get(i % options.size());
            slots.add(new ApiAiCaseGenerationSlot(
                    firstNonBlank(option.id(), "ai-case-" + System.nanoTime() + "-" + i),
                    option.groupLabel(),
                    option.group(),
                    option.label(),
                    option.key()
            ));
        }
        return slots;
    }

    private String providerForProtocolType(String protocolType) {
        String normalized = protocolType == null ? "" : protocolType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case AiProviderClient.PROTOCOL_AZURE_OPENAI -> "Azure OpenAI";
            case AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_RESPONSES -> "OpenAI Responses Compatible";
            default -> "OpenAI Compatible";
        };
    }

    private ApiAuthConfigInput normalizeAuth(ApiAuthConfigInput authConfig) {
        if (authConfig == null) {
            return new ApiAuthConfigInput("NONE", new ApiAuthCredentialInput("", ""), new ApiAuthCredentialInput("", ""));
        }
        return new ApiAuthConfigInput(
                firstNonBlank(authConfig.authType(), "NONE").toUpperCase(Locale.ROOT),
                normalizeCredential(authConfig.basicAuth()),
                normalizeCredential(authConfig.digestAuth()),
                Optional.ofNullable(authConfig.bearerToken()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyName()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyValue()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyLocation()).orElse("header")
        );
    }

    private ApiAuthCredentialInput normalizeCredential(ApiAuthCredentialInput credential) {
        if (credential == null) {
            return new ApiAuthCredentialInput("", "");
        }
        return new ApiAuthCredentialInput(Optional.ofNullable(credential.userName()).orElse(""),
                Optional.ofNullable(credential.password()).orElse(""));
    }

    private List<String> normalizeTags(List<String> tags, ApiAiCaseGenerationSlot slot) {
        List<String> normalized = new ArrayList<>();
        for (String tag : defaultList(tags, List.<String>of())) {
            if (blankToNull(tag) != null && normalized.size() < 6) {
                normalized.add(tag.trim());
            }
        }
        if (!normalized.contains(slot.group())) {
            normalized.add(slot.group());
        }
        if (!normalized.contains(slot.type())) {
            normalized.add(slot.type());
        }
        return normalized;
    }

    private String defaultDescription(ApiAiCaseGenerationSlot slot) {
        return "AI \u751f\u6210\u7684" + slot.group() + "\u63a5\u53e3\u7528\u4f8b";
    }

    private String defaultExpected(ApiAiCaseGenerationSlot slot) {
        return "positive".equals(slot.groupKey())
                ? "\u9884\u671f\u63a5\u53e3\u8fd4\u56de\u6210\u529f\u54cd\u5e94"
                : "\u9884\u671f\u63a5\u53e3\u8fd4\u56de\u5408\u7406\u9519\u8bef\u6216\u88ab\u89c4\u5219\u62e6\u622a";
    }

    private String normalizeCaseName(String rawName, ApiAiCaseGenerationSlot slot, String method, String path, String expected) {
        String name = firstNonBlank(rawName, slot.type() + " \u2013 " + method + " " + path + " \u2013 " + expected);
        name = name
                .replaceFirst("^\\u3010[^\\u3011]+\\u3011\\s*", "")
                .replaceFirst("^\\[[^\\]]+]\\s*", "")
                .replaceFirst("^(\\u6b63\\u5411|\\u53cd\\u5411|\\u8d1f\\u5411|\\u8fb9\\u754c|\\u5b89\\u5168\\u6027|\\u5b89\\u5168)\\s*[-\\u2013\\u2014:\\uff1a]\\s*", "")
                .trim();
        if (!name.startsWith(slot.type() + " \u2013 ") && !name.startsWith(slot.type() + " - ")) {
            name = slot.type() + " \u2013 " + name;
        }
        return name;
    }

    private String stageFailureMessage(String stage, Exception exception) {
        return stage + "\uff1a" + exceptionMessage(exception);
    }

    private String exceptionMessage(Exception exception) {
        if (exception == null) {
            return "\u672a\u77e5\u9519\u8bef";
        }
        String message = firstNonBlank(exception.getMessage(),
                exception.getCause() == null ? null : exception.getCause().getMessage(),
                exception.getClass().getSimpleName());
        return message == null ? "\u672a\u77e5\u9519\u8bef" : message;
    }

    private <T> List<T> defaultList(List<T> primary, List<T> fallback) {
        return primary == null ? (fallback == null ? List.of() : fallback) : primary;
    }

    private String firstNonBlank(String first, String fallback) {
        return firstNonBlank(first, fallback, null);
    }

    private String firstNonBlank(String first, String second, String fallback) {
        if (first != null && !first.isBlank()) return first.trim();
        if (second != null && !second.isBlank()) return second.trim();
        return fallback;
    }

    private String firstNonBlank(String first, String second, String third, String fallback) {
        if (first != null && !first.isBlank()) return first.trim();
        if (second != null && !second.isBlank()) return second.trim();
        if (third != null && !third.isBlank()) return third.trim();
        return fallback;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record ApiAiCaseGenerationRequest(
            String workspaceCode,
            Long definitionId,
            String definitionName,
            String name,
            String method,
            String path,
            String description,
            Long providerConnectionId,
            String modelName,
            String caseCount,
            Boolean noDuplicate,
            String prompt,
            List<ApiAiCaseGenerationOption> options,
            ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors,
            List<ApiAiExistingCaseSummary> existingCases
    ) {
    }

    public record ApiAiCaseGenerationOption(
            String id,
            String key,
            String group,
            String label,
            String groupLabel
    ) {
    }

    public record ApiAiExistingCaseSummary(
            Long id,
            String name,
            List<String> tags
    ) {
    }

    public record ApiAiCaseGenerationEvent(
            String event,
            String itemId,
            String group,
            String type,
            Integer total,
            ApiAiGeneratedCaseDraft item,
            ApiAiGeneratedCaseOutline outline,
            String message
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAiGeneratedCaseDraft(
            String name,
            String description,
            List<String> tags,
            String group,
            String groupKey,
            String type,
            String typeKey,
            String expected,
            ApiRequestConfigInput requestConfig,
            List<ApiAssertionInput> assertions,
            List<ApiProcessorInput> preProcessors,
            List<ApiProcessorInput> postProcessors
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiAiGeneratedCaseOutline(
            String name,
            String description,
            List<String> tags,
            String group,
            String groupKey,
            String type,
            String typeKey,
            String expected
    ) {
    }

    record ApiAiCaseGenerationSlot(
            String id,
            String group,
            String groupKey,
            String type,
            String typeKey
    ) {
    }

    record ApiAiGeneratedCaseOutlineLine(
            String id,
            ApiAiGeneratedCaseOutline outline
    ) {
    }

    private record ResolvedAiProvider(
            AiProviderRequestProfile profile,
            String apiKey
    ) {
    }
}
