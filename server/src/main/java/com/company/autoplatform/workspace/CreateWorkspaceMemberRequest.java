package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateWorkspaceMemberRequest(
        @NotNull(message = "用户不能为空") Long userId,
        String memberType,
        List<Long> roleIds,
        String roleCode
) {
}
