package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.settings.EnvConfigEntity;
import com.company.autoplatform.settings.EnvConfigMapper;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.defaultList;

@Component
class WebUiEnvironmentResolver {

    private final WebUiEnvironmentMapper environmentMapper;
    private final EnvConfigMapper envConfigMapper;
    private final WebUiExecutionContextSupport executionContextSupport;

    WebUiEnvironmentResolver(
            WebUiEnvironmentMapper environmentMapper,
            EnvConfigMapper envConfigMapper,
            WebUiExecutionContextSupport executionContextSupport
    ) {
        this.environmentMapper = environmentMapper;
        this.envConfigMapper = envConfigMapper;
        this.executionContextSupport = executionContextSupport;
    }

    EnvironmentResolution resolve(Long environmentId, Long workspaceId) {
        if (environmentId == null) {
            return null;
        }
        if (environmentId < 0) {
            return resolvePublicEnvironment(Math.abs(environmentId), workspaceId);
        }
        WebUiEnvironmentEntity legacyEnvironment = environmentMapper.selectById(environmentId);
        if (legacyEnvironment != null) {
            if (!workspaceId.equals(legacyEnvironment.getWorkspaceId())) {
                throw new NotFoundException("Web UI environment not found");
            }
            if (legacyEnvironment.getStatus() != null && legacyEnvironment.getStatus() == 0) {
                throw new BadRequestException("Web UI environment is disabled");
            }
            return new EnvironmentResolution(
                    legacyEnvironment.getId(),
                    legacyEnvironment.getEnvironmentName(),
                    legacyEnvironment.getBaseUrl(),
                    legacyEnvironment.getBrowserType(),
                    legacyEnvironment.getHeadless(),
                    legacyEnvironment.getDefaultTimeoutMs(),
                    legacyEnvironment.getDefaultVariableSetId(),
                    null,
                    null,
                    List.of(),
                    "default",
                    List.of()
            );
        }
        return resolvePublicEnvironment(environmentId, workspaceId);
    }

    private EnvironmentResolution resolvePublicEnvironment(Long environmentId, Long workspaceId) {
        EnvConfigEntity environment = envConfigMapper.selectById(environmentId);
        if (environment == null || !WebUiEnvironmentTypeSupport.isWebUiUsable(environment.getEnvType())
                || !workspaceId.equals(environment.getWorkspaceId())) {
            throw new NotFoundException("Web UI environment not found");
        }
        if (environment.getStatus() != null && environment.getStatus() == 0) {
            throw new BadRequestException("Web UI environment is disabled");
        }
        WebUiExecutionContextSupport.WebUiEnvironmentConfig config =
                executionContextSupport.readEnvironmentConfig(environment.getConfigJson());
        List<WebUiExecutionContextSupport.ServiceEndpoint> services = normalizeServices(config.services(), environment.getBaseUrl());
        String defaultServiceKey = normalizeDefaultServiceKey(config.defaultServiceKey(), services);
        String baseUrl = services.stream()
                .filter(service -> service.key().equals(defaultServiceKey))
                .findFirst()
                .map(WebUiExecutionContextSupport.ServiceEndpoint::baseUrl)
                .orElse(environment.getBaseUrl());
        return new EnvironmentResolution(
                -environment.getId(),
                environment.getEnvName(),
                baseUrl,
                config.browserType(),
                config.headless(),
                config.defaultTimeoutMs(),
                config.defaultVariableSetId(),
                Boolean.FALSE.equals(config.mockEnabled()) ? null : config.mockApplicationId(),
                Boolean.FALSE.equals(config.mockEnabled()) ? null : config.mockReleaseId(),
                config.variables() == null ? List.of() : config.variables(),
                defaultServiceKey,
                services
        );
    }

    private List<WebUiExecutionContextSupport.ServiceEndpoint> normalizeServices(
            List<WebUiExecutionContextSupport.ServiceEndpoint> services,
            String fallbackBaseUrl
    ) {
        List<WebUiExecutionContextSupport.ServiceEndpoint> normalized = defaultList(services).stream()
                .filter(service -> service != null
                        && service.key() != null && !service.key().isBlank()
                        && service.baseUrl() != null && !service.baseUrl().isBlank())
                .map(service -> new WebUiExecutionContextSupport.ServiceEndpoint(
                        service.key().trim(),
                        service.name() == null || service.name().isBlank() ? service.key().trim() : service.name().trim(),
                        service.baseUrl().trim()
                ))
                .toList();
        if (!normalized.isEmpty()) {
            return normalized;
        }
        return List.of(new WebUiExecutionContextSupport.ServiceEndpoint("default", "默认服务", fallbackBaseUrl == null ? "" : fallbackBaseUrl.trim()));
    }

    private String normalizeDefaultServiceKey(String defaultServiceKey, List<WebUiExecutionContextSupport.ServiceEndpoint> services) {
        String normalized = defaultServiceKey == null ? "" : defaultServiceKey.trim();
        if (!normalized.isBlank() && services.stream().anyMatch(service -> service.key().equals(normalized))) {
            return normalized;
        }
        return services.isEmpty() ? "default" : services.getFirst().key();
    }

    record EnvironmentResolution(
            Long bridgeId,
            String name,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Long defaultVariableSetId,
            Long mockApplicationId,
            Long mockReleaseId,
            List<WebUiExecutionContextSupport.VariableItem> variables,
            String defaultServiceKey,
            List<WebUiExecutionContextSupport.ServiceEndpoint> services
    ) {
    }
}
