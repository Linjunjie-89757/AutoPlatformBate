package com.company.autoplatform.auth;

import com.company.autoplatform.common.ServiceUnavailableException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class SmtpPasswordResetMailService implements PasswordResetMailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String mailFrom;

    public SmtpPasswordResetMailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.password-reset.mail-from:no-reply@autotest.local}") String mailFrom
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.mailFrom = mailFrom;
    }

    @Override
    public void sendResetLink(String recipient, String displayName, String resetUrl, long validMinutes) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new ServiceUnavailableException("密码重置邮件服务尚未配置，请联系管理员");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(recipient);
        message.setSubject("AutoTest 密码重置");
        message.setText("""
                您好，%s：

                我们收到了你的密码重置申请。请在 %d 分钟内打开以下链接设置新密码：

                %s

                如果这不是你的操作，请忽略此邮件。请勿将该链接转发给其他人。
                """.formatted(displayName == null || displayName.isBlank() ? "AutoTest 用户" : displayName, validMinutes, resetUrl));
        try {
            mailSender.send(message);
        } catch (MailException exception) {
            throw new ServiceUnavailableException("密码重置邮件发送失败，请稍后重试");
        }
    }
}
