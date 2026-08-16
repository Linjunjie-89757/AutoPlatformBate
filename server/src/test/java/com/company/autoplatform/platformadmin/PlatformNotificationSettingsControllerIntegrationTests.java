package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PlatformNotificationSettingsControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PlatformNotificationSettingsMapper settingsMapper;

    @AfterEach
    void cleanSettings() {
        settingsMapper.delete(new LambdaQueryWrapper<>());
    }

    @Test
    void superAdminCanPersistSettingsWithoutExposingSmtpPassword() throws Exception {
        var authentication = authenticationForSuperAdmin();
        mockMvc.perform(put("/api/platform-admin/notifications")
                        .with(authentication(authentication))
                        .contentType("application/json")
                        .content("""
                                {
                                  "host":"smtp.example.com",
                                  "port":465,
                                  "username":"notify@example.com",
                                  "password":"smtp-secret",
                                  "encryption":"SSL/TLS",
                                  "senderName":"AutoTest",
                                  "rules":[
                                    {"code":"invite","enabled":true},
                                    {"code":"welcome","enabled":true},
                                    {"code":"reset","enabled":true}
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.passwordConfigured").value(true))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        PlatformNotificationSettingsEntity stored = settingsMapper.selectOne(new LambdaQueryWrapper<>());
        assertThat(stored.getSmtpPasswordCipherText()).isNotEqualTo("smtp-secret");

        mockMvc.perform(get("/api/platform-admin/notifications")
                        .with(authentication(authentication)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.host").value("smtp.example.com"))
                .andExpect(jsonPath("$.data.passwordConfigured").value(true))
                .andExpect(jsonPath("$.data.rules.length()").value(8));
    }

    private UsernamePasswordAuthenticationToken authenticationForSuperAdmin() {
        UserEntity superAdmin = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                .last("limit 1"));
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                superAdmin.getId(), superAdmin.getUsername(), superAdmin.getDisplayName(),
                superAdmin.getPassword(), PlatformRole.SUPER_ADMIN, superAdmin.getStatus());
        return new UsernamePasswordAuthenticationToken(
                principal, principal.getPassword(), principal.getAuthorities());
    }
}
