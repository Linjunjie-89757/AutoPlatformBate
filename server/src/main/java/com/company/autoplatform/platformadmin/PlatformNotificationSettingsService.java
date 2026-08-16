package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.ServiceUnavailableException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import jakarta.mail.internet.InternetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;

import static com.company.autoplatform.platformadmin.PlatformNotificationModels.*;

@Service
public class PlatformNotificationSettingsService {

    private static final Logger log = LoggerFactory.getLogger(PlatformNotificationSettingsService.class);
    private static final TypeReference<List<RuleRequest>> RULE_LIST_TYPE = new TypeReference<>() { };
    private static final List<RuleItem> DEFAULT_RULES = List.of(
            new RuleItem("invite", "邀请成员", "管理员通过平台邀请新账号时发送确认邮件给被邀请人", true),
            new RuleItem("welcome", "账号激活", "新账号首次设置密码后，发送欢迎邮件及平台使用指引", true),
            new RuleItem("reset", "密码重置", "用户发起忘记密码请求时，发送重置链接邮件", true),
            new RuleItem("approve", "申请审批通知", "工作区加入申请被审批通过或拒绝时，通知申请人结果", true),
            new RuleItem("disable", "账号禁用告警", "账号被管理员手动禁用时，发送告警邮件给该账号", false),
            new RuleItem("login-fail", "连续登录失败", "同一账号 5 次密码错误后，发送安全告警给账号及超级管理员", true),
            new RuleItem("task-done", "自动化任务完成", "执行任务完成时（不论成功失败），通知任务创建人", false),
            new RuleItem("daily", "每日质量报告", "每天早 9 点，向所有工作区管理员发送前一日测试质量摘要", false)
    );

    private final PlatformNotificationSettingsMapper mapper;
    private final PlatformMailSecretCodec secretCodec;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public PlatformNotificationSettingsService(
            PlatformNotificationSettingsMapper mapper,
            PlatformMailSecretCodec secretCodec,
            UserMapper userMapper,
            ObjectMapper objectMapper
    ) {
        this.mapper = mapper;
        this.secretCodec = secretCodec;
        this.userMapper = userMapper;
        this.objectMapper = objectMapper;
    }

    public SettingsItem getSettings() {
        requireSuperAdmin();
        PlatformNotificationSettingsEntity entity = findSettings();
        if (entity == null) {
            return new SettingsItem("", 465, "", false, "SSL/TLS", "AutoTest 平台通知", DEFAULT_RULES);
        }
        return toItem(entity);
    }

    @Transactional
    public SettingsItem saveSettings(SaveSettingsRequest request) {
        requireSuperAdmin();
        PlatformNotificationSettingsEntity entity = findSettings();
        boolean creating = entity == null;
        if (creating) {
            entity = new PlatformNotificationSettingsEntity();
            entity.setCreatedAt(LocalDateTime.now());
        }
        String passwordCipherText = resolvePasswordCipherText(request.password(), entity.getSmtpPasswordCipherText());
        entity.setSmtpHost(request.host().trim());
        entity.setSmtpPort(request.port());
        entity.setSmtpUsername(request.username().trim());
        entity.setSmtpPasswordCipherText(passwordCipherText);
        entity.setEncryption(normalizeEncryption(request.encryption()));
        entity.setSenderName(request.senderName().trim());
        entity.setRulesJson(writeRules(request.rules()));
        entity.setUpdatedAt(LocalDateTime.now());
        if (creating) mapper.insert(entity); else mapper.updateById(entity);
        return toItem(entity);
    }

    public void sendTestMail(TestMailRequest request) {
        requireSuperAdmin();
        UserEntity currentUser = userMapper.selectById(CurrentUserContext.get());
        if (currentUser == null || currentUser.getEmail() == null || currentUser.getEmail().isBlank()) {
            throw new BadRequestException("当前账号未配置有效邮箱，无法发送测试邮件");
        }
        PlatformNotificationSettingsEntity existing = findSettings();
        String password = request.password() == null || request.password().isBlank()
                ? decryptExistingPassword(existing)
                : request.password();
        MailConnection connection = new MailConnection(
                request.host().trim(), request.port(), request.username().trim(), password,
                normalizeEncryption(request.encryption()), request.senderName().trim()
        );
        send(connection, currentUser.getEmail(), "AutoTest SMTP 测试邮件", "SMTP 邮件服务连接成功，此配置可用于平台邀请和密码重置邮件。");
    }

    public void sendRequired(String ruleCode, String recipient, String subject, String content) {
        PlatformNotificationSettingsEntity entity = requireConfiguredSettings();
        if (!isRuleEnabled(entity, ruleCode)) {
            throw new ServiceUnavailableException("当前通知规则已关闭，请在平台管理的消息与通知中开启");
        }
        send(toConnection(entity), recipient, subject, content);
    }

    public boolean sendOptional(String ruleCode, String recipient, String subject, String content) {
        try {
            PlatformNotificationSettingsEntity entity = findSettings();
            if (entity == null || !isRuleEnabled(entity, ruleCode)) return false;
            send(toConnection(entity), recipient, subject, content);
            return true;
        } catch (RuntimeException exception) {
            log.warn("Optional platform mail delivery failed for rule {}: {}", ruleCode, exception.getMessage());
            return false;
        }
    }

    public boolean isRuleEnabled(String ruleCode) {
        PlatformNotificationSettingsEntity entity = findSettings();
        return entity != null && isRuleEnabled(entity, ruleCode);
    }

