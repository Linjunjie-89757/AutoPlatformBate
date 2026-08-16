package com.company.autoplatform.auth;

import jakarta.validation.constraints.NotBlank;

public record ConfirmAccountActivationRequest(
        @NotBlank(message = "激活令牌不能为空") String token,
        @NotBlank(message = "密码不能为空") String password
) {
}
