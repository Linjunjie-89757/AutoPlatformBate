package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.http.HttpRequest;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static com.company.autoplatform.apiautomation.ApiExecutionRuntimeModelFixtures.resolvedEnvironment;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApiRequestExecutionSupportTests {

    private final ApiRequestExecutionSupport requestSupport = new ApiRequestExecutionSupport(new ApiVariableResolver());

    @Test
    void resolveRequestJoinsBaseUrlAndResolvesQueryHeadersCookiesAndBody() {
        ApiRequestExecutionSupport.ResolvedRequest request = requestSupport.resolveRequest(
                new ApiRequestConfigInput(
                        "POST",
                        "/orders/{{orderId}}",
                        1000,
                        List.of(item("q", "{{keyword}}", true, true)),
                        List.of(item("X-Trace", "{{traceId}}", true, null)),
                        List.of(item("sid", "{{sessionId}}", true, null)),
                        new ApiRequestBodyInput("RAW_JSON", "{\"id\":\"{{orderId}}\"}", List.of(), "application/json", null, null),
                        noneAuth()
                ),
                environment("https://api.example.com/base", List.of(item("X-Env", "{{envHeader}}", true, null))),
                Map.of(
                        "orderId", "1001",
                        "keyword", "hello world",
                        "traceId", "trace-1",
                        "sessionId", "s-1",
                        "envHeader", "env-1"
                ),
                noneAuth()
        );

        assertThat(request.url()).isEqualTo("https://api.example.com/base/orders/1001?q=hello+world");
        assertThat(request.headers())
                .containsEntry("X-Env", "env-1")
                .containsEntry("X-Trace", "trace-1")
                .containsEntry("Cookie", "sid=s-1");
        assertThat(request.body()).isEqualTo("{\"id\":\"1001\"}");
    }

    @Test
    void buildHttpRequestAddsBasicAuthorizationHeader() {
        ApiAuthConfigInput auth = new ApiAuthConfigInput(
                "BASIC",
                new ApiAuthCredentialInput("{{user}}", "{{password}}"),
                new ApiAuthCredentialInput("", "")
        );
        ApiRequestExecutionSupport.ResolvedRequest request = requestSupport.resolveRequest(
                new ApiRequestConfigInput("GET", "https://api.example.com/orders", 1000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), auth),
                environment("", List.of()),
                Map.of("user", "alice", "password", "secret"),
                auth
        );

        String encoded = Base64.getEncoder().encodeToString("alice:secret".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        HttpRequest httpRequest = requestSupport.buildHttpRequest(
                request,
                new ApiRequestConfigInput("GET", request.url(), 1000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), auth),
                environment("", List.of()),
                "Basic " + encoded
        );

        assertThat(httpRequest.headers().firstValue("Authorization")).contains("Basic " + encoded);
    }

    @Test
    void sendRequestAppliesBearerAndApiKeyAuthentication() throws Exception {
        AtomicReference<String> bearerHeader = new AtomicReference<>();
        AtomicReference<String> apiKeyHeader = new AtomicReference<>();
        AtomicReference<String> apiKeyQuery = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            switch (exchange.getRequestURI().getPath()) {
                case "/bearer" -> bearerHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
                case "/api-key-header" -> apiKeyHeader.set(exchange.getRequestHeaders().getFirst("X-API-Key"));
                case "/api-key-query" -> apiKeyQuery.set(exchange.getRequestURI().getRawQuery());
                default -> {
                }
            }
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort();
            sendRequest(baseUrl + "/bearer", new ApiAuthConfigInput(
                    "BEARER", null, null, "{{token}}", null, null, null
            ), Map.of("token", "abc-123"));
            sendRequest(baseUrl + "/api-key-header", new ApiAuthConfigInput(
                    "API_KEY", null, null, null, "X-API-Key", "{{secret}}", "header"
            ), Map.of("secret", "header-secret"));
            sendRequest(baseUrl + "/api-key-query?keep=1&access_key=old", new ApiAuthConfigInput(
                    "API_KEY", null, null, null, "access_key", "{{secret}}", "query"
            ), Map.of("secret", "s3 cr&et"));
        } finally {
            server.stop(0);
        }

        assertThat(bearerHeader.get()).isEqualTo("Bearer abc-123");
        assertThat(apiKeyHeader.get()).isEqualTo("header-secret");
        assertThat(apiKeyQuery.get()).isEqualTo("keep=1&access_key=s3%20cr%26et");
    }

    @Test
    void resolveRequestKeepsMissingVariableFailureBehavior() {
        assertThatThrownBy(() -> requestSupport.resolveRequest(
                new ApiRequestConfigInput("GET", "/orders/{{missing}}", 1000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), noneAuth()),
                environment("https://api.example.com", List.of()),
                Map.of(),
                noneAuth()
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Missing variable: missing");
    }

    private ApiExecutionRuntimeModels.ResolvedEnvironment environment(String baseUrl, List<ApiKeyValueInput> headers) {
        return resolvedEnvironment(baseUrl, headers, noneAuth());
    }

    private void sendRequest(String url, ApiAuthConfigInput auth, Map<String, String> variables) throws Exception {
        ApiRequestConfigInput config = new ApiRequestConfigInput(
                "GET", url, 1000, List.of(), List.of(), List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), auth
        );
        ApiExecutionRuntimeModels.ResolvedEnvironment environment = environment("", List.of());
        ApiRequestExecutionSupport.ResolvedRequest request = requestSupport.resolveRequest(config, environment, variables, auth);
        requestSupport.sendRequest(request, config, environment, variables);
    }

    private ApiAuthConfigInput noneAuth() {
        return new ApiAuthConfigInput("NONE", new ApiAuthCredentialInput("", ""), new ApiAuthCredentialInput("", ""));
    }

    private ApiKeyValueInput item(String key, String value, Boolean enabled, Boolean encode) {
        return new ApiKeyValueInput(key, value, null, enabled, null, null, encode, null, null, null, null, null);
    }
}
