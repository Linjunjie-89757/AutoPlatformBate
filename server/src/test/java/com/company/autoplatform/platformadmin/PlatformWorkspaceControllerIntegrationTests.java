package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PlatformWorkspaceControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Test
    void superAdminCanListAndToggleWorkspaceIncludingDisabledState() throws Exception {
        String code = "ws_platform_" + System.nanoTime();
        var superAdminAuthentication = authenticationForSuperAdmin();

        mockMvc.perform(post("/api/platform-admin/workspaces")
                        .with(authentication(superAdminAuthentication))
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "workspaceName": "platform workspace",
                                  "description": "platform management test",
                                  "status": 1
                                }
                                """.formatted(code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workspaceCode").value(code))
                .andExpect(jsonPath("$.data.status").value(1));

        mockMvc.perform(put("/api/platform-admin/workspaces/{workspaceCode}/status", code)
                        .with(authentication(superAdminAuthentication))
                        .contentType("application/json")
                        .content("{\"status\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        mockMvc.perform(get("/api/platform-admin/workspaces")
                        .with(authentication(superAdminAuthentication)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].workspaceCode", hasItem(code)))
                .andExpect(jsonPath("$.data[?(@.workspaceCode == '%s')].status".formatted(code)).value(hasItem(0)));

        mockMvc.perform(put("/api/platform-admin/workspaces/{workspaceCode}/status", code)
                        .with(authentication(superAdminAuthentication))
                        .contentType("application/json")
                        .content("{\"status\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(1));

        mockMvc.perform(delete("/api/platform-admin/workspaces/{workspaceCode}", code)
                        .with(authentication(superAdminAuthentication)))
                .andExpect(status().isOk());
    }

    @Test
    void platformAdminCannotAccessPlatformWorkspaceManagement() throws Exception {
        mockMvc.perform(get("/api/platform-admin/workspaces"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    private UsernamePasswordAuthenticationToken authenticationForSuperAdmin() {
        UserEntity superAdmin = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                .last("limit 1"));
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                superAdmin.getId(),
                superAdmin.getUsername(),
                superAdmin.getDisplayName(),
                superAdmin.getPassword(),
                PlatformRole.SUPER_ADMIN,
                superAdmin.getStatus()
        );
        return new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        );
    }
}
