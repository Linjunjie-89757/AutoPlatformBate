package com.company.autoplatform.platformadmin;

import jakarta.validation.constraints.NotNull;

public record PlatformWorkspaceStatusRequest(
        @NotNull(message = "工作区状态不能为空")
        Integer status
) {
}
