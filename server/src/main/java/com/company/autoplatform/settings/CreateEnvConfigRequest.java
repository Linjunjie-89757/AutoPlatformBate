package com.company.autoplatform.settings;

import jakarta.validation.constraints.NotBlank;

public record CreateEnvConfigRequest(
        String workspaceCode,
        String envType,
        @NotBlank(message = "环境名称不能为空") String envName,
        String baseUrl,
        String configJson
) {
}
