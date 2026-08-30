package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Component
public class AiProviderClient {
    public static final String PROTOCOL_OPENAI_COMPATIBLE_CHAT = "OPENAI_COMPATIBLE_CHAT";
    public static final String PROTOCOL_OPENAI_COMPATIBLE_RESPONSES = "OPENAI_COMPATIBLE_RESPONSES";
    public static final String PROTOCOL_AZURE_OPENAI = "AZURE_OPENAI";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, AiProtocolAdapter> adapters;

    public AiProviderClient(List<AiProtocolAdapter> adapters) {
        this.adapters = adapters.stream().collect(Collectors.toMap(AiProtocolAdapter::protocolType, Function.identity()));
    }

    public AiGeneratedCasesResult generate(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<ImageInput> images
    ) {
        String content = adapter(profile.protocolType()).requestStructuredContent(profile, apiKey, prompt, images);
        return parseGeneratedCasesContent(content, profile.maxCases());
    }

    public AiReviewResult review(AiProviderRequestProfile profile, String apiKey, String prompt) {
        String content = adapter(profile.protocolType()).requestStructuredContent(profile, apiKey, prompt, List.of());
        return parseReviewResultContent(content);
    }

    public String requestStructuredContent(AiProviderRequestProfile profile, String apiKey, String prompt) {
        return adapter(profile.protocolType()).requestStructuredContent(profile, apiKey, prompt, List.of());
    }

    public String streamStructuredContent(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            Consumer<String> deltaConsumer
    ) {
        return streamStructuredContentWithResult(profile, apiKey, prompt, deltaConsumer).content();
    }

    public StreamContentResult streamStructuredContentWithResult(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            Consumer<String> deltaConsumer
    ) {
        return streamStructuredContentWithResult(profile, apiKey, prompt, List.of(), deltaConsumer);
    }

    public StreamContentResult streamStructuredContentWithResult(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<ImageInput> images,
            Consumer<String> deltaConsumer
    ) {
        AiProtocolAdapter adapter = adapter(profile.protocolType());
        if (!adapter.supportsStructuredStreaming()) {
            String content = adapter.requestStructuredContent(profile, apiKey, prompt, images);
            return new StreamContentResult(content, true, "当前协议适配器不支持实时流式输出");
        }
        try {
            return new StreamContentResult(
                    adapter.streamStructuredContent(profile, apiKey, prompt, images, deltaConsumer),
                    false,
                    null
            );
        } catch (RuntimeException exception) {
            String content = adapter.requestStructuredContent(profile, apiKey, prompt, images);
            return new StreamContentResult(content, true, exception.getMessage());
        }
    }

    public void testConnection(AiProviderRequestProfile profile, String apiKey) {
        adapter(profile.protocolType()).testConnection(profile, apiKey);
    }

    public AiModelFetchResult fetchModels(AiProviderRequestProfile profile, String apiKey) {
        return adapter(profile.protocolType()).fetchModels(profile, apiKey);
    }

    public AiModelCapabilities probeCapabilities(AiProviderRequestProfile profile, String apiKey) {
        return adapter(profile.protocolType()).probeCapabilities(profile, apiKey);
    }

    private AiProtocolAdapter adapter(String protocolType) {
        AiProtocolAdapter adapter = adapters.get(protocolType);
        if (adapter == null) {
            throw new BadRequestException("暂不支持该 AI 协议类型");
        }
        return adapter;
    }

