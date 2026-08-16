package com.company.autoplatform.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AuthControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void loginSuccessKeepsCurrentUserResponseShape() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginRequest("zhangli", "123456")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Login successful"))
                .andExpect(jsonPath("$.data.id").value(11))
                .andExpect(jsonPath("$.data.username").value("zhangli"))
                .andExpect(jsonPath("$.data.displayName").value("Zhang Li"))
                .andExpect(jsonPath("$.data.roleCode").value("ADMIN"))
                .andExpect(jsonPath("$.data.workspaceCodes").isArray())
                .andExpect(jsonPath("$.data.workspaceCodes", hasItem(WORKSPACE_CODE)))
                .andExpect(jsonPath("$.data.workspaceAccesses").isArray())
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].canManage".formatted(WORKSPACE_CODE), hasItem(true)));
    }

    @Test
    void loginFailureKeepsUnauthorizedResponse() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("198.51.100.1");
                            return request;
                        })
                        .contentType("application/json")
                        .content(loginRequest("zhangli", "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void loginRejectsOversizedCredentialsBeforeAuthentication() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginRequest("a".repeat(129), "12345678")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("username 账号长度不能超过128个字符"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginRequest("zhangli", "a".repeat(129))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password 密码长度不能超过128个字符"));
    }

    @Test
    void pendingAccountGetsActivationGuidance() throws Exception {
        String username = "pending_auth_" + System.nanoTime();
        UserEntity user = createUser(username, null, 1);

        try {
            mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content(loginRequest(username, "12345678")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("账号尚未激活，请先通过邀请邮件设置密码"));
        } finally {
            userMapper.deleteById(user.getId());
        }
    }

    @Test
    void accountLockAlsoAppliesWhenSwitchingFromUsernameToEmail() throws Exception {
        String username = "locked_auth_" + System.nanoTime();
        UserEntity user = createUser(username, passwordEncoder.encode("valid-password-1"), 1);

        try {
            for (int attempt = 1; attempt < 5; attempt++) {
                mockMvc.perform(post("/api/auth/login")
                                .with(request -> {
                                    request.setRemoteAddr("198.51.100.10");
                                    return request;
                                })
                                .contentType("application/json")
                                .content(loginRequest(username, "wrong-password")))
                        .andExpect(status().isUnauthorized());
            }

            mockMvc.perform(post("/api/auth/login")
                            .with(request -> {
                                request.setRemoteAddr("198.51.100.10");
                                return request;
                            })
                            .contentType("application/json")
                            .content(loginRequest(username, "wrong-password")))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists("Retry-After"))
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("该账户已被临时锁定")));

            mockMvc.perform(post("/api/auth/login")
                            .with(request -> {
                                request.setRemoteAddr("198.51.100.11");
                                return request;
                            })
                            .contentType("application/json")
                            .content(loginRequest(user.getEmail(), "valid-password-1")))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("该账户已被临时锁定")));
        } finally {
            userMapper.deleteById(user.getId());
        }
    }

    @Test
    void repeatedFailuresFromOneAddressAreRateLimited() throws Exception {
        for (int attempt = 1; attempt < 20; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .with(request -> {
                                request.setRemoteAddr("198.51.100.20");
                                return request;
                            })
                            .contentType("application/json")
                            .content(loginRequest("unknown_" + attempt, "wrong-password")))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("198.51.100.20");
                            return request;
                        })
                        .contentType("application/json")
                        .content(loginRequest("unknown_20", "wrong-password")))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("操作过于频繁")));
    }

    @Test
    void currentUserKeepsResponseShapeForAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(11))
                .andExpect(jsonPath("$.data.username").value("zhangli"))
                .andExpect(jsonPath("$.data.displayName").value("Zhang Li"))
                .andExpect(jsonPath("$.data.roleCode").value("ADMIN"))
                .andExpect(jsonPath("$.data.workspaceCodes").isArray())
                .andExpect(jsonPath("$.data.workspaceCodes", hasItem(WORKSPACE_CODE)))
                .andExpect(jsonPath("$.data.workspaceAccesses").isArray())
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].canManage".formatted(WORKSPACE_CODE), hasItem(true)));
    }

    @Test
    void disabledUserCannotLogin() throws Exception {
        String username = "disabled_auth_" + System.nanoTime();
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(username + "@demo.local");
        user.setDisplayName("Disabled Auth");
        user.setRoleCode(PlatformRole.MEMBER);
        user.setPassword(passwordEncoder.encode("123456"));
        user.setStatus(0);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginRequest(username, "123456")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("账号已停用，请联系管理员"));
    }

    @Test
    void disablingUserInvalidatesExistingSession() throws Exception {
        String username = "session_disable_" + System.nanoTime();
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(username + "@demo.local");
        user.setDisplayName("Session Disable");
        user.setRoleCode(PlatformRole.MEMBER);
        user.setPassword(passwordEncoder.encode("123456"));
        user.setStatus(1);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);

        try {
            MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content(loginRequest(username, "123456")))
                    .andExpect(status().isOk())
                    .andReturn();
            MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);

            CurrentUserPrincipal platformAdmin = new CurrentUserPrincipal(
                    11L,
                    "zhangli",
                    "Zhang Li",
                    "{noop}123456",
                    PlatformRole.PLATFORM_ADMIN,
                    1
            );
            mockMvc.perform(put("/api/users/{userId}", user.getId())
                            .with(authentication(new UsernamePasswordAuthenticationToken(
                                    platformAdmin,
                                    platformAdmin.getPassword(),
                                    platformAdmin.getAuthorities()
                            )))
                            .contentType("application/json")
                            .content(updateUserRequest(username)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value(0));

            mockMvc.perform(get("/api/auth/me").session(session))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.message").value("登录状态已失效，请重新登录"));
        } finally {
            userMapper.deleteById(user.getId());
        }
    }

    @Test
    void superAdminBootstrapEnsuresActiveSuperAdmin() {
        UserEntity superAdmin = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                .last("limit 1"));

        org.assertj.core.api.Assertions.assertThat(superAdmin).isNotNull();
        org.assertj.core.api.Assertions.assertThat(superAdmin.getUsername()).isEqualTo("superadmin");
        org.assertj.core.api.Assertions.assertThat(superAdmin.getDisplayName()).isNotBlank();
        org.assertj.core.api.Assertions.assertThat(superAdmin.getStatus()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(superAdmin.getPassword()).isNotBlank();
    }

    private String loginRequest(String username, String password) {
        return """
                {
                  "username": "%s",
                  "password": "%s"
                }
                """.formatted(username, password);
    }

    private UserEntity createUser(String username, String encodedPassword, int status) {
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(username + "@demo.local");
        user.setDisplayName("Auth Test User");
        user.setRoleCode(PlatformRole.MEMBER);
        user.setPassword(encodedPassword);
        user.setStatus(status);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return user;
    }

    private String updateUserRequest(String username) {
        return """
                {
                  "email": "%s@demo.local",
                  "displayName": "Session Disable",
                  "roleCode": "MEMBER",
                  "status": 0,
                  "workspaceCodes": []
                }
                """.formatted(username);
    }
}
