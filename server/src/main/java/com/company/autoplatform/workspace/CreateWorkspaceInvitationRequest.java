package com.company.autoplatform.workspace;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateWorkspaceInvitationRequest(
        @Min(value = 1, message = "邀请码有效期不能少于 1 天")
        @Max(value = 30, message = "邀请码有效期不能超过 30 天")
        Integer validDays,
        @Min(value = 1, message = "邀请码使用次数不能少于 1 次")
        @Max(value = 100, message = "邀请码使用次数不能超过 100 次")
        Integer maxUses
) {
}
