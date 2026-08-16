package com.company.autoplatform.auth;

import com.company.autoplatform.platformadmin.PlatformNotificationSettingsService;
import org.springframework.stereotype.Service;

@Service
public class SmtpPasswordResetMailService implements PasswordResetMailService {

    private final PlatformNotificationSettingsService notificationSettingsService;

    public SmtpPasswordResetMailService(PlatformNotificationSettingsService notificationSettingsService) {
        this.notificationSettingsService = notificationSettingsService;
    }

    @Override
    public void sendResetLink(String recipient, String displayName, String resetUrl, long validMinutes) {
        notificationSettingsService.sendRequired(
                "reset",
                recipient,
                "AutoTest 密码重置",
                """
                您好，%s：

                我们收到了你的密码重置申请。请在 %d 分钟内打开以下链接设置新密码：

                %s

                如果这不是你的操作，请忽略此邮件。请勿将该链接转发给其他人。
                """.formatted(displayName == null || displayName.isBlank() ? "AutoTest 用户" : displayName, validMinutes, resetUrl)
        );
    }
}
