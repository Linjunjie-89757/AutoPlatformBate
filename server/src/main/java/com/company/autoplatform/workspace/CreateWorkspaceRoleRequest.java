package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRoleRequest(
        @NotBlank(message = "角色名称不能为空")
        @Size(max = 128, message = "角色名称不能超过128个字符")
        String name,
        @Size(max = 500, message = "角色描述不能超过500个字符")
        String description
) {
}
