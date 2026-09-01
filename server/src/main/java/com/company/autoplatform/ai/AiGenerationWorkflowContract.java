package com.company.autoplatform.ai;

import java.util.Set;

/**
 * Stable values shared by the staged AI generation and review workflow.
 * Existing PENDING task values remain accepted for backward compatibility.
 */
public final class AiGenerationWorkflowContract {

    public static final String SELF_CHECK_NOT_STARTED = "NOT_STARTED";
    public static final String SELF_CHECK_RUNNING = "RUNNING";
    public static final String SELF_CHECK_SUCCEEDED = "SUCCEEDED";
    public static final String SELF_CHECK_FAILED = "FAILED";
    public static final String SELF_CHECK_TIMED_OUT = "TIMED_OUT";

    public static final String REVIEW_NOT_STARTED = "NOT_STARTED";
    public static final String REVIEW_RUNNING = "RUNNING";
    public static final String REVIEW_SUCCEEDED = "SUCCEEDED";
    public static final String REVIEW_PARTIAL = "PARTIAL";
    public static final String REVIEW_FAILED = "FAILED";
    public static final String REVIEW_CANCELED = "CANCELED";

    public static final String VALIDATION_VALID = "VALID";
    public static final String VALIDATION_WARNING = "WARNING";
    public static final String VALIDATION_FAILED = "FAILED";
    public static final String VALIDATION_DUPLICATE = "DUPLICATE";

    public static final String SOURCE_INITIAL_GENERATION = "INITIAL_GENERATION";
    public static final String SOURCE_SELF_REVIEW_SUPPLEMENT = "SELF_REVIEW_SUPPLEMENT";
    public static final String SOURCE_COVERAGE_REVIEW_SUPPLEMENT = "COVERAGE_REVIEW_SUPPLEMENT";

    public static final String COVERAGE_UNREVIEWED = "UNREVIEWED";
    public static final String COVERAGE_COVERED = "COVERED";
    public static final String COVERAGE_GAP = "GAP";
    public static final String COVERAGE_EXPECTED = "EXPECTED_COVERAGE";

    public static final String VERIFICATION_UNVERIFIED = "UNVERIFIED";
    public static final String VERIFICATION_VERIFIED = "VERIFIED";
    public static final String VERIFICATION_UNVERIFIED_BY_SECOND_REVIEW = "UNVERIFIED_BY_SECOND_REVIEW";

    private static final Set<String> REVIEW_TERMINAL_STATES = Set.of(
            REVIEW_SUCCEEDED, REVIEW_PARTIAL, REVIEW_FAILED, REVIEW_CANCELED
    );

    private AiGenerationWorkflowContract() {
    }

    public static boolean isReviewSupplementAllowed(String reviewStatus, int failedBatchCount) {
        return REVIEW_SUCCEEDED.equals(reviewStatus) && failedBatchCount == 0;
    }

    public static boolean isReviewTerminal(String reviewStatus) {
        return REVIEW_TERMINAL_STATES.contains(reviewStatus);
    }

    public static boolean canAdopt(String validationStatus) {
        return VALIDATION_VALID.equals(validationStatus) || VALIDATION_WARNING.equals(validationStatus);
    }
}
