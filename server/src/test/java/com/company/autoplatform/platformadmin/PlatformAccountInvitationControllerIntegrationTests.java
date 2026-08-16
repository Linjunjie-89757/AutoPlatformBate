package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PlatformAccountInvitationControllerIntegrationTests extends IntegrationTestSupport {

    private static final Pattern TOKEN_PATTERN = Pattern.compile("[?&]token=([A-Za-z0-9_-]+)");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PlatformAccountInvitationMapper invitationMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private PlatformNotificationSettingsService notificationSettingsService;

    @Test
    void invitationCreatesPendingAccountAndPublicActivationSetsPasswordOnce() throws Exception {
        String email = "invite-" + System.nanoTime() + "@demo.local";
        var superAdminAuthentication = authenticationForSuperAdmin();
        try {
            mockMvc.perform(post("/api/platform-admin/account-invitations")
                            .with(authentication(superAdminAuthentication))
                            .contentType("application/json")
                            .content("""
                                    {
                                      "displayName": "Invited User",
                                      "email": "%s",
                                      "department": "QA",
                                      "roleCode": "MEMBER"
                                    }
                                    """.formatted(email)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("邀请邮件已发送"))
                    .andExpect(jsonPath("$.data.email").value(email))
                    .andExpect(jsonPath("$.data.status").value("PENDING"));

            UserEntity pending = findUser(email);
            assertThat(pending).isNotNull();
            assertThat(pending.getPassword()).isNull();

            ArgumentCaptor<String> content = ArgumentCaptor.forClass(String.class);
            verify(notificationSettingsService).sendRequired(
                    eq("invite"), eq(email), eq("AutoTest 平台账号邀请"), content.capture());
            Matcher matcher = TOKEN_PATTERN.matcher(content.getValue());
            assertThat(matcher.find()).isTrue();
            String token = matcher.group(1);

            mockMvc.perform(get("/api/auth/account-activation/validate")
                            .with(anonymous())
                            .param("token", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.email").value(email));

            mockMvc.perform(post("/api/auth/account-activation/confirm")
                            .with(anonymous())
                            .contentType("application/json")
                            .content("""
                                    {"token":"%s","password":"Activated123"}
                                    """.formatted(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("账号已激活"));

            UserEntity activated = findUser(email);
            assertThat(passwordEncoder.matches("Activated123", activated.getPassword())).isTrue();

            mockMvc.perform(post("/api/auth/account-activation/confirm")
                            .with(anonymous())
                            .contentType("application/json")
                            .content("""
                                    {"token":"%s","password":"Activated456"}
                                    """.formatted(token)))
                    .andExpect(status().isBadRequest());
        } finally {
            UserEntity user = findUser(email);
            if (user != null) {
                invitationMapper.delete(new LambdaQueryWrapper<PlatformAccountInvitationEntity>()
                        .eq(PlatformAccountInvitationEntity::getUserId, user.getId()));
                userMapper.deleteById(user.getId());
            }
        }
    }

    private UserEntity findUser(String email) {
        return userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getEmail, email)
                .last("limit 1"));
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
