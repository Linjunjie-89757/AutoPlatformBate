package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;

@Service
public class AiCaseConfigDomainService {

    static final String ROLE_GENERATOR = "CASE_GENERATOR";
    static final String ROLE_REVIEWER = "CASE_REVIEWER";
    private static final long PERSONAL_SCOPE_WORKSPACE_ID = 0L;
    private static final String PERSONAL_SCOPE_WORKSPACE_CODE = "PERSONAL";
    private static final String PERSONAL_SCOPE_WORKSPACE_NAME = "我的配置";
    private static final int DEFAULT_GENERATOR_MAX_CASES = 200;
    private static final int DEFAULT_REVIEWER_MAX_CASES = 50;
    private static final int MIN_CONFIG_MAX_CASES = 100;
    private static final int SYSTEM_MAX_CASES = 500;
    private static final double DEFAULT_GENERATOR_TOP_P = 0.9;
    private static final double DEFAULT_REVIEWER_TOP_P = 0.7;

    private final AiCaseConfigMapper aiCaseConfigMapper;
    private final AiSecretCodec aiSecretCodec;
    private final AiProviderClient aiProviderClient;
    private final AiProviderDomainService aiProviderDomainService;
    private final int defaultRequestTimeoutSeconds;

    public AiCaseConfigDomainService(
            AiCaseConfigMapper aiCaseConfigMapper,
            AiSecretCodec aiSecretCodec,
            AiProviderClient aiProviderClient,
            AiProviderDomainService aiProviderDomainService,
            @Value("${app.ai.request-timeout-seconds:60}") int defaultRequestTimeoutSeconds
    ) {
        this.aiCaseConfigMapper = aiCaseConfigMapper;
        this.aiSecretCodec = aiSecretCodec;
        this.aiProviderClient = aiProviderClient;
        this.aiProviderDomainService = aiProviderDomainService;
        this.defaultRequestTimeoutSeconds = Math.max(10, Math.min(600, defaultRequestTimeoutSeconds));
    }

    public AiCaseConfigResponse getConfig(String headerWorkspaceCode, String targetWorkspaceCode) {
        Long ownerUserId = CurrentUserContext.get();
        AiCaseConfigItem generatorConfig = toItem(findByOwnerUserIdAndRoleType(ownerUserId, ROLE_GENERATOR));
        AiCaseConfigItem reviewerConfig = toItem(findByOwnerUserIdAndRoleType(ownerUserId, ROLE_REVIEWER));
        boolean hasLegacyConfig = hasLegacyConfig();
        return new AiCaseConfigResponse(
                generatorConfig,
                reviewerConfig,
                hasLegacyConfig,
                hasLegacyConfig && generatorConfig == null && reviewerConfig == null
        );
    }

    public AiCaseConfigItem createConfig(String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        Long ownerUserId = CurrentUserContext.get();
        String roleType = normalizeRoleType(request.roleType());
        if (findByOwnerUserIdAndRoleType(ownerUserId, roleType) != null) {
            throw new BadRequestException("AI config already exists for this role");
        }
        AiCaseConfigEntity entity = new AiCaseConfigEntity();
        entity.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        entity.setOwnerUserId(ownerUserId);
        entity.setRoleType(roleType);
        applyRoleRequest(entity, request, null, true);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        aiCaseConfigMapper.insert(entity);
        return toItem(entity);
    }

    public AiCaseConfigItem updateConfig(Long id, String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        AiCaseConfigEntity entity = requireConfig(id);
        String roleType = normalizeRoleType(request.roleType());
        if (!entity.getRoleType().equals(roleType)) {
            throw new BadRequestException("AI config role type cannot be changed");
        }
        applyRoleRequest(entity, request, entity, false);
        entity.setUpdatedAt(LocalDateTime.now());
        aiCaseConfigMapper.updateById(entity);
        return toItem(entity);
    }

