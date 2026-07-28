package com.company.autoplatform.audit;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.workspace.WorkspaceScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class OperationAuditControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OperationAuditLogMapper auditLogMapper;

    @BeforeEach
    void clearAuditLogs() {
        auditLogMapper.delete(null);
    }

    @Test
    void recordsSuccessfulAndFailedBusinessWritesButExcludesRunnerTraffic() throws Exception {
        UsernamePasswordAuthenticationToken authentication = platformAdminAuthentication();
        String taskName = "audit-task-" + System.nanoTime();
        String body = """
                {
                  "workspaceCode": "%s",
                  "taskName": "%s",
                  "engineType": "API",
                  "status": "READY",
                  "summary": "operation audit integration test"
                }
                """.formatted(WORKSPACE_CODE, taskName);

        mockMvc.perform(post("/api/tasks")
                        .with(authentication(authentication))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit-logs")
                        .with(authentication(authentication))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("category", "execution")
                        .param("result", "success")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.items[0].operatorUsername").value("audit-admin"))
                .andExpect(jsonPath("$.data.items[0].category").value("EXECUTION"))
                .andExpect(jsonPath("$.data.items[0].actionName").value("创建任务"))
                .andExpect(jsonPath("$.data.items[0].target").value("/api/tasks"))
                .andExpect(jsonPath("$.data.items[0].requestMethod").value("POST"))
                .andExpect(jsonPath("$.data.items[0].result").value("SUCCESS"))
                .andExpect(jsonPath("$.data.items[0].statusCode").value(200));

        mockMvc.perform(put("/api/tasks/{id}", 999_999_999L)
                        .with(authentication(authentication))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/audit-logs")
                        .with(authentication(authentication))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("result", "failed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].target").value("/api/tasks/999999999"))
                .andExpect(jsonPath("$.data.items[0].result").value("FAILED"))
                .andExpect(jsonPath("$.data.items[0].statusCode").value(404));

        mockMvc.perform(post("/api/public/local-runner/heartbeat")
                        .with(authentication(authentication))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/audit-logs")
                        .with(authentication(authentication))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2));
    }

    private UsernamePasswordAuthenticationToken platformAdminAuthentication() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "audit-admin",
                "Audit Admin",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        return new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities());
    }
}
