package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.company.autoplatform.platformadmin.PlatformNotificationModels.*;

@RestController
@RequestMapping("/api/platform-admin/notifications")
public class PlatformNotificationSettingsController {

    private final PlatformNotificationSettingsService service;

    public PlatformNotificationSettingsController(PlatformNotificationSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<SettingsItem> getSettings() {
        return ApiResponse.ok(service.getSettings());
    }

    @PutMapping
    public ApiResponse<SettingsItem> saveSettings(@Valid @RequestBody SaveSettingsRequest request) {
        return ApiResponse.ok(service.saveSettings(request), "通知配置已保存");
    }

    @PostMapping("/test-email")
    public ApiResponse<Void> sendTestMail(@Valid @RequestBody TestMailRequest request) {
        service.sendTestMail(request);
        return ApiResponse.ok(null, "测试邮件已发送");
    }
}
