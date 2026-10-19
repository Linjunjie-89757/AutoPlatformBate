package com.company.autoplatform.apiautomation;

import org.junit.jupiter.api.Test;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.emptyAuthConfig;
import static org.assertj.core.api.Assertions.assertThat;

class ApiEnvironmentPayloadTests {

    @Test
    void environmentPayloadAcceptsLegacyLocalVariablesAlias() {
        ApiExecutionRuntimeModels.EnvironmentConfigPayload payload = ApiAutomationJsonSupport.read("""
                {
                  "localVariables": [
                    {"name": "TENANT", "value": "legacy", "sensitive": false}
                  ],
                  "variableSetIds": [11, 12],
                  "disabledVariableSetIds": [12]
                }
                """, ApiExecutionRuntimeModels.EnvironmentConfigPayload.class,
                new ApiExecutionRuntimeModels.EnvironmentConfigPayload(
                        java.util.List.of(), emptyAuthConfig(), 10000, java.util.List.of(), null,
                        null, null, null, null, java.util.List.of()));

        assertThat(payload.variables()).extracting(ApiAutomationModels.ApiVariableItem::name)
                .containsExactly("TENANT");
        assertThat(payload.variableSetIds()).containsExactly(11L, 12L);
        assertThat(payload.disabledVariableSetIds()).containsExactly(12L);
    }

    @Test
    void environmentPayloadReadsLegacyNestedApiConfig() {
        ApiExecutionRuntimeModels.EnvironmentConfigPayload payload = ApiAutomationJsonSupport.read("""
                {
                  "apiConfig": {
                    "baseUrl": "https://legacy.example.test",
                    "timeout": 4500,
                    "authType": "bearer",
                    "authBearer": "{{TOKEN}}",
                    "headers": [{"key": "X-Tenant", "value": "legacy", "enabled": true}]
                  }
                }
                """, ApiExecutionRuntimeModels.EnvironmentConfigPayload.class,
                new ApiExecutionRuntimeModels.EnvironmentConfigPayload(
                        java.util.List.of(), emptyAuthConfig(), 10000, java.util.List.of(), null,
                        null, null, null, null, java.util.List.of()));

        assertThat(payload.apiConfig()).isNotNull();
        assertThat(payload.apiConfig().baseUrl()).isEqualTo("https://legacy.example.test");
        assertThat(payload.apiConfig().timeout()).isEqualTo(4500);
        assertThat(payload.apiConfig().authType()).isEqualTo("bearer");
        assertThat(payload.apiConfig().authBearer()).isEqualTo("{{TOKEN}}");
        assertThat(payload.apiConfig().headers()).hasSize(1);
    }

    @Test
    void legacyApiConfigReadsApiKeyTypeAndCredentials() {
        ApiExecutionRuntimeModels.EnvironmentConfigPayload payload = ApiAutomationJsonSupport.read("""
                {"apiConfig":{"authType":"apikey","authApiKeyName":"X-API-Key","authApiKeyValue":"secret"}}
                """, ApiExecutionRuntimeModels.EnvironmentConfigPayload.class,
                new ApiExecutionRuntimeModels.EnvironmentConfigPayload(
                        java.util.List.of(), emptyAuthConfig(), 10000, java.util.List.of(), null,
                        null, null, null, null, java.util.List.of()));

        assertThat(payload.apiConfig().authType()).isEqualTo("apikey");
        assertThat(payload.apiConfig().authApiKeyName()).isEqualTo("X-API-Key");
    }
}
