package com.company.autoplatform.auth;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.platformadmin.PlatformAccountInvitationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/account-activation")
public class AccountActivationController {

    private final PlatformAccountInvitationService service;

    public AccountActivationController(PlatformAccountInvitationService service) {
        this.service = service;
    }

    @GetMapping("/validate")
    public ApiResponse<AccountActivationInfo> validate(@RequestParam String token) {
        return ApiResponse.ok(service.validateInvitation(token));
    }

    @PostMapping("/confirm")
    public ApiResponse<Void> confirm(@Valid @RequestBody ConfirmAccountActivationRequest request) {
        service.activate(request.token(), request.password());
        return ApiResponse.ok(null, "账号已激活");
    }
}