    public TestAiCaseConfigResponse testConfig(String headerWorkspaceCode, SaveAiCaseConfigRequest request) {
        Long ownerUserId = CurrentUserContext.get();
        String roleType = normalizeRoleType(request.roleType());
        if (request.providerConnectionId() != null) {
            AiProviderConnectionEntity connection = aiProviderDomainService.requireProviderConnection(request.providerConnectionId());
            String apiKey = aiProviderDomainService.requireProviderApiKey(connection);
            AiProviderRequestProfile profile = aiProviderDomainService.buildProviderProfile(
                    connection,
                    request.model().trim(),
                    request.temperature(),
                    normalizeTopP(request.roleType(), request.topP()),
                    request.maxCases()
            );
            aiProviderClient.testConnection(profile, apiKey);
            return new TestAiCaseConfigResponse(true, profile.provider(), profile.model(), "AI 连接可用");
        }
        String apiKey = blankToNull(request.apiKey());
        if (apiKey == null) {
            AiCaseConfigEntity existing = findByOwnerUserIdAndRoleType(ownerUserId, roleType);
            if (existing != null) {
                AiProviderConnectionEntity connection = aiProviderDomainService.resolveBoundConnection(existing);
                apiKey = connection != null
                        ? aiSecretCodec.decrypt(connection.getApiKeyCipherText())
                        : aiSecretCodec.decrypt(existing.getApiKeyCipherText());
            }
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new BadRequestException("AI API key is required for connection test");
        }
        AiProviderRequestProfile profile = buildLegacyProfile(roleType, request, findByOwnerUserIdAndRoleType(ownerUserId, roleType));
        aiProviderClient.testConnection(profile, apiKey);
        return new TestAiCaseConfigResponse(true, profile.provider(), profile.model(), "AI 连接可用");
    }

    public AiCaseConfigSecretResponse getConfigSecret(Long id, String headerWorkspaceCode) {
        AiCaseConfigEntity entity = requireConfig(id);
        AiProviderConnectionEntity connection = aiProviderDomainService.resolveBoundConnection(entity);
        String apiKey = connection != null
                ? aiSecretCodec.decrypt(connection.getApiKeyCipherText())
                : aiSecretCodec.decrypt(entity.getApiKeyCipherText());
        return new AiCaseConfigSecretResponse(
                entity.getId(),
                entity.getRoleType(),
                apiKey
        );
    }

    public AiCaseConfigResponse bootstrapConfigFromLegacy(String headerWorkspaceCode) {
        Long ownerUserId = CurrentUserContext.get();
        if (findByOwnerUserIdAndRoleType(ownerUserId, ROLE_GENERATOR) != null
                || findByOwnerUserIdAndRoleType(ownerUserId, ROLE_REVIEWER) != null) {
            throw new BadRequestException("Personal AI config already exists");
        }
        if (!hasLegacyConfig()) {
            throw new BadRequestException("No legacy AI config found");
        }
        cloneLegacyRoleConfig(ownerUserId, ROLE_GENERATOR);
        cloneLegacyRoleConfig(ownerUserId, ROLE_REVIEWER);
        return getConfig(headerWorkspaceCode, null);
    }

    AiCaseConfigEntity findByOwnerUserIdAndRoleType(Long ownerUserId, String roleType) {
        return aiCaseConfigMapper.selectOne(new LambdaQueryWrapper<AiCaseConfigEntity>()
                .eq(AiCaseConfigEntity::getOwnerUserId, ownerUserId)
                .eq(AiCaseConfigEntity::getRoleType, roleType)
                .last("limit 1"));
    }

    AiCaseConfigEntity findLegacyRoleConfig(String roleType) {
        return aiCaseConfigMapper.selectOne(new LambdaQueryWrapper<AiCaseConfigEntity>()
                .isNull(AiCaseConfigEntity::getOwnerUserId)
                .eq(AiCaseConfigEntity::getWorkspaceId, PERSONAL_SCOPE_WORKSPACE_ID)
                .eq(AiCaseConfigEntity::getRoleType, roleType)
                .last("limit 1"));
    }

    boolean hasLegacyConfig() {
        Long count = aiCaseConfigMapper.selectCount(new LambdaQueryWrapper<AiCaseConfigEntity>()
                .isNull(AiCaseConfigEntity::getOwnerUserId)
                .eq(AiCaseConfigEntity::getWorkspaceId, PERSONAL_SCOPE_WORKSPACE_ID));
        return count != null && count > 0;
    }

    AiCaseConfigEntity requireConfig(Long id) {
        AiCaseConfigEntity entity = aiCaseConfigMapper.selectById(id);
        if (entity == null || !Objects.equals(entity.getOwnerUserId(), CurrentUserContext.get())) {
            throw new BadRequestException("AI config does not exist");
        }
        return entity;
    }

