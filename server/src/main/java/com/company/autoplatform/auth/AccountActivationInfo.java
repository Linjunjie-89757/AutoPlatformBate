package com.company.autoplatform.auth;

import java.time.LocalDateTime;

public record AccountActivationInfo(
        String email,
        String displayName,
        LocalDateTime expiresAt
) {
}
