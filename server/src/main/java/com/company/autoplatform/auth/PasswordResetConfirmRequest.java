package com.company.autoplatform.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank(message = "重置令牌不能为空") String token,
        @NotBlank(message = "新密码不能为空")
        @Size(max = 128, message = "密码长度不能超过 128 个字符")
        String newPassword
) {
}