    void applyRoleRequest(
            AiCaseConfigEntity entity,
            SaveAiCaseConfigRequest request,
            AiCaseConfigEntity existing,
            boolean creating
    ) {
        entity.setRoleType(normalizeRoleType(request.roleType()));
        entity.setModel(request.model().trim());
        entity.setPromptTemplate(request.promptTemplate().trim());
        entity.setReviewChecklist(blankToNull(request.reviewChecklist()));
        entity.setTemperature(request.temperature());
        entity.setTopP(normalizeTopP(entity.getRoleType(), request.topP()));
        entity.setMaxCases(normalizeRoleMaxCases(entity.getRoleType(), request.maxCases()));
        entity.setStatus(normalizeStatus(request.status()));
        AiProviderConnectionEntity connection = aiProviderDomainService.resolveRequestedConnection(request, existing, creating);
        entity.setProviderConnectionId(connection.getId());
        aiProviderDomainService.mirrorConnectionSnapshot(entity, connection);
        AiCapabilityOverride override = mergeCapabilityOverride(request);
        entity.setCapabilityOverrideJson(writeCapabilityOverride(override));
        AiModelCapabilities detectedCapabilities = aiProviderDomainService.resolveDetectedCapabilities(connection, entity.getModel());
        AiModelCapabilities effectiveCapabilities = detectedCapabilities.applyOverride(override);
        entity.setSupportsImageInput(Boolean.TRUE.equals(effectiveCapabilities.imageInput().supported()) ? 1 : 0);
    }

    AiCaseConfigItem toItem(AiCaseConfigEntity entity) {
        if (entity == null) {
            return null;
        }
        AiProviderConnectionEntity connection = aiProviderDomainService.resolveBoundConnection(entity);
        String protocolType = connection != null
                ? aiProviderDomainService.normalizeProtocolType(connection.getProtocolType(), null, connection.getBaseUrl())
                : aiProviderDomainService.normalizeProtocolType(entity.getProtocolType(), entity.getProvider(), entity.getBaseUrl());
        String baseUrl = connection != null ? connection.getBaseUrl() : entity.getBaseUrl();
        String apiKey = connection != null
                ? aiSecretCodec.decrypt(connection.getApiKeyCipherText())
                : aiSecretCodec.decrypt(entity.getApiKeyCipherText());
        AiCapabilityOverride override = readCapabilityOverride(entity);
        AiModelCapabilities detectedCapabilities = connection != null
                ? aiProviderDomainService.resolveDetectedCapabilities(connection, entity.getModel())
                : AiModelCapabilities.infer(protocolType, entity.getModel(), apiKey != null && !apiKey.isBlank());
        AiModelCapabilities effectiveCapabilities = detectedCapabilities.applyOverride(override);
        return new AiCaseConfigItem(
                entity.getId(),
                PERSONAL_SCOPE_WORKSPACE_CODE,
                PERSONAL_SCOPE_WORKSPACE_NAME,
                entity.getRoleType(),
                connection == null ? null : connection.getId(),
                connection == null ? null : connection.getConnectionName(),
                protocolType,
                aiProviderDomainService.providerForProtocolType(protocolType),
                entity.getModel(),
                baseUrl,
                maskApiKey(apiKey),
                apiKey != null && !apiKey.isBlank(),
                entity.getPromptTemplate(),
                entity.getReviewChecklist(),
                entity.getTemperature(),
                normalizeTopP(entity.getRoleType(), entity.getTopP()),
                entity.getMaxCases(),
                detectedCapabilities,
                effectiveCapabilities,
                override,
                Boolean.TRUE.equals(effectiveCapabilities.imageInput().supported()),
                normalizeStatus(entity.getStatus())
        );
    }

    void cloneLegacyRoleConfig(Long ownerUserId, String roleType) {
        AiCaseConfigEntity legacyConfig = findLegacyRoleConfig(roleType);
        if (legacyConfig == null) {
            return;
        }
        AiProviderConnectionEntity personalConnection = aiProviderDomainService.cloneLegacyConnection(ownerUserId, legacyConfig);
        AiCaseConfigEntity cloned = new AiCaseConfigEntity();
        cloned.setWorkspaceId(PERSONAL_SCOPE_WORKSPACE_ID);
        cloned.setOwnerUserId(ownerUserId);
        cloned.setRoleType(legacyConfig.getRoleType());
        cloned.setProtocolType(legacyConfig.getProtocolType());
        cloned.setProvider(legacyConfig.getProvider());
        cloned.setModel(legacyConfig.getModel());
        cloned.setBaseUrl(personalConnection.getBaseUrl());
        cloned.setApiKeyCipherText(personalConnection.getApiKeyCipherText());
        cloned.setPromptTemplate(legacyConfig.getPromptTemplate());
        cloned.setReviewChecklist(legacyConfig.getReviewChecklist());
        cloned.setTemperature(legacyConfig.getTemperature());
        cloned.setTopP(normalizeTopP(roleType, legacyConfig.getTopP()));
        cloned.setMaxCases(legacyConfig.getMaxCases());
        cloned.setProviderConnectionId(personalConnection.getId());
        cloned.setCapabilityOverrideJson(legacyConfig.getCapabilityOverrideJson());
        cloned.setSupportsImageInput(legacyConfig.getSupportsImageInput());
        cloned.setStatus(normalizeStatus(legacyConfig.getStatus()));
        cloned.setCreatedAt(LocalDateTime.now());
        cloned.setUpdatedAt(LocalDateTime.now());
        aiCaseConfigMapper.insert(cloned);
    }

