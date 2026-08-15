package com.company.autoplatform.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PasswordResetControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordResetTokenMapper tokenMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private PasswordResetMailService mailService;

    @BeforeEach
    void resetMailService() {
        reset(mailService);
    }

    @Test
    void publicPasswordResetFlowUpdatesPasswordAndConsumesToken() throws Exception {
        UserEntity user = createUser("password_reset");
        try {
            mockMvc.perform(post("/api/auth/password-reset/request")
                            .with(anonymous())
                            .contentType("application/json")
                            .content(requestBody(user.getEmail())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.resendCooldownSeconds").value(60))
                    .andExpect(jsonPath("$.data.validMinutes").value(30));

            ArgumentCaptor<String> resetUrl = ArgumentCaptor.forClass(String.class);
            verify(mailService).sendResetLink(
                    eq(user.getEmail()),
                    eq(user.getDisplayName()),
                    resetUrl.capture(),
                    eq(30L)
            );
            String token = UriComponentsBuilder.fromUriString(resetUrl.getValue())
                    .build()
                    .getQueryParams()
                    .getFirst("token");
            assertThat(token).isNotBlank();

            mockMvc.perform(post("/api/auth/password-reset/confirm")
                            .with(anonymous())
                            .contentType("application/json")
                            .content(confirmBody(token, "NewPassword123")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.message").value("密码已重置"));

            UserEntity updated = userMapper.selectById(user.getId());
            assertThat(passwordEncoder.matches("NewPassword123", updated.getPassword())).isTrue();

            mockMvc.perform(post("/api/auth/password-reset/confirm")
                            .with(anonymous())
                            .contentType("application/json")
                            .content(confirmBody(token, "AnotherPassword456")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("重置链接无效或已过期，请重新申请"));
        } finally {
            deleteUserData(user.getId());
        }
    }

    @Test
    void unknownEmailKeepsGenericSuccessResponseWithoutSendingMail() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/request")
                        .with(anonymous())
                        .contentType("application/json")
                        .content(requestBody("missing-" + System.nanoTime() + "@demo.local")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("如果该邮箱已注册，密码重置邮件将很快送达"));

        verify(mailService, never()).sendResetLink(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong()
        );
    }

    @Test
    void resendWithinCooldownDoesNotIssueAnotherTokenOrEmail() throws Exception {
        UserEntity user = createUser("password_resend");
        try {
            mockMvc.perform(post("/api/auth/password-reset/request")
                            .with(anonymous())
                            .contentType("application/json")
                            .content(requestBody(user.getEmail())))
                    .andExpect(status().isOk());
            mockMvc.perform(post("/api/auth/password-reset/request")
                            .with(anonymous())
                            .contentType("application/json")
                            .content(requestBody(user.getEmail())))
                    .andExpect(status().isOk());

            verify(mailService).sendResetLink(
                    eq(user.getEmail()),
                    eq(user.getDisplayName()),
                    org.mockito.ArgumentMatchers.anyString(),
                    eq(30L)
            );
            Long tokenCount = tokenMapper.selectCount(new LambdaQueryWrapper<PasswordResetTokenEntity>()
                    .eq(PasswordResetTokenEntity::getUserId, user.getId()));
            assertThat(tokenCount).isEqualTo(1L);
        } finally {
            deleteUserData(user.getId());
        }
    }

    private UserEntity createUser(String prefix) {
        String suffix = String.valueOf(System.nanoTime());
        UserEntity user = new UserEntity();
        user.setUsername(prefix + "_" + suffix);
        user.setEmail(prefix + "_" + suffix + "@demo.local");
        user.setDisplayName("Password Reset User");
        user.setRoleCode(PlatformRole.MEMBER);
        user.setPassword(passwordEncoder.encode("OriginalPassword123"));
        user.setStatus(1);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return user;
    }

    private void deleteUserData(Long userId) {
        tokenMapper.delete(new LambdaQueryWrapper<PasswordResetTokenEntity>()
                .eq(PasswordResetTokenEntity::getUserId, userId));
        userMapper.deleteById(userId);
    }

    private String requestBody(String email) {
        return """
                {
                  "email": "%s"
                }
                """.formatted(email);
    }

    private String confirmBody(String token, String password) {
        return """
                {
                  "token": "%s",
                  "newPassword": "%s"
                }
                """.formatted(token, password);
    }
}