    public AiGeneratedCasesResult parseGeneratedCasesContent(String normalizedJson, Integer maxCases) {
        try {
            JsonNode parsed = objectMapper.readTree(normalizedJson);
            JsonNode casesNode = parsed.isArray() ? parsed : parsed.path("cases");
            if (!casesNode.isArray()) {
                throw new BadRequestException("AI 返回内容无法解析为结构化用例");
            }
            String coverageSummary = parsed.isArray() ? null : optionalText(parsed, "coverageSummary");
            List<String> remainingCoverageGaps = parsed.isArray() ? List.of() : stringList(parsed.path("remainingCoverageGaps"));
            List<GeneratedAiCaseItem> items = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            List<AiInvalidCaseItem> invalidCases = new ArrayList<>();
            int limit = maxCases == null ? Integer.MAX_VALUE : maxCases;
            int index = 0;
            for (JsonNode item : casesNode) {
                if (items.size() >= limit) {
                    break;
                }
                index += 1;
                List<String> itemWarnings = new ArrayList<>();
                String title = optionalText(item, "title");
                String steps = optionalText(item, "steps");
                String expectedResult = optionalText(item, "expectedResult");
                if (title == null || title.isBlank()) {
                    invalidCases.add(new AiInvalidCaseItem(index, fallbackTitle(item, index), "Missing case title"));
                    continue;
                }
                if (steps == null || steps.isBlank()) {
                    invalidCases.add(new AiInvalidCaseItem(index, title, "Missing test steps"));
                    continue;
                }
                if (expectedResult == null || expectedResult.isBlank()) {
                    invalidCases.add(new AiInvalidCaseItem(index, title, "Missing expected result"));
                    continue;
                }
                String normalizedCaseType = normalizeCaseType(optionalText(item, "caseType"), itemWarnings);
                String normalizedPriority = normalizePriority(optionalText(item, "priority"), itemWarnings);
                if (!itemWarnings.isEmpty()) {
                    warnings.add("Candidate case " + index + " has normalized fields");
                }
                items.add(new GeneratedAiCaseItem(
                        title,
                        normalizedCaseType,
                        normalizedPriority,
                        optionalText(item, "precondition"),
                        steps,
                        expectedResult,
                        optionalText(item, "riskNotes"),
                        optionalText(item, "testAngle"),
                        optionalText(item, "generationReason"),
                        optionalText(item, "requirementEvidence"),
                        firstText(item, "aiSource", "source"),
                        optionalText(item, "reviewComment"),
                        optionalText(item, "optimizationReason"),
                        optionalText(item, "supplementReason"),
                        optionalText(item, "coverageGap"),
                        null,
                        itemWarnings,
                        firstText(item, "aiReviewStatus", "reviewStatus"),
                        firstText(item, "aiReviewSummary", "reviewSummary"),
                        false,
                        null,
                        null
                ));
            }
            if (items.isEmpty()) {
                throw new BadRequestException("AI 返回已解析，但没有得到有效用例");
            }
            return new AiGeneratedCasesResult(items, coverageSummary, remainingCoverageGaps, warnings, invalidCases, normalizedJson);
        } catch (IOException exception) {
            throw new BadRequestException("AI 返回内容无法解析为结构化用例");
        }
    }

    public AiReviewResult parseReviewResultContent(String normalizedJson) {
        try {
            JsonNode parsed = objectMapper.readTree(normalizedJson);
            String result = normalizeReviewResult(optionalText(parsed, "result"));
            String summary = optionalText(parsed, "summary");
            List<String> issues = stringList(parsed.path("issues"));
            List<String> suggestions = stringList(parsed.path("suggestions"));
            List<AiReviewCaseDecision> caseDecisions = parseReviewCaseDecisions(parsed.path("caseDecisions"));
            if (caseDecisions.isEmpty()) {
                caseDecisions = parseReviewCaseDecisions(parsed.path("reviews"));
            }
            List<GeneratedAiCaseItem> supplementCases = parseGeneratedCaseItems(
                    firstArray(parsed, "supplementCases", "supplementedCases"),
                    null,
                    "REVIEW_SUPPLEMENTED",
                    "SUPPLEMENTED"
            );
            List<String> unresolvedCoverageGaps = stringList(parsed.path("unresolvedCoverageGaps"));
            if ((summary == null || summary.isBlank()) && !issues.isEmpty()) {
                summary = issues.get(0);
            }
            if ((summary == null || summary.isBlank()) && !suggestions.isEmpty()) {
                summary = suggestions.get(0);
            }
            if (summary == null || summary.isBlank()) {
                summary = "AI review completed. Please combine the issues and suggestions to decide next steps.";
            }
            return new AiReviewResult(result, summary, issues, suggestions, caseDecisions, supplementCases, unresolvedCoverageGaps, normalizedJson, true);
        } catch (IOException exception) {
            return new AiReviewResult(
                    "SUGGEST",
                    "AI returned a non-structured review result. Please inspect the raw content.",
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList(),
                    normalizedJson,
                    false
            );
        }
    }

