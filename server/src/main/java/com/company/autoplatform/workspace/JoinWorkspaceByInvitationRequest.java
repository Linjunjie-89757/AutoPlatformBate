package com.company.autoplatform.workspace;

import jakarta.validation.constraints.NotBlank;

public record JoinWorkspaceByInvitationRequest(
        @NotBlank(message = "邀请码不能为空") String invitationCode
) {
}
