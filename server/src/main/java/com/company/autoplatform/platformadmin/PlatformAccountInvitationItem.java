package com.company.autoplatform.platformadmin;

import java.time.LocalDateTime;

public record PlatformAccountInvitationItem(
        Long id,
        Long userId,
        String email,
        String displayName,
        String roleCode,
        String status,
        LocalDateTime expiresAt
) {
}
