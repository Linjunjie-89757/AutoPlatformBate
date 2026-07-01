package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.NotFoundException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

final class ApiLocalRunnerPayloadSupport {

    private static final String SCENARIO_RESOURCE_TYPE_CASE = "CASE";
    private static final String SCENARIO_STEP_API_CASE = "API_CASE";
    private static final String SCENARIO_STEP_CUSTOM_REQUEST = "CUSTOM_REQUEST";
    private static final String SCENARIO_STEP_REF_REF = "REF";

    private ApiLocalRunnerPayloadSupport() {
    }

    static ArtifactCollector artifactCollector() {
        return new ArtifactCollector();
    }

    static List<Map<String, Object>> defaultMaskingRules() {
        List<Map<String, Object>> rules = new ArrayList<>();
        for (String fieldName : List.of(
                "authorization",
                "proxy-authorization",
                "cookie",
                "set-cookie",
                "password",
                "passwd",
                "pwd",
                "token",
                "access_token",
                "refresh_token",
                "secret",
                "credential",
                "api_key",
                "apikey",
                "x-api-key",
                "x-auth-token"
        )) {
            rules.add(maskingRule("field_" + fieldName.replace("-", "_"), "FIELD_NAME", fieldName, "******", null));
        }
        rules.add(maskingRule("json_sensitive_field", "REGEX",
                "(\"(?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|apikey)\"\\s*:\\s*\")[^\"\\\\]*(\")",
                "$1******$2",
                "gi"));
        rules.add(maskingRule("url_sensitive_query", "REGEX",
                "([?&](?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|apikey)=)[^&#\\s]+",
                "$1******",
                "gi"));
        rules.add(maskingRule("bearer_authorization", "REGEX", "(Bearer\\s+)[A-Za-z0-9._~+\\-/]+=*", "$1******", "gi"));
        rules.add(maskingRule("basic_authorization", "REGEX", "(Basic\\s+)[A-Za-z0-9+/=]+", "$1******", "gi"));
        return List.copyOf(rules);
    }

