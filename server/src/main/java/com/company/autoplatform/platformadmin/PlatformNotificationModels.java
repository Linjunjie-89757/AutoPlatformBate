package com.company.autoplatform.platformadmin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public final class PlatformNotificationModels {

    private PlatformNotificationModels() {
    }

    public record RuleItem(
            String code,
            String label,
            String description,
            boolean enabled
    ) {
    }

    public record RuleRequest(
            @NotBlank String code,
            boolean enabled
    ) {
    }

    public record SettingsItem(
            String host,
            Integer port,
            String username,
            boolean passwordConfigured,
            String encryption,
            String senderName,
            List<RuleItem> rules
    ) {
    }

    public record SaveSettingsRequest(
            @NotBlank(message = "SMTP 服务器不能为空") String host,
            @Min(value = 1, message = "SMTP 端口无效")
            @Max(value = 65535, message = "SMTP 端口无效") Integer port,
            @NotBlank(message = "发件人账号不能为空") @Email(message = "发件人账号格式无效") String username,
            String password,
            @NotBlank(message = "加密方式不能为空") String encryption,
            @NotBlank(message = "发件人显示名不能为空") String senderName,
            @NotEmpty(message = "通知规则不能为空") List<@Valid RuleRequest> rules
    ) {
    }

    public record TestMailRequest(
            @NotBlank(message = "SMTP 服务器不能为空") String host,
            @Min(value = 1, message = "SMTP 端口无效")
            @Max(value = 65535, message = "SMTP 端口无效") Integer port,
            @NotBlank(message = "发件人账号不能为空") @Email(message = "发件人账号格式无效") String username,
            String password,
            @NotBlank(message = "加密方式不能为空") String encryption,
            @NotBlank(message = "发件人显示名不能为空") String senderName
    ) {
    }
}
