package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class ApiRequestSettingsIntegrationTests extends IntegrationTestSupport {
    @Autowired
    private ApiAutomationService service;

    @Test
    void definitionSettingsPersistAndUpdateWithoutLosingOtherConfiguration() {
        ApiRequestConfigInput initial = config(30000, 60000, false);
        ApiDefinitionDetail saved = service.createDefinition(WORKSPACE_CODE, definition(initial));
        ApiDefinitionDetail read = service.getDefinition(saved.id(), WORKSPACE_CODE);
        assertThat(read.requestConfig().connectTimeoutMs()).isEqualTo(30000);
        assertThat(read.requestConfig().followRedirects()).isFalse();
        assertThat(read.requestConfig().timeoutMs()).isEqualTo(60000);
        service.updateDefinition(saved.id(), WORKSPACE_CODE, definition(config(15000, 45000, true)));
        ApiDefinitionDetail updated = service.getDefinition(saved.id(), WORKSPACE_CODE);
        assertThat(updated.requestConfig().connectTimeoutMs()).isEqualTo(15000);
        assertThat(updated.requestConfig().followRedirects()).isTrue();
        assertThat(updated.requestConfig().timeoutMs()).isEqualTo(45000);
        assertThat(updated.tags()).containsExactly("settings-regression");
        assertThat(updated.requestConfig().path()).isEqualTo("/settings-regression");
    }

    private ApiRequestConfigInput config(int connection, int response, boolean redirects) {
        return new ApiRequestConfigInput("GET", "/settings-regression", response, List.of(), List.of(), List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null),
                new ApiAuthConfigInput("NONE", null, null), List.of(), connection, redirects);
    }

    private SaveApiDefinitionRequest definition(ApiRequestConfigInput config) {
        return new SaveApiDefinitionRequest(WORKSPACE_CODE, "settings-regression", null, "settings regression",
                List.of("settings-regression"), config, List.of(), List.of(), List.of(), List.of());
    }
}
