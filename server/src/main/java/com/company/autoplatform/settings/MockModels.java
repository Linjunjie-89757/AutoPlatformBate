package com.company.autoplatform.settings;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public final class MockModels {

    private MockModels() {
    }

    public record MockApplicationRequest(
            String workspaceCode,
            @NotBlank(message = "Mock 应用名称不能为空") String appName,
            @NotBlank(message = "Mock 应用编码不能为空") String appCode,
            String description,
            Integer status
    ) {
    }

    public record MockEndpointRequest(
            String workspaceCode,
            Long appId,
            @NotBlank(message = "Mock 接口名称不能为空") String endpointName,
            @NotBlank(message = "请求方法不能为空") String httpMethod,
            @NotBlank(message = "匹配路径不能为空") String pathPattern,
            String description,
            Integer status
    ) {
    }

    public record MockScenarioRequest(
            String workspaceCode,
            Long appId,
            Long endpointId,
            @NotBlank(message = "Mock 场景名称不能为空") String scenarioName,
            Integer priority,
            String matchJson,
            Integer responseStatus,
            String responseHeadersJson,
            String responseBody,
            Integer responseDelayMs,
            String variablesJson,
            Integer status
    ) {
    }

    public record MockBusinessScenarioItemRequest(
            Long endpointId,
            Long scenarioId,
            Integer sortOrder,
            Integer status
    ) {
    }

    public record MockBusinessScenarioRequest(
            String workspaceCode,
            Long appId,
            @NotBlank(message = "Mock 业务场景名称不能为空") String scenarioName,
            String description,
            String variablesJson,
            Integer status,
            List<MockBusinessScenarioItemRequest> items
    ) {
    }

    public record MockApplicationItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String appName,
            String appCode,
            String description,
            Integer status
    ) {
    }

    public record MockEndpointItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long appId,
            String appName,
            String endpointName,
            String httpMethod,
            String pathPattern,
            String description,
            Integer status
    ) {
    }

    public record MockScenarioItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long appId,
            String appName,
            Long endpointId,
            String endpointName,
            String scenarioName,
            Integer priority,
            String matchJson,
            Integer responseStatus,
            String responseHeadersJson,
            String responseBody,
            Integer responseDelayMs,
            String variablesJson,
            Integer status
    ) {
    }

    public record MockBusinessScenarioStepItem(
            Long id,
            Long businessScenarioId,
            Long appId,
            Long endpointId,
            String endpointName,
            Long scenarioId,
            String scenarioName,
            Integer sortOrder,
            Integer status
    ) {
    }

    public record MockBusinessScenarioItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long appId,
            String appName,
            String scenarioName,
            String description,
            String variablesJson,
            Integer status,
            List<MockBusinessScenarioStepItem> items
    ) {
    }

    public record MockReleaseRequest(
            String workspaceCode,
            String releaseName
    ) {
    }

    public record MockReleaseItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long appId,
            String appName,
            Integer versionNo,
            String releaseName,
            Boolean active,
            LocalDateTime createdAt
    ) {
    }

    public record MockReleaseSnapshot(
            MockReleaseApplicationSnapshot application,
            List<MockReleaseEndpointSnapshot> endpoints,
            List<MockReleaseScenarioSnapshot> scenarios,
            List<MockReleaseBusinessScenarioSnapshot> businessScenarios
    ) {
    }

    public record MockReleaseApplicationSnapshot(
            Long id,
            String appName,
            String appCode,
            String description,
            Integer status
    ) {
    }

    public record MockReleaseEndpointSnapshot(
            Long id,
            Long appId,
            String endpointName,
            String httpMethod,
            String pathPattern,
            String description,
            Integer status
    ) {
    }

    public record MockReleaseScenarioSnapshot(
            Long id,
            Long appId,
            Long endpointId,
            String scenarioName,
            Integer priority,
            String matchJson,
            Integer responseStatus,
            String responseHeadersJson,
            String responseBody,
            Integer responseDelayMs,
            String variablesJson,
            Integer status
    ) {
    }

    public record MockReleaseBusinessScenarioSnapshot(
            Long id,
            Long appId,
            String scenarioName,
            String description,
            String variablesJson,
            Integer status,
            List<MockReleaseBusinessScenarioStepSnapshot> items
    ) {
    }

    public record MockReleaseBusinessScenarioStepSnapshot(
            Long id,
            Long endpointId,
            Long scenarioId,
            Integer sortOrder,
            Integer status
    ) {
    }

    public record MockCallLogItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            Long appId,
            String appName,
            Long endpointId,
            String endpointName,
            Long scenarioId,
            String scenarioName,
            Long businessScenarioId,
            String businessScenarioName,
            Long releaseId,
            Integer releaseVersion,
            String httpMethod,
            String requestPath,
            String requestHeadersJson,
            String requestBody,
            Integer responseStatus,
            String responseHeadersJson,
            String responseBody,
            Boolean matched,
            String status,
            LocalDateTime createdAt
    ) {
    }
}
