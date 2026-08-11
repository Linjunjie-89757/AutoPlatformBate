package com.company.autoplatform.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class UserControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserService userService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listUsersKeepsResponseShapeAndHidesSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].username", hasItem("zhangli")))
                .andExpect(jsonPath("$.data[*].username", hasItem("chennan")))
                .andExpect(jsonPath("$.data[*].roleCode", hasItem("ADMIN")))
                .andExpect(jsonPath("$.data[*].workspaceCodes").isArray())
                .andExpect(jsonPath("$.data[*].username", not(hasItem("superadmin"))));
    }

    @Test
    void createAndUpdateUserKeepResponseShape() throws Exception {
        String username = "user_it_" + System.nanoTime();
        MvcResult createResult = mockMvc.perform(post("/api/users")
                        .contentType("application/json")
                        .content(createUserRequest(username, username + "@demo.local", "User IT", "MEMBER", WORKSPACE_CODE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.email").value(username + "@demo.local"))
                .andExpect(jsonPath("$.data.displayName").value("User IT"))
                .andExpect(jsonPath("$.data.roleCode").value("MEMBER"))
                .andExpect(jsonPath("$.data.status").value(1))
                .andExpect(jsonPath("$.data.workspaceCodes", hasItem(WORKSPACE_CODE)))
                .andReturn();

        long userId = data(createResult).path("id").asLong();
        mockMvc.perform(put("/api/users/{userId}", userId)
                        .contentType("application/json")
                        .content(updateUserRequest(username + "-updated@demo.local", "User Updated", "MEMBER", 1, "payments-core")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(userId))
                .andExpect(jsonPath("$.data.email").value(username + "-updated@demo.local"))
                .andExpect(jsonPath("$.data.displayName").value("User Updated"))
                .andExpect(jsonPath("$.data.workspaceCodes", hasItem("payments-core")))
                .andExpect(jsonPath("$.data.workspaceCodes", not(hasItem(WORKSPACE_CODE))));
    }

    @Test
    void updatingUserKeepsWorkspaceRoleAndDisabledMemberVisible() throws Exception {
        String workspaceCode = "user_member_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(workspaceCode)))
                .andExpect(status().isOk());
        String username = "workspace_role_" + System.nanoTime();
        MvcResult createResult = mockMvc.perform(post("/api/users")
                        .contentType("application/json")
                        .content(createUserRequest(username, username + "@demo.local", "Workspace Role", "MEMBER", workspaceCode)))
                .andExpect(status().isOk())
                .andReturn();
        long userId = data(createResult).path("id").asLong();

        MvcResult membersResult = mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", workspaceCode))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode member = java.util.stream.StreamSupport.stream(data(membersResult).spliterator(), false)
                .filter(item -> item.path("userId").asLong() == userId)
                .findFirst()
                .orElseThrow();

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/members/{memberId}", workspaceCode, member.path("id").asLong())
                        .contentType("application/json")
                        .content("{\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/users/{userId}", userId)
                        .contentType("application/json")
                        .content(updateUserRequest(username + "@demo.local", "Workspace Role", "MEMBER", 0, workspaceCode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(0));

        MvcResult updatedMembersResult = mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", workspaceCode))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode updatedMember = java.util.stream.StreamSupport.stream(data(updatedMembersResult).spliterator(), false)
                .filter(item -> item.path("userId").asLong() == userId)
                .findFirst()
                .orElseThrow();
        org.assertj.core.api.Assertions.assertThat(updatedMember.path("roleCode").asText()).isEqualTo("ADMIN");
        org.assertj.core.api.Assertions.assertThat(updatedMember.path("status").asInt()).isZero();

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", workspaceCode, member.path("id").asLong()))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", workspaceCode))
                .andExpect(status().isOk());
    }

    @Test
    void batchCreateAndResetPasswordKeepBehavior() throws Exception {
        String okUsername = "batch_ok_" + System.nanoTime();
        String duplicateUsername = "batch_dup_" + System.nanoTime();
        mockMvc.perform(post("/api/users")
                        .contentType("application/json")
                        .content(createUserRequest(duplicateUsername, duplicateUsername + "@demo.local", "Duplicate", "MEMBER", WORKSPACE_CODE)))
                .andExpect(status().isOk());

        MvcResult batchResult = mockMvc.perform(post("/api/users/batch")
                        .contentType("application/json")
                        .content(batchCreateRequest(okUsername, duplicateUsername)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.successCount").value(1))
                .andExpect(jsonPath("$.data.failureCount").value(1))
                .andExpect(jsonPath("$.data.results[0].success").value(true))
                .andExpect(jsonPath("$.data.results[0].user.username").value(okUsername))
                .andExpect(jsonPath("$.data.results[1].success").value(false))
                .andReturn();

        long createdUserId = data(batchResult).path("results").get(0).path("user").path("id").asLong();
        mockMvc.perform(post("/api/users/{userId}/reset-password", createdUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value(createdUserId))
                .andExpect(jsonPath("$.data.username").value(okUsername))
                .andExpect(jsonPath("$.data.defaultPassword").value(UserService.DEFAULT_PASSWORD));
    }

    @Test
    void nonPlatformAdminCannotWriteUsers() throws Exception {
        String username = "deny_user_" + System.nanoTime();
        setMemberUser();

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post("/api/users")
                        .contentType("application/json")
                        .content(createUserRequest(username, username + "@demo.local", "Denied", "MEMBER", WORKSPACE_CODE)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(put("/api/users/{userId}", 12L)
                        .contentType("application/json")
                        .content(updateUserRequest("chennan-denied@demo.local", "Denied", "MEMBER", 1, WORKSPACE_CODE)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post("/api/users/{userId}/reset-password", 12L))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void superAdminCannotBeMaintainedThroughUserManagement() throws Exception {
        long superAdminUserId = requireSuperAdminUserId();
        mockMvc.perform(put("/api/users/{userId}", superAdminUserId)
                        .contentType("application/json")
                        .content(updateUserRequest("superadmin@local", "Super Admin", "MEMBER", 1, WORKSPACE_CODE)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post("/api/users/{userId}/reset-password", superAdminUserId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void roleAndWorkspaceGrantPublicMethodsKeepBehavior() throws Exception {
        String workspaceCode = "user_ws_" + System.nanoTime();
        setSuperAdminUser();
        userService.updateUser(11L, new UpdateUserRequest(
                "zhangli@demo.local",
                "Zhang Li",
                "ADMIN",
                1,
                java.util.List.of()
        ));

        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(workspaceCode)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", workspaceCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].id", hasItem(-11)))
                .andExpect(jsonPath("$.data[*].userId", hasItem(11)))
                .andExpect(jsonPath("$.data[*].roleCode", hasItem("ADMIN")));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", workspaceCode))
                .andExpect(status().isOk());

        setPlatformAdminUser();
        org.assertj.core.api.Assertions.assertThat(userService.isPlatformAdmin(11L)).isTrue();
        org.assertj.core.api.Assertions.assertThat(userService.isSuperAdmin(requireSuperAdminUserId())).isTrue();
        org.assertj.core.api.Assertions.assertThat(userService.listPlatformAdminUsers())
                .extracting(UserEntity::getId)
                .contains(11L);

        setSuperAdminUser();
        userService.removeAdminFromWorkspace(11L, WORKSPACE_CODE);
        org.assertj.core.api.Assertions.assertThat(userService.isPlatformAdmin(11L)).isFalse();

        setSuperAdminUser();
        userService.updateUser(11L, new UpdateUserRequest(
                "zhangli@demo.local",
                "Zhang Li",
                "ADMIN",
                1,
                java.util.List.of()
        ));
        org.assertj.core.api.Assertions.assertThat(userService.isPlatformAdmin(11L)).isTrue();
    }

    private String workspaceRequest(String workspaceCode) {
        return """
                {
                  "workspaceCode": "%s",
                  "workspaceName": "User Regression Workspace",
                  "description": "user integration test",
                  "workspaceType": "PROJECT",
                  "status": 1
                }
                """.formatted(workspaceCode);
    }

    private Long requireSuperAdminUserId() {
        UserEntity superAdmin = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                .last("limit 1"));
        org.assertj.core.api.Assertions.assertThat(superAdmin).isNotNull();
        return superAdmin.getId();
    }

    private String createUserRequest(String username, String email, String displayName, String roleCode, String workspaceCode) {
        return """
                {
                  "username": "%s",
                  "email": "%s",
                  "displayName": "%s",
                  "roleCode": "%s",
                  "workspaceCodes": ["%s"]
                }
                """.formatted(username, email, displayName, roleCode, workspaceCode);
    }

    private String updateUserRequest(String email, String displayName, String roleCode, int status, String workspaceCode) {
        return """
                {
                  "email": "%s",
                  "displayName": "%s",
                  "roleCode": "%s",
                  "status": %d,
                  "workspaceCodes": ["%s"]
                }
                """.formatted(email, displayName, roleCode, status, workspaceCode);
    }

    private String batchCreateRequest(String okUsername, String duplicateUsername) {
        return """
                {
                  "users": [
                    {
                      "username": "%s",
                      "email": "%s@demo.local",
                      "displayName": "Batch OK",
                      "roleCode": "MEMBER",
                      "workspaceCodes": ["%s"]
                    },
                    {
                      "username": "%s",
                      "email": "%s-second@demo.local",
                      "displayName": "Batch Duplicate",
                      "roleCode": "MEMBER",
                      "workspaceCodes": ["%s"]
                    }
                  ]
                }
                """.formatted(okUsername, okUsername, WORKSPACE_CODE, duplicateUsername, duplicateUsername, WORKSPACE_CODE);
    }

    private JsonNode data(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private void setMemberUser() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                12L,
                "chennan",
                "Chen Nan",
                "{noop}123456",
                PlatformRole.MEMBER,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities())
        );
    }

    private void setPlatformAdminUser() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities())
        );
    }

    private void setSuperAdminUser() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                requireSuperAdminUserId(),
                "superadmin",
                "Super Admin",
                "{noop}superadmin123",
                PlatformRole.SUPER_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities())
        );
    }
}
