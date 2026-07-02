package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ApiExecutionSuiteCrudIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void suiteCrudPersistsConfigurationFields() throws Exception {
        String unique = "suite-crud-" + System.nanoTime();
        int moduleId = createModule(unique + "-module");
        int suiteId = createSuite(moduleId, unique + "-suite");

        mockMvc.perform(get("/api/automation/api/execution-suites")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("moduleId", String.valueOf(moduleId))
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[*].id", hasItem(suiteId)));

        mockMvc.perform(get("/api/automation/api/execution-suites/{id}", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(suiteId))
                .andExpect(jsonPath("$.data.name").value(unique + "-suite"))
                .andExpect(jsonPath("$.data.moduleId").value(moduleId))
                .andExpect(jsonPath("$.data.priority").value("P0"))
                .andExpect(jsonPath("$.data.runMode").value("SERIAL"))
                .andExpect(jsonPath("$.data.notifyEnabled").value(true))
                .andExpect(jsonPath("$.data.globalTimeoutMs").value(300000));

        mockMvc.perform(put("/api/automation/api/execution-suites/{id}", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceCode":"risk-ops",
                                  "moduleId":%d,
                                  "name":"%s-updated",
                                  "priority":"P2",
                                  "status":"INACTIVE",
                                  "description":"updated description",
                                  "runMode":"PARALLEL",
                                  "runOn":"SERVER",
                                  "notifyEnabled":false,
                                  "continueOnFailure":true,
                                  "globalTimeoutMs":120000,
                                  "stepFailureRetryCount":2,
                                  "defaultStepWaitMs":1000,
                                  "scheduleEnabled":true,
                                  "cronExpression":"0 0 2 * * ?",
                                  "branchName":"release/test",
                                  "triggerSource":"manual",
                                  "branchNote":"branch note"
                                }
                                """.formatted(moduleId, unique)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(unique + "-updated"))
                .andExpect(jsonPath("$.data.priority").value("P2"))
                .andExpect(jsonPath("$.data.status").value("INACTIVE"))
                .andExpect(jsonPath("$.data.runMode").value("PARALLEL"))
                .andExpect(jsonPath("$.data.runOn").value("SERVER"))
                .andExpect(jsonPath("$.data.notifyEnabled").value(false))
                .andExpect(jsonPath("$.data.continueOnFailure").value(true))
                .andExpect(jsonPath("$.data.globalTimeoutMs").value(120000))
                .andExpect(jsonPath("$.data.stepFailureRetryCount").value(2))
                .andExpect(jsonPath("$.data.defaultStepWaitMs").value(1000))
                .andExpect(jsonPath("$.data.scheduleEnabled").value(true))
                .andExpect(jsonPath("$.data.cronExpression").value("0 0 2 * * ?"))
                .andExpect(jsonPath("$.data.branchName").value("release/test"));

        mockMvc.perform(put("/api/automation/api/execution-suites/{id}", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceCode":"risk-ops",
                                  "moduleId":%d,
                                  "name":"%s-invalid-cron",
                                  "scheduleEnabled":true,
                                  "cronExpression":"not-a-cron"
                                }
                                """.formatted(moduleId, unique)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/automation/api/execution-suites")
                        .header(WorkspaceScope.HEADER, WorkspaceScope.ALL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"ALL","name":"%s-all"}
                                """.formatted(unique)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(delete("/api/automation/api/execution-suites/{id}", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/automation/api/execution-suites")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(suiteId))));
    }

    private int createModule(String name) throws Exception {
        String response = mockMvc.perform(post("/api/automation/api/execution-suite-modules")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"risk-ops","name":"%s"}
                                """.formatted(name)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.data.id");
    }

    private int createSuite(int moduleId, String name) throws Exception {
        String response = mockMvc.perform(post("/api/automation/api/execution-suites")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceCode":"risk-ops",
                                  "moduleId":%d,
                                  "name":"%s",
                                  "priority":"P0",
                                  "description":"crud description"
                                }
                                """.formatted(moduleId, name)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value(name))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.data.id");
    }
}
