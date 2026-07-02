package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ApiExecutionSuiteRunHistoryIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApiAutomationService apiAutomationService;

    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ok", exchange -> writeResponse(exchange, 200, "application/json", """
                {"ok":true,"source":"suite-history"}
                """));
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void runHistoryKeepsRecentResultsAndProvidesDetail() throws Exception {
        String unique = "suite-history-" + System.nanoTime();
        ApiDefinitionCaseDetail apiCase = createCase(unique);
        int suiteId = createSuite(unique);
        addItem(suiteId, apiCase.id());

        for (int index = 0; index < 11; index++) {
            mockMvc.perform(post("/api/automation/api/execution-suites/{id}/run", suiteId)
                            .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                {"workspaceCode":"risk-ops","runOn":"SERVER"}
                                    """))
                    .andExpect(status().isOk());
        }

        String response = mockMvc.perform(get("/api/automation/api/execution-suites/{id}/run-history", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(11))
                .andExpect(jsonPath("$.data.items", hasSize(10)))
                .andExpect(jsonPath("$.data.items[0].result").value("SUCCESS"))
                .andExpect(jsonPath("$.data.items[0].totalCount").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Integer historyId = com.jayway.jsonpath.JsonPath.read(response, "$.data.items[0].id");
        assertThat(historyId).isNotNull();

        mockMvc.perform(get("/api/automation/api/execution-suites/run-history/{historyId}", historyId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(historyId))
                .andExpect(jsonPath("$.data.result").value("SUCCESS"))
                .andExpect(jsonPath("$.data.stepResults", hasSize(1)))
                .andExpect(jsonPath("$.data.stepResults[0].response.statusCode").value(200));
    }

    private int createSuite(String unique) throws Exception {
        String response = mockMvc.perform(post("/api/automation/api/execution-suites")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"risk-ops","name":"%s-suite"}
                                """.formatted(unique)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.data.id");
    }

    private void addItem(int suiteId, Long caseId) throws Exception {
        mockMvc.perform(post("/api/automation/api/execution-suites/{id}/items", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"itemType":"API_CASE","itemId":%d,"enabled":true}
                                """.formatted(caseId)))
                .andExpect(status().isOk());
    }

    private ApiDefinitionCaseDetail createCase(String unique) {
        restoreCurrentUser();
        ApiDefinitionDetail definition = apiAutomationService.createDefinition(WORKSPACE_CODE, new SaveApiDefinitionRequest(
                WORKSPACE_CODE,
                unique + "-definition",
                null,
                "suite history definition",
                List.of("suite-history"),
                requestConfig(),
                List.of(new ApiAssertionInput("STATUS_CODE", null, "EQUALS", "200")),
                List.of(),
                List.of(),
                List.of()
        ));
        return apiAutomationService.createCase(WORKSPACE_CODE, new SaveApiDefinitionCaseRequest(
                WORKSPACE_CODE,
                definition.id(),
                unique + "-case",
                "suite history case",
                List.of("suite-history"),
                requestConfig(),
                List.of(new ApiAssertionInput("STATUS_CODE", null, "EQUALS", "200")),
                List.of(),
                List.of()
        ));
    }

    private ApiRequestConfigInput requestConfig() {
        return new ApiRequestConfigInput(
                "GET",
                baseUrl + "/ok",
                5000,
                List.of(),
                List.of(),
                List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null),
                new ApiAuthConfigInput("NONE", null, null)
        );
    }

    private void restoreCurrentUser() {
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

    private void writeResponse(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().put("Content-Type", List.of(contentType));
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
