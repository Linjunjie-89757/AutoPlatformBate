package com.company.autoplatform.webuiautomation;

import java.util.List;
import java.util.Map;

public interface WebUiBrowserRunner {

    List<StepExecutionResult> run(WebUiRunContext context);

    record WebUiRunContext(
            String browserType,
            boolean headless,
            String baseUrl,
            int defaultTimeoutMs,
            Map<String, String> extraHttpHeaders,
            List<WebUiCaseStepEntity> steps
    ) {
    }

    record StepExecutionResult(
            WebUiCaseStepEntity step,
            boolean success,
            long durationMs,
            String errorMessage,
            byte[] screenshotBytes
    ) {
    }
}
