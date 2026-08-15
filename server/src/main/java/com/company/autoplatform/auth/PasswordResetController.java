package com.company.autoplatform.auth;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    public PasswordResetController(PasswordResetService passwordResetService) {
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/request")
    public ApiResponse<PasswordResetRequestResponse> requestReset(
            @Valid @RequestBody PasswordResetRequest request
    ) {
        return ApiResponse.ok(
                passwordResetService.requestReset(request.email()),
                "如果该邮箱已注册，密码重置邮件将很快送达"
        );
    }

    @PostMapping("/confirm")
    public ApiResponse<Void> confirmReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.confirmReset(request.token(), request.newPassword());
        return ApiResponse.ok(null, "密码已重置");
    }
}