    private void send(MailConnection connection, String recipient, String subject, String content) {
        if (recipient == null || recipient.isBlank()) {
            throw new BadRequestException("收件邮箱不能为空");
        }
        if (connection.password() == null || connection.password().isBlank()) {
            throw new ServiceUnavailableException("SMTP 授权密码尚未配置");
        }
        try {
            JavaMailSenderImpl sender = createSender(connection);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(new InternetAddress(connection.username(), connection.senderName(), StandardCharsets.UTF_8.name()));
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(content, false);
            sender.send(message);
        } catch (Exception exception) {
            log.warn("Platform email delivery failed: {}", exception.getMessage());
            throw new ServiceUnavailableException("邮件发送失败，请检查 SMTP 配置后重试");
        }
    }

    private JavaMailSenderImpl createSender(MailConnection connection) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(connection.host());
        sender.setPort(connection.port());
        sender.setUsername(connection.username());
        sender.setPassword(connection.password());
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.connectiontimeout", "10000");
        properties.put("mail.smtp.timeout", "10000");
        properties.put("mail.smtp.writetimeout", "10000");
        if ("SSL_TLS".equals(connection.encryption())) {
            properties.put("mail.smtp.ssl.enable", "true");
        } else if ("STARTTLS".equals(connection.encryption())) {
            properties.put("mail.smtp.starttls.enable", "true");
            properties.put("mail.smtp.starttls.required", "true");
        }
        return sender;
    }

    private PlatformNotificationSettingsEntity requireConfiguredSettings() {
        PlatformNotificationSettingsEntity entity = findSettings();
        if (entity == null) {
            throw new ServiceUnavailableException("平台 SMTP 邮件服务尚未配置，请联系超级管理员");
        }
        return entity;
    }

    private PlatformNotificationSettingsEntity findSettings() {
        return mapper.selectOne(new LambdaQueryWrapper<PlatformNotificationSettingsEntity>()
                .orderByAsc(PlatformNotificationSettingsEntity::getId)
                .last("limit 1"));
    }

    private SettingsItem toItem(PlatformNotificationSettingsEntity entity) {
        return new SettingsItem(
                entity.getSmtpHost(), entity.getSmtpPort(), entity.getSmtpUsername(),
                entity.getSmtpPasswordCipherText() != null && !entity.getSmtpPasswordCipherText().isBlank(),
                encryptionLabel(entity.getEncryption()), entity.getSenderName(), readRules(entity.getRulesJson())
        );
    }

    private MailConnection toConnection(PlatformNotificationSettingsEntity entity) {
        return new MailConnection(
                entity.getSmtpHost(), entity.getSmtpPort(), entity.getSmtpUsername(),
                secretCodec.decrypt(entity.getSmtpPasswordCipherText()), entity.getEncryption(), entity.getSenderName()
        );
    }

    private String resolvePasswordCipherText(String newPassword, String existingCipherText) {
        if (newPassword != null && !newPassword.isBlank()) return secretCodec.encrypt(newPassword);
        if (existingCipherText != null && !existingCipherText.isBlank()) return existingCipherText;
        throw new BadRequestException("请输入 SMTP 授权密码");
    }

    private String decryptExistingPassword(PlatformNotificationSettingsEntity existing) {
        if (existing == null || existing.getSmtpPasswordCipherText() == null) {
            throw new BadRequestException("请输入 SMTP 授权密码");
        }
        return secretCodec.decrypt(existing.getSmtpPasswordCipherText());
    }

    private boolean isRuleEnabled(PlatformNotificationSettingsEntity entity, String ruleCode) {
        return readRules(entity.getRulesJson()).stream()
                .anyMatch(rule -> rule.code().equals(ruleCode) && rule.enabled());
    }

    private List<RuleItem> readRules(String json) {
        Map<String, Boolean> enabledByCode = new LinkedHashMap<>();
        try {
            if (json != null && !json.isBlank()) {
                objectMapper.readValue(json, RULE_LIST_TYPE)
                        .forEach(rule -> enabledByCode.put(rule.code(), rule.enabled()));
            }
        } catch (Exception exception) {
            log.warn("Unable to read platform notification rules: {}", exception.getMessage());
        }
        return DEFAULT_RULES.stream()
                .map(rule -> new RuleItem(rule.code(), rule.label(), rule.description(),
                        enabledByCode.getOrDefault(rule.code(), rule.enabled())))
                .toList();
    }

    private String writeRules(List<RuleRequest> requests) {
        Map<String, Boolean> enabledByCode = new LinkedHashMap<>();
        for (RuleRequest request : requests) {
            enabledByCode.put(request.code(), request.enabled());
        }
        List<RuleRequest> normalized = DEFAULT_RULES.stream()
                .map(rule -> new RuleRequest(rule.code(), enabledByCode.getOrDefault(rule.code(), rule.enabled())))
                .toList();
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception exception) {
            throw new BadRequestException("通知规则保存失败");
        }
    }

    private String normalizeEncryption(String value) {
        String normalized = value.trim().toUpperCase(Locale.ROOT).replace("/", "_").replace("-", "_");
        return switch (normalized) {
            case "SSL_TLS", "SSL" -> "SSL_TLS";
            case "STARTTLS", "START_TLS" -> "STARTTLS";
            case "NONE", "无加密" -> "NONE";
            default -> throw new BadRequestException("不支持的 SMTP 加密方式");
        };
    }

    private String encryptionLabel(String value) {
        return switch (value) {
            case "SSL_TLS" -> "SSL/TLS";
            case "STARTTLS" -> "STARTTLS";
            default -> "无加密";
        };
    }

    private void requireSuperAdmin() {
        if (!PlatformRole.isSuperAdmin(CurrentUserContext.require().platformRole())) {
            throw new org.springframework.security.access.AccessDeniedException("仅超级管理员可管理平台通知配置");
        }
    }

    private record MailConnection(
            String host,
            Integer port,
            String username,
            String password,
            String encryption,
            String senderName
    ) {
    }
}
