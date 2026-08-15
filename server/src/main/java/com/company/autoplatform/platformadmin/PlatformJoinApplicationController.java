package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform-admin/join-applications")
public class PlatformJoinApplicationController {

    private final PlatformJoinApplicationService service;

    public PlatformJoinApplicationController(PlatformJoinApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PlatformJoinApplicationItem>> listApplications(
            @RequestParam(required = false) String status
    ) {
        return ApiResponse.ok(service.listApplications(status));
    }

    @PostMapping("/{applicationId}/approve")
    public ApiResponse<PlatformJoinApplicationItem> approveApplication(@PathVariable Long applicationId) {
        return ApiResponse.ok(service.approveApplication(applicationId), "申请已批准");
    }

    @PostMapping("/{applicationId}/reject")
    public ApiResponse<PlatformJoinApplicationItem> rejectApplication(
            @PathVariable Long applicationId,
            @Valid @RequestBody RejectPlatformJoinApplicationRequest request
    ) {
        return ApiResponse.ok(service.rejectApplication(applicationId, request.reason()), "申请已拒绝");
    }
}
