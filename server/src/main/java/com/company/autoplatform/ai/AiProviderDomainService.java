package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AiProviderDomainService {

    private static final long PERSONAL_SCOPE_WORKSPACE_ID = 0L;
    private static final String PERSONAL_SCOPE_WORKSPACE_CODE = "PERSONAL";
    private static final String PERSONAL_SCOPE_WORKSPACE_NAME = "我的配置";
    private static final String PROTOCOL_OPENAI_CHAT = AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT;
    private static final String PROTOCOL_OPENAI_RESPONSES = AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_RESPONSES;
    private static final String PROTOCOL_AZURE_OPENAI = AiProviderClient.PROTOCOL_AZURE_OPENAI;
    private static final double DEFAULT_REVIEWER_TOP_P = 0.7;

    private final AiCaseConfigMapper aiCaseConfigMapper;
    private final AiProviderConnectionMapper aiProviderConnectionMapper;
    private final AiProviderModelMapper aiProviderModelMapper;
    private final AiSecretCodec aiSecretCodec;
    private final AiProviderClient aiProviderClient;
    private final int defaultRequestTimeoutSeconds;

    public AiProviderDomainService(
            AiCaseConfigMapper aiCaseConfigMapper,
            AiProviderConnectionMapper aiProviderConnectionMapper,
            AiProviderModelMapper aiProviderModelMapper,
            AiSecretCodec aiSecretCodec,
            AiProviderClient aiProviderClient,
            @Value("${app.ai.request-timeout-seconds:60}") int defaultRequestTimeoutSeconds
    ) {
        this.aiCaseConfigMapper = aiCaseConfigMapper;
        this.aiProviderConnectionMapper = aiProviderConnectionMapper;
        this.aiProviderModelMapper = aiProviderModelMapper;
        this.aiSecretCodec = aiSecretCodec;
        this.aiProviderClient = aiProviderClient;
        this.defaultRequestTimeoutSeconds = Math.max(10, Math.min(600, defaultRequestTimeoutSeconds));
    }

    public List<AiProviderConnectionItem> getProviders(String headerWorkspaceCode) {
        Long ownerUserId = CurrentUserContext.get();
        return aiProviderConnectionMapper.selectList(new LambdaQueryWrapper<AiProviderConnectionEntity>()
                        .eq(AiProviderConnectionEntity::getOwnerUserId, ownerUserId)
                        .orderByDesc(AiProviderConnectionEntity::getUpdatedAt))
                .stream()
                .map(this::toConnectionItem)
                .toList();
    }

    public AiProviderConnectionItem createProvider(String headerWorkspaceCode, SaveAiProviderConnectionRequest request) {
        if (blankToNull(request.apiKey()) == null) {
            throw new BadRequestException("AI API Key 不能为空");
        }
        AiProviderConnectionEntity entity = new AiProviderConnectionEntity();
        entity.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        entity.setOwnerUserId(CurrentUserContext.get());
        applyProviderRequest(entity, request, true);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        aiProviderConnectionMapper.insert(entity);
        syncRequestedModel(entity, request.modelName());
        return toConnectionItem(entity);
    }

    public AiProviderConnectionItem updateProvider(Long id, String headerWorkspaceCode, SaveAiProviderConnectionRequest request) {
        AiProviderConnectionEntity entity = requireProviderConnection(id);
        applyProviderRequest(entity, request, false);
        entity.setUpdatedAt(LocalDateTime.now());
        aiProviderConnectionMapper.updateById(entity);
        syncRequestedModel(entity, request.modelName());
        return toConnectionItem(entity);
    }

    public PreviewAiProviderModelsResponse previewProviderModels(String headerWorkspaceCode, PreviewAiProviderModelsRequest request) {
        String apiKey = blankToNull(request.apiKey());
        if (apiKey == null) {
            throw new BadRequestException("AI API key is required");
        }
        AiModelFetchResult fetchResult = aiProviderClient.fetchModels(
                buildPreviewProviderProfile(request),
                apiKey
        );
        return new PreviewAiProviderModelsResponse(
                fetchResult.models(),
                LocalDateTime.now(),
                fetchResult.message()
        );
    }

    @Transactional
    public void deleteProvider(Long id, String headerWorkspaceCode) {
        requireProviderConnection(id);
        aiCaseConfigMapper.update(null, new LambdaUpdateWrapper<AiCaseConfigEntity>()
                .eq(AiCaseConfigEntity::getOwnerUserId, CurrentUserContext.get())
                .eq(AiCaseConfigEntity::getProviderConnectionId, id)
                .set(AiCaseConfigEntity::getProviderConnectionId, null)
                .set(AiCaseConfigEntity::getApiKeyCipherText, null)
                .set(AiCaseConfigEntity::getCapabilityOverrideJson, null)
                .set(AiCaseConfigEntity::getSupportsImageInput, 0)
                .set(AiCaseConfigEntity::getStatus, 0)
                .set(AiCaseConfigEntity::getUpdatedAt, LocalDateTime.now()));
        aiProviderModelMapper.delete(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getConnectionId, id));
        aiProviderConnectionMapper.deleteById(id);
    }

    public TestAiProviderConnectionResponse testProvider(Long id, String headerWorkspaceCode) {
        AiProviderConnectionEntity entity = requireProviderConnection(id);
        String apiKey = requireProviderApiKey(entity);
        String modelName = resolvePreferredModelForConnection(entity.getId());
        if (blankToNull(modelName) == null) {
            AiModelFetchResult fetched = aiProviderClient.fetchModels(
                    buildProviderProfile(entity, "model-probe", 0.3, DEFAULT_REVIEWER_TOP_P, null),
                    apiKey
            );
            if (!fetched.models().isEmpty()) {
                persistFetchedModels(entity, fetched.models(), LocalDateTime.now());
                modelName = fetched.models().get(0).modelName();
            }
        }
        if (blankToNull(modelName) == null) {
            throw new BadRequestException("当前连接还没有可用模型，请先获取模型列表或在角色绑定里手工指定模型");
        }
        AiProviderRequestProfile profile = buildProviderProfile(entity, modelName, 0.3, DEFAULT_REVIEWER_TOP_P, null);
        try {
            aiProviderClient.testConnection(profile, apiKey);
        } catch (RuntimeException exception) {
            LocalDateTime testedAt = LocalDateTime.now();
            entity.setLastTestAt(testedAt);
            entity.setLastTestStatus("FAILED");
            entity.setLastTestMessage(truncateTestMessage(exception.getMessage()));
            entity.setUpdatedAt(testedAt);
            aiProviderConnectionMapper.updateById(entity);
            throw exception;
        }
        LocalDateTime verifiedAt = LocalDateTime.now();
        entity.setLastTestAt(verifiedAt);
        entity.setLastTestStatus("SUCCESS");
        entity.setLastTestMessage(null);
        entity.setLastVerifiedAt(verifiedAt);
        entity.setUpdatedAt(verifiedAt);
        aiProviderConnectionMapper.updateById(entity);
        return new TestAiProviderConnectionResponse(
                true,
                entity.getId(),
                entity.getConnectionName(),
                entity.getProtocolType(),
                "连接测试成功",
                entity.getLastVerifiedAt()
        );
    }

    public FetchAiProviderModelsResponse fetchProviderModels(Long id, String headerWorkspaceCode) {
        AiProviderConnectionEntity entity = requireProviderConnection(id);
        String apiKey = requireProviderApiKey(entity);
        AiModelFetchResult fetchResult = aiProviderClient.fetchModels(
                buildProviderProfile(entity, "gpt-4o-mini", 0.3, DEFAULT_REVIEWER_TOP_P, null),
                apiKey
        );
        LocalDateTime now = LocalDateTime.now();
        List<AiProviderModelItem> updatedModels = persistFetchedModels(entity, fetchResult.models(), now);
        entity.setLastFetchModelsAt(now);
        entity.setUpdatedAt(now);
        aiProviderConnectionMapper.updateById(entity);
        return new FetchAiProviderModelsResponse(
                entity.getId(),
                entity.getConnectionName(),
                updatedModels,
                now,
                fetchResult.message()
        );
    }

    public List<AiProviderModelItem> getProviderModels(Long id, String headerWorkspaceCode) {
        requireProviderConnection(id);
        return listModelItems(id);
    }

    public AiProviderModelItem probeProviderModel(Long id, String headerWorkspaceCode, ProbeAiProviderModelRequest request) {
        AiProviderConnectionEntity entity = requireProviderConnection(id);
        String apiKey = requireProviderApiKey(entity);
        AiProviderRequestProfile profile = buildProviderProfile(entity, request.modelName().trim(), 0.3, DEFAULT_REVIEWER_TOP_P, null);
        AiModelCapabilities capabilities = aiProviderClient.probeCapabilities(profile, apiKey);
        LocalDateTime now = LocalDateTime.now();
        AiProviderModelEntity modelEntity = findProviderModelByName(id, request.modelName().trim());
        if (modelEntity == null) {
            modelEntity = new AiProviderModelEntity();
            modelEntity.setConnectionId(id);
            modelEntity.setModelName(request.modelName().trim());
            modelEntity.setDisplayName(request.modelName().trim());
            modelEntity.setSelectable(1);
            modelEntity.setCreatedAt(now);
        }
        modelEntity.setDetectedCapabilitiesJson(writeCapabilities(capabilities));
        modelEntity.setLastProbedAt(now);
        modelEntity.setUpdatedAt(now);
        if (modelEntity.getId() == null) {
            aiProviderModelMapper.insert(modelEntity);
        } else {
            aiProviderModelMapper.updateById(modelEntity);
        }
        return toModelItem(modelEntity);
    }

    public AiProviderModelItem updateProviderModelStatus(
            Long connectionId,
            Long modelId,
            String headerWorkspaceCode,
            boolean selectable
    ) {
        requireProviderConnection(connectionId);
        AiProviderModelEntity modelEntity = requireProviderModel(connectionId, modelId);
        if (!selectable && isModelInUse(connectionId, modelEntity.getModelName())) {
            throw new BadRequestException("该模型已被 AI 用途绑定，不能停用");
        }
        modelEntity.setSelectable(selectable ? 1 : 0);
        modelEntity.setUpdatedAt(LocalDateTime.now());
        aiProviderModelMapper.updateById(modelEntity);
        return toModelItem(modelEntity);
    }

    @Transactional
    public void deleteProviderModel(Long connectionId, Long modelId, String headerWorkspaceCode) {
        AiProviderConnectionEntity connection = requireProviderConnection(connectionId);
        AiProviderModelEntity modelEntity = requireProviderModel(connectionId, modelId);
        if (Objects.equals(blankToNull(connection.getSelectedModelName()), blankToNull(modelEntity.getModelName()))) {
            throw new BadRequestException("当前模型是默认模型，请先切换默认模型后再删除");
        }
        if (isModelInUse(connectionId, modelEntity.getModelName())) {
            throw new BadRequestException("该模型已被 AI 用途绑定，请先解除绑定后再删除");
        }
        aiProviderModelMapper.deleteById(modelEntity.getId());
    }

    public ResolvedProviderModelConfig requireResolvedProviderModel(Long providerConnectionId, String modelName) {
        String normalizedModelName = blankToNull(modelName);
        if (providerConnectionId == null || normalizedModelName == null) {
            throw new BadRequestException("请选择 AI 采集模型");
        }
        AiProviderConnectionEntity connection = requireProviderConnection(providerConnectionId);
        String apiKey = requireProviderApiKey(connection);
        AiProviderRequestProfile profile = buildProviderProfile(
                connection,
                normalizedModelName,
                0.3,
                0.9,
                null
        );
        return new ResolvedProviderModelConfig(connection, profile, apiKey);
    }

    public AiProviderConnectionSecretResponse getProviderSecret(Long id, String headerWorkspaceCode) {
        AiProviderConnectionEntity entity = requireProviderConnection(id);
        return new AiProviderConnectionSecretResponse(
                entity.getId(),
                requireProviderApiKey(entity)
        );
    }

    AiProviderConnectionEntity requireProviderConnection(Long id) {
        AiProviderConnectionEntity entity = aiProviderConnectionMapper.selectById(id);
        if (entity == null || !Objects.equals(entity.getOwnerUserId(), CurrentUserContext.get())) {
            throw new BadRequestException("AI 连接不存在");
        }
        return entity;
    }

    AiProviderConnectionEntity resolveBoundConnection(AiCaseConfigEntity entity) {
        if (entity == null || entity.getProviderConnectionId() == null) {
            return null;
        }
        return aiProviderConnectionMapper.selectById(entity.getProviderConnectionId());
    }

    AiProviderConnectionEntity resolveRequestedConnection(
            SaveAiCaseConfigRequest request,
            AiCaseConfigEntity existing,
            boolean creating
    ) {
        if (request.providerConnectionId() != null) {
            return requireProviderConnection(request.providerConnectionId());
        }
        String baseUrl = blankToNull(request.baseUrl());
        if (baseUrl == null && existing != null && existing.getProviderConnectionId() != null) {
            return requireProviderConnection(existing.getProviderConnectionId());
        }
        if (baseUrl == null) {
            throw new BadRequestException("请先选择或创建 AI 连接");
        }
        String protocolType = normalizeProtocolType(request.protocolType(), request.provider(), request.baseUrl());
        String apiKey = blankToNull(request.apiKey());
        if (apiKey == null && existing != null) {
            AiProviderConnectionEntity existingConnection = resolveBoundConnection(existing);
            if (existingConnection != null) {
                apiKey = aiSecretCodec.decrypt(existingConnection.getApiKeyCipherText());
            } else if (existing.getApiKeyCipherText() != null) {
                apiKey = aiSecretCodec.decrypt(existing.getApiKeyCipherText());
            }
        }
        if (apiKey == null && creating) {
            throw new BadRequestException("AI API Key 不能为空");
        }
        AiProviderConnectionEntity matched = findMatchingConnection(CurrentUserContext.get(), protocolType, baseUrl, apiKey);
        if (matched != null) {
            return matched;
        }
        if (apiKey == null) {
            throw new BadRequestException("当前未找到可复用的 AI 连接，请先补充 API Key");
        }
        AiProviderConnectionEntity created = new AiProviderConnectionEntity();
        created.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        created.setOwnerUserId(CurrentUserContext.get());
        created.setConnectionName("角色迁移连接-" + normalizeRoleType(request.roleType()));
        created.setProviderType("custom");
        created.setProtocolType(protocolType);
        created.setBaseUrl(baseUrl);
        created.setRequestTimeoutSeconds(null);
        created.setApiKeyCipherText(aiSecretCodec.encrypt(apiKey));
        created.setStatus(1);
        created.setCreatedAt(LocalDateTime.now());
        created.setUpdatedAt(LocalDateTime.now());
        aiProviderConnectionMapper.insert(created);
        return created;
    }

    AiProviderConnectionEntity findMatchingConnection(Long ownerUserId, String protocolType, String baseUrl, String apiKey) {
        List<AiProviderConnectionEntity> candidates = aiProviderConnectionMapper.selectList(new LambdaQueryWrapper<AiProviderConnectionEntity>()
                .eq(AiProviderConnectionEntity::getOwnerUserId, ownerUserId)
                .eq(AiProviderConnectionEntity::getProtocolType, protocolType)
                .eq(AiProviderConnectionEntity::getBaseUrl, baseUrl));
        if (apiKey == null) {
            return candidates.stream().findFirst().orElse(null);
        }
        return candidates.stream()
                .filter(item -> Objects.equals(apiKey, aiSecretCodec.decrypt(item.getApiKeyCipherText())))
                .findFirst()
                .orElse(null);
    }

    AiProviderConnectionEntity cloneLegacyConnection(Long ownerUserId, AiCaseConfigEntity legacyConfig) {
        AiProviderConnectionEntity legacyConnection = resolveBoundConnection(legacyConfig);
        String protocolType = legacyConnection != null
                ? legacyConnection.getProtocolType()
                : normalizeProtocolType(legacyConfig.getProtocolType(), legacyConfig.getProvider(), legacyConfig.getBaseUrl());
        String baseUrl = legacyConnection != null ? legacyConnection.getBaseUrl() : legacyConfig.getBaseUrl();
        String apiKey = legacyConnection != null
                ? aiSecretCodec.decrypt(legacyConnection.getApiKeyCipherText())
                : aiSecretCodec.decrypt(legacyConfig.getApiKeyCipherText());
        AiProviderConnectionEntity existing = findMatchingConnection(ownerUserId, protocolType, baseUrl, apiKey);
        if (existing != null) {
            return existing;
        }
        AiProviderConnectionEntity cloned = new AiProviderConnectionEntity();
        cloned.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        cloned.setOwnerUserId(ownerUserId);
        cloned.setConnectionName((legacyConnection != null ? legacyConnection.getConnectionName() : null) == null
                ? "旧版迁移-" + legacyConfig.getRoleType()
                : legacyConnection.getConnectionName());
        cloned.setProviderType(legacyConnection == null ? "custom" : normalizeProviderType(legacyConnection.getProviderType()));
        cloned.setProtocolType(protocolType);
        cloned.setBaseUrl(baseUrl);
        cloned.setRequestTimeoutSeconds(legacyConnection == null ? null : legacyConnection.getRequestTimeoutSeconds());
        cloned.setApiKeyCipherText(apiKey == null ? null : aiSecretCodec.encrypt(apiKey));
        cloned.setStatus(legacyConnection != null ? normalizeStatus(legacyConnection.getStatus()) : normalizeStatus(legacyConfig.getStatus()));
        cloned.setLastVerifiedAt(legacyConnection == null ? null : legacyConnection.getLastVerifiedAt());
        cloned.setLastFetchModelsAt(legacyConnection == null ? null : legacyConnection.getLastFetchModelsAt());
        cloned.setCreatedAt(LocalDateTime.now());
        cloned.setUpdatedAt(LocalDateTime.now());
        aiProviderConnectionMapper.insert(cloned);
        if (legacyConnection != null) {
            cloneLegacyModelCache(legacyConnection.getId(), cloned.getId());
        }
        return cloned;
    }

    void cloneLegacyModelCache(Long sourceConnectionId, Long targetConnectionId) {
        List<AiProviderModelEntity> models = aiProviderModelMapper.selectList(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getConnectionId, sourceConnectionId));
        for (AiProviderModelEntity model : models) {
            AiProviderModelEntity cloned = new AiProviderModelEntity();
            cloned.setConnectionId(targetConnectionId);
            cloned.setModelName(model.getModelName());
            cloned.setDisplayName(model.getDisplayName());
            cloned.setRawMetadataJson(model.getRawMetadataJson());
            cloned.setDetectedCapabilitiesJson(model.getDetectedCapabilitiesJson());
            cloned.setSelectable(model.getSelectable());
            cloned.setLastProbedAt(model.getLastProbedAt());
            cloned.setCreatedAt(LocalDateTime.now());
            cloned.setUpdatedAt(LocalDateTime.now());
            aiProviderModelMapper.insert(cloned);
        }
    }

    void mirrorConnectionSnapshot(AiCaseConfigEntity entity, AiProviderConnectionEntity connection) {
        String protocolType = normalizeProtocolType(connection.getProtocolType(), null, connection.getBaseUrl());
        entity.setProtocolType(protocolType);
        entity.setProvider(providerForProtocolType(protocolType));
        entity.setBaseUrl(connection.getBaseUrl());
    }

    String requireProviderApiKey(AiProviderConnectionEntity connection) {
        String apiKey = aiSecretCodec.decrypt(connection.getApiKeyCipherText());
        if (apiKey == null || apiKey.isBlank()) {
            throw new BadRequestException("AI 连接未配置 API Key");
        }
        return apiKey;
    }

    AiProviderRequestProfile buildProviderProfile(
            AiProviderConnectionEntity connection,
            String model,
            Double temperature,
            Double topP,
            Integer maxCases
    ) {
        String protocolType = resolveProviderProtocolType(
                connection.getProtocolType(),
                connection.getConnectionName(),
                connection.getBaseUrl(),
                model
        );
        return new AiProviderRequestProfile(
                protocolType,
                providerForProtocolType(protocolType),
                model,
                connection.getBaseUrl(),
                temperature == null ? 0.3 : temperature,
                topP == null ? DEFAULT_REVIEWER_TOP_P : normalizeTopP(null, topP),
                maxCases,
                resolveRequestTimeoutSeconds(connection.getRequestTimeoutSeconds())
        );
    }

    AiModelCapabilities resolveDetectedCapabilities(AiProviderConnectionEntity connection, String modelName) {
        AiProviderModelEntity cache = findProviderModelByName(connection.getId(), modelName);
        if (cache != null) {
            return readCapabilities(cache.getDetectedCapabilitiesJson(), modelName, connection.getProtocolType());
        }
        return AiModelCapabilities.infer(connection.getProtocolType(), modelName, true);
    }

    String writeCapabilities(AiModelCapabilities capabilities) {
        return AiCaseJsonSupport.toJson(capabilities, "AI 模型能力序列化失败");
    }

    AiModelCapabilities readCapabilities(String json, String modelName, String protocolType) {
        return AiCaseJsonSupport.read(
                json,
                AiModelCapabilities.class,
                AiModelCapabilities.infer(protocolType == null ? PROTOCOL_OPENAI_CHAT : protocolType, modelName, false)
        );
    }

    String normalizeProtocolType(String protocolType, String provider, String baseUrl) {
        String normalized = protocolType == null ? "" : protocolType.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        if (!normalized.isEmpty()) {
            return switch (normalized) {
                case "OPENAI_CHAT_COMPLETIONS", PROTOCOL_OPENAI_CHAT -> PROTOCOL_OPENAI_CHAT;
                case "OPENAI_RESPONSES", PROTOCOL_OPENAI_RESPONSES -> PROTOCOL_OPENAI_RESPONSES;
                case PROTOCOL_AZURE_OPENAI -> PROTOCOL_AZURE_OPENAI;
                default -> throw new BadRequestException("AI protocol type is invalid");
            };
        }
        return mapLegacyProviderToProtocolType(provider, baseUrl);
    }

    String providerForProtocolType(String protocolType) {
        return switch (protocolType) {
            case PROTOCOL_OPENAI_RESPONSES -> "OPENAI_COMPATIBLE_RESPONSES";
            case PROTOCOL_AZURE_OPENAI -> "AZURE_OPENAI";
            default -> "OPENAI_COMPATIBLE_CHAT";
        };
    }

    private AiProviderConnectionItem toConnectionItem(AiProviderConnectionEntity entity) {
        Long modelCount = aiProviderModelMapper.selectCount(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getConnectionId, entity.getId()));
        String preferredModelName = resolvePreferredModelForConnection(entity.getId());
        return new AiProviderConnectionItem(
                entity.getId(),
                PERSONAL_SCOPE_WORKSPACE_CODE,
                PERSONAL_SCOPE_WORKSPACE_NAME,
                entity.getConnectionName(),
                normalizeProviderType(entity.getProviderType()),
                normalizeProtocolType(entity.getProtocolType(), null, entity.getBaseUrl()),
                entity.getBaseUrl(),
                entity.getRequestTimeoutSeconds(),
                preferredModelName,
                maskApiKey(aiSecretCodec.decrypt(entity.getApiKeyCipherText())),
                entity.getApiKeyCipherText() != null && !entity.getApiKeyCipherText().isBlank(),
                normalizeStatus(entity.getStatus()),
                modelCount == null ? 0 : modelCount.intValue(),
                entity.getLastVerifiedAt(),
                entity.getLastFetchModelsAt(),
                entity.getLastTestAt(),
                entity.getLastTestStatus(),
                entity.getLastTestMessage()
        );
    }

    private AiProviderModelEntity requireProviderModel(Long connectionId, Long modelId) {
        AiProviderModelEntity modelEntity = aiProviderModelMapper.selectOne(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getId, modelId)
                .eq(AiProviderModelEntity::getConnectionId, connectionId)
                .last("limit 1"));
        if (modelEntity == null) {
            throw new BadRequestException("AI 模型不存在");
        }
        return modelEntity;
    }

    private boolean isModelInUse(Long connectionId, String modelName) {
        return aiCaseConfigMapper.selectCount(new LambdaQueryWrapper<AiCaseConfigEntity>()
                .eq(AiCaseConfigEntity::getOwnerUserId, CurrentUserContext.get())
                .eq(AiCaseConfigEntity::getProviderConnectionId, connectionId)
                .eq(AiCaseConfigEntity::getModel, modelName)) > 0;
    }

    private String truncateTestMessage(String message) {
        String normalized = blankToNull(message);
        if (normalized == null) return null;
        return normalized.length() <= 2000 ? normalized : normalized.substring(0, 2000);
    }

    private AiProviderModelItem toModelItem(AiProviderModelEntity entity) {
        return new AiProviderModelItem(
                entity.getId(),
                entity.getConnectionId(),
                entity.getModelName(),
                blankToNull(entity.getDisplayName()) == null ? entity.getModelName() : entity.getDisplayName(),
                readCapabilities(entity.getDetectedCapabilitiesJson(), entity.getModelName(), null),
                entity.getSelectable() == null || entity.getSelectable() == 1,
                entity.getRawMetadataJson(),
                entity.getLastProbedAt()
        );
    }

    private void applyProviderRequest(AiProviderConnectionEntity entity, SaveAiProviderConnectionRequest request, boolean creating) {
        String connectionName = blankToNull(request.connectionName());
        String baseUrl = blankToNull(request.baseUrl());
        if (connectionName == null) {
            throw new BadRequestException("AI 连接名称不能为空");
        }
        if (baseUrl == null) {
            throw new BadRequestException("AI API URL 不能为空");
        }
        entity.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        entity.setOwnerUserId(CurrentUserContext.get());
        entity.setConnectionName(connectionName);
        if (creating) {
            entity.setProviderType(normalizeProviderType(request.providerType()));
        }
        entity.setProtocolType(resolveProviderProtocolType(request.protocolType(), connectionName, baseUrl, request.modelName()));
        entity.setBaseUrl(baseUrl);
        entity.setRequestTimeoutSeconds(normalizeRequestTimeoutSeconds(request.requestTimeoutSeconds()));
        entity.setSelectedModelName(blankToNull(request.modelName()));
        if (creating) {
            entity.setApiKeyCipherText(aiSecretCodec.encrypt(request.apiKey().trim()));
        } else if (blankToNull(request.apiKey()) != null) {
            entity.setApiKeyCipherText(aiSecretCodec.encrypt(request.apiKey().trim()));
        }
        entity.setStatus(normalizeStatus(request.status()));
    }

    private List<AiProviderModelItem> persistFetchedModels(
            AiProviderConnectionEntity connection,
            List<AiProviderModelItem> fetchedModels,
            LocalDateTime fetchedAt
    ) {
        Map<String, AiProviderModelEntity> existingByName = aiProviderModelMapper.selectList(new LambdaQueryWrapper<AiProviderModelEntity>()
                        .eq(AiProviderModelEntity::getConnectionId, connection.getId()))
                .stream()
                .collect(Collectors.toMap(AiProviderModelEntity::getModelName, item -> item));
        List<Long> keepIds = new ArrayList<>();
        List<AiProviderModelItem> result = new ArrayList<>();
        for (AiProviderModelItem model : fetchedModels) {
            AiProviderModelEntity entity = existingByName.get(model.modelName());
            if (entity == null) {
                entity = new AiProviderModelEntity();
                entity.setConnectionId(connection.getId());
                entity.setModelName(model.modelName());
                entity.setCreatedAt(fetchedAt);
            }
            entity.setDisplayName(blankToNull(model.displayName()) == null ? model.modelName() : model.displayName());
            entity.setRawMetadataJson(model.rawMetadataJson());
            entity.setDetectedCapabilitiesJson(writeCapabilities(model.detectedCapabilities()));
            entity.setSelectable(model.selectable() ? 1 : 0);
            entity.setUpdatedAt(fetchedAt);
            if (entity.getId() == null) {
                aiProviderModelMapper.insert(entity);
            } else {
                aiProviderModelMapper.updateById(entity);
            }
            keepIds.add(entity.getId());
            result.add(toModelItem(entity));
        }
        if (!keepIds.isEmpty()) {
            List<AiProviderModelEntity> stale = existingByName.values().stream()
                    .filter(item -> item.getId() != null && !keepIds.contains(item.getId()))
                    .toList();
            stale.forEach(item -> aiProviderModelMapper.deleteById(item.getId()));
        }
        return result.stream()
                .sorted(Comparator.comparing(AiProviderModelItem::modelName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<AiProviderModelItem> listModelItems(Long connectionId) {
        return aiProviderModelMapper.selectList(new LambdaQueryWrapper<AiProviderModelEntity>()
                        .eq(AiProviderModelEntity::getConnectionId, connectionId)
                        .orderByAsc(AiProviderModelEntity::getDisplayName)
                        .orderByAsc(AiProviderModelEntity::getModelName))
                .stream()
                .map(this::toModelItem)
                .toList();
    }

    private AiProviderModelEntity findProviderModelByName(Long connectionId, String modelName) {
        return aiProviderModelMapper.selectOne(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getConnectionId, connectionId)
                .eq(AiProviderModelEntity::getModelName, modelName)
                .last("limit 1"));
    }

    private void syncRequestedModel(AiProviderConnectionEntity connection, String modelName) {
        String normalizedModelName = blankToNull(modelName);
        if (connection == null || connection.getId() == null || normalizedModelName == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        AiProviderModelEntity modelEntity = findProviderModelByName(connection.getId(), normalizedModelName);
        if (modelEntity == null) {
            modelEntity = new AiProviderModelEntity();
            modelEntity.setConnectionId(connection.getId());
            modelEntity.setModelName(normalizedModelName);
            modelEntity.setDisplayName(normalizedModelName);
            modelEntity.setSelectable(1);
            modelEntity.setCreatedAt(now);
        }
        if (blankToNull(modelEntity.getDisplayName()) == null) {
            modelEntity.setDisplayName(normalizedModelName);
        }
        modelEntity.setSelectable(1);
        modelEntity.setLastProbedAt(now);
        modelEntity.setUpdatedAt(now);
        if (modelEntity.getId() == null) {
            aiProviderModelMapper.insert(modelEntity);
        } else {
            aiProviderModelMapper.updateById(modelEntity);
        }
    }

    private String resolvePreferredModelForConnection(Long connectionId) {
        AiProviderConnectionEntity connection = aiProviderConnectionMapper.selectById(connectionId);
        if (connection != null && blankToNull(connection.getSelectedModelName()) != null) {
            return connection.getSelectedModelName();
        }
        AiProviderModelEntity cachedModel = aiProviderModelMapper.selectOne(new LambdaQueryWrapper<AiProviderModelEntity>()
                .eq(AiProviderModelEntity::getConnectionId, connectionId)
                .orderByDesc(AiProviderModelEntity::getLastProbedAt)
                .orderByAsc(AiProviderModelEntity::getModelName)
                .last("limit 1"));
        if (cachedModel != null && blankToNull(cachedModel.getModelName()) != null) {
            return cachedModel.getModelName();
        }
        AiCaseConfigEntity boundRole = aiCaseConfigMapper.selectOne(new LambdaQueryWrapper<AiCaseConfigEntity>()
                .eq(AiCaseConfigEntity::getOwnerUserId, CurrentUserContext.get())
                .eq(AiCaseConfigEntity::getProviderConnectionId, connectionId)
                .orderByDesc(AiCaseConfigEntity::getUpdatedAt)
                .last("limit 1"));
        return boundRole == null ? null : boundRole.getModel();
    }

    private AiProviderRequestProfile buildPreviewProviderProfile(PreviewAiProviderModelsRequest request) {
        String baseUrl = blankToNull(request.baseUrl());
        if (baseUrl == null) {
            throw new BadRequestException("AI API URL 不能为空");
        }
        String protocolType = resolveProviderProtocolType(request.protocolType(), null, baseUrl, null);
        return new AiProviderRequestProfile(
                protocolType,
                providerForProtocolType(protocolType),
                "model-probe",
                baseUrl,
                0.3,
                DEFAULT_REVIEWER_TOP_P,
                null,
                resolveRequestTimeoutSeconds(request.requestTimeoutSeconds())
        );
    }

    private String normalizeProvider(String provider) {
        return provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private String normalizeProviderType(String providerType) {
        String normalized = providerType == null ? "" : providerType.trim().toLowerCase(Locale.ROOT).replace(' ', '_');
        return switch (normalized) {
            case "openai",
                 "anthropic",
                 "google",
                 "deepseek",
                 "qwen",
                 "azure",
                 "xiaomi",
                 "zhipu",
                 "kimi",
                 "minimax",
                 "ollama",
                 "custom" -> normalized;
            default -> "custom";
        };
    }

    private String resolveProviderProtocolType(String protocolType, String connectionName, String baseUrl, String modelName) {
        if (blankToNull(protocolType) != null) {
            return normalizeProtocolType(protocolType, null, baseUrl);
        }
        String source = String.join(" ",
                blankToNull(connectionName) == null ? "" : connectionName,
                blankToNull(baseUrl) == null ? "" : baseUrl,
                blankToNull(modelName) == null ? "" : modelName).toLowerCase(Locale.ROOT);
        if (source.contains("azure") || source.contains(".openai.azure.com")) {
            return PROTOCOL_AZURE_OPENAI;
        }
        if (source.contains("/responses")) {
            return PROTOCOL_OPENAI_RESPONSES;
        }
        return PROTOCOL_OPENAI_CHAT;
    }

    private String mapLegacyProviderToProtocolType(String provider, String baseUrl) {
        String normalizedProvider = normalizeProvider(provider);
        if ("AZURE_OPENAI".equals(normalizedProvider)) {
            return PROTOCOL_AZURE_OPENAI;
        }
        if ("INTERNAL_PROXY".equals(normalizedProvider)) {
            String normalizedBaseUrl = baseUrl == null ? "" : baseUrl.trim().toLowerCase(Locale.ROOT);
            return normalizedBaseUrl.contains("/responses") ? PROTOCOL_OPENAI_RESPONSES : PROTOCOL_OPENAI_CHAT;
        }
        return PROTOCOL_OPENAI_CHAT;
    }

    private Integer normalizeStatus(Integer status) {
        if (status == null) {
            return 1;
        }
        if (status != 0 && status != 1) {
            throw new BadRequestException("AI config status must be 0 or 1");
        }
        return status;
    }

    private Double normalizeTopP(String roleType, Double topP) {
        if (topP == null) {
            return DEFAULT_REVIEWER_TOP_P;
        }
        return Math.max(0.1, Math.min(1.0, topP));
    }

    private Integer normalizeRequestTimeoutSeconds(Integer requestTimeoutSeconds) {
        if (requestTimeoutSeconds == null) {
            return defaultRequestTimeoutSeconds;
        }
        return Math.max(10, Math.min(600, requestTimeoutSeconds));
    }

    private int resolveRequestTimeoutSeconds(Integer requestTimeoutSeconds) {
        return requestTimeoutSeconds == null ? defaultRequestTimeoutSeconds : Math.max(10, Math.min(600, requestTimeoutSeconds));
    }

    private String maskApiKey(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.length() <= 8) {
            return "****";
        }
        return value.substring(0, 4) + "****" + value.substring(value.length() - 4);
    }

    private String normalizeRoleType(String roleType) {
        String normalized = roleType == null ? "" : roleType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CASE_REVIEWER", "REVIEWER" -> "CASE_REVIEWER";
            default -> "CASE_GENERATOR";
        };
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record ResolvedProviderModelConfig(
            AiProviderConnectionEntity connection,
            AiProviderRequestProfile profile,
            String apiKey
    ) {
    }
}