    private List<AiReviewCaseDecision> parseReviewCaseDecisions(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<AiReviewCaseDecision> decisions = new ArrayList<>();
        for (JsonNode item : node) {
            Integer caseIndex = optionalInt(item.path("caseIndex"));
            if (caseIndex == null) {
                caseIndex = optionalInt(item.path("itemIndex"));
            }
            if (caseIndex == null) {
                caseIndex = optionalInt(item.path("index"));
            }
            String status = normalizePerCaseReviewStatus(firstText(item, "status", "result", "reviewStatus"));
            GeneratedAiCaseItem optimizedCase = parseGeneratedCaseItem(item.path("optimizedCase"), "REVIEW_OPTIMIZED", status);
            GeneratedAiCaseItem suggestedCase = parseGeneratedCaseItem(item.path("suggestedCase"), "REVIEW_SUGGESTED", status);
            if (suggestedCase == null) {
                suggestedCase = optimizedCase;
            }
            decisions.add(new AiReviewCaseDecision(
                    caseIndex,
                    status,
                    firstText(item, "summary", "message", "reason", "suggestion"),
                    firstText(item, "coverageComment", "coverage", "coverageReason"),
                    firstText(item, "evidenceComment", "evidence", "evidenceReason"),
                    firstText(item, "reviewComment", "comment"),
                    optionalText(item, "optimizationReason"),
                    optionalText(item, "coverageGap"),
                    optimizedCase,
                    firstText(item, "candidateCaseId", "candidateId"),
                    optionalText(item, "suggestedAction"),
                    optionalInt(item.path("score")),
                    optionalDouble(item.path("confidence")),
                    firstText(item, "reason", "reviewReason", "summary"),
                    suggestedCase,
                    stringList(firstArray(item, "mergeTargetCaseIds", "mergeTargetCandidateIds")),
                    optionalInt(item.path("sourceVersion")),
                    optionalText(item, "sourceContentHash")
            ));
        }
        return decisions;
    }

    private List<GeneratedAiCaseItem> parseGeneratedCaseItems(JsonNode node, Integer limit, String source, String reviewStatus) {
        if (!node.isArray()) {
            return List.of();
        }
        List<GeneratedAiCaseItem> items = new ArrayList<>();
        for (JsonNode item : node) {
            if (limit != null && items.size() >= limit) {
                break;
            }
            GeneratedAiCaseItem parsed = parseGeneratedCaseItem(item, source, reviewStatus);
            if (parsed != null) {
                items.add(parsed);
            }
        }
        return items;
    }

    private GeneratedAiCaseItem parseGeneratedCaseItem(JsonNode item, String source, String reviewStatus) {
        if (item == null || item.isMissingNode() || item.isNull()) {
            return null;
        }
        String title = optionalText(item, "title");
        String steps = optionalText(item, "steps");
        String expectedResult = optionalText(item, "expectedResult");
        if (title == null || title.isBlank() || steps == null || steps.isBlank() || expectedResult == null || expectedResult.isBlank()) {
            return null;
        }
        List<String> itemWarnings = new ArrayList<>();
        String aiSource = firstText(item, "aiSource", "source");
        String aiReviewStatus = firstText(item, "aiReviewStatus", "reviewStatus");
        return new GeneratedAiCaseItem(
                title,
                normalizeCaseType(optionalText(item, "caseType"), itemWarnings),
                normalizePriority(optionalText(item, "priority"), itemWarnings),
                optionalText(item, "precondition"),
                steps,
                expectedResult,
                optionalText(item, "riskNotes"),
                optionalText(item, "testAngle"),
                optionalText(item, "generationReason"),
                optionalText(item, "requirementEvidence"),
                aiSource == null ? source : aiSource,
                optionalText(item, "reviewComment"),
                optionalText(item, "optimizationReason"),
                optionalText(item, "supplementReason"),
                optionalText(item, "coverageGap"),
                null,
                itemWarnings,
                aiReviewStatus == null ? reviewStatus : aiReviewStatus,
                firstText(item, "aiReviewSummary", "reviewSummary"),
                false,
                null,
                null
        );
    }

