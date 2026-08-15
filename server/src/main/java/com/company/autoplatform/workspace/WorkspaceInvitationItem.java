package com.company.autoplatform.workspace;

public record WorkspaceInvitationItem(
        Long id,
        String workspaceCode,
        String invitationCode,
        String expiresAt,
        Integer maxUses
) {
}
