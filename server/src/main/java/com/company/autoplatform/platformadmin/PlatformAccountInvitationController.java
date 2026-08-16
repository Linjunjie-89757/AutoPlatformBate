package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
        return ApiResponse.ok(service.createInvitation(request), "邀请邮件已发送");
    }
}