    private JsonNode firstArray(JsonNode item, String... fields) {
        for (String field : fields) {
            JsonNode node = item.path(field);
            if (node.isArray()) {
                return node;
            }
        }
        return objectMapper.createArrayNode();
    }

    private Integer optionalInt(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.canConvertToInt()) {
            return node.asInt();
        }
        if (node.isTextual()) {
            try {
                return Integer.parseInt(node.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Double optionalDouble(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asDouble();
        }
        if (node.isTextual()) {
            try {
                return Double.parseDouble(node.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String firstText(JsonNode item, String... fields) {
        for (String field : fields) {
            String value = optionalText(item, field);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String optionalText(JsonNode item, String field) {
        JsonNode fieldNode = item.path(field);
        if (fieldNode.isMissingNode() || fieldNode.isNull()) {
            return null;
        }
        if (fieldNode.isArray()) {
            List<String> values = new ArrayList<>();
            for (JsonNode child : fieldNode) {
                String value = child == null ? null : child.asText();
                if (value != null && !value.trim().isBlank()) {
                    values.add(value.trim());
                }
            }
            return values.isEmpty() ? null : String.join("\n", values);
        }
        String value = fieldNode.asText();
        return value == null ? null : value.trim();
    }

    private String normalizeCaseType(String caseType, List<String> warnings) {
        if (caseType == null || caseType.isBlank()) {
            warnings.add("caseType is missing, defaulted to FUNCTION");
            return "FUNCTION";
        }
        String normalized = caseType.trim().toUpperCase();
        return switch (normalized) {
            case "FUNCTION", "BOUNDARY", "EXCEPTION", "REGRESSION" -> normalized;
            default -> {
                warnings.add("caseType '" + caseType + "' is not recognized, defaulted to FUNCTION");
                yield "FUNCTION";
            }
        };
    }

    private String normalizePriority(String priority, List<String> warnings) {
        if (priority == null || priority.isBlank()) {
            warnings.add("priority is missing, defaulted to P1");
            return "P1";
        }
        String normalized = priority.trim().toUpperCase();
        return switch (normalized) {
            case "P0", "P1", "P2", "P3" -> normalized;
            default -> {
                warnings.add("priority '" + priority + "' is not recognized, defaulted to P1");
                yield "P1";
            }
        };
    }

    private String fallbackTitle(JsonNode item, int index) {
        String value = optionalText(item, "title");
        return value == null || value.isBlank() ? "Candidate case " + index : value;
    }

    private List<String> stringList(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText().trim());
            }
        }
        return values;
    }

    private String normalizeReviewResult(String result) {
        if (result == null || result.isBlank()) {
            return "SUGGEST";
        }
        String normalized = result.trim().toUpperCase();
        return switch (normalized) {
            case "APPROVE", "REJECT", "SUGGEST" -> normalized;
            default -> "SUGGEST";
        };
    }

    private String normalizePerCaseReviewStatus(String status) {
        if (status == null || status.isBlank()) {
            return "CONFIRM_REQUIRED";
        }
        String normalized = status.trim().toUpperCase();
        return switch (normalized) {
            case "APPROVE", "APPROVED", "PASS", "PASSED" -> "APPROVED";
            case "OPTIMIZE", "OPTIMIZED", "SUGGESTED", "SUGGEST", "IMPROVED", "CHANGE_SUGGESTED" -> "CHANGE_SUGGESTED";
            case "SUPPLEMENT", "SUPPLEMENTED", "ADDED" -> "SUPPLEMENTED";
            case "CONFIRM", "CONFIRM_REQUIRED", "NEEDS_CONFIRMATION" -> "CONFIRM_REQUIRED";
            case "NOT_RECOMMENDED", "REJECT", "REJECTED", "FAIL", "FAILED" -> "NOT_RECOMMENDED";
            default -> "CONFIRM_REQUIRED";
        };
    }

    public record ImageInput(
            String fileName,
            String contentType,
            byte[] bytes
    ) {
    }

    public record StreamContentResult(
            String content,
            boolean fallbackToComplete,
            String fallbackReason
    ) {
    }
}
