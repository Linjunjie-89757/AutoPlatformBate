package com.company.autoplatform.auth;

public record PasswordResetRequestResponse(
        long resendCooldownSeconds,
        long validMinutes
) {
}
