package com.company.autoplatform.ai;

import java.time.LocalDateTime;

public record AiProviderConnectionItem(
        Long id,
        String workspaceCode,
        String workspaceName,
        String connectionName,
        String providerType,
        String protocolType,
        String baseUrl,
        Integer requestTimeoutSeconds,
        String modelName,
        String apiKeyMasked,
        boolean apiKeyConfigured,
        Integer status,
        Integer modelCount,
        LocalDateTime lastVerifiedAt,
        LocalDateTime lastFetchModelsAt,
        LocalDateTime lastTestAt,
        String lastTestStatus,
        String lastTestMessage
) {
}
