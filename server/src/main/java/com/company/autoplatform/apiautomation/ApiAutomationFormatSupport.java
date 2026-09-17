package com.company.autoplatform.apiautomation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

final class ApiAutomationFormatSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ApiAutomationFormatSupport() {
    }

    static <T> List<T> defaultList(List<T> values) {
        return values == null ? List.of() : values;
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static String blankToFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    static String firstNonBlank(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first.trim();
    }

    static ApiAuthConfigInput emptyAuthConfig() {
        return new ApiAuthConfigInput(
                "NONE",
                new ApiAuthCredentialInput("", ""),
                new ApiAuthCredentialInput("", "")
        );
    }

    static ApiAuthConfigInput normalizeAuth(ApiAuthConfigInput authConfig) {
        if (authConfig == null) {
            return emptyAuthConfig();
        }
        return new ApiAuthConfigInput(
                Optional.ofNullable(authConfig.authType()).filter(value -> !value.isBlank()).map(String::toUpperCase).orElse("NONE"),
                normalizeCredential(authConfig.basicAuth()),
                normalizeCredential(authConfig.digestAuth()),
                Optional.ofNullable(authConfig.bearerToken()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyName()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyValue()).orElse(""),
                Optional.ofNullable(authConfig.apiKeyLocation()).orElse("header")
        );
    }

    static List<String> readTags(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiAssertionInput> readAssertions(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiExtractorInput> readExtractors(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiVariableItem> readVariables(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiScenarioAssertionInput> readScenarioAssertions(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiScenarioStepInput> readScenarioSteps(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(json);
            if (root == null || !root.isArray()) {
                return List.of();
            }
            return OBJECT_MAPPER.convertValue(root, new TypeReference<List<ApiScenarioStepInput>>() {
            });
        } catch (IOException | IllegalArgumentException exception) {
            throw new com.company.autoplatform.common.BadRequestException("Failed to parse scenario steps");
        }
    }

    static List<ApiProcessorInput> readProcessorsJson(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    static List<ApiProcessorInput> normalizePostProcessors(List<ApiProcessorInput> processors, List<ApiExtractorInput> legacyExtractors) {
        List<ApiProcessorInput> normalized = new ArrayList<>(normalizeProcessors(processors, "POST"));
        if (!defaultList(legacyExtractors).isEmpty()) {
            normalized.add(new ApiProcessorInput(
                    "legacy-extract",
                    "EXTRACT",
                    "Extract",
                    true,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    defaultList(legacyExtractors).stream()
                            .map(item -> new ApiProcessorExtractItemInput(item.name(), item.sourceType(), item.expression(), true,
                                    item.name(), null, "TEMPORARY", null, null, null, null, null, null))
                            .toList()
            ));
        }
        return normalized;
    }

    static List<ApiProcessorInput> normalizeProcessors(List<ApiProcessorInput> processors, String stage) {
        List<ApiProcessorInput> normalized = new ArrayList<>();
        int index = 0;
        for (ApiProcessorInput processor : defaultList(processors)) {
            if (processor == null) {
                continue;
            }
            String type = Optional.ofNullable(processor.processorType()).orElse("").trim().toUpperCase();
            if (type.isBlank()) {
                continue;
            }
            if ("PRE".equals(stage) && "EXTRACT".equals(type)) {
                continue;
            }
            normalized.add(new ApiProcessorInput(
                    blankToFallback(processor.id(), stage.toLowerCase() + "-processor-" + index++),
                    type,
                    blankToNull(processor.name()),
                    !Boolean.FALSE.equals(processor.enabled()),
                    blankToNull(processor.description()),
                    "SCRIPT".equals(type) ? "JAVASCRIPT" : blankToNull(processor.scriptLanguage()),
                    Optional.ofNullable(processor.script()).orElse(""),
                    normalizeDelayMs(processor.delayMs()),
                    processor.dataSourceId(),
                    blankToNull(processor.dataSourceName()),
                    processor.queryTimeout() == null || processor.queryTimeout() <= 0 ? 30000 : processor.queryTimeout(),
                    blankToNull(processor.variableNames()),
                    defaultList(processor.extractParams()).stream()
                            .filter(item -> item != null && item.key() != null && !item.key().isBlank())
                            .toList(),
                    blankToNull(processor.resultVariable()),
                    defaultList(processor.extractors()).stream()
                            .filter(item -> item != null && !blankToFallback(firstNonBlank(item.variableName(), item.name()), "").isBlank())
                            .map(item -> new ApiProcessorExtractItemInput(
                                    blankToFallback(firstNonBlank(item.name(), item.variableName()), "").trim(),
                                    blankToNull(item.sourceType()) == null ? null : item.sourceType().trim().toUpperCase(),
                                    Optional.ofNullable(item.expression()).orElse(""),
                                    !Boolean.FALSE.equals(item.enabled()),
                                    blankToFallback(firstNonBlank(item.variableName(), item.name()), "").trim(),
                                    blankToNull(item.description()),
                                    blankToFallback(item.variableType(), "TEMPORARY").toUpperCase(),
                                    blankToNull(item.extractType()) == null ? legacyExtractType(item.sourceType()) : item.extractType().trim().toUpperCase(),
                                    blankToNull(item.extractScope()) == null ? legacyExtractScope(item.sourceType()) : item.extractScope().trim().toUpperCase(),
                                    blankToFallback(item.expressionMatchingRule(), "EXPRESSION").toUpperCase(),
                                    blankToFallback(item.resultMatchingRule(), "RANDOM").toUpperCase(),
                                    item.resultMatchingRuleNum() == null || item.resultMatchingRuleNum() <= 0 ? 1 : item.resultMatchingRuleNum(),
                                    blankToFallback(item.responseFormat(), "JSON").toUpperCase()
                            ))
                            .toList()
            ));
        }
        return normalized;
    }

    private static ApiAuthCredentialInput normalizeCredential(ApiAuthCredentialInput credential) {
        if (credential == null) {
            return new ApiAuthCredentialInput("", "");
        }
        return new ApiAuthCredentialInput(
                Optional.ofNullable(credential.userName()).orElse(""),
                Optional.ofNullable(credential.password()).orElse("")
        );
    }

    private static String legacyExtractType(String sourceType) {
        String normalized = Optional.ofNullable(sourceType).orElse("").trim().toUpperCase();
        return switch (normalized) {
            case "BODY_JSONPATH" -> "JSON_PATH";
            case "HEADER", "STATUS_CODE" -> "REGEX";
            default -> "JSON_PATH";
        };
    }

    private static String legacyExtractScope(String sourceType) {
        String normalized = Optional.ofNullable(sourceType).orElse("").trim().toUpperCase();
        return switch (normalized) {
            case "HEADER" -> "RESPONSE_HEADERS";
            case "STATUS_CODE" -> "RESPONSE_CODE";
            default -> "BODY";
        };
    }

    private static int normalizeDelayMs(Integer delayMs) {
        if (delayMs == null) {
            return 1000;
        }
        return Math.max(1, Math.min(600000, delayMs));
    }
}
