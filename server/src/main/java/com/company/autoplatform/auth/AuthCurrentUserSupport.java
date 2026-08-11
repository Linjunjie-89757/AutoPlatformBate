package com.company.autoplatform.auth;

import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Component;

@Component
public class AuthCurrentUserSupport {

    private final WorkspaceService workspaceService;

    public AuthCurrentUserSupport(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    public CurrentUserResponse currentUser() {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        String roleCode = PlatformRole.MEMBER;
        if (workspaceService.isSuperAdmin()) {
            roleCode = "SUPER_ADMIN";
        } else if (workspaceService.isPlatformAdmin()) {
            roleCode = "ADMIN";
        }
        return new CurrentUserResponse(
                currentUser.userId(),
                currentUser.username(),
                currentUser.displayName(),
                roleCode,
                workspaceService.listReadableWorkspaceCodes(),
                workspaceService.listCurrentWorkspaceAccesses()
        );
    }
}
