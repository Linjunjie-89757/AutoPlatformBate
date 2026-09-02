package com.company.autoplatform.ai;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Component
public class AiGenerationTaskResultMergeSupport {

    AiExistingCaseItem toExistingCaseItem(GeneratedAiCaseItem item) {
        return new AiExistingCaseItem(
                null,
                null,
                null,
                item.title(),
                item.caseType(),
                item.priority(),
                item.precondition(),
                item.steps(),
                item.expectedResult(),
                item.testAngle(),
                item.generationReason(),
                item.requirementEvidence()
        );
    }

    GeneratedAiCaseItem applyReviewUpdate(GeneratedAiCaseItem original, AiCaseService.ReviewCaseStreamUpdate update) {
        GeneratedAiCaseItem base = original;
        String reviewStatus = normalizeReviewStatus(update.status());
        return new GeneratedAiCaseItem(
                base.title(),
                base.caseType(),
                base.priority(),
                base.precondition(),
                base.steps(),
                base.expectedResult(),
                base.riskNotes(),
                firstNonBlank(base.testAngle(), original.testAngle()),
                firstNonBlank(base.generationReason(), original.generationReason()),
                firstNonBlank(base.requirementEvidence(), original.requirementEvidence()),
                firstNonBlank(original.aiSource(), "INITIAL"),
                firstNonBlank(update.reviewComment(), update.summary(), base.reviewComment(), original.reviewComment()),
                firstNonBlank(update.optimizationReason(), base.optimizationReason(), original.optimizationReason()),
                firstNonBlank(base.supplementReason(), original.supplementReason()),
                firstNonBlank(update.coverageGap(), base.coverageGap(), original.coverageGap()),
                original.originalCaseSnapshot(),
                base.warnings() == null ? original.warnings() : base.warnings(),
                reviewStatus,
                update.summary(),
                original.manualEdited(),
                original.manualEditedByName(),
                original.manualEditedAt()
        );
    }

