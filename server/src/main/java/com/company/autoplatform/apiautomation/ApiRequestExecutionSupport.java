package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Flow;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.defaultList;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Component
public class ApiRequestExecutionSupport {

    private final ApiVariableResolver variableResolver;
    private final HttpClient httpClient;

    public ApiRequestExecutionSupport(ApiVariableResolver variableResolver) {
        this.variableResolver = variableResolver;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    ResolvedRequest resolveRequest(
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables,
            ApiAuthConfigInput normalizedAuthConfig
    ) {
        String path = Optional.ofNullable(variableResolver.replaceVariables(config.path(), variables)).orElse("").trim();
        String url = path.startsWith("http://") || path.startsWith("https://")
                ? path
                : joinBaseUrl(environment.baseUrl(), path);

        String query = variableResolver.buildQueryString(defaultList(config.queryParams()), variables);
        if (!query.isEmpty()) {
            url = url.contains("?") ? url + "&" + query : url + "?" + query;
        }

        LinkedHashMap<String, String> headers = new LinkedHashMap<>();
        headers.putAll(variableResolver.toEnabledMap(defaultList(environment.headers()), variables));
        headers.putAll(variableResolver.toEnabledMap(defaultList(config.headers()), variables));
        headers.entrySet().removeIf(entry -> "authorization".equalsIgnoreCase(entry.getKey()));
        if (environment.mockBusinessScenarioId() != null && isMockRequest(url, environment.mockBaseUrl())) {
            headers.put("X-Mock-Business-Scenario-Id", String.valueOf(environment.mockBusinessScenarioId()));
        }
        if (environment.mockExecutionToken() != null && !environment.mockExecutionToken().isBlank()
                && isMockRequest(url, environment.mockBaseUrl())) {
            headers.put("X-Mock-Execution-Token", environment.mockExecutionToken());
        }

        LinkedHashMap<String, String> cookies = new LinkedHashMap<>(variableResolver.toEnabledMap(defaultList(config.cookies()), variables));

        String body = null;
        ApiRequestBodyInput bodyConfig = config.body() == null ? new ApiRequestBodyInput("NONE", null, List.of(), null, null, null) : config.body();
        if ("RAW_JSON".equalsIgnoreCase(bodyConfig.type())
                || "RAW_TEXT".equalsIgnoreCase(bodyConfig.type())
                || "RAW_XML".equalsIgnoreCase(bodyConfig.type())) {
            body = variableResolver.replaceVariables(Optional.ofNullable(bodyConfig.rawText()).orElse(""), variables);
        } else if ("FORM_URLENCODED".equalsIgnoreCase(bodyConfig.type())) {
            body = variableResolver.buildQueryString(variableResolver.toEnabledMap(defaultList(bodyConfig.formItems()), variables));
            headers.putIfAbsent("Content-Type", "application/x-www-form-urlencoded");
        } else if ("BINARY".equalsIgnoreCase(bodyConfig.type())) {
            String fileName = Optional.ofNullable(bodyConfig.fileName()).filter(name -> !name.isBlank()).orElse("binary-body");
            String contentType = Optional.ofNullable(bodyConfig.contentType()).filter(value -> !value.isBlank()).orElse("application/octet-stream");
            String base64 = Optional.ofNullable(bodyConfig.binaryBase64()).orElse("");
            body = "[binary] " + fileName + " (" + contentType + ", " + base64.length() + " base64 chars)";
        }

        if (!cookies.isEmpty()) {
            headers.put("Cookie", buildCookieHeader(cookies));
        }
        return new ResolvedRequest(config.method().toUpperCase(), url, headers, body, bodyConfig, normalizedAuthConfig);
    }

    private boolean isMockRequest(String url, String mockBaseUrl) {
        return url != null
                && mockBaseUrl != null
                && !mockBaseUrl.isBlank()
                && url.regionMatches(true, 0, mockBaseUrl, 0, mockBaseUrl.length());
    }

    SentRequestResult sendRequest(
            ResolvedRequest request,
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables
    ) throws IOException, InterruptedException {
        ApiAuthConfigInput authConfig = request.authConfig();
        String authType = Optional.ofNullable(authConfig.authType()).orElse("NONE").toUpperCase();
        return switch (authType) {
            case "NONE" -> {
                HttpRequest httpRequest = buildHttpRequest(request, config, environment);
                yield new SentRequestResult(
                        httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)),
                        flattenHeaders(httpRequest.headers().map())
                );
            }
            case "BASIC" -> sendBasicAuthRequest(request, config, environment, variables, authConfig);
            case "DIGEST" -> sendDigestAuthRequest(request, config, environment, variables, authConfig);
            default -> throw new BadRequestException("Unsupported auth type: " + authType);
        };
    }

    HttpRequest buildHttpRequest(
            ResolvedRequest request,
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment
    ) {
        return buildHttpRequest(request, config, environment, null);
    }

    HttpRequest buildHttpRequest(
            ResolvedRequest request,
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            String authorizationHeader
    ) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(request.url()))
                .timeout(Duration.ofMillis(config.timeoutMs() == null || config.timeoutMs() <= 0 ? environment.timeoutMs() : config.timeoutMs()));
        request.headers().forEach(builder::header);
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            builder.header("Authorization", authorizationHeader);
        }

        HttpRequest.BodyPublisher publisher = HttpRequest.BodyPublishers.noBody();
        if ("FORM_DATA".equalsIgnoreCase(request.bodyConfig().type())) {
            MultipartPayload multipart = buildMultipart(defaultList(request.bodyConfig().formItems()));
            builder.header("Content-Type", "multipart/form-data; boundary=" + multipart.boundary());
            publisher = multipart.publisher();
        } else if (request.body() != null) {
            if ("RAW_JSON".equalsIgnoreCase(request.bodyConfig().type())) {
                builder.header("Content-Type", "application/json");
            } else if ("RAW_XML".equalsIgnoreCase(request.bodyConfig().type())) {
                builder.header("Content-Type", Optional.ofNullable(request.bodyConfig().contentType())
                        .filter(value -> !value.isBlank())
                        .orElse("application/xml; charset=UTF-8"));
            } else if ("RAW_TEXT".equalsIgnoreCase(request.bodyConfig().type())) {
                builder.header("Content-Type", "text/plain; charset=UTF-8");
            } else if ("BINARY".equalsIgnoreCase(request.bodyConfig().type())) {
                String base64 = Optional.ofNullable(request.bodyConfig().binaryBase64()).orElse("");
                if (base64.isBlank()) {
                    throw new BadRequestException("Binary body file cannot be empty");
                }
                byte[] content;
                try {
                    content = Base64.getDecoder().decode(base64);
                } catch (IllegalArgumentException exception) {
                    throw new BadRequestException("Binary body content is not valid base64");
                }
                builder.header("Content-Type", Optional.ofNullable(request.bodyConfig().contentType())
                        .filter(value -> !value.isBlank())
                        .orElse("application/octet-stream"));
                publisher = HttpRequest.BodyPublishers.ofByteArray(content);
                return builder.method(request.method(), publisher).build();
            }
            publisher = HttpRequest.BodyPublishers.ofString(request.body(), StandardCharsets.UTF_8);
        }

        return builder.method(request.method(), publisher).build();
    }

    private SentRequestResult sendBasicAuthRequest(
            ResolvedRequest request,
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables,
            ApiAuthConfigInput authConfig
    ) throws IOException, InterruptedException {
        ApiAuthCredentialInput credential = requireCredential(authConfig.basicAuth(), "Basic");
        String userName = variableResolver.replaceVariables(Optional.ofNullable(credential.userName()).orElse(""), variables);
        String password = variableResolver.replaceVariables(Optional.ofNullable(credential.password()).orElse(""), variables);
        String encoded = Base64.getEncoder().encodeToString((userName + ":" + password).getBytes(StandardCharsets.UTF_8));
        HttpRequest httpRequest = buildHttpRequest(request, config, environment, "Basic " + encoded);
        return new SentRequestResult(
                httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)),
                flattenHeaders(httpRequest.headers().map())
        );
    }

    private SentRequestResult sendDigestAuthRequest(
            ResolvedRequest request,
            ApiRequestConfigInput config,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables,
            ApiAuthConfigInput authConfig
    ) throws IOException, InterruptedException {
        ApiAuthCredentialInput credential = requireCredential(authConfig.digestAuth(), "Digest");
        String userName = variableResolver.replaceVariables(Optional.ofNullable(credential.userName()).orElse(""), variables);
        String password = variableResolver.replaceVariables(Optional.ofNullable(credential.password()).orElse(""), variables);

        HttpRequest initialRequest = buildHttpRequest(request, config, environment);
        HttpResponse<String> initialResponse = httpClient.send(initialRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (initialResponse.statusCode() != 401) {
            return new SentRequestResult(initialResponse, flattenHeaders(initialRequest.headers().map()));
        }

        String challengeHeader = extractDigestChallenge(initialResponse.headers());
        if (challengeHeader == null) {
            return new SentRequestResult(initialResponse, flattenHeaders(initialRequest.headers().map()));
        }

        DigestChallenge challenge = parseDigestChallenge(challengeHeader);
        String authorizationHeader = buildDigestAuthorizationHeader(request, userName, password, challenge);
        HttpRequest digestRequest = buildHttpRequest(request, config, environment, authorizationHeader);
        return new SentRequestResult(
                httpClient.send(digestRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)),
                flattenHeaders(digestRequest.headers().map())
        );
    }

    private ApiAuthCredentialInput requireCredential(ApiAuthCredentialInput credential, String authType) {
        if (credential == null
                || credential.userName() == null
                || credential.userName().isBlank()
                || credential.password() == null
                || credential.password().isBlank()) {
            throw new BadRequestException(authType + " auth username and password cannot be blank");
        }
        return credential;
    }

    private String extractDigestChallenge(HttpHeaders headers) {
        for (String value : headers.allValues("WWW-Authenticate")) {
            if (value != null && value.regionMatches(true, 0, "Digest ", 0, 7)) {
                return value;
            }
        }
        return null;
    }

    private DigestChallenge parseDigestChallenge(String header) {
        String content = header.substring(7).trim();
        Matcher matcher = Pattern.compile("(\\w+)=(\"([^\"]*)\"|([^,]+))").matcher(content);
        Map<String, String> values = new LinkedHashMap<>();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = matcher.group(3) != null ? matcher.group(3) : matcher.group(4);
            values.put(key, value == null ? "" : value.trim());
        }
        String realm = values.get("realm");
        String nonce = values.get("nonce");
        if (realm == null || realm.isBlank() || nonce == null || nonce.isBlank()) {
            throw new BadRequestException("Digest auth challenge is missing realm or nonce");
        }
        return new DigestChallenge(
                realm,
                nonce,
                values.get("opaque"),
                Optional.ofNullable(values.get("algorithm")).filter(value -> !value.isBlank()).orElse("MD5"),
                Optional.ofNullable(values.get("qop")).map(String::trim).orElse("")
        );
    }

    private String buildDigestAuthorizationHeader(
            ResolvedRequest request,
            String userName,
            String password,
            DigestChallenge challenge
    ) {
        String algorithm = challenge.algorithm().toUpperCase();
        if (!"MD5".equals(algorithm) && !"MD5-SESS".equals(algorithm)) {
            throw new BadRequestException("Unsupported digest algorithm: " + challenge.algorithm());
        }
        String qop = resolveDigestQop(challenge.qop());
        String uri = URI.create(request.url()).getRawPath();
        String rawQuery = URI.create(request.url()).getRawQuery();
        if (uri == null || uri.isBlank()) {
            uri = "/";
        }
        if (rawQuery != null && !rawQuery.isBlank()) {
            uri = uri + "?" + rawQuery;
        }

        String cnonce = UUID.randomUUID().toString().replace("-", "");
        String nonceCount = "00000001";
        String ha1 = md5Hex(userName + ":" + challenge.realm() + ":" + password);
        if ("MD5-SESS".equals(algorithm)) {
            ha1 = md5Hex(ha1 + ":" + challenge.nonce() + ":" + cnonce);
        }
        String ha2 = md5Hex(request.method() + ":" + uri);
        String response = qop == null
                ? md5Hex(ha1 + ":" + challenge.nonce() + ":" + ha2)
                : md5Hex(ha1 + ":" + challenge.nonce() + ":" + nonceCount + ":" + cnonce + ":" + qop + ":" + ha2);

        List<String> parts = new ArrayList<>();
        parts.add("username=\"" + escapeDigestValue(userName) + "\"");
        parts.add("realm=\"" + escapeDigestValue(challenge.realm()) + "\"");
        parts.add("nonce=\"" + escapeDigestValue(challenge.nonce()) + "\"");
        parts.add("uri=\"" + escapeDigestValue(uri) + "\"");
        parts.add("response=\"" + response + "\"");
        parts.add("algorithm=" + algorithm);
        if (challenge.opaque() != null && !challenge.opaque().isBlank()) {
            parts.add("opaque=\"" + escapeDigestValue(challenge.opaque()) + "\"");
        }
        if (qop != null) {
            parts.add("qop=" + qop);
            parts.add("nc=" + nonceCount);
            parts.add("cnonce=\"" + cnonce + "\"");
        }
        return "Digest " + String.join(", ", parts);
    }

    private String resolveDigestQop(String qopHeader) {
        if (qopHeader == null || qopHeader.isBlank()) {
            return null;
        }
        List<String> values = java.util.Arrays.stream(qopHeader.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .toList();
        if (values.contains("auth")) {
            return "auth";
        }
        throw new BadRequestException("Unsupported digest qop: " + qopHeader);
    }

    private String md5Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.ISO_8859_1));
            StringBuilder builder = new StringBuilder();
            for (byte item : bytes) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("MD5 algorithm is not available", exception);
        }
    }

    private String escapeDigestValue(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private MultipartPayload buildMultipart(List<ApiKeyValueInput> items) {
        String boundary = "Boundary" + System.nanoTime();
        List<ByteBuffer> buffers = new ArrayList<>();
        for (ApiKeyValueInput item : items) {
            if (item == null || item.key() == null || item.key().isBlank() || Boolean.FALSE.equals(item.enabled())) {
                continue;
            }
            if ("file".equalsIgnoreCase(Optional.ofNullable(item.paramType()).orElse(""))) {
                String base64 = Optional.ofNullable(item.fileBase64()).orElse("");
                if (base64.isBlank()) {
                    continue;
                }
                byte[] content;
                try {
                    content = Base64.getDecoder().decode(base64);
                } catch (IllegalArgumentException exception) {
                    throw new BadRequestException("Form-data file content is not valid base64");
                }
                String fileName = Optional.ofNullable(item.fileName()).filter(value -> !value.isBlank()).orElse(item.value());
                if (fileName == null || fileName.isBlank()) {
                    fileName = "upload";
                }
                String contentType = Optional.ofNullable(item.contentType()).filter(value -> !value.isBlank()).orElse("application/octet-stream");
                String partHeader = "--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"" + item.key() + "\"; filename=\"" + escapeMultipartHeader(fileName) + "\"\r\n"
                        + "Content-Type: " + contentType + "\r\n\r\n";
                buffers.add(StandardCharsets.UTF_8.encode(partHeader));
                buffers.add(ByteBuffer.wrap(content));
                buffers.add(StandardCharsets.UTF_8.encode("\r\n"));
                continue;
            }
            String part = "--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"" + item.key() + "\"\r\n\r\n"
                    + Optional.ofNullable(item.value()).orElse("")
                    + "\r\n";
            buffers.add(StandardCharsets.UTF_8.encode(part));
        }
        buffers.add(StandardCharsets.UTF_8.encode("--" + boundary + "--\r\n"));
        return new MultipartPayload(boundary, HttpRequest.BodyPublishers.fromPublisher(new ByteBufferPublisher(buffers)));
    }

    private String escapeMultipartHeader(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String joinBaseUrl(String baseUrl, String path) {
        String normalizedBase = Optional.ofNullable(baseUrl).orElse("").trim();
        if (normalizedBase.isEmpty()) {
            throw new BadRequestException("相对路径请求需要先选择带 Base URL 的运行环境，或直接填写完整 URL");
        }
        if (normalizedBase.endsWith("/") && path.startsWith("/")) {
            return normalizedBase + path.substring(1);
        }
        if (!normalizedBase.endsWith("/") && !path.startsWith("/")) {
            return normalizedBase + "/" + path;
        }
        return normalizedBase + path;
    }

    private String buildCookieHeader(Map<String, String> cookies) {
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, String> entry : cookies.entrySet()) {
            parts.add(entry.getKey() + "=" + Optional.ofNullable(entry.getValue()).orElse(""));
        }
        return String.join("; ", parts);
    }

    Map<String, String> flattenHeaders(Map<String, List<String>> headers) {
        LinkedHashMap<String, String> flattened = new LinkedHashMap<>();
        headers.forEach((key, value) -> flattened.put(key, value == null ? "" : String.join(", ", value)));
        return flattened;
    }

    record SentRequestResult(
            HttpResponse<String> response,
            Map<String, String> headers
    ) {
    }

    record ResolvedRequest(
            String method,
            String url,
            Map<String, String> headers,
            String body,
            ApiRequestBodyInput bodyConfig,
            ApiAuthConfigInput authConfig
    ) {
    }

    private record DigestChallenge(
            String realm,
            String nonce,
            String opaque,
            String algorithm,
            String qop
    ) {
    }

    private record MultipartPayload(
            String boundary,
            HttpRequest.BodyPublisher publisher
    ) {
    }

    private static class ByteBufferPublisher implements Flow.Publisher<ByteBuffer> {
        private final List<ByteBuffer> buffers;

        private ByteBufferPublisher(List<ByteBuffer> buffers) {
            this.buffers = buffers;
        }

        @Override
        public void subscribe(Flow.Subscriber<? super ByteBuffer> subscriber) {
            subscriber.onSubscribe(new Flow.Subscription() {
                private int index;
                private boolean completed;

                @Override
                public void request(long n) {
                    if (completed) {
                        return;
                    }
                    while (index < buffers.size()) {
                        subscriber.onNext(buffers.get(index++));
                    }
                    completed = true;
                    subscriber.onComplete();
                }

                @Override
                public void cancel() {
                    completed = true;
                }
            });
        }
    }
}
