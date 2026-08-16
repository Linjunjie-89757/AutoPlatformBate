package com.company.autoplatform.platformadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreatePlatformAccountInvitationRequest(
        @NotBlank(message = "姓名不能为空") String displayName,
        @NotBlank(message = "邮箱不能为空") @Email(message = "邮箱格式无效") String email,
        String department,
        String roleCode
) {
}
