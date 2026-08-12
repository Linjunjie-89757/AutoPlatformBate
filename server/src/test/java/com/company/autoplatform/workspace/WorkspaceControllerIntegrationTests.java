package com.company.autoplatform.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.settings.CreateEnvConfigRequest;
import com.company.autoplatform.settings.EnvConfigItem;
import com.company.autoplatform.settings.SettingsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class WorkspaceControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SettingsService settingsService;

    @Autowired
    private WorkspaceService workspaceService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listAndSwitchableKeepResponseShape() throws Exception {
        mockMvc.perform(get("/api/workspaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].code", hasItem(WORKSPACE_CODE)))
                .andExpect(jsonPath("$.data[*].name").isArray())
                .andExpect(jsonPath("$.data[*].allScope", not(hasItem(true))));

        mockMvc.perform(get("/api/workspaces/switchable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].code").value(WorkspaceScope.ALL))
                .andExpect(jsonPath("$.data[0].allScope").value(true))
                .andExpect(jsonPath("$.data[*].code", hasItem(WORKSPACE_CODE)));
    }

    @Test
    void createUpdateDeleteWorkspaceKeepsResponseShape() throws Exception {
        String code = "ws_it_" + System.nanoTime();

        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "created", "PROJECT", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.code").value(code))
                .andExpect(jsonPath("$.data.name").value("created"))
                .andExpect(jsonPath("$.data.workspaceType").value("PROJECT"))
                .andExpect(jsonPath("$.data.status").value(1))
                .andExpect(jsonPath("$.data.allScope").value(false));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}", code)
                        .contentType("application/json")
                        .content(workspaceRequest(code, "updated", "TEAM", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.code").value(code))
                .andExpect(jsonPath("$.data.name").value("updated"))
                .andExpect(jsonPath("$.data.workspaceType").value("TEAM"));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/workspaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].code", not(hasItem(code))));
    }

    @Test
    void deleteWorkspaceWithDependenciesFails() throws Exception {
        String code = "ws_dep_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "dependency", "PROJECT", 1)))
                .andExpect(status().isOk());

        setPlatformAdminUser();
        EnvConfigItem env = settingsService.createEnv(code, new CreateEnvConfigRequest(
                null,
                "DEV",
                code + "-env",
                "https://" + code + ".example.com",
                "{}"
        ));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        setPlatformAdminUser();
        settingsService.deleteEnv(env.id(), code);
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void nonPlatformAdminCannotCreateUpdateOrDeleteWorkspace() throws Exception {
        String code = "ws_deny_" + System.nanoTime();
        setMemberUser();

        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "denied", "PROJECT", 1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(workspaceRequest(WORKSPACE_CODE, "denied-update", "PROJECT", 1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", WORKSPACE_CODE))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void memberCrudKeepsResponseShape() throws Exception {
        String code = "ws_mem_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "members", "PROJECT", 1)))
                .andExpect(status().isOk());

        MvcResult createResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members", code)
                        .contentType("application/json")
                        .content(memberRequest(12L, "MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value(12))
                .andExpect(jsonPath("$.data.username").value("chennan"))
                .andExpect(jsonPath("$.data.roleCode").value("MEMBER"))
                .andExpect(jsonPath("$.data.memberType").value("MEMBER"))
                .andExpect(jsonPath("$.data.roles[0].roleCode").value("SYSTEM_TEST_ENGINEER"))
                .andReturn();
        long memberId = data(createResult).path("id").asLong();

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].userId", hasItem(11)))
                .andExpect(jsonPath("$.data[*].id", hasItem(-11)))
                .andExpect(jsonPath("$.data[*].userId", hasItem(12)));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/members/{memberId}", code, memberId)
                        .contentType("application/json")
                        .content(updateMemberRequest("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(memberId))
                .andExpect(jsonPath("$.data.roleCode").value("ADMIN"))
                .andExpect(jsonPath("$.data.memberType").value("ADMIN"))
                .andExpect(jsonPath("$.data.roles[0].roleCode").value("SYSTEM_TEST_LEAD"));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, memberId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].userId", not(hasItem(12))));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void batchMembersAndWorkspaceAccessScopeKeepBehavior() throws Exception {
        String code = "ws_scope_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "scope", "PROJECT", 1)))
                .andExpect(status().isOk());

        MvcResult batchResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members/batch", code)
                        .contentType("application/json")
                        .content(batchMemberRequest("MEMBER", 12L, 13L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].userId", hasItem(12)))
                .andExpect(jsonPath("$.data[*].userId", hasItem(13)))
                .andReturn();

        mockMvc.perform(get("/api/workspaces")
                        .with(authentication(authenticationFor(12L, "chennan", "Chen Nan", PlatformRole.MEMBER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].code", hasItem(code)));

        mockMvc.perform(get("/api/workspaces/switchable")
                        .with(authentication(authenticationFor(12L, "chennan", "Chen Nan", PlatformRole.MEMBER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].code", hasItem(code)))
                .andExpect(jsonPath("$.data[*].code", not(hasItem(WorkspaceScope.ALL))));

        mockMvc.perform(get("/api/auth/me")
                        .with(authentication(authenticationFor(12L, "chennan", "Chen Nan", PlatformRole.MEMBER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].memberType".formatted(code), hasItem("MEMBER")))
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].canManage".formatted(code), hasItem(false)));

        setMemberUser(12L, "chennan", "Chen Nan");
        assertThat(workspaceService.listReadableWorkspaceCodes()).contains(code);
        assertThat(workspaceService.listReadableWorkspaceIds())
                .contains(workspaceService.requireWorkspace(code).getId());
        assertThat(workspaceService.requireReadableWorkspace(code).getWorkspaceCode()).isEqualTo(code);
        assertThat(workspaceService.requireWritableWorkspace(code).getWorkspaceCode()).isEqualTo(code);

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", code)
                        .with(authentication(authenticationFor(14L, "zhaofeng", "Zhao Feng", PlatformRole.MEMBER))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
        setMemberUser(14L, "zhaofeng", "Zhao Feng");
        assertThatThrownBy(() -> workspaceService.requireReadableWorkspace(code))
                .isInstanceOf(RuntimeException.class);

        setPlatformAdminUser();
        for (JsonNode item : data(batchResult)) {
            mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, item.path("id").asLong()))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void ownerMemberProtectionKeepsBehavior() throws Exception {
        String code = "ws_owner_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "owner", "PROJECT", 1, 12L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ownerUserId").value(12));

        MvcResult membersResult = mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].userId", hasItem(12)))
                .andReturn();
        long ownerMemberId = memberIdForUser(membersResult, 12L);

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/members/{memberId}", code, ownerMemberId)
                        .contentType("application/json")
                        .content(updateMemberRequest("MEMBER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, ownerMemberId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}", code)
                        .contentType("application/json")
                        .content(workspaceRequest(code, "owner", "PROJECT", 1, 11L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ownerUserId").value(11));

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, ownerMemberId))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void createAndListWorkspaceRolePersistsRoleDefinition() throws Exception {
        String roleName = "角色集成测试-" + System.nanoTime();

        MvcResult createResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/roles", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(roleRequest(roleName, "用于验证工作区角色创建接口")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value(roleName))
                .andExpect(jsonPath("$.data.roleCode").value(org.hamcrest.Matchers.startsWith("CUSTOM_")))
                .andExpect(jsonPath("$.data.memberCount").value(0))
                .andExpect(jsonPath("$.data.permissionCount").value(0))
                .andExpect(jsonPath("$.data.system").value(false))
                .andReturn();

        long roleId = data(createResult).path("id").asLong();
        mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %s)].name".formatted(roleId), hasItem(roleName)))
                .andExpect(jsonPath("$.data[?(@.roleCode == 'SYSTEM_TEST_LEAD')].name", hasItem("项目负责人")))
                .andExpect(jsonPath("$.data[?(@.roleCode == 'SYSTEM_TEST_LEAD')].permissionCount", hasItem(34)))
                .andExpect(jsonPath("$.data[?(@.roleCode == 'SYSTEM_TEST_ENGINEER')].permissionCount", hasItem(22)))
                .andExpect(jsonPath("$.data[?(@.roleCode == 'SYSTEM_DEVELOPER')].permissionCount", hasItem(8)))
                .andExpect(jsonPath("$.data[?(@.roleCode == 'SYSTEM_READ_ONLY')].permissionCount", hasItem(4)));

        mockMvc.perform(post("/api/workspaces/{workspaceCode}/roles", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(roleRequest(roleName, "重复角色")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void deleteDefaultWorkspaceRoleRemovesMemberBindingsAndDoesNotRecreateRole() throws Exception {
        String code = "ws_role_delete_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "role delete", "PROJECT", 1)))
                .andExpect(status().isOk());

        MvcResult rolesResult = mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles", code))
                .andExpect(status().isOk())
                .andReturn();
        long roleId = 0L;
        for (JsonNode role : data(rolesResult)) {
            if (WorkspaceRoleDomainService.SYSTEM_TEST_ENGINEER.equals(role.path("roleCode").asText())) {
                roleId = role.path("id").asLong();
                break;
            }
        }
        assertThat(roleId).isPositive();

        MvcResult memberResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members", code)
                        .contentType("application/json")
                        .content(memberRequestWithRoles(12L, "MEMBER", roleId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0].id").value(roleId))
                .andReturn();

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/roles/{roleId}", code, roleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].roleCode", not(hasItem(WorkspaceRoleDomainService.SYSTEM_TEST_ENGINEER))));

        MvcResult membersResult = mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", code))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode deletedRoleMember = null;
        for (JsonNode member : data(membersResult)) {
            if (member.path("userId").asLong() == 12L) {
                deletedRoleMember = member;
                break;
            }
        }
        assertThat(deletedRoleMember).isNotNull();
        assertThat(deletedRoleMember.path("roles").isEmpty()).isTrue();

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, data(memberResult).path("id").asLong()))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void nonPlatformAdminCannotCreateWorkspaceRole() throws Exception {
        setMemberUser();
        mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles", "retail-onboarding"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post("/api/workspaces/{workspaceCode}/roles", "retail-onboarding")
                        .contentType("application/json")
                        .content(roleRequest("无权创建角色-" + System.nanoTime(), "权限验证")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void ordinaryMemberCanReadRuntimeConfigButCannotManageWorkspaceResources() throws Exception {
        setMemberUser();
        String readableWorkspaceCode = "retail-onboarding";

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members", readableWorkspaceCode))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/settings/envs")
                        .header(WorkspaceScope.HEADER, readableWorkspaceCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(post("/api/settings/envs")
                        .header(WorkspaceScope.HEADER, readableWorkspaceCode)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/audit-logs")
                        .header(WorkspaceScope.HEADER, readableWorkspaceCode))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void workspaceIdentityAndBusinessRolesAreManagedSeparately() throws Exception {
        String code = "ws_rbac_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "rbac", "PROJECT", 1)))
                .andExpect(status().isOk());

        MvcResult roleResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/roles", code)
                        .contentType("application/json")
                        .content(roleRequest("接口测试工程师-" + System.nanoTime(), "业务角色绑定测试")))
                .andExpect(status().isOk())
                .andReturn();
        long roleId = data(roleResult).path("id").asLong();

        MvcResult createResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members", code)
                        .contentType("application/json")
                        .content(memberRequestWithRoles(12L, "MEMBER", roleId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberType").value("MEMBER"))
                .andExpect(jsonPath("$.data.roles[0].id").value(roleId))
                .andReturn();
        long memberId = data(createResult).path("id").asLong();

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/members/{memberId}", code, memberId)
                        .contentType("application/json")
                        .content(updateMemberRequestWithRoles("MEMBER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/members/{memberId}", code, memberId)
                        .contentType("application/json")
                        .content(updateMemberRequestWithRoles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberType").value("ADMIN"))
                .andExpect(jsonPath("$.data.roles").isEmpty());

        setMemberUser(12L, "chennan", "Chen Nan");
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].memberType".formatted(code), hasItem("ADMIN")))
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].canManage".formatted(code), hasItem(true)));

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/members/lookup", code)
                        .param("account", "liping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(13))
                .andExpect(jsonPath("$.data.alreadyMember").value(false));

        MvcResult managedMember = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members", code)
                        .contentType("application/json")
                        .content(memberRequest(13L, "MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(13))
                .andReturn();

        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, data(managedMember).path("id").asLong()))
                .andExpect(status().isOk());

        setPlatformAdminUser();
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, memberId))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    @Test
    void workspaceRolePermissionsArePersistedAndEnforced() throws Exception {
        String code = "ws_permission_" + System.nanoTime();
        mockMvc.perform(post("/api/workspaces")
                        .contentType("application/json")
                        .content(workspaceRequest(code, "permission", "PROJECT", 1)))
                .andExpect(status().isOk());

        MvcResult roleResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/roles", code)
                        .contentType("application/json")
                        .content(roleRequest("只读用例角色-" + System.nanoTime(), "仅允许查看用例")))
                .andExpect(status().isOk())
                .andReturn();
        long roleId = data(roleResult).path("id").asLong();

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/permissions/catalog", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == 'cases')].permissions[*].code", hasItem("cases.view")))
                .andExpect(jsonPath("$.data[?(@.id == 'config')].permissions[*].code", hasItem("config.manage")));

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/roles/{roleId}/permissions", code, roleId)
                        .contentType("application/json")
                        .content("""
                                {
                                  "permissionCodes": ["cases.view"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleId").value(roleId))
                .andExpect(jsonPath("$.data.permissionCodes[0]").value("cases.view"));

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles/{roleId}/permissions", code, roleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissionCodes[0]").value("cases.view"));

        mockMvc.perform(get("/api/workspaces/{workspaceCode}/roles", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %s)].permissionCount".formatted(roleId), hasItem(1)));

        MvcResult memberResult = mockMvc.perform(post("/api/workspaces/{workspaceCode}/members", code)
                        .contentType("application/json")
                        .content(memberRequestWithRoles(12L, "MEMBER", roleId)))
                .andExpect(status().isOk())
                .andReturn();

        setMemberUser(12L, "chennan", "Chen Nan");
        Authentication memberAuthentication = authenticationFor(
                12L,
                "chennan",
                "Chen Nan",
                PlatformRole.MEMBER
        );
        mockMvc.perform(get("/api/auth/me")
                        .with(authentication(memberAuthentication)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workspaceAccesses[?(@.workspaceCode == '%s')].permissionCodes[*]".formatted(code), hasItem("cases.view")));

        mockMvc.perform(get("/api/cases")
                        .with(authentication(memberAuthentication))
                        .header(WorkspaceScope.HEADER, code))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/cases")
                        .with(authentication(memberAuthentication))
                        .header(WorkspaceScope.HEADER, code)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .with(authentication(memberAuthentication))
                        .header(WorkspaceScope.HEADER, code))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        setPlatformAdminUser();
        mockMvc.perform(put("/api/workspaces/{workspaceCode}/roles/{roleId}/permissions", code, roleId)
                        .contentType("application/json")
                        .content("""
                                {
                                  "permissionCodes": ["cases.view", "config.manage"]
                                }
                                """))
                .andExpect(status().isOk());

        MvcResult envResult = mockMvc.perform(post("/api/settings/envs")
                        .with(authentication(memberAuthentication))
                        .header(WorkspaceScope.HEADER, code)
                        .contentType("application/json")
                        .content("""
                                {
                                  "envType": "DEV",
                                  "envName": "角色配置权限环境",
                                  "baseUrl": "https://permission.example.com",
                                  "configJson": "{}"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(put("/api/workspaces/{workspaceCode}/roles/{roleId}/permissions", code, roleId)
                        .contentType("application/json")
                        .content("""
                                {
                                  "permissionCodes": ["unknown.permission"]
                                }
                                """))
                .andExpect(status().isBadRequest());

        setPlatformAdminUser();
        settingsService.deleteEnv(data(envResult).path("id").asLong(), code);
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}/members/{memberId}", code, data(memberResult).path("id").asLong()))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/workspaces/{workspaceCode}", code))
                .andExpect(status().isOk());
    }

    private String workspaceRequest(String code, String name, String type, int status) {
        return """
                {
                  "workspaceCode": "%s",
                  "workspaceName": "%s",
                  "description": "workspace integration test",
                  "workspaceType": "%s",
                  "status": %d
                }
                """.formatted(code, name, type, status);
    }

    private String workspaceRequest(String code, String name, String type, int status, Long ownerUserId) {
        return """
                {
                  "workspaceCode": "%s",
                  "workspaceName": "%s",
                  "description": "workspace integration test",
                  "workspaceType": "%s",
                  "ownerUserId": %d,
                  "status": %d
                }
                """.formatted(code, name, type, ownerUserId, status);
    }

    private String memberRequest(Long userId, String roleCode) {
        return """
                {
                  "userId": %d,
                  "roleCode": "%s"
                }
                """.formatted(userId, roleCode);
    }

    private String roleRequest(String name, String description) {
        return """
                {
                  "name": "%s",
                  "description": "%s"
                }
                """.formatted(name, description);
    }

    private String memberRequestWithRoles(Long userId, String memberType, Long... roleIds) {
        String ids = java.util.Arrays.stream(roleIds)
                .map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(", "));
        return """
                {
                  "userId": %d,
                  "memberType": "%s",
                  "roleIds": [%s]
                }
                """.formatted(userId, memberType, ids);
    }

    private String batchMemberRequest(String roleCode, Long... userIds) {
        String ids = java.util.Arrays.stream(userIds)
                .map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(", "));
        return """
                {
                  "userIds": [%s],
                  "roleCode": "%s"
                }
                """.formatted(ids, roleCode);
    }

    private String updateMemberRequest(String roleCode) {
        return """
                {
                  "roleCode": "%s"
                }
                """.formatted(roleCode);
    }

    private String updateMemberRequestWithRoles(String memberType, Long... roleIds) {
        String ids = java.util.Arrays.stream(roleIds)
                .map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(", "));
        return """
                {
                  "memberType": "%s",
                  "roleIds": [%s]
                }
                """.formatted(memberType, ids);
    }

    private JsonNode data(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private long memberIdForUser(MvcResult result, Long userId) throws Exception {
        for (JsonNode item : data(result)) {
            if (item.path("userId").asLong() == userId) {
                return item.path("id").asLong();
            }
        }
        throw new AssertionError("Member not found for userId " + userId);
    }

    private void setMemberUser() {
        setMemberUser(13L, "liping", "Li Ping");
    }

    private void setMemberUser(Long userId, String username, String displayName) {
        SecurityContextHolder.getContext().setAuthentication(authenticationFor(userId, username, displayName, PlatformRole.MEMBER));
    }

    private Authentication authenticationFor(Long userId, String username, String displayName, String platformRole) {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                userId,
                username,
                displayName,
                "{noop}123456",
                platformRole,
                1
        );
        return new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities());
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
}
