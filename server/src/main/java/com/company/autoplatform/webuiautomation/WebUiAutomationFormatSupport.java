package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;

import java.util.List;
import java.util.Locale;
import java.util.Set;

final class WebUiAutomationFormatSupport {

    static final String DEFAULT_BROWSER_TYPE = "CHROMIUM";
    static final String DEFAULT_STATUS = "ENABLED";
    static final String DEFAULT_SCREENSHOT_POLICY = "ON_FAILURE";
    static final int CASE_DEFAULT_TIMEOUT_MS = 10000;
    static final int STEP_DEFAULT_TIMEOUT_MS = 5000;
    static final int MIN_TIMEOUT_MS = 1000;
    static final int MAX_TIMEOUT_MS = 60000;

    private static final Set<String> BROWSER_TYPES = Set.of("CHROMIUM", "FIREFOX", "WEBKIT");
    private static final Set<String> CASE_STATUSES = Set.of("ENABLED", "DISABLED");
    private static final Set<String> LOCATOR_TYPES = Set.of("CSS", "TEXT", "ROLE", "PLACEHOLDER", "LABEL", "TEST_ID", "XPATH");
    private static final Set<String> STEP_TYPES = Set.of(
            "OPEN", "CLICK", "FILL", "CLEAR", "WAIT_FOR", "ASSERT_VISIBLE", "ASSERT_TEXT", "SCREENSHOT",
            "DRAG_TO", "DRAG_COORDINATES",
            "HOVER", "DOUBLE_CLICK", "RIGHT_CLICK", "PRESS_KEY", "SELECT", "FILE_UPLOAD", "FILE_PICKER",
            "ASSERT_URL", "ASSERT_TITLE", "ASSERT_ATTRIBUTE", "ASSERT_COUNT");
    private static final Set<String> LOCATOR_REQUIRED_STEP_TYPES = Set.of(
            "CLICK", "FILL", "CLEAR", "WAIT_FOR", "ASSERT_VISIBLE", "ASSERT_TEXT",
            "DRAG_TO", "DRAG_COORDINATES", "HOVER", "DOUBLE_CLICK", "RIGHT_CLICK", "SELECT", "FILE_UPLOAD", "FILE_PICKER", "ASSERT_ATTRIBUTE", "ASSERT_COUNT");
    private static final Set<String> INPUT_REQUIRED_STEP_TYPES = Set.of(
            "OPEN", "FILL", "DRAG_TO", "DRAG_COORDINATES", "ASSERT_TEXT", "PRESS_KEY", "SELECT", "FILE_UPLOAD", "FILE_PICKER",
            "ASSERT_URL", "ASSERT_TITLE", "ASSERT_ATTRIBUTE", "ASSERT_COUNT");
    private static final Set<String> SCREENSHOT_POLICIES = Set.of("NONE", "ON_FAILURE", "ALWAYS");

    private WebUiAutomationFormatSupport() {
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static <T> List<T> defaultList(List<T> values) {
        return values == null ? List.of() : values;
    }

    static String normalizeBrowserType(String browserType) {
        return normalizeAllowed(browserType, DEFAULT_BROWSER_TYPE, BROWSER_TYPES, "Unsupported browser type: ");
    }

    static String normalizeStatus(String status) {
        return normalizeAllowed(status, DEFAULT_STATUS, CASE_STATUSES, "Unsupported status: ");
    }

    static String normalizeLocatorType(String locatorType) {
        return normalizeAllowed(locatorType, null, LOCATOR_TYPES, "Unsupported locator type: ");
    }

    static int normalizeEnvironmentStatus(Integer status) {
        if (status == null) {
            return 1;
        }
        if (status != 0 && status != 1) {
            throw new BadRequestException("Unsupported environment status: " + status);
        }
        return status;
    }

    static String normalizeStepType(String stepType) {
        return normalizeAllowed(stepType, null, STEP_TYPES, "Unsupported step type: ");
    }

    static String normalizeScreenshotPolicy(String screenshotPolicy) {
        return normalizeAllowed(screenshotPolicy, DEFAULT_SCREENSHOT_POLICY, SCREENSHOT_POLICIES, "Unsupported screenshot policy: ");
    }

    static int normalizeCaseTimeout(Integer timeoutMs) {
        return clampTimeout(timeoutMs, CASE_DEFAULT_TIMEOUT_MS);
    }

    static int normalizeStepTimeout(Integer timeoutMs) {
        return clampTimeout(timeoutMs, STEP_DEFAULT_TIMEOUT_MS);
    }

    static void validateStepRequirements(String stepType, String locatorType, String locatorValue, String inputValue) {
        if (LOCATOR_REQUIRED_STEP_TYPES.contains(stepType)
                && (blankToNull(locatorType) == null || blankToNull(locatorValue) == null)) {
            throw new BadRequestException("Locator is required for step type: " + stepType);
        }
        if (INPUT_REQUIRED_STEP_TYPES.contains(stepType) && blankToNull(inputValue) == null) {
            throw new BadRequestException("Input value is required for step type: " + stepType);
        }
    }

    private static String normalizeAllowed(String raw, String fallback, Set<String> allowed, String errorPrefix) {
        String normalized = blankToNull(raw);
        if (normalized == null) {
            if (fallback == null) {
                throw new BadRequestException(errorPrefix + "blank");
            }
            return fallback;
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BadRequestException(errorPrefix + normalized);
        }
        return normalized;
    }

    private static int clampTimeout(Integer timeoutMs, int defaultValue) {
        int value = timeoutMs == null ? defaultValue : timeoutMs;
        return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, value));
    }
}
