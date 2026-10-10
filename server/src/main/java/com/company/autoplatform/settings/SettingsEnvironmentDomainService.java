package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class SettingsEnvironmentDomainService {

    private final EnvConfigMapper envConfigMapper;
    private final WorkspaceService workspaceService;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final ConfigReferenceDomainService referenceDomainService;

    public SettingsEnvironmentDomainService(
            EnvConfigMapper envConfigMapper,
            WorkspaceService workspaceService,
            ConfigReferenceDomainService referenceDomainService
    ) {
        this.envConfigMapper = envConfigMapper;
        this.workspaceService = workspaceService;
        this.referenceDomainService = referenceDomainService;
    }

    public PageResponse<EnvConfigItem> listEnvs(String workspaceCode, String keyword, String envType, Integer status) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        LambdaQueryWrapper<EnvConfigEntity> query = new LambdaQueryWrapper<>();
        if (workspace != null) {
            query.eq(EnvConfigEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return new PageResponse<>(List.of(), 0);
            }
            query.in(EnvConfigEntity::getWorkspaceId, workspaceIds);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(EnvConfigEntity::getEnvName, trimmedKeyword)
                    .or()
                    .like(EnvConfigEntity::getBaseUrl, trimmedKeyword)
                    .or()
                    .like(EnvConfigEntity::getConfigJson, trimmedKeyword));
        }
        String trimmedEnvType = blankToNull(envType);
        if (trimmedEnvType != null) {
            query.eq(EnvConfigEntity::getEnvType, normalizeEnvType(trimmedEnvType));
        }
        if (status != null) {
            query.eq(EnvConfigEntity::getStatus, normalizeStatus(status));
        }
        var items = envConfigMapper.selectList(query.orderByAsc(EnvConfigEntity::getId)).stream()
                .map(this::toEnvItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public EnvConfigItem createEnv(String headerWorkspaceCode, CreateEnvConfigRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        validateEnvironmentRequest(request);
        EnvConfigEntity entity = new EnvConfigEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setEnvType(normalizeEnvType(request.envType()));
        entity.setEnvName(request.envName());
        entity.setBaseUrl(normalizeBaseUrl(request.baseUrl()));
        entity.setConfigJson(request.configJson());
        entity.setStatus(1);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.insert(entity);
        return toEnvItem(entity);
    }

    public EnvConfigItem updateEnv(Long id, String headerWorkspaceCode, CreateEnvConfigRequest request) {
        EnvConfigEntity entity = requireEnv(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该环境");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("不允许修改环境归属空间");
        }
        validateEnvironmentRequest(request);
        entity.setEnvType(normalizeEnvType(request.envType()));
        entity.setEnvName(request.envName());
        entity.setBaseUrl(normalizeBaseUrl(request.baseUrl()));
        entity.setConfigJson(request.configJson());
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.updateById(entity);
        return toEnvItem(entity);
    }

    public EnvConfigItem updateEnvStatus(Long id, String workspaceCode, UpdateSettingStatusRequest request) {
        EnvConfigEntity entity = requireEnv(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可修改该环境");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        entity.setStatus(normalizeStatus(request.status()));
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.updateById(entity);
        return toEnvItem(entity);
    }

    public void deleteEnv(Long id, String workspaceCode) {
        EnvConfigEntity entity = requireEnv(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该环境");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        referenceDomainService.assertEnvironmentNotReferenced(id, entity.getWorkspaceId());
        envConfigMapper.deleteById(id);
    }

    private WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }

    private EnvConfigEntity requireEnv(Long id) {
        EnvConfigEntity entity = envConfigMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("环境不存在");
        }
        return entity;
    }

    private void validateReadable(Long workspaceId, String workspaceCode, String message) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null && !workspace.getId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
        if (workspace == null && !workspaceService.isPlatformAdmin()
                && !workspaceService.listReadableWorkspaceIds().contains(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private Integer normalizeStatus(Integer status) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("状态只能是 0 或 1");
        }
        return status;
    }

    private EnvConfigItem toEnvItem(EnvConfigEntity item) {
        WorkspaceEntity currentWorkspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        return new EnvConfigItem(
                item.getId(),
                currentWorkspace.getWorkspaceCode(),
                currentWorkspace.getWorkspaceName(),
                item.getEnvType(),
                item.getEnvName(),
                item.getBaseUrl(),
                item.getConfigJson(),
                item.getStatus()
        );
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeBaseUrl(String value) {
        return value == null ? "" : value.trim();
    }

    private void validateEnvironmentRequest(CreateEnvConfigRequest request) {
        String envName = request.envName() == null ? "" : request.envName().trim();
        if (envName.isBlank()) {
            throw new BadRequestException("环境名称不能为空");
        }
        JsonNode config = readConfig(request.configJson());
        String scopeType = text(config, "scopeType").toUpperCase(Locale.ROOT);
        String baseUrl = normalizeBaseUrl(request.baseUrl());
        if (!baseUrl.isBlank()) {
            validateHttpUrl(baseUrl, "Base URL");
        }
        JsonNode apiConfig = config.path("apiConfig");
        validateTimeout(apiConfig.path("timeout"), "API 超时时间");
        validateTimeout(config.path("timeoutMs"), "环境超时时间");
        JsonNode webConfig = config.path("webUIConfig");
        if (!webConfig.isMissingNode() && !webConfig.isNull()) {
            String entryUrl = text(webConfig, "entryUrl");
            if (!entryUrl.isBlank()) {
                validateHttpUrl(entryUrl, "Web UI 入口 URL");
            }
            validateTimeout(webConfig.path("pageLoadTimeout"), "Web UI 页面加载超时");
        }
    }

    private JsonNode readConfig(String configJson) {
        if (configJson == null || configJson.isBlank()) {
            return OBJECT_MAPPER.createObjectNode();
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(configJson);
            if (node == null || !node.isObject()) {
                throw new BadRequestException("环境配置必须是 JSON 对象");
            }
            return node;
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("环境配置 JSON 格式不正确");
        }
    }

    private String text(JsonNode object, String field) {
        JsonNode value = object == null ? null : object.get(field);
        return value == null || value.isNull() ? "" : value.asText("").trim();
    }

    private void validateHttpUrl(String value, String label) {
        if (!value.matches("^https?://[^\\s]+$")) {
            throw new BadRequestException(label + " 必须以 http:// 或 https:// 开头且不能包含空格");
        }
    }

    private void validateTimeout(JsonNode value, String label) {
        if (value == null || value.isMissingNode() || value.isNull() || value.asText("").isBlank()) {
            return;
        }
        if (!value.isNumber() || value.asInt() < 1000 || value.asInt() > 120000) {
            throw new BadRequestException(label + "必须在 1000 到 120000 毫秒之间");
        }
    }

    private String normalizeEnvType(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return "TEST";
        }
        return normalized.toUpperCase(Locale.ROOT);
    }
}
