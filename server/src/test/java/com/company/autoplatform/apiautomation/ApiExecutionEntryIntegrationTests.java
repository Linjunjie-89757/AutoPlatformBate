package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.settings.CreateEnvConfigRequest;
import com.company.autoplatform.settings.CreateParamSetRequest;
import com.company.autoplatform.settings.EnvConfigItem;
import com.company.autoplatform.settings.ParamSetItem;
import com.company.autoplatform.settings.SettingsService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.assertj.core.api.Assertions.assertThat;

class ApiExecutionEntryIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private ApiAutomationService apiAutomationService;

    @Autowired
    private SettingsService settingsService;

    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ok", exchange -> writeResponse(exchange, 200, "application/json", """
                {"ok":true,"source":"entry-smoke"}
                """));
        server.createContext("/echo", exchange -> writeResponse(exchange, 200, "application/json", """
                {"query":"%s","header":"%s"}
                """.formatted(
                URLDecoder.decode(exchange.getRequestURI().getRawQuery() == null ? "" : exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8),
                exchange.getRequestHeaders().getFirst("X-Dynamic-Sign")
        )));
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
    void debugRunDefinitionDraftReturnsSuccessfulRunWithStepResult() {
        ApiRunResponse run = apiAutomationService.debugRunDefinitionDraft(WORKSPACE_CODE, new ApiDebugDefinitionRequest(
                WORKSPACE_CODE,
                null,
                "draft definition entry smoke " + System.nanoTime(),
                requestConfig(),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                null
        ));

        assertSuccessfulRun(run);
    }

    @Test
    void debugRunSavedDefinitionReturnsSuccessfulRunAndUpdatesLastRunResult() {
        ApiDefinitionDetail definition = createDefinition("saved definition entry smoke " + System.nanoTime());

        ApiRunResponse run = apiAutomationService.debugRunDefinition(
                definition.id(),
                WORKSPACE_CODE,
                new ApiRunRequest(WORKSPACE_CODE, null, null, null, null)
        );

        assertSuccessfulRun(run);
        ApiDefinitionDetail refreshed = apiAutomationService.getDefinition(definition.id(), WORKSPACE_CODE);
        assertThat(refreshed.lastRunResult()).isEqualTo("SUCCESS");
        assertThat(refreshed.lastRunAt()).isNotNull();
    }

    @Test
    void debugRunDefinitionCanUseSharedEnvironmentServiceEndpointVariable() {
        EnvConfigItem environment = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "TEST",
                "shared service env " + System.nanoTime(),
                baseUrl,
                """
                        {"envGroup":"TEST","defaultServiceKey":"order-api","services":[{"key":"order-api","name":"订单服务","baseUrl":"%s"}]}
                        """.formatted(baseUrl)
        ));
        ApiDefinitionDetail definition = createDefinition(
                "shared service endpoint definition " + System.nanoTime(),
                "${order-api}/ok"
        );

        ApiRunResponse run = apiAutomationService.debugRunDefinition(
                definition.id(),
                WORKSPACE_CODE,
                new ApiRunRequest(WORKSPACE_CODE, environment.id(), null, null, null)
        );

        assertSuccessfulRun(run);
    }

    @Test
    void debugRunDefinitionReadsLegacyNestedApiEnvironmentConfig() {
        EnvConfigItem environment = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "TEST",
                "legacy nested api env " + System.nanoTime(),
                "",
                """
                        {"apiConfig":{"baseUrl":"%s","timeout":4500,"authType":"NONE"}}
                        """.formatted(baseUrl)
        ));
        ApiDefinitionDetail definition = createDefinition(
                "legacy nested api definition " + System.nanoTime(),
                "/ok"
        );
        ApiRunResponse run = apiAutomationService.debugRunDefinition(
                definition.id(),
                WORKSPACE_CODE,
                new ApiRunRequest(WORKSPACE_CODE, environment.id(), null, null, null)
        );

        assertSuccessfulRun(run);
    }

    @Test
    void debugRunDefinitionResolvesDynamicFunctionsFromVariableSetIntoRequestAndSnapshot() {
        ParamSetItem variableSet = settingsService.createParam(WORKSPACE_CODE, new CreateParamSetRequest(
                WORKSPACE_CODE,
                "API_VARIABLE_SET",
                "dynamic functions " + System.nanoTime(),
                """
                        [{"name":"sign_str","value":"abc","sensitive":false},{"name":"uniqueName","value":"测试商品_{{$randomInt(1000, 9999)}}","sensitive":false},{"name":"signature","value":"{{$md5({{sign_str}})}}","sensitive":false}]
                        """
        ));
        ApiRequestConfigInput config = new ApiRequestConfigInput(
                "GET",
                baseUrl + "/echo",
                5000,
                List.of(new ApiKeyValueInput("name", "{{uniqueName}}", null, true, null, null, false, null, null, null, null, null),
                        new ApiKeyValueInput("sign", "{{signature}}", null, true, null, null, false, null, null, null, null, null)),
                List.of(new ApiKeyValueInput("X-Dynamic-Sign", "{{signature}}", null, true, null, null, false, null, null, null, null, null)),
                List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null),
                new ApiAuthConfigInput("NONE", null, null)
        );

        ApiRunResponse run = apiAutomationService.debugRunDefinitionDraft(WORKSPACE_CODE, new ApiDebugDefinitionRequest(
                WORKSPACE_CODE,
                null,
                "dynamic functions draft " + System.nanoTime(),
                config,
                List.of(statusCodeAssertion()),
                List.of(),
                List.of(),
                List.of(),
                null,
                variableSet.id(),
                null,
                null
        ));

        assertSuccessfulRun(run);
        ApiRunStepResultResponse step = run.stepResults().getFirst();
        assertThat(step.response().body()).containsPattern("name=测试商品_\\d{4}");
        assertThat(step.response().body()).contains("sign=900150983cd24fb0d6963f7d28e17f72");
        assertThat(step.response().body()).doesNotContain("{{$");
    }

    @Test
    void runSavedCaseReturnsSuccessfulRunUpdatesLastRunResultAndWritesHistory() {
        ApiDefinitionCaseDetail apiCase = createSavedCase("saved case entry smoke " + System.nanoTime());

        ApiRunResponse run = apiAutomationService.runCase(
                apiCase.id(),
                WORKSPACE_CODE,
                new ApiRunRequest(WORKSPACE_CODE, null, null, null, null)
        );

        assertSuccessfulRun(run);
        assertCaseRunPersisted(apiCase.id(), run.reportId());
    }

    @Test
    void debugRunCaseDraftWithSavedCaseReturnsSuccessfulRunAndWritesHistory() {
        ApiDefinitionCaseDetail apiCase = createSavedCase("draft case entry smoke " + System.nanoTime());

        ApiRunResponse run = apiAutomationService.debugRunCaseDraft(WORKSPACE_CODE, new ApiDebugCaseRequest(
                WORKSPACE_CODE,
                apiCase.id(),
                apiCase.definitionId(),
                "draft run for " + apiCase.name(),
                requestConfig(),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of(),
                null,
                null,
                null,
                null
        ));

        assertSuccessfulRun(run);
        assertCaseRunPersisted(apiCase.id(), run.reportId());
    }

    @Test
    void runScenarioReturnsSuccessfulRunAndUpdatesLastRunResult() {
        ApiDefinitionDetail definition = createDefinition("scenario entry smoke definition " + System.nanoTime());
        ApiScenarioDetail scenario = apiAutomationService.createScenario(WORKSPACE_CODE, new SaveApiScenarioRequest(
                WORKSPACE_CODE,
                "scenario entry smoke " + System.nanoTime(),
                null,
                null,
                "P2",
                "ACTIVE",
                "entry smoke",
                List.of("entry-smoke"),
                null,
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(new ApiScenarioStepInput(
                        "step-api-ok",
                        "Run saved definition",
                        "API",
                        null,
                        "DEFINITION",
                        definition.id(),
                        true,
                        null,
                        List.of(),
                        List.of(),
                        List.of(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of()
                ))
        ));

        ApiRunResponse run = apiAutomationService.runScenario(
                scenario.id(),
                WORKSPACE_CODE,
                new ApiRunRequest(WORKSPACE_CODE, null, null, null, null)
        );

        assertThat(run.taskId()).isNotNull();
        assertThat(run.reportId()).isNotNull();
        assertThat(run.result()).isEqualTo("SUCCESS");
        assertThat(run.stepResults())
                .anySatisfy(step -> {
                    assertThat(step.success()).isTrue();
                    assertThat(step.response()).isNotNull();
                    assertThat(step.response().statusCode()).isEqualTo(200);
                });
        ApiScenarioDetail refreshed = apiAutomationService.getScenario(scenario.id(), WORKSPACE_CODE);
        assertThat(refreshed.lastRunResult()).isEqualTo("SUCCESS");
        assertThat(refreshed.lastRunAt()).isNotNull();
    }

    private void assertSuccessfulRun(ApiRunResponse run) {
        assertThat(run.taskId()).isNotNull();
        assertThat(run.reportId()).isNotNull();
        assertThat(run.result()).isEqualTo("SUCCESS");
        assertThat(run.stepResults()).hasSize(1);
        ApiRunStepResultResponse step = run.stepResults().getFirst();
        assertThat(step.success()).isTrue();
        assertThat(step.response()).isNotNull();
        assertThat(step.response().statusCode()).isEqualTo(200);
        assertThat(step.assertionResults()).allMatch(ApiAssertionResult::success);
    }

    private void assertCaseRunPersisted(Long caseId, Long reportId) {
        ApiDefinitionCaseDetail refreshed = apiAutomationService.getCase(caseId, WORKSPACE_CODE);
        assertThat(refreshed.lastRunResult()).isEqualTo("SUCCESS");
        assertThat(refreshed.lastRunAt()).isNotNull();
        assertThat(apiAutomationService.listCaseRunHistory(caseId, WORKSPACE_CODE).items())
                .anySatisfy(history -> {
                    assertThat(history.reportId()).isEqualTo(reportId);
                    assertThat(history.result()).isEqualTo("PASSED");
                    assertThat(history.statusCode()).isEqualTo(200);
                });
    }

    private ApiDefinitionCaseDetail createSavedCase(String caseName) {
        ApiDefinitionDetail definition = createDefinition(caseName + " definition");
        return apiAutomationService.createCase(WORKSPACE_CODE, new SaveApiDefinitionCaseRequest(
                WORKSPACE_CODE,
                definition.id(),
                caseName,
                "entry smoke",
                List.of("entry-smoke"),
                requestConfig(),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of()
        ));
    }

    private ApiDefinitionDetail createDefinition(String name) {
        return createDefinition(name, baseUrl + "/ok");
    }

    private ApiDefinitionDetail createDefinition(String name, String path) {
        return apiAutomationService.createDefinition(WORKSPACE_CODE, new SaveApiDefinitionRequest(
                WORKSPACE_CODE,
                name,
                null,
                "entry smoke",
                List.of("entry-smoke"),
                requestConfig(path),
                List.of(statusCodeAssertion()),
                List.of(),
                List.of(),
                List.of()
        ));
    }

    private ApiRequestConfigInput requestConfig() {
        return requestConfig(baseUrl + "/ok");
    }

    private ApiRequestConfigInput requestConfig(String path) {
        return new ApiRequestConfigInput(
                "GET",
                path,
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
