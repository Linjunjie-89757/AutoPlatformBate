package com.company.autoplatform.auth;

public interface PasswordResetMailService {

    void sendResetLink(String recipient, String displayName, String resetUrl, long validMinutes);
}
