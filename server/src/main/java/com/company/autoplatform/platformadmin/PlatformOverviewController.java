package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform-admin")
public class PlatformOverviewController {

    private final PlatformOverviewService service;

    public PlatformOverviewController(PlatformOverviewService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public ApiResponse<PlatformOverviewResponse> getOverview() {
        return ApiResponse.ok(service.getOverview());
    }
}