    AiCapabilityOverride mergeCapabilityOverride(SaveAiCaseConfigRequest request) {
        AiCapabilityOverride base = request.capabilityOverride();
        if (request.supportsImageInput() == null) {
            return base;
        }
        return new AiCapabilityOverride(
                base == null ? null : base.textChat(),
                base == null ? null : base.streamOutput(),
                base == null ? null : base.structuredOutput(),
                request.supportsImageInput(),
                base == null ? null : base.longContext(),
                base == null ? null : base.stableAvailable()
        );
    }

    String writeCapabilityOverride(AiCapabilityOverride override) {
        if (override == null || !override.hasAnyValue()) {
            return null;
        }
        return AiCaseJsonSupport.toJson(override, "AI 能力覆盖配置序列化失败");
    }

    AiCapabilityOverride readCapabilityOverride(AiCaseConfigEntity entity) {
        return AiCaseJsonSupport.read(entity.getCapabilityOverrideJson(), AiCapabilityOverride.class, null);
    }

    boolean supportsImageInputForGeneration(ResolvedRoleConfig resolved) {
        AiCapabilityValue effectiveImage = resolved.effectiveCapabilities().imageInput();
        if (!Boolean.FALSE.equals(effectiveImage.supported())) {
            return true;
        }
        return AiModelCapabilities.SOURCE_INFERRED.equals(effectiveImage.source())
                || AiModelCapabilities.SOURCE_UNKNOWN.equals(effectiveImage.source());
    }

    public ResolvedRoleConfig requireResolvedRoleConfig(String roleType) {
        AiCaseConfigEntity roleConfig = findByOwnerUserIdAndRoleType(CurrentUserContext.get(), roleType);
        if (roleConfig == null) {
            throw new BadRequestException("No personal " + roleType + " config found");
        }
        AiProviderConnectionEntity connection = aiProviderDomainService.resolveBoundConnection(roleConfig);
        String apiKey;
        AiProviderRequestProfile profile;
        if (connection != null) {
            apiKey = aiProviderDomainService.requireProviderApiKey(connection);
            profile = aiProviderDomainService.buildProviderProfile(
                    connection,
                    roleConfig.getModel(),
                    roleConfig.getTemperature(),
                    normalizeTopP(roleConfig.getRoleType(), roleConfig.getTopP()),
                    roleConfig.getMaxCases()
            );
        } else {
            apiKey = requireConfigApiKey(roleConfig);
            profile = buildLegacyProfile(roleType, new SaveAiCaseConfigRequest(
                    roleConfig.getWorkspaceId() == null ? null : PERSONAL_SCOPE_WORKSPACE_CODE,
                    roleConfig.getRoleType(),
                    null,
                    roleConfig.getProtocolType(),
                    roleConfig.getProvider(),
                    roleConfig.getModel(),
                    roleConfig.getBaseUrl(),
                    apiKey,
                    roleConfig.getPromptTemplate(),
                    roleConfig.getReviewChecklist(),
                    roleConfig.getTemperature(),
                    roleConfig.getTopP(),
                    roleConfig.getMaxCases(),
                    readCapabilityOverride(roleConfig),
                    roleConfig.getSupportsImageInput() != null && roleConfig.getSupportsImageInput() == 1,
                    roleConfig.getStatus()
            ), roleConfig);
        }
        AiCapabilityOverride override = readCapabilityOverride(roleConfig);
        AiModelCapabilities detectedCapabilities = connection != null
                ? aiProviderDomainService.resolveDetectedCapabilities(connection, roleConfig.getModel())
                : AiModelCapabilities.infer(profile.protocolType(), roleConfig.getModel(), true);
        AiModelCapabilities effectiveCapabilities = detectedCapabilities.applyOverride(override);
        return new ResolvedRoleConfig(roleConfig, connection, profile, apiKey, detectedCapabilities, effectiveCapabilities);
    }

    String requireConfigApiKey(AiCaseConfigEntity config) {
        String decryptedApiKey = aiSecretCodec.decrypt(config.getApiKeyCipherText());
        if (decryptedApiKey == null || decryptedApiKey.isBlank()) {
            throw new BadRequestException("AI config API key is missing");
        }
        return decryptedApiKey;
    }

