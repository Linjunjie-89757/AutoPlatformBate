package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BatchWorkspaceMemberRequest(
        @NotEmpty(message = "成员不能为空") List<Long> userIds,
        String memberType,
        List<Long> roleIds,
        String roleCode
) {
}
