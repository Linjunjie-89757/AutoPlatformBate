package com.company.autoplatform.ai;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class AiGenerationCaseQualityService {

    public QualityResult validateNormalizeAndDeduplicate(
            List<GeneratedAiCaseItem> input,
            List<AiInvalidCaseItem> existingInvalidCases,
            int maxCases
    ) {
        List<GeneratedAiCaseItem> valid = new ArrayList<>();
        List<AiInvalidCaseItem> invalid = new ArrayList<>(existingInvalidCases == null ? List.of() : existingInvalidCases);
        List<String> warnings = new ArrayList<>();
        Map<String, Integer> fingerprintIndexes = new LinkedHashMap<>();
        int sourceIndex = 0;
        for (GeneratedAiCaseItem item : input == null ? List.<GeneratedAiCaseItem>of() : input) {
            sourceIndex += 1;
            GeneratedAiCaseItem normalized = normalize(item);
            if (normalized == null) {
                invalid.add(new AiInvalidCaseItem(sourceIndex, "Candidate case " + sourceIndex,
                        "标题、步骤和预期结果不能为空，或测试类型/优先级不合法", item == null ? "null" : item.toString()));
                continue;
            }
            String fingerprint = fingerprint(normalized);
            Integer duplicateOf = fingerprintIndexes.get(fingerprint);
            if (duplicateOf != null) {
                warnings.add("Candidate case " + sourceIndex + " duplicated candidate case " + duplicateOf + " and was ignored");
                continue;
            }
            if (valid.size() >= maxCases) {
                warnings.add("Candidate case " + sourceIndex + " exceeded the maximum case limit and was ignored");
                continue;
            }
            fingerprintIndexes.put(fingerprint, sourceIndex);
            valid.add(normalized);
        }
        return new QualityResult(valid, warnings, invalid);
    }

    private GeneratedAiCaseItem normalize(GeneratedAiCaseItem item) {
        if (item == null || blank(item.title()) || blank(item.steps()) || blank(item.expectedResult())) {
            return null;
        }
        String caseType = normalizeChoice(item.caseType(), List.of("FUNCTION", "BOUNDARY", "EXCEPTION", "REGRESSION"));
        String priority = normalizeChoice(item.priority(), List.of("P0", "P1", "P2", "P3"));
        if (caseType == null || priority == null) {
            return null;
        }
        if (caseType.equals(item.caseType()) && priority.equals(item.priority())) {
            return item;
        }
        return new GeneratedAiCaseItem(
                item.title().trim(), caseType, priority, trim(item.precondition()), item.steps().trim(), item.expectedResult().trim(),
                trim(item.riskNotes()), trim(item.testAngle()), trim(item.generationReason()), trim(item.requirementEvidence()),
                item.aiSource(), item.reviewComment(), item.optimizationReason(), item.supplementReason(), item.coverageGap(),
                item.originalCaseSnapshot(), item.warnings(), item.aiReviewStatus(), item.aiReviewSummary(), item.manualEdited(),
                item.manualEditedByName(), item.manualEditedAt()
        );
    }

    private String normalizeChoice(String value, List<String> allowed) {
        if (blank(value)) {
            return allowed.get(0);
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return allowed.contains(normalized) ? normalized : null;
    }

    private String fingerprint(GeneratedAiCaseItem item) {
        return normalizeText(item.title()) + "|" + normalizeText(item.precondition()) + "|"
                + normalizeText(item.steps()) + "|" + normalizeText(item.expectedResult());
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String trim(String value) {
        return blank(value) ? null : value.trim();
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record QualityResult(
            List<GeneratedAiCaseItem> cases,
            List<String> warnings,
            List<AiInvalidCaseItem> invalidCases
    ) {
    }
}
