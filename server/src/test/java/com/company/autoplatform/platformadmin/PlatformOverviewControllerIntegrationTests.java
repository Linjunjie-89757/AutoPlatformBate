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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PlatformOverviewControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Test
    void superAdminCanReadPlatformOverview() throws Exception {
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
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        );

        mockMvc.perform(get("/api/platform-admin/overview").with(authentication(authentication)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.workspaceTotal").isNumber())
                .andExpect(jsonPath("$.data.registeredUserTotal").isNumber())
                .andExpect(jsonPath("$.data.todayActiveUserTotal").isNumber())
                .andExpect(jsonPath("$.data.pendingApprovalTotal").isNumber())
                .andExpect(jsonPath("$.data.workspaces").isArray())
                .andExpect(jsonPath("$.data.recentOperations").isArray());
    }

    @Test
    void platformAdminCannotReadSuperAdminOverview() throws Exception {
        mockMvc.perform(get("/api/platform-admin/overview"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }
}