    GeneratedAiCaseItem withStreamSupplementMetadata(AiCaseService.ReviewCaseStreamUpdate update) {
        GeneratedAiCaseItem item = update.supplementCase();
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
                firstNonBlank(item.reviewComment(), update.reviewComment()),
                item.optimizationReason(),
                firstNonBlank(item.supplementReason(), update.supplementReason(), update.summary()),
                firstNonBlank(item.coverageGap(), update.coverageGap()),
                null,
                item.warnings(),
                "CONFIRM_REQUIRED",
                firstNonBlank(item.aiReviewSummary(), update.summary(), update.supplementReason(), update.coverageGap()),
                item.manualEdited(),
                item.manualEditedByName(),
                item.manualEditedAt()
        );
    }

    List<GeneratedAiCaseItem> mergeCompleteReviewResult(List<GeneratedAiCaseItem> generatedCases, AiReviewResult review) {
        return mergeCompleteReviewResult(generatedCases, null, review, AiCaseService.FINAL_MAX_CASES);
    }

    List<GeneratedAiCaseItem> mergeCompleteReviewResult(
            List<GeneratedAiCaseItem> generatedCases,
            List<AiCaseCandidateEntity> candidates,
            AiReviewResult review
    ) {
        return mergeCompleteReviewResult(generatedCases, candidates, review, AiCaseService.FINAL_MAX_CASES);
    }

    List<GeneratedAiCaseItem> mergeCompleteReviewResult(
            List<GeneratedAiCaseItem> generatedCases,
            List<AiCaseCandidateEntity> candidates,
            AiReviewResult review,
            int maxCases
    ) {
        List<GeneratedAiCaseItem> finalCases = new ArrayList<>();
        Set<String> caseFingerprints = new HashSet<>();
        for (GeneratedAiCaseItem item : generatedCases) {
            finalCases.add(withSource(item, "INITIAL"));
            caseFingerprints.add(caseFingerprint(item));
        }
        if (review == null) {
            return finalCases;
        }
        for (AiReviewCaseDecision decision : review.caseDecisions() == null ? List.<AiReviewCaseDecision>of() : review.caseDecisions()) {
            Integer index = resolveDecisionIndex(decision, candidates, finalCases.size());
            if (index == null) {
                continue;
            }
            GeneratedAiCaseItem current = finalCases.get(index);
            GeneratedAiCaseItem next = applyReviewDecision(current, decision);
            finalCases.set(index, next);
        }
        for (GeneratedAiCaseItem item : review.supplementCases() == null ? List.<GeneratedAiCaseItem>of() : review.supplementCases()) {
            if (finalCases.size() >= maxCases) {
                break;
            }
            if (!isValidSupplement(item) || !caseFingerprints.add(caseFingerprint(item))) {
                continue;
            }
            finalCases.add(withSupplementMetadata(item));
        }
        return finalCases;
    }

    private Integer resolveDecisionIndex(
            AiReviewCaseDecision decision,
            List<AiCaseCandidateEntity> candidates,
            int caseCount
    ) {
        if (decision.candidateCaseId() != null && !decision.candidateCaseId().isBlank() && candidates != null) {
            for (AiCaseCandidateEntity candidate : candidates) {
                if (decision.candidateCaseId().trim().equals(candidate.getCandidateId())) {
                    if (decision.caseIndex() != null && !Objects.equals(decision.caseIndex(), candidate.getDisplayIndex())) {
                        return null;
                    }
                    return candidate.getDisplayIndex();
                }
            }
            return null;
        }
        if (decision.caseIndex() == null || decision.caseIndex() < 0 || decision.caseIndex() >= caseCount) {
            return null;
        }
        return decision.caseIndex();
    }

    private GeneratedAiCaseItem applyReviewDecision(GeneratedAiCaseItem original, AiReviewCaseDecision decision) {
        String status = normalizeReviewStatus(decision.status());
        GeneratedAiCaseItem base = original;
        return new GeneratedAiCaseItem(
                base.title(),
                base.caseType(),
                base.priority(),
                base.precondition(),
                base.steps(),
                base.expectedResult(),
                base.riskNotes(),
                firstNonBlank(base.testAngle(), original.testAngle()),
                firstNonBlank(base.generationReason(), original.generationReason()),
                firstNonBlank(base.requirementEvidence(), original.requirementEvidence()),
                firstNonBlank(original.aiSource(), "INITIAL"),
                firstNonBlank(decision.reviewComment(), decision.summary(), base.reviewComment(), original.reviewComment()),
                firstNonBlank(decision.optimizationReason(), base.optimizationReason(), original.optimizationReason()),
                firstNonBlank(base.supplementReason(), original.supplementReason()),
                firstNonBlank(decision.coverageGap(), base.coverageGap(), original.coverageGap()),
                original.originalCaseSnapshot(),
                base.warnings() == null ? original.warnings() : base.warnings(),
                status,
                decision.summary(),
                original.manualEdited(),
                original.manualEditedByName(),
                original.manualEditedAt()
        );
    }

    private GeneratedAiCaseItem withSource(GeneratedAiCaseItem item, String source) {
        return new GeneratedAiCaseItem(
                item.title(), item.caseType(), item.priority(), item.precondition(), item.steps(), item.expectedResult(),
                item.riskNotes(), item.testAngle(), item.generationReason(), item.requirementEvidence(),
                firstNonBlank(item.aiSource(), source), item.reviewComment(), item.optimizationReason(), item.supplementReason(),
                item.coverageGap(), item.originalCaseSnapshot(), item.warnings(), item.aiReviewStatus(), item.aiReviewSummary(),
                item.manualEdited(), item.manualEditedByName(), item.manualEditedAt()
        );
    }

    private GeneratedAiCaseItem withSupplementMetadata(GeneratedAiCaseItem item) {
        return new GeneratedAiCaseItem(
                item.title(), item.caseType(), item.priority(), item.precondition(), item.steps(), item.expectedResult(),
                item.riskNotes(), item.testAngle(), item.generationReason(), item.requirementEvidence(),
                "REVIEW_SUPPLEMENTED", item.reviewComment(), item.optimizationReason(), item.supplementReason(),
                item.coverageGap(), null, item.warnings(), "CONFIRM_REQUIRED", firstNonBlank(item.aiReviewSummary(), item.supplementReason(), item.coverageGap()),
                item.manualEdited(), item.manualEditedByName(), item.manualEditedAt()
        );
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isValidSupplement(GeneratedAiCaseItem item) {
        return item != null
                && !isBlank(item.title())
                && !isBlank(item.steps())
                && !isBlank(item.expectedResult());
    }

    private String caseFingerprint(GeneratedAiCaseItem item) {
        return String.join("\u001f",
                normalize(item.title()),
                normalize(item.precondition()),
                normalize(item.steps()),
                normalize(item.expectedResult())
        );
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalizeReviewStatus(String status) {
        if (status == null || status.isBlank()) {
            return "CONFIRM_REQUIRED";
        }
        return "OPTIMIZED".equals(status) ? "CHANGE_SUGGESTED" : status;
    }
}
