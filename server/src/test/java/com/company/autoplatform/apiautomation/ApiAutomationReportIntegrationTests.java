package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ApiAutomationReportIntegrationTests extends IntegrationTestSupport {

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
                {"ok":true,"source":"report-v1"}
                """));
        server.createContext("/fail", exchange -> writeResponse(exchange, 500, "application/json", """
                {"ok":false,"source":"report-v2","message":"intentional failure"}
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
    void reportTabListsCaseAndSuiteRunsAndProvidesStepDetails() throws Exception {
        String unique = "report-v1-" + System.nanoTime();
        ApiDefinitionCaseDetail apiCase = createCase(unique);

        apiAutomationService.runCase(apiCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));

        int suiteId = createSuite(unique);
        addItem(suiteId, apiCase.id());
        mockMvc.perform(post("/api/automation/api/execution-suites/{id}/run", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"risk-ops"}
                                """))
                .andExpect(status().isOk());

        String listResponse = mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.data.items[?(@.objectType == 'API_CASE')]", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.items[?(@.objectType == 'SUITE')]", hasSize(greaterThanOrEqualTo(1))))
                .andReturn()
                .getResponse()
                .getContentAsString();

        List<String> caseReportKeys = com.jayway.jsonpath.JsonPath.read(listResponse, "$.data.items[?(@.objectType == 'API_CASE')].reportKey");
        List<String> suiteReportKeys = com.jayway.jsonpath.JsonPath.read(listResponse, "$.data.items[?(@.objectType == 'SUITE')].reportKey");
        String caseReportKey = caseReportKeys.getFirst();
        String suiteReportKey = suiteReportKeys.getFirst();

        mockMvc.perform(get("/api/automation/api/reports/{reportKey}", caseReportKey)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.objectType").value("API_CASE"))
                .andExpect(jsonPath("$.data.stepResults", hasSize(1)))
                .andExpect(jsonPath("$.data.stepResults[0].response.statusCode").value(200));

        mockMvc.perform(get("/api/automation/api/reports/{reportKey}", suiteReportKey)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.objectType").value("SUITE"))
                .andExpect(jsonPath("$.data.itemSnapshots", hasSize(1)))
                .andExpect(jsonPath("$.data.stepResults", hasSize(1)))
                .andExpect(jsonPath("$.data.stepResults[0].response.statusCode").value(200));
    }

    @Test
    void reportFiltersAndFailureAnalysisFollowSameQuery() throws Exception {
        String unique = "report-v2-" + System.nanoTime();
        ApiDefinitionCaseDetail successCase = createCase(unique + "-success", "/ok");
        ApiDefinitionCaseDetail failedCase = createCase(unique + "-failed", "/fail");

        apiAutomationService.runCase(successCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));
        apiAutomationService.runCase(failedCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));

        String createdFrom = LocalDateTime.now().minusDays(1).toString();
        String createdTo = LocalDateTime.now().plusDays(1).toString();
        mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("objectType", "API_CASE")
                        .param("result", "FAILED")
                        .param("createdFrom", createdFrom)
                        .param("createdTo", createdTo)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.items[0].objectType").value("API_CASE"))
                .andExpect(jsonPath("$.data.items[0].objectName").value(org.hamcrest.Matchers.containsString(unique)))
                .andExpect(jsonPath("$.data.items[0].result").value(org.hamcrest.Matchers.containsString("FAILED")));

        mockMvc.perform(get("/api/automation/api/reports/analysis")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("objectType", "API_CASE")
                        .param("createdFrom", createdFrom)
                        .param("createdTo", createdTo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalCount").value(greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.data.failedCount").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.failureRate").value(org.hamcrest.Matchers.greaterThan(0.0)))
                .andExpect(jsonPath("$.data.failureReasons[0].count").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.topFailedObjects[0].label").value(org.hamcrest.Matchers.containsString(unique)))
                .andExpect(jsonPath("$.data.recentFailures[0].objectName").value(org.hamcrest.Matchers.containsString(unique)));
    }

    @Test
    void reportStatisticsExposeTrendAndDistributionForSameQuery() throws Exception {
        String unique = "report-v3-" + System.nanoTime();
        ApiDefinitionCaseDetail successCase = createCase(unique + "-success", "/ok");
        ApiDefinitionCaseDetail failedCase = createCase(unique + "-failed", "/fail");

        apiAutomationService.runCase(successCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));
        apiAutomationService.runCase(failedCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));

        int suiteId = createSuite(unique);
        addItem(suiteId, successCase.id());
        mockMvc.perform(post("/api/automation/api/execution-suites/{id}/run", suiteId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"risk-ops"}
                                """))
                .andExpect(status().isOk());

        String createdFrom = LocalDateTime.now().minusDays(1).toString();
        String createdTo = LocalDateTime.now().plusDays(1).toString();
        mockMvc.perform(get("/api/automation/api/reports/statistics")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("createdFrom", createdFrom)
                        .param("createdTo", createdTo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.trendPoints", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.trendPoints[0].totalCount").value(greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.data.trendPoints[0].failedCount").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.trendPoints[0].failureRate").value(org.hamcrest.Matchers.greaterThan(0.0)))
                .andExpect(jsonPath("$.data.resultDistribution[?(@.key == 'FAILED')]", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.objectTypeDistribution[?(@.key == 'API_CASE')]", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.objectTypeDistribution[?(@.key == 'SUITE')]", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.slowestRuns", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.slowestRuns[0].objectName").value(org.hamcrest.Matchers.containsString(unique)));
    }

    @Test
    void reportManagementExportsRerunsAndArchivesReports() throws Exception {
        String unique = "report-v4-" + System.nanoTime();
        ApiDefinitionCaseDetail apiCase = createCase(unique);

        apiAutomationService.runCase(apiCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));

        String listResponse = mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].archived").value(false))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String reportKey = com.jayway.jsonpath.JsonPath.read(listResponse, "$.data.items[0].reportKey");

        mockMvc.perform(get("/api/automation/api/reports/export")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("reportKey,objectType")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(unique)));

        mockMvc.perform(get("/api/automation/api/reports-export")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("archived", "false"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(unique)));

        mockMvc.perform(post("/api/automation/api/reports/{reportKey}/rerun", reportKey)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workspaceCode":"risk-ops","triggerSource":"REPORT_RERUN"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reportId").isNumber())
                .andExpect(jsonPath("$.data.result").value("SUCCESS"));

        mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(greaterThanOrEqualTo(2)));

        mockMvc.perform(patch("/api/automation/api/reports/{reportKey}/archive", reportKey)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(true));

        mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("archived", "false")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));

        mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("archived", "true")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].archived").value(true));
    }

    @Test
    void reportListPaginatesAcrossMultipleCaseRuns() throws Exception {
        String unique = "report-page-" + System.nanoTime();
        ApiDefinitionCaseDetail apiCase = createCase(unique);
        apiAutomationService.runCase(apiCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));
        apiAutomationService.runCase(apiCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));
        apiAutomationService.runCase(apiCase.id(), WORKSPACE_CODE, new ApiRunRequest(WORKSPACE_CODE, null, null, null, null));

        String firstPage = mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("objectType", "API_CASE")
                        .param("pageNo", "1")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String secondPage = mockMvc.perform(get("/api/automation/api/reports")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("objectType", "API_CASE")
                        .param("pageNo", "2")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String firstKey = com.jayway.jsonpath.JsonPath.read(firstPage, "$.data.items[0].reportKey");
        String secondKey = com.jayway.jsonpath.JsonPath.read(secondPage, "$.data.items[0].reportKey");
        org.assertj.core.api.Assertions.assertThat(firstKey).isNotEqualTo(secondKey);
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
        return createCase(unique, "/ok");
    }

    private ApiDefinitionCaseDetail createCase(String unique, String path) {
        ApiDefinitionDetail definition = apiAutomationService.createDefinition(WORKSPACE_CODE, new SaveApiDefinitionRequest(
                WORKSPACE_CODE,
                unique + "-definition",
                null,
                "report v1 definition",
                List.of("report-v1"),
                requestConfig(path),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of(),
                List.of()
        ));
        return apiAutomationService.createCase(WORKSPACE_CODE, new SaveApiDefinitionCaseRequest(
                WORKSPACE_CODE,
                definition.id(),
                unique + "-case",
                "report v1 case",
                List.of("report-v1"),
                requestConfig(path),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of()
        ));
    }

    private ApiRequestConfigInput requestConfig() {
        return requestConfig("/ok");
    }

    private ApiRequestConfigInput requestConfig(String path) {
        return new ApiRequestConfigInput(
                "GET",
                baseUrl + path,
                5000,
                List.of(),
                List.of(),
                List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null),
                new ApiAuthConfigInput("NONE", null, null)
        );
    }

    private ApiAssertionInput statusCodeAssertion() {
        return new ApiAssertionInput("STATUS_CODE", null, "EQUALS", "200");
    }

    private void writeResponse(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().put("Content-Type", List.of(contentType));
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
