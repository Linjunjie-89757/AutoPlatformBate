package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

@Component
public class AiResponseParsingSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final AiProviderClient aiProviderClient;

    public AiResponseParsingSupport(AiProviderClient aiProviderClient) {
        this.aiProviderClient = aiProviderClient;
    }

    void drainCompleteLines(StringBuilder buffer, Consumer<String> lineConsumer) {
        int index = indexOfLineBreak(buffer);
        while (index >= 0) {
            String line = buffer.substring(0, index);
            buffer.delete(0, index + 1);
            lineConsumer.accept(line);
            index = indexOfLineBreak(buffer);
        }
    }

    void drainCompleteJsonValues(StringBuilder buffer, Consumer<String> valueConsumer) {
        AiJsonBoundaryExtractor.drainCompleteValues(buffer, valueConsumer);
    }

    void emitGeneratedCaseLine(
            String rawLine,
            int maxCases,
            List<GeneratedAiCaseItem> generatedCases,
            List<String> warnings,
            List<AiInvalidCaseItem> invalidCases,
            StringBuilder rawOutput,
            Consumer<AiCaseService.GeneratedCaseStreamUpdate> caseConsumer
    ) {
        if (generatedCases.size() >= maxCases) {
            return;
        }
        String line = normalizeStreamJsonLine(rawLine);
        if (line == null) {
            return;
        }
        emitGeneratedCaseValue(line, maxCases, generatedCases, warnings, invalidCases, rawOutput, caseConsumer);
    }

    void emitGeneratedCaseValue(
            String rawValue,
            int maxCases,
            List<GeneratedAiCaseItem> generatedCases,
            List<String> warnings,
            List<AiInvalidCaseItem> invalidCases,
            StringBuilder rawOutput,
            Consumer<AiCaseService.GeneratedCaseStreamUpdate> caseConsumer
    ) {
        if (rawValue == null || rawValue.isBlank()) {
            return;
        }
        AiGeneratedCasesResult parsed;
        try {
            parsed = aiProviderClient.parseGeneratedCasesContent(rawValue, maxCases - generatedCases.size());
        } catch (RuntimeException ignored) {
            // Keep the raw stream and let the final parser report the complete failure.
            return;
        }
        warnings.addAll(parsed.warnings());
        invalidCases.addAll(parsed.invalidCases());
        for (GeneratedAiCaseItem item : parsed.generatedCases()) {
            if (generatedCases.size() >= maxCases) {
                break;
            }
            String fingerprint = AiGenerationCaseQualityService.fingerprint(item);
            boolean duplicate = generatedCases.stream()
                    .anyMatch(existing -> AiGenerationCaseQualityService.fingerprint(existing).equals(fingerprint));
            if (duplicate) {
                warnings.add("Streamed candidate duplicated an accepted candidate and was ignored");
                continue;
            }
            generatedCases.add(item);
            if (caseConsumer != null) {
                caseConsumer.accept(new AiCaseService.GeneratedCaseStreamUpdate(
                        generatedCases.size() - 1,
                        item,
                        rawOutput.toString()
                ));
            }
        }
    }

    void emitReviewLine(
            String rawLine,
            int caseCount,
            StringBuilder rawOutput,
            Map<Integer, AiCaseService.ReviewCaseStreamUpdate> updates,
            Consumer<AiCaseService.ReviewCaseStreamUpdate> reviewConsumer
    ) {
        emitReviewValue(normalizeStreamJsonLine(rawLine), caseCount, rawOutput, updates, reviewConsumer);
    }

    void emitReviewValue(
            String rawValue,
            int caseCount,
            StringBuilder rawOutput,
            Map<Integer, AiCaseService.ReviewCaseStreamUpdate> updates,
            Consumer<AiCaseService.ReviewCaseStreamUpdate> reviewConsumer
    ) {
        if (rawValue == null || rawValue.isBlank()) {
            return;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(rawValue);
            String status = normalizePerCaseReviewStatus(firstText(root, "status", "result", "reviewStatus"));
            String summary = firstText(root, "summary", "message", "reason", "suggestion");
            String coverageComment = firstText(root, "coverageComment", "coverage", "coverageReason");
            String evidenceComment = firstText(root, "evidenceComment", "evidence", "evidenceReason");
            String reviewComment = firstText(root, "reviewComment", "comment");
            String optimizationReason = firstText(root, "optimizationReason");
            String supplementReason = firstText(root, "supplementReason");
            String coverageGap = firstText(root, "coverageGap");
            String candidateCaseId = firstText(root, "candidateCaseId", "candidateId");
            String suggestedAction = firstText(root, "suggestedAction");
            Integer score = optionalInt(root.path("score"));
            Double confidence = optionalDouble(root.path("confidence"));
            String reason = firstText(root, "reason", "reviewReason", "summary");
            String reasonCode = firstText(root, "reasonCode");
            if ("NOT_RECOMMENDED".equals(status) && reasonCode != null) {
                reason = reason == null ? reasonCode : reasonCode + ": " + reason;
            }
            List<String> mergeTargetCandidateIds = stringList(firstPresentNode(root, "mergeTargetCaseIds", "mergeTargetCandidateIds"));
            Integer sourceVersion = optionalInt(root.path("sourceVersion"));
            String sourceContentHash = firstText(root, "sourceContentHash");
            GeneratedAiCaseItem supplementCase = parseStreamGeneratedCase(firstPresentNode(root, "supplementCase", "case", "newCase"), "REVIEW_SUPPLEMENTED", "SUPPLEMENTED");
            if ("SUPPLEMENTED".equals(status)) {
                if (supplementCase == null) {
                    return;
                }
                if (summary == null || summary.isBlank()) {
                    summary = firstNonBlank(supplementReason, coverageGap, "AI review supplemented a missing case.");
                }
                AiCaseService.ReviewCaseStreamUpdate update = new AiCaseService.ReviewCaseStreamUpdate(null, status, summary, coverageComment, evidenceComment, reviewComment, optimizationReason, supplementReason, coverageGap, null, supplementCase, rawOutput.toString(), null, null, score, confidence, reason, null, List.of(), null, null);
                updates.put(-(updates.size() + 1), update);
                if (reviewConsumer != null) {
                    reviewConsumer.accept(update);
                }
                return;
            }
            Integer caseIndex = parseReviewCaseIndex(root, caseCount);
            if (caseIndex == null) {
                return;
            }
            GeneratedAiCaseItem optimizedCase = parseStreamGeneratedCase(root.path("optimizedCase"), "REVIEW_OPTIMIZED", status);
            GeneratedAiCaseItem suggestedCase = parseStreamGeneratedCase(root.path("suggestedCase"), "REVIEW_SUGGESTED", status);
            if (suggestedCase == null) {
                suggestedCase = optimizedCase;
            }
            if ((summary == null || summary.isBlank()) && !"APPROVED".equals(status)) {
                summary = switch (status) {
                    case "NOT_RECOMMENDED", "REJECTED" -> "AI review does not recommend this case.";
                    case "CHANGE_SUGGESTED" -> "AI review suggested changes for this case.";
                    default -> "AI review suggests confirming this case.";
                };
            }
            if ((coverageComment == null || coverageComment.isBlank()) && !"APPROVED".equals(status)) {
                coverageComment = summary;
            }
            if (evidenceComment == null || evidenceComment.isBlank()) {
                evidenceComment = firstText(root, "reason", "summary");
            }
            AiCaseService.ReviewCaseStreamUpdate update = new AiCaseService.ReviewCaseStreamUpdate(caseIndex, status, summary, coverageComment, evidenceComment, reviewComment, optimizationReason, null, coverageGap, optimizedCase, null, rawOutput.toString(), candidateCaseId, suggestedAction, score, confidence, reason, suggestedCase, mergeTargetCandidateIds, sourceVersion, sourceContentHash);
            updates.put(caseIndex, update);
            if (reviewConsumer != null) {
                reviewConsumer.accept(update);
            }
        } catch (Exception ignored) {
            // Wait for a later complete line or final full-output fallback.
        }
    }

    AiReviewResult buildStreamReviewResult(String rawContent, Map<Integer, AiCaseService.ReviewCaseStreamUpdate> updates) {
        if (updates.isEmpty()) {
            return aiProviderClient.parseReviewResultContent(rawContent);
        }
        ReviewStreamSummary streamSummary = parseReviewStreamSummary(rawContent);
        boolean hasRejected = updates.values().stream().anyMatch(item -> "NOT_RECOMMENDED".equals(item.status()));
        boolean hasSuggested = updates.values().stream().anyMatch(item -> !"APPROVED".equals(item.status()));
        String result = streamSummary == null || streamSummary.result() == null
                ? (hasRejected ? "REJECT" : hasSuggested ? "SUGGEST" : "APPROVE")
                : normalizeReviewResult(streamSummary.result());
        List<String> issues = updates.values().stream()
                .filter(item -> "NOT_RECOMMENDED".equals(item.status()))
                .map(item -> "Case " + (item.itemIndex() + 1) + ": " + item.summary())
                .toList();
        List<String> suggestions = updates.values().stream()
                .filter(item -> item.itemIndex() != null && !"APPROVED".equals(item.status()) && !"NOT_RECOMMENDED".equals(item.status()) && !"SUPPLEMENTED".equals(item.status()))
                .map(item -> "Case " + (item.itemIndex() + 1) + ": " + item.summary())
                .toList();
        long reviewedCount = updates.values().stream().filter(item -> item.itemIndex() != null).count();
        String summary = streamSummary == null || streamSummary.summary() == null
                ? "AI review completed for " + reviewedCount + " generated cases."
                : streamSummary.summary();
        return new AiReviewResult(result, summary, issues, suggestions, updates.values().stream()
                .filter(item -> !"SUPPLEMENTED".equals(item.status()))
                .map(item -> new AiReviewCaseDecision(
                        item.itemIndex(),
                        item.status(),
                        item.summary(),
                        item.coverageComment(),
                        item.evidenceComment(),
                        item.reviewComment(),
                        item.optimizationReason(),
                        item.coverageGap(),
                        item.optimizedCase(),
                        item.candidateCaseId(),
                        item.suggestedAction(),
                        item.score(),
                        item.confidence(),
                        item.reason(),
                        item.suggestedCase(),
                        item.mergeTargetCandidateIds(),
                        item.sourceVersion(),
                        item.sourceContentHash()
                ))
                .toList(), updates.values().stream()
                .filter(item -> "SUPPLEMENTED".equals(item.status()) && item.supplementCase() != null)
                .map(item -> withSupplementReviewMetadata(item.supplementCase(), item.summary(), item.supplementReason(), item.coverageGap()))
                .toList(), streamSummary == null ? List.of() : streamSummary.unresolvedCoverageGaps(), rawContent, true);
    }

    void validateReviewCompleteness(AiReviewResult reviewResult, int expectedCaseCount, String rawContent) {
        if (expectedCaseCount <= 0) {
            return;
        }
        Set<Integer> reviewedIndexes = new HashSet<>();
        if (reviewResult != null && reviewResult.caseDecisions() != null) {
            for (AiReviewCaseDecision decision : reviewResult.caseDecisions()) {
                if (decision.caseIndex() != null && decision.caseIndex() >= 0 && decision.caseIndex() < expectedCaseCount) {
                    reviewedIndexes.add(decision.caseIndex());
                }
            }
        }
        if (reviewedIndexes.size() != expectedCaseCount) {
            throw new BadRequestException("AI 评审结果不完整：应返回 " + expectedCaseCount
                    + " 条逐条结论，实际返回 " + reviewedIndexes.size() + " 条");
        }
        ReviewStreamSummary streamSummary = parseReviewStreamSummary(rawContent);
        if (streamSummary != null && streamSummary.reviewedCount() != null
                && streamSummary.reviewedCount() != expectedCaseCount) {
            throw new BadRequestException("AI 评审汇总数量不一致：应为 " + expectedCaseCount
                    + " 条，SUMMARY 返回 " + streamSummary.reviewedCount() + " 条");
        }
    }

    private ReviewStreamSummary parseReviewStreamSummary(String rawContent) {
        if (rawContent == null || rawContent.isBlank()) {
            return null;
        }
        ReviewStreamSummary[] found = new ReviewStreamSummary[]{null};
        StringBuilder buffer = new StringBuilder(rawContent);
        drainCompleteJsonValues(buffer, value -> {
            try {
                findReviewStreamSummary(OBJECT_MAPPER.readTree(value), found);
            } catch (Exception ignored) {
                // Legacy detailed review output may not use the compact SUMMARY record.
            }
        });
        return found[0];
    }

    private void findReviewStreamSummary(JsonNode node, ReviewStreamSummary[] found) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                findReviewStreamSummary(child, found);
            }
            return;
        }
        if (!node.isObject()) {
            return;
        }
        String type = firstText(node, "type");
        if (!"SUMMARY".equalsIgnoreCase(type == null ? "" : type) && !node.has("reviewedCount")) {
            return;
        }
        found[0] = new ReviewStreamSummary(
                optionalInt(node.path("reviewedCount")),
                stringList(firstPresentNode(node, "unresolvedCoverageGaps", "coverageGaps")),
                firstText(node, "result"),
                firstText(node, "summary", "message")
        );
    }

    void emitCompleteReviewResultAsUpdates(
            AiReviewResult reviewResult,
            String rawContent,
            int caseCount,
            Map<Integer, AiCaseService.ReviewCaseStreamUpdate> updates,
            Consumer<AiCaseService.ReviewCaseStreamUpdate> reviewConsumer
    ) {
        if (reviewResult.caseDecisions() != null && !reviewResult.caseDecisions().isEmpty()) {
            for (AiReviewCaseDecision decision : reviewResult.caseDecisions()) {
                if (decision.caseIndex() == null || decision.caseIndex() < 0 || decision.caseIndex() >= caseCount) {
                    continue;
                }
                AiCaseService.ReviewCaseStreamUpdate update = new AiCaseService.ReviewCaseStreamUpdate(
                        decision.caseIndex(),
                        decision.status() == null ? "CONFIRM_REQUIRED" : decision.status(),
                        decision.summary(),
                        decision.coverageComment(),
                        decision.evidenceComment(),
                        decision.reviewComment(),
                        decision.optimizationReason(),
                        null,
                        decision.coverageGap(),
                        decision.optimizedCase(),
                        null,
                        rawContent,
                        decision.candidateCaseId(),
                        decision.suggestedAction(),
                        decision.score(),
                        decision.confidence(),
                        decision.reason(),
                        decision.suggestedCase(),
                        decision.mergeTargetCandidateIds(),
                        decision.sourceVersion(),
                        decision.sourceContentHash()
                );
                updates.put(decision.caseIndex(), update);
                if (reviewConsumer != null) {
                    reviewConsumer.accept(update);
                }
            }
        }
        if (reviewResult.supplementCases() != null && !reviewResult.supplementCases().isEmpty()) {
            for (GeneratedAiCaseItem item : reviewResult.supplementCases()) {
                AiCaseService.ReviewCaseStreamUpdate update = new AiCaseService.ReviewCaseStreamUpdate(
                        null,
                        "SUPPLEMENTED",
                        firstNonBlank(item.aiReviewSummary(), item.supplementReason(), item.coverageGap()),
                        null,
                        null,
                        item.reviewComment(),
                        null,
                        item.supplementReason(),
                        item.coverageGap(),
                        null,
                        item,
                        rawContent,
                        null,
                        null,
                        null,
                        null,
                        firstNonBlank(item.aiReviewSummary(), item.supplementReason()),
                        null,
                        List.of(),
                        null,
                        null
                );
                updates.put(-(updates.size() + 1), update);
                if (reviewConsumer != null) {
                    reviewConsumer.accept(update);
                }
            }
        }
        if (updates.isEmpty()) {
            for (int index = 0; index < caseCount; index += 1) {
                AiCaseService.ReviewCaseStreamUpdate update = new AiCaseService.ReviewCaseStreamUpdate(
                        index,
                        "CONFIRM_REQUIRED",
                        reviewResult.summary(),
                        reviewResult.summary(),
                        "完整输出评审未返回逐条依据评价，请查看评审原始输出。",
                        reviewResult.summary(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        rawContent,
                        null,
                        null,
                        null,
                        null,
                        reviewResult.summary(),
                        null,
                        List.of(),
                        null,
                        null
                );
                updates.put(index, update);
                if (reviewConsumer != null) {
                    reviewConsumer.accept(update);
                }
            }
        }
    }

    String generationCoverageSummary(String rawContent) {
        if (rawContent == null || rawContent.isBlank()) {
            return null;
        }
        try {
            JsonNode parsed = OBJECT_MAPPER.readTree(rawContent);
            JsonNode node = parsed.path("coverageSummary");
            return node.isTextual() && !node.asText().trim().isBlank() ? node.asText().trim() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    List<String> generationRemainingCoverageGaps(String rawContent) {
        if (rawContent == null || rawContent.isBlank()) {
            return List.of();
        }
        try {
            JsonNode parsed = OBJECT_MAPPER.readTree(rawContent);
            JsonNode node = parsed.path("remainingCoverageGaps");
            if (!node.isArray()) {
                return List.of();
            }
            List<String> values = new ArrayList<>();
            for (JsonNode item : node) {
                if (item.isTextual() && !item.asText().trim().isBlank()) {
                    values.add(item.asText().trim());
                }
            }
            return values;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    boolean isImageInputUnsupportedError(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("不支持图片")
                || normalized.contains("图片输入")
                || normalized.contains("image input")
                || normalized.contains("does not support image")
                || normalized.contains("image is not supported")
                || normalized.contains("not a vision model")
                || normalized.contains("vision model required")
                || normalized.contains("image_url")
                || normalized.contains("input_image");
    }

    String normalizeStreamJsonLine(String rawLine) {
        if (rawLine == null) {
            return null;
        }
        String line = rawLine.trim();
        while (line.startsWith(",")) {
            line = line.substring(1).trim();
        }
        while (line.endsWith(",")) {
            line = line.substring(0, line.length() - 1).trim();
        }
        if (line.isBlank() || line.startsWith("```") || line.startsWith("[") || !line.startsWith("{")) {
            return null;
        }
        return line;
    }

    private int indexOfLineBreak(StringBuilder buffer) {
        for (int index = 0; index < buffer.length(); index += 1) {
            char current = buffer.charAt(index);
            if (current == '\n') {
                return index;
            }
        }
        return -1;
    }

    private Integer parseReviewCaseIndex(JsonNode root, int caseCount) {
        Integer caseIndex = optionalInt(root.path("caseIndex"));
        if (caseIndex != null && caseIndex >= 0 && caseIndex < caseCount) {
            return caseIndex;
        }
        Integer itemIndex = optionalInt(root.path("itemIndex"));
        if (itemIndex != null && itemIndex >= 0 && itemIndex < caseCount) {
            return itemIndex;
        }
        Integer index = optionalInt(root.path("index"));
        if (index != null && index >= 0 && index < caseCount) {
            return index;
        }
        Integer caseNo = optionalInt(root.path("caseNo"));
        if (caseNo != null && caseNo >= 1 && caseNo <= caseCount) {
            return caseNo - 1;
        }
        return null;
    }

    private GeneratedAiCaseItem parseStreamGeneratedCase(JsonNode node, String source, String reviewStatus) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String title = firstText(node, "title");
        String steps = firstText(node, "steps");
        String expectedResult = firstText(node, "expectedResult");
        if (title == null || steps == null || expectedResult == null) {
            return null;
        }
        return new GeneratedAiCaseItem(
                title,
                normalizeCaseType(firstText(node, "caseType")),
                normalizePriority(firstText(node, "priority")),
                firstText(node, "precondition"),
                steps,
                expectedResult,
                firstText(node, "riskNotes"),
                firstText(node, "testAngle"),
                firstText(node, "generationReason"),
                firstText(node, "requirementEvidence"),
                firstText(node, "aiSource", "source") == null ? source : firstText(node, "aiSource", "source"),
                firstText(node, "reviewComment"),
                firstText(node, "optimizationReason"),
                firstText(node, "supplementReason"),
                firstText(node, "coverageGap"),
                null,
                List.of(),
                firstText(node, "aiReviewStatus", "reviewStatus") == null ? reviewStatus : firstText(node, "aiReviewStatus", "reviewStatus"),
                firstText(node, "aiReviewSummary", "reviewSummary"),
                false,
                null,
                null
        );
    }

    private GeneratedAiCaseItem withSupplementReviewMetadata(GeneratedAiCaseItem item, String summary, String supplementReason, String coverageGap) {
        return new GeneratedAiCaseItem(
                item.title(),
                item.caseType(),
                item.priority(),
                item.precondition(),
                item.steps(),
                item.expectedResult(),
                item.riskNotes(),
                item.testAngle(),
                item.generationReason(),
                item.requirementEvidence(),
                "REVIEW_SUPPLEMENTED",
                item.reviewComment(),
                item.optimizationReason(),
                firstNonBlank(item.supplementReason(), supplementReason),
                firstNonBlank(item.coverageGap(), coverageGap),
                null,
                item.warnings(),
                "SUPPLEMENTED",
                firstNonBlank(item.aiReviewSummary(), summary, supplementReason, coverageGap),
                item.manualEdited(),
                item.manualEditedByName(),
                item.manualEditedAt()
        );
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

    private List<String> stringList(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().trim().isBlank()) {
                values.add(item.asText().trim());
            }
        }
        return values;
    }

    private String firstText(JsonNode root, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode node = root.path(fieldName);
            if (node.isTextual() && !node.asText().trim().isBlank()) {
                return node.asText().trim();
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private JsonNode firstPresentNode(JsonNode root, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode node = root.path(fieldName);
            if (!node.isMissingNode() && !node.isNull()) {
                return node;
            }
        }
        return null;
    }

    private String normalizePerCaseReviewStatus(String status) {
        if (status == null || status.isBlank()) {
            return "CONFIRM_REQUIRED";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "APPROVE", "APPROVED", "PASS", "PASSED" -> "APPROVED";
            case "OPTIMIZE", "OPTIMIZED", "SUGGESTED", "SUGGEST", "IMPROVED", "CHANGE_SUGGESTED" -> "CHANGE_SUGGESTED";
            case "SUPPLEMENT", "SUPPLEMENTED", "ADDED" -> "SUPPLEMENTED";
            case "CONFIRM", "CONFIRM_REQUIRED", "NEEDS_CONFIRMATION" -> "CONFIRM_REQUIRED";
            case "NOT_RECOMMENDED", "REJECT", "REJECTED", "FAIL", "FAILED" -> "NOT_RECOMMENDED";
            default -> "CONFIRM_REQUIRED";
        };
    }

    private String normalizeReviewResult(String result) {
        if (result == null || result.isBlank()) {
            return "SUGGEST";
        }
        return switch (result.trim().toUpperCase(Locale.ROOT)) {
            case "APPROVE", "REJECT", "SUGGEST" -> result.trim().toUpperCase(Locale.ROOT);
            default -> "SUGGEST";
        };
    }

    private record ReviewStreamSummary(
            Integer reviewedCount,
            List<String> unresolvedCoverageGaps,
            String result,
            String summary
    ) {
    }

    private String normalizeCaseType(String caseType) {
        if (caseType == null || caseType.isBlank()) {
            return "FUNCTION";
        }
        String normalized = caseType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "FUNCTION", "BOUNDARY", "EXCEPTION", "REGRESSION" -> normalized;
            default -> "FUNCTION";
        };
    }

    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "P1";
        }
        String normalized = priority.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "P0", "P1", "P2", "P3" -> normalized;
            default -> "P1";
        };
    }
}