    private static Map<String, Object> maskingRule(String ruleId, String type, String pattern, String replacement, String flags) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("ruleId", ruleId);
        rule.put("type", type);
        rule.put("pattern", pattern);
        rule.put("replacement", replacement);
        rule.put("enabled", true);
        if (flags != null) {
            rule.put("flags", flags);
        }
        return rule;
    }

    static List<Map<String, Object>> buildScenarioSteps(
            List<ApiScenarioStepInput> steps,
            boolean continueOnFailure,
            ApiDefinitionCaseMapper caseMapper
    ) {
        return buildScenarioSteps(steps, continueOnFailure, caseMapper, null);
    }

    static List<Map<String, Object>> buildScenarioSteps(
            List<ApiScenarioStepInput> steps,
            boolean continueOnFailure,
            ApiDefinitionCaseMapper caseMapper,
            ArtifactCollector artifactCollector
    ) {
        List<Map<String, Object>> values = new ArrayList<>();
        int index = 0;
        for (ApiScenarioStepInput step : defaultList(steps)) {
            if (step == null || Boolean.FALSE.equals(step.enabled())) {
                continue;
            }
            Map<String, Object> value = new LinkedHashMap<>();
            String stepId = blankToFallback(step.id(), "api-step-" + (++index));
            String stepType = normalizeScenarioStepType(step);
            value.put("stepId", stepId);
            value.put("id", stepId);
            value.put("name", blankToFallback(step.stepName(), stepId));
            value.put("stepName", blankToFallback(step.stepName(), stepId));
            value.put("type", stepType);
            value.put("stepType", stepType);
            value.put("enabled", true);
            value.put("continueOnFailure", continueOnFailure);
            value.put("caseSnapshot", buildCaseSnapshot(step, stepType, caseMapper, artifactCollector, "scenario-step-" + stepId));
            values.add(value);
        }
        return values;
    }

    static Map<String, Object> buildApiCaseSnapshot(ApiDefinitionCaseEntity apiCase) {
        return buildApiCaseSnapshot(apiCase, null);
    }

    static Map<String, Object> buildApiCaseSnapshot(ApiDefinitionCaseEntity apiCase, ArtifactCollector artifactCollector) {
        if (apiCase == null) {
            throw new NotFoundException("API case not found");
        }
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("caseId", apiCase.getId());
        value.put("caseName", apiCase.getCaseName());
        value.put("definitionId", apiCase.getDefinitionId());
        value.put("request", buildRequest(readCaseRequestConfig(apiCase), artifactCollector, "api-case-" + apiCase.getId()));
        value.put("assertions", buildAssertions(readAssertions(apiCase.getAssertionsJson())));
        value.put("preScript", buildScript(readProcessorsJson(apiCase.getPreprocessorsJson())));
        List<ApiProcessorInput> postProcessors = readProcessorsJson(apiCase.getPostprocessorsJson());
        value.put("postScript", buildScript(postProcessors));
        value.put("extractors", buildExtractors(postProcessors));
        return value;
    }

    private static String normalizeScenarioStepType(ApiScenarioStepInput step) {
        String rawType = blankToNull(step.stepType());
        if (rawType == null) {
            String resourceType = blankToFallback(step.resourceType(), "").toUpperCase();
            rawType = SCENARIO_RESOURCE_TYPE_CASE.equals(resourceType) ? SCENARIO_STEP_API_CASE : SCENARIO_STEP_CUSTOM_REQUEST;
        }
        return rawType.trim().toUpperCase();
    }

    private static Map<String, Object> buildCaseSnapshot(
            ApiScenarioStepInput step,
            String stepType,
            ApiDefinitionCaseMapper caseMapper,
            ArtifactCollector artifactCollector,
            String artifactScope
    ) {
        if (SCENARIO_STEP_API_CASE.equals(stepType)
                && SCENARIO_STEP_REF_REF.equalsIgnoreCase(blankToFallback(step.refType(), SCENARIO_STEP_REF_REF))) {
            ApiDefinitionCaseEntity apiCase = caseMapper.selectById(step.resourceId());
            return buildApiCaseSnapshot(apiCase, artifactCollector);
        }

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("caseId", step.resourceId());
        value.put("caseName", blankToFallback(step.stepName(), "Local API Step"));
        value.put("request", buildRequest(step.requestConfig(), artifactCollector, artifactScope));
        value.put("assertions", buildAssertions(step.assertions()));
        value.put("preScript", buildScript(step.preProcessors()));
        value.put("postScript", buildScript(step.postProcessors()));
        value.put("extractors", buildExtractors(step.postProcessors()));
        return value;
    }

    private static ApiRequestConfigInput readCaseRequestConfig(ApiDefinitionCaseEntity apiCase) {
        return ApiAutomationJsonSupport.read(
                apiCase.getRequestJson(),
                ApiRequestConfigInput.class,
                new ApiRequestConfigInput("GET", "/", 30000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig())
        );
    }

    private static Map<String, Object> buildRequest(ApiRequestConfigInput config) {
        return buildRequest(config, null, "api-request");
    }

    private static Map<String, Object> buildRequest(
            ApiRequestConfigInput config,
            ArtifactCollector artifactCollector,
            String artifactScope
    ) {
        ApiRequestConfigInput safeConfig = config == null
                ? new ApiRequestConfigInput("GET", "/", 30000, List.of(), List.of(), List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig())
                : config;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("method", blankToFallback(safeConfig.method(), "GET").toUpperCase());
        value.put("url", buildRequestUrl(safeConfig.path()));
        value.put("queryParams", buildKeyValueItems(safeConfig.queryParams()));
        value.put("headers", buildKeyValueItems(safeConfig.headers()));
        value.put("cookies", buildKeyValueItems(safeConfig.cookies()));
        value.put("body", buildRequestBody(safeConfig.body(), artifactCollector, artifactScope));
        return value;
    }

    private static String buildRequestUrl(String path) {
        String value = blankToFallback(path, "/");
        if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("{{baseUrl}}")) {
            return value;
        }
        return value.startsWith("/") ? "{{baseUrl}}" + value : "{{baseUrl}}/" + value;
    }

    private static List<Map<String, Object>> buildKeyValueItems(List<ApiKeyValueInput> items) {
        return defaultList(items).stream()
                .filter(item -> item != null && !Boolean.FALSE.equals(item.enabled()) && blankToNull(item.key()) != null)
                .map(item -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("name", item.key().trim());
                    value.put("key", item.key().trim());
                    value.put("value", Optional.ofNullable(item.value()).orElse(""));
                    value.put("enabled", true);
                    return value;
                })
                .toList();
    }

    private static Object buildRequestBody(
            ApiRequestBodyInput body,
            ArtifactCollector artifactCollector,
            String artifactScope
    ) {
        if (body == null) {
            return null;
        }
        String type = blankToFallback(body.type(), "NONE").toUpperCase();
        if ("RAW_JSON".equals(type) || "RAW_TEXT".equals(type) || "RAW_XML".equals(type)) {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("type", type);
            value.put("rawText", Optional.ofNullable(body.rawText()).orElse(""));
            if (blankToNull(body.contentType()) != null) {
                value.put("contentType", body.contentType().trim());
            }
            return value;
        }
        if ("FORM_DATA".equals(type)) {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("type", type);
            value.put("formItems", buildFormItems(body.formItems(), artifactCollector, artifactScope));
            return value;
        }
        return null;
    }

    private static List<Map<String, Object>> buildFormItems(
            List<ApiKeyValueInput> items,
            ArtifactCollector artifactCollector,
            String artifactScope
    ) {
        List<Map<String, Object>> values = new ArrayList<>();
        int index = 0;
        for (ApiKeyValueInput item : defaultList(items)) {
            if (item == null || Boolean.FALSE.equals(item.enabled()) || blankToNull(item.key()) == null) {
                continue;
            }
            String key = item.key().trim();
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("name", key);
            value.put("key", key);
            value.put("enabled", true);
            index++;
            if (isFormFileItem(item)) {
                String fileId = buildArtifactFileId(artifactScope, key, index);
                String fileName = blankToFallback(item.fileName(), blankToFallback(item.value(), fileId));
                String contentType = blankToFallback(item.contentType(), "application/octet-stream");
                value.put("value", "artifact:" + fileId);
                value.put("fileName", fileName);
                value.put("contentType", contentType);
                addFormFileArtifact(artifactCollector, fileId, fileName, contentType, item.fileBase64());
            } else {
                value.put("value", Optional.ofNullable(item.value()).orElse(""));
            }
            values.add(value);
        }
        return values;
    }

    private static boolean isFormFileItem(ApiKeyValueInput item) {
        return "file".equalsIgnoreCase(blankToFallback(item.paramType(), ""))
                || blankToNull(item.fileName()) != null
                || blankToNull(item.fileBase64()) != null;
    }

    private static void addFormFileArtifact(
            ArtifactCollector artifactCollector,
            String fileId,
            String fileName,
            String contentType,
            String contentBase64
    ) {
        if (artifactCollector == null) {
            return;
        }
        Map<String, Object> artifact = new LinkedHashMap<>();
        artifact.put("fileId", fileId);
        artifact.put("artifactId", fileId);
        artifact.put("fileName", fileName);
        artifact.put("contentType", contentType);
        if (blankToNull(contentBase64) != null) {
            artifact.put("contentBase64", contentBase64.trim());
        }
        artifactCollector.add(artifact);
    }

    private static String buildArtifactFileId(String artifactScope, String key, int index) {
        return sanitizeArtifactSegment(blankToFallback(artifactScope, "api-request"))
                + "-"
                + sanitizeArtifactSegment(key)
                + "-"
                + index;
    }

    private static String sanitizeArtifactSegment(String value) {
        String sanitized = blankToFallback(value, "file")
                .trim()
                .replaceAll("[^A-Za-z0-9._-]+", "-")
                .replaceAll("(^-+|-+$)", "");
        return sanitized.isBlank() ? "file" : sanitized;
    }

    private static List<Map<String, Object>> buildAssertions(List<ApiAssertionInput> assertions) {
        return defaultList(assertions).stream()
                .filter(assertion -> assertion != null && !Boolean.FALSE.equals(assertion.enabled()))
                .map(assertion -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    String type = blankToFallback(firstNonBlank(assertion.assertionType(), assertion.type()), "STATUS_CODE").toUpperCase();
                    value.put("assertionId", blankToFallback(assertion.id(), "assertion"));
                    value.put("id", blankToFallback(assertion.id(), "assertion"));
                    value.put("type", normalizeAssertionType(type, assertion.subject()));
                    value.put("expected", Optional.ofNullable(assertion.expectedValue()).orElse(""));
                    value.put("expectedValue", Optional.ofNullable(assertion.expectedValue()).orElse(""));
                    value.put("expression", blankToNull(assertion.condition()));
                    value.put("name", blankToNull(assertion.name()));
                    value.put("enabled", true);
                    return value;
                })
                .toList();
    }

    private static String normalizeAssertionType(String type, String subject) {
        if ("STATUS_CODE".equals(type)
                || "BODY_CONTAINS".equals(type)
                || "HEADER_EQUALS".equals(type)
                || "JSON_EQUALS".equals(type)
                || "RESPONSE_TIME_LESS_THAN".equals(type)) {
            return type;
        }
        String normalizedSubject = blankToFallback(subject, "").toUpperCase();
        if ("STATUS".equals(normalizedSubject) || "STATUS_CODE".equals(normalizedSubject)) {
            return "STATUS_CODE";
        }
        return type;
    }

    private static List<Map<String, Object>> buildExtractors(List<ApiProcessorInput> processors) {
        List<Map<String, Object>> values = new ArrayList<>();
        for (ApiProcessorInput processor : defaultList(processors)) {
            if (processor == null
                    || Boolean.FALSE.equals(processor.enabled())
                    || !"EXTRACT".equalsIgnoreCase(blankToFallback(processor.processorType(), ""))) {
                continue;
            }
            for (ApiProcessorExtractItemInput extractor : defaultList(processor.extractors())) {
                if (extractor == null || Boolean.FALSE.equals(extractor.enabled())) {
                    continue;
                }
                String variableName = blankToFallback(firstNonBlank(extractor.variableName(), extractor.name()), "");
                if (variableName.isBlank()) {
                    continue;
                }
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("extractorId", blankToFallback(extractor.name(), variableName));
                value.put("id", blankToFallback(extractor.name(), variableName));
                value.put("name", variableName);
                value.put("variableName", variableName);
                value.put("type", normalizeRunnerExtractorType(extractor));
                value.put("extractType", normalizeRunnerExtractorType(extractor));
                value.put("extractScope", normalizeRunnerExtractorScope(extractor));
                value.put("sourceType", blankToNull(extractor.sourceType()));
                value.put("expression", Optional.ofNullable(extractor.expression()).orElse(""));
                value.put("enabled", true);
                values.add(value);
            }
        }
        return values;
    }

    private static String normalizeRunnerExtractorType(ApiProcessorExtractItemInput extractor) {
        String extractType = blankToNull(extractor.extractType());
        if (extractType != null) {
            return extractType.toUpperCase();
        }
        String sourceType = blankToFallback(extractor.sourceType(), "").toUpperCase();
        return switch (sourceType) {
            case "BODY_JSONPATH" -> "JSON_PATH";
            case "HEADER" -> "HEADER";
            case "STATUS_CODE" -> "STATUS_CODE";
            default -> "JSON_PATH";
        };
    }

    private static String normalizeRunnerExtractorScope(ApiProcessorExtractItemInput extractor) {
        String extractScope = blankToNull(extractor.extractScope());
        if (extractScope != null) {
            return extractScope.toUpperCase();
        }
        String sourceType = blankToFallback(extractor.sourceType(), "").toUpperCase();
        return switch (sourceType) {
            case "HEADER" -> "RESPONSE_HEADERS";
            case "STATUS_CODE" -> "RESPONSE_CODE";
            default -> "BODY";
        };
    }

    private static String buildScript(List<ApiProcessorInput> processors) {
        return defaultList(processors).stream()
                .filter(processor -> processor != null && !Boolean.FALSE.equals(processor.enabled()))
                .filter(processor -> "SCRIPT".equalsIgnoreCase(blankToFallback(processor.processorType(), "")))
                .filter(processor -> {
                    String language = blankToFallback(processor.scriptLanguage(), "JAVASCRIPT");
                    return "JAVASCRIPT".equalsIgnoreCase(language) || "JS".equalsIgnoreCase(language);
                })
                .map(ApiProcessorInput::script)
                .filter(script -> script != null && !script.isBlank())
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    static final class ArtifactCollector {
        private final Map<String, Map<String, Object>> artifactRefs = new LinkedHashMap<>();

        void add(Map<String, Object> artifactRef) {
            if (artifactRef == null) {
                return;
            }
            String fileId = Optional.ofNullable(artifactRef.get("fileId"))
                    .map(String::valueOf)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .orElse(null);
            if (fileId == null) {
                return;
            }
            artifactRefs.putIfAbsent(fileId, artifactRef);
        }

        List<Map<String, Object>> artifactRefs() {
            return List.copyOf(artifactRefs.values());
        }
    }
}