    AiProviderRequestProfile buildLegacyProfile(
            String roleType,
            SaveAiCaseConfigRequest request,
            AiCaseConfigEntity existing
    ) {
        String protocolType = aiProviderDomainService.normalizeProtocolType(request.protocolType(), request.provider(), request.baseUrl());
        String baseUrl = blankToNull(request.baseUrl());
        if (baseUrl == null && existing != null) {
            baseUrl = existing.getBaseUrl();
        }
        if (baseUrl == null) {
            throw new BadRequestException("AI API URL 不能为空");
        }
        Double temperature = request.temperature() == null
                ? (existing == null ? 0.3 : existing.getTemperature())
                : request.temperature();
        Double topP = request.topP() == null
                ? (existing == null ? defaultTopPForRole(roleType) : normalizeTopP(roleType, existing.getTopP()))
                : normalizeTopP(roleType, request.topP());
        Integer maxCases = normalizeRoleMaxCases(roleType, request.maxCases() == null
                ? (existing == null ? null : existing.getMaxCases())
                : request.maxCases());
        return new AiProviderRequestProfile(
                protocolType,
                aiProviderDomainService.providerForProtocolType(protocolType),
                request.model().trim(),
                baseUrl,
                temperature,
                topP,
                maxCases,
                defaultRequestTimeoutSeconds
        );
    }

    String normalizeRoleType(String roleType) {
        String normalized = roleType == null ? "" : roleType.trim().toUpperCase(Locale.ROOT);
        if (!ROLE_GENERATOR.equals(normalized) && !ROLE_REVIEWER.equals(normalized)) {
            throw new BadRequestException("AI role type must be CASE_GENERATOR or CASE_REVIEWER");
        }
        return normalized;
    }

    Integer normalizeStatus(Integer status) {
        if (status == null) {
            return 1;
        }
        if (status != 0 && status != 1) {
            throw new BadRequestException("AI config status must be 0 or 1");
        }
        return status;
    }

    Integer normalizeRoleMaxCases(Integer maxCases) {
        return normalizeRoleMaxCases(ROLE_GENERATOR, maxCases);
    }

    Integer normalizeRoleMaxCases(String roleType, Integer maxCases) {
        String normalizedRoleType = normalizeRoleType(roleType);
        if (maxCases == null) {
            return ROLE_GENERATOR.equals(normalizedRoleType)
                    ? DEFAULT_GENERATOR_MAX_CASES
                    : DEFAULT_REVIEWER_MAX_CASES;
        }
        int minimum = ROLE_GENERATOR.equals(normalizedRoleType) ? MIN_CONFIG_MAX_CASES : 1;
        if (maxCases < minimum || maxCases > SYSTEM_MAX_CASES) {
            throw new BadRequestException(ROLE_GENERATOR.equals(normalizedRoleType)
                    ? "Generator max cases must be between 100 and 500"
                    : "Reviewer max cases must be between 1 and 500");
        }
        return maxCases;
    }

    Double normalizeTopP(String roleType, Double topP) {
        if (topP == null) {
            return defaultTopPForRole(roleType);
        }
        if (topP < 0.1 || topP > 1.0) {
            throw new BadRequestException("Top-p must be between 0.1 and 1.0");
        }
        return Math.round(topP * 10.0) / 10.0;
    }

    double defaultTopPForRole(String roleType) {
        if (roleType == null || roleType.isBlank()) {
            return DEFAULT_REVIEWER_TOP_P;
        }
        return ROLE_REVIEWER.equals(normalizeRoleType(roleType)) ? DEFAULT_REVIEWER_TOP_P : DEFAULT_GENERATOR_TOP_P;
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return "";
        }
        if (apiKey.length() <= 8) {
            return "*".repeat(apiKey.length());
        }
        return apiKey.substring(0, 4) + "*".repeat(apiKey.length() - 8) + apiKey.substring(apiKey.length() - 4);
    }

    public record ResolvedRoleConfig(
            AiCaseConfigEntity roleConfig,
            AiProviderConnectionEntity connection,
            AiProviderRequestProfile profile,
            String apiKey,
            AiModelCapabilities detectedCapabilities,
            AiModelCapabilities effectiveCapabilities
    ) {
        public AiProviderRequestProfile profileWithMaxCases(Integer maxCases) {
            return new AiProviderRequestProfile(
                    profile.protocolType(),
                    profile.provider(),
                    profile.model(),
                    profile.baseUrl(),
                    profile.temperature(),
                    profile.topP(),
                    maxCases,
                    profile.requestTimeoutSeconds()
            );
        }
    }
}
