package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform-admin/account-invitations")
public class PlatformAccountInvitationController {

    private final PlatformAccountInvitationService service;

    public PlatformAccountInvitationController(PlatformAccountInvitationService service) {
        this.service = service;
    }

    @PostMapping
    public ApiResponse<PlatformAccountInvitationItem> createInvitation(
            @Valid @RequestBody CreatePlatformAccountInvitationRequest request
    ) {
        PlatformAccountInvitationItem item = service.createInvitation(request);
        return ApiResponse.ok(item, "FAILED".equals(item.status())
                ? "账号已创建，但邀请邮件发送失败，请在邀请记录中重发"
                : "邀请邮件已发送");
    }

    @org.springframework.web.bind.annotation.GetMapping
    public ApiResponse<List<PlatformAccountInvitationItem>> listInvitations() {
        return ApiResponse.ok(service.listInvitations());
    }

    @PostMapping("/{id}/resend")
    public ApiResponse<PlatformAccountInvitationItem> resendInvitation(@org.springframework.web.bind.annotation.PathVariable Long id) {
        PlatformAccountInvitationItem item = service.resendInvitation(id);
        return ApiResponse.ok(item, "FAILED".equals(item.status())
                ? "邀请记录已保留，但邮件发送失败，请检查 SMTP 配置后重试"
                : "邀请邮件已重新发送");
    }

    @PostMapping("/{id}/revoke")
    public ApiResponse<PlatformAccountInvitationItem> revokeInvitation(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return ApiResponse.ok(service.revokeInvitation(id), "邀请已撤销");
    }
}
