package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.settings.EnvConfigEntity;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.company.autoplatform.settings.ParamSetEntity;
import com.company.autoplatform.settings.ParamSetMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiConfigDomainService {

    private static final String API_ENV_TYPE = "API";
    private static final String API_VARIABLE_SET_TYPE = "API_VARIABLE_SET";
    private static final String PAYMENT_CHANNEL_VARIABLE_SET_TYPE = "PAYMENT_CHANNEL";

    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiConfigDomainService(
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiEnvironmentItem> listEnvironments(String workspaceCode) {
        LambdaQueryWrapper<EnvConfigEntity> query = new LambdaQueryWrapper<>();
        query.in(EnvConfigEntity::getEnvType, ApiEnvironmentTypeSupport.apiUsableEnvTypes());
        workspaceScopeSupport.applyWorkspaceScope(query, EnvConfigEntity::getWorkspaceId, workspaceCode);
        List<ApiEnvironmentItem> items = envConfigMapper.selectList(query.orderByDesc(EnvConfigEntity::getUpdatedAt))
                .stream()
                .map(this::toEnvironmentItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ApiEnvironmentItem createEnvironment(String headerWorkspaceCode, ApiEnvironmentRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        EnvConfigEntity entity = new EnvConfigEntity();
        fillEnvironmentEntity(entity, workspace, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.insert(entity);
        return toEnvironmentItem(entity);
    }

    public ApiEnvironmentItem updateEnvironment(Long id, String headerWorkspaceCode, ApiEnvironmentRequest request) {
        EnvConfigEntity entity = requireEnvironment(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the environment");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillEnvironmentEntity(entity, workspaceService.requireWorkspaceById(entity.getWorkspaceId()), request);
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.updateById(entity);
        return toEnvironmentItem(entity);
    }

    public void deleteEnvironment(Long id, String workspaceCode) {
        EnvConfigEntity entity = requireEnvironment(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the environment");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        envConfigMapper.deleteById(id);
    }

    public PageResponse<ApiVariableSetItem> listVariableSets(String workspaceCode) {
        LambdaQueryWrapper<ParamSetEntity> query = new LambdaQueryWrapper<>();
        query.in(ParamSetEntity::getParamType, API_VARIABLE_SET_TYPE, PAYMENT_CHANNEL_VARIABLE_SET_TYPE);
        workspaceScopeSupport.applyWorkspaceScope(query, ParamSetEntity::getWorkspaceId, workspaceCode);
        List<ApiVariableSetItem> items = paramSetMapper.selectList(query.orderByDesc(ParamSetEntity::getUpdatedAt))
                .stream()
                .map(this::toVariableSetItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ApiVariableSetItem createVariableSet(String headerWorkspaceCode, ApiVariableSetRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        ParamSetEntity entity = new ParamSetEntity();
        fillVariableSetEntity(entity, workspace, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.insert(entity);
        return toVariableSetItem(entity);
    }

    public ApiVariableSetItem updateVariableSet(Long id, String headerWorkspaceCode, ApiVariableSetRequest request) {
        ParamSetEntity entity = requireVariableSet(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the variable set");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillVariableSetEntity(entity, workspaceService.requireWorkspaceById(entity.getWorkspaceId()), request);
        entity.setUpdatedAt(LocalDateTime.now());
        paramSetMapper.updateById(entity);
        return toVariableSetItem(entity);
    }

    public void deleteVariableSet(Long id, String workspaceCode) {
        ParamSetEntity entity = requireVariableSet(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the variable set");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        paramSetMapper.deleteById(id);
    }

    private void fillEnvironmentEntity(EnvConfigEntity entity, WorkspaceEntity workspace, ApiEnvironmentRequest request) {
        EnvironmentConfigPayload previousConfig = ApiAutomationJsonSupport.read(entity.getConfigJson(), EnvironmentConfigPayload.class,
                new EnvironmentConfigPayload(List.of(), emptyAuthConfig(), 10000, List.of(), null, null));
        entity.setWorkspaceId(workspace.getId());
        entity.setEnvType(API_ENV_TYPE);
        entity.setEnvName(request.name().trim());
        entity.setBaseUrl(request.baseUrl().trim());
        entity.setConfigJson(ApiAutomationJsonSupport.toJson(new EnvironmentConfigPayload(
                defaultList(request.headers()),
                normalizeAuth(request.authConfig()),
                request.timeoutMs() == null || request.timeoutMs() <= 0 ? 10000 : request.timeoutMs(),
                defaultList(previousConfig.variables()),
                request.defaultVariableSetId() == null ? previousConfig.defaultVariableSetId() : request.defaultVariableSetId(),
                request.mockApplicationId() == null ? previousConfig.mockApplicationId() : request.mockApplicationId()
        ), "Failed to serialize environment config"));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private void fillVariableSetEntity(ParamSetEntity entity, WorkspaceEntity workspace, ApiVariableSetRequest request) {
        entity.setWorkspaceId(workspace.getId());
        entity.setParamType(API_VARIABLE_SET_TYPE);
        entity.setParamName(request.name().trim());
        entity.setContentJson(ApiAutomationJsonSupport.toJson(defaultList(request.variables()), "Failed to serialize variable set"));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private ApiEnvironmentItem toEnvironmentItem(EnvConfigEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        EnvironmentConfigPayload config = ApiAutomationJsonSupport.read(entity.getConfigJson(), EnvironmentConfigPayload.class,
                new EnvironmentConfigPayload(List.of(), emptyAuthConfig(), 10000, List.of(), null, null));
        return new ApiEnvironmentItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getEnvName(),
                entity.getBaseUrl(),
                defaultList(config.headers()),
                normalizeAuth(config.authConfig()),
                config.timeoutMs() == null ? 10000 : config.timeoutMs(),
                config.defaultVariableSetId(),
                config.mockApplicationId(),
                entity.getStatus()
        );
    }

    private ApiVariableSetItem toVariableSetItem(ParamSetEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiVariableSetItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getParamName(),
                readVariables(entity.getContentJson()),
                entity.getStatus()
        );
    }

    private EnvConfigEntity requireEnvironment(Long id) {
        EnvConfigEntity entity = envConfigMapper.selectById(id);
        if (entity == null || !ApiEnvironmentTypeSupport.isApiUsable(entity.getEnvType())) {
            throw new NotFoundException("API environment not found");
        }
        return entity;
    }

    private ParamSetEntity requireVariableSet(Long id) {
        ParamSetEntity entity = paramSetMapper.selectById(id);
        if (entity == null || !isApiRuntimeVariableSet(entity.getParamType())) {
            throw new NotFoundException("API variable set not found");
        }
        return entity;
    }

    private boolean isApiRuntimeVariableSet(String paramType) {
        return API_VARIABLE_SET_TYPE.equals(paramType)
                || PAYMENT_CHANNEL_VARIABLE_SET_TYPE.equals(paramType);
    }

    private List<ApiVariableItem> readVariables(String json) {
        return ApiAutomationJsonSupport.readList(json, new TypeReference<>() {
        }, List.of());
    }

    private ApiAuthConfigInput normalizeAuth(ApiAuthConfigInput authConfig) {
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

    private ApiAuthCredentialInput normalizeCredential(ApiAuthCredentialInput credential) {
        if (credential == null) {
            return new ApiAuthCredentialInput("", "");
        }
        return new ApiAuthCredentialInput(
                Optional.ofNullable(credential.userName()).orElse(""),
                Optional.ofNullable(credential.password()).orElse("")
        );
    }

    private ApiAuthConfigInput emptyAuthConfig() {
        return new ApiAuthConfigInput(
                "NONE",
                new ApiAuthCredentialInput("", ""),
                new ApiAuthCredentialInput("", "")
        );
    }

    private Integer normalizeStatus(Integer status) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("Status must be 0 or 1");
        }
        return status;
    }

    private <T> List<T> defaultList(List<T> values) {
        return values == null ? List.of() : values;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record EnvironmentConfigPayload(
            List<ApiKeyValueInput> headers,
            ApiAuthConfigInput authConfig,
            Integer timeoutMs,
            List<ApiVariableItem> variables,
            Long defaultVariableSetId,
            Long mockApplicationId
    ) {
    }
}
