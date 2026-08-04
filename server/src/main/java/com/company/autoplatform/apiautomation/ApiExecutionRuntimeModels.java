package com.company.autoplatform.apiautomation;

import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.TaskEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.defaultList;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.normalizeAuth;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

// Package-private runtime models shared by api execution support classes only.
final class ApiExecutionRuntimeModels {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ApiExecutionRuntimeModels() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EnvironmentConfigPayload(
            List<ApiKeyValueInput> headers,
            ApiAuthConfigInput authConfig,
            Integer timeoutMs,
            List<ApiVariableItem> variables,
            Long defaultVariableSetId,
            Long mockApplicationId,
            String defaultServiceKey,
            List<EnvironmentServiceEndpoint> services
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EnvironmentServiceEndpoint(
            String key,
            String name,
            String baseUrl
    ) {
    }

    record ResolvedEnvironment(
            Long environmentId,
            String baseUrl,
            List<ApiKeyValueInput> headers,
            ApiAuthConfigInput authConfig,
            Integer timeoutMs,
            List<ApiVariableItem> variables,
            Long defaultVariableSetId,
            Long mockApplicationId,
            String mockApplicationName,
            String mockApplicationCode,
            String mockBaseUrl,
            Long mockBusinessScenarioId,
            String mockBusinessScenarioName,
            Long mockReleaseId,
            Integer mockReleaseVersion,
            String mockExecutionToken,
            String defaultServiceKey,
            List<EnvironmentServiceEndpoint> services
    ) {
        ResolvedEnvironment(
                Long environmentId,
                String baseUrl,
                List<ApiKeyValueInput> headers,
                ApiAuthConfigInput authConfig,
                Integer timeoutMs,
                List<ApiVariableItem> variables,
                Long defaultVariableSetId,
                Long mockApplicationId,
                String mockApplicationName,
                String mockApplicationCode,
                String mockBaseUrl,
                String defaultServiceKey,
                List<EnvironmentServiceEndpoint> services
        ) {
            this(environmentId, baseUrl, headers, authConfig, timeoutMs, variables, defaultVariableSetId,
                    mockApplicationId, mockApplicationName, mockApplicationCode, mockBaseUrl, null, null,
                    null, null, null, defaultServiceKey, services);
        }
    }

    record ExecutionContext(
            ResolvedEnvironment environment,
            Map<String, String> variables,
            String contextSnapshotJson
    ) {
    }

    record RuntimeContextSnapshot(
            RuntimeEnvironmentSnapshot environment,
            RuntimeVariableSetSnapshot variableSet,
            List<RuntimeVariableSetSnapshot> variableSets,
            RuntimeMockSnapshot mock,
            Map<String, String> variables
    ) {
    }

    record RuntimeEnvironmentSnapshot(
            Long id,
            String baseUrl,
            Integer timeoutMs,
            String defaultServiceKey,
            List<EnvironmentServiceEndpoint> services
    ) {
    }

    record RuntimeVariableSetSnapshot(
            Long id,
            String name,
            Integer versionNo
    ) {
    }

    record RuntimeMockSnapshot(
            Long id,
            String appName,
            String appCode,
            String baseUrl,
            Long businessScenarioId,
            String businessScenarioName,
            Long releaseId,
            Integer releaseVersion
    ) {
    }

    record RunEnvelope(
            TaskEntity task,
            ReportEntity report
    ) {
    }

    record RunStepComputation(
            boolean success,
            ApiRunStepResultResponse response
    ) {
    }

    static final class MutableRequestConfig {
        private String method;
        private String path;
        private Integer timeoutMs;
        private List<ApiKeyValueInput> queryParams;
        private List<ApiKeyValueInput> headers;
        private List<ApiKeyValueInput> cookies;
        private ApiRequestBodyInput body;
        private ApiAuthConfigInput authConfig;

        MutableRequestConfig(
                String method,
                String path,
                Integer timeoutMs,
                List<ApiKeyValueInput> queryParams,
                List<ApiKeyValueInput> headers,
                List<ApiKeyValueInput> cookies,
                ApiRequestBodyInput body,
                ApiAuthConfigInput authConfig
        ) {
            this.method = method;
            this.path = path;
            this.timeoutMs = timeoutMs;
            this.queryParams = queryParams;
            this.headers = headers;
            this.cookies = cookies;
            this.body = body;
            this.authConfig = authConfig;
        }

        String method() {
            return method;
        }

        String path() {
            return path;
        }

        Integer timeoutMs() {
            return timeoutMs;
        }

        List<ApiKeyValueInput> queryParams() {
            return queryParams;
        }

        List<ApiKeyValueInput> headers() {
            return headers;
        }

        List<ApiKeyValueInput> cookies() {
            return cookies;
        }

        ApiRequestBodyInput body() {
            return body;
        }

        ApiAuthConfigInput authConfig() {
            return authConfig;
        }

        Map<String, Object> toScriptMap() {
            LinkedHashMap<String, Object> request = new LinkedHashMap<>();
            request.put("method", method);
            request.put("path", path);
            request.put("timeoutMs", timeoutMs);
            request.put("queryParams", new ArrayList<>(queryParams));
            request.put("headers", new ArrayList<>(headers));
            request.put("cookies", new ArrayList<>(cookies));
            request.put("body", body);
            request.put("authConfig", authConfig);
            return request;
        }

        void applyScriptMap(Map<String, Object> requestValues) {
            ApiRequestConfigInput next = OBJECT_MAPPER.convertValue(requestValues, ApiRequestConfigInput.class);
            method = blankToFallback(next.method(), method).toUpperCase();
            path = blankToFallback(next.path(), path);
            timeoutMs = next.timeoutMs() == null ? timeoutMs : next.timeoutMs();
            queryParams = new ArrayList<>(defaultList(next.queryParams()));
            headers = new ArrayList<>(defaultList(next.headers()));
            cookies = new ArrayList<>(defaultList(next.cookies()));
            body = next.body() == null ? body : next.body();
            authConfig = next.authConfig() == null ? authConfig : normalizeAuth(next.authConfig());
        }
    }
}
