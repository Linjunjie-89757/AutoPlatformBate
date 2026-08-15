package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(
        String workspaceCode,
        @NotBlank(message = "空间名称不能为空")
        @Size(max = 128, message = "空间名称不能超过128个字符")
        String workspaceName,
        @Size(max = 500, message = "空间描述不能超过500个字符")
        String description,
        String workspaceType,
        Long ownerUserId,
        Integer status,
        @Size(max = 64, message = "所属行业不能超过64个字符")
        String industry,
        String initializationMode
) {
}
