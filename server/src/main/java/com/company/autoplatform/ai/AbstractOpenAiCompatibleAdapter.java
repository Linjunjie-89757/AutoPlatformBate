package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

abstract class AbstractOpenAiCompatibleAdapter implements AiProtocolAdapter {

    private static final int LOG_BODY_LIMIT = 1000;

    protected final Logger log = LoggerFactory.getLogger(getClass());
    protected final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final long defaultRequestTimeoutSeconds;

    protected AbstractOpenAiCompatibleAdapter(long timeoutSeconds) {
        this.defaultRequestTimeoutSeconds = Math.max(5, timeoutSeconds);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(this.defaultRequestTimeoutSeconds))
                .build();
    }

    @Override
    public void testConnection(AiProviderRequestProfile profile, String apiKey) {
        String content = requestStructuredContent(profile, apiKey, """
                Return only JSON.
                Reply exactly with:
                {"ok":true}
                """, List.of());
        try {
            JsonNode parsed = objectMapper.readTree(content);
            if (!parsed.path("ok").asBoolean(false)) {
                throw new BadRequestException("AI 提供方返回了无法识别的探活结果");
            }
        } catch (IOException exception) {
            throw new BadRequestException("AI 提供方探活返回的内容不是合法 JSON");
        }
    }

    @Override
    public AiModelFetchResult fetchModels(AiProviderRequestProfile profile, String apiKey) {
        String endpoint = resolveModelsEndpoint(profile.baseUrl());
        try {
            HttpResponse<String> response = sendRequest("GET", endpoint, apiKey, null, profile.requestTimeoutSeconds());
            if (response.statusCode() == 404 || response.statusCode() == 405) {
                return new AiModelFetchResult(List.of(), "当前连接未提供模型列表接口，可手工输入模型名");
            }
            if (response.statusCode() >= 400) {
                throw new BadRequestException("获取模型列表失败: " + abbreviate(response.body()));
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode data = root.path("data");
            if (!data.isArray()) {
                return new AiModelFetchResult(List.of(), "当前连接未返回标准模型列表，可手工输入模型名");
            }
            List<AiProviderModelItem> models = new ArrayList<>();
            for (JsonNode item : data) {
                String modelName = item.path("id").asText("");
                if (modelName.isBlank()) {
                    continue;
                }
                AiModelCapabilities capabilities = inferCapabilities(profile.protocolType(), modelName, true);
                models.add(new AiProviderModelItem(
                        null,
                        null,
                        modelName,
                        modelName,
                        capabilities,
                        true,
                        item.toString(),
                        null
                ));
            }
            return new AiModelFetchResult(models, models.isEmpty() ? "未拉取到可用模型，可手工输入模型名" : "模型列表获取成功");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("获取模型列表被中断");
        } catch (IOException exception) {
            throw new BadRequestException("获取模型列表失败");
        }
    }

    @Override
    public AiModelCapabilities probeCapabilities(AiProviderRequestProfile profile, String apiKey) {
        AiModelCapabilities inferred = inferCapabilities(profile.protocolType(), profile.model(), false);
        String content = requestStructuredContent(profile, apiKey, """
                Return only JSON.
                Reply exactly with:
                {"ok":true}
                """, List.of());
        try {
            JsonNode parsed = objectMapper.readTree(content);
            boolean ok = parsed.path("ok").asBoolean(false);
            AiModelCapabilities probed = inferred
                    .withTextChat(AiModelCapabilities.value(ok, AiModelCapabilities.SOURCE_PROBED, ok ? "最小文本对话探测成功" : "最小文本对话探测失败"))
                    .withStructuredOutput(AiModelCapabilities.value(ok, AiModelCapabilities.SOURCE_PROBED, ok ? "结构化 JSON 探测成功" : "结构化 JSON 探测失败"))
                    .withStableAvailable(AiModelCapabilities.value(ok, AiModelCapabilities.SOURCE_PROBED, ok ? "最近一次探测成功" : "最近一次探测失败"));
            return probed.withStreamOutput(probeStreamCapability(profile, apiKey, probed.streamOutput()));
        } catch (IOException exception) {
            return inferred
                    .withTextChat(AiModelCapabilities.value(false, AiModelCapabilities.SOURCE_PROBED, "文本对话探测返回了不可解析内容"))
                    .withStructuredOutput(AiModelCapabilities.value(false, AiModelCapabilities.SOURCE_PROBED, "结构化输出探测返回了不可解析内容"))
                    .withStableAvailable(AiModelCapabilities.value(false, AiModelCapabilities.SOURCE_PROBED, "最近一次探测失败"));
        }
    }

    protected AiCapabilityValue probeStreamCapability(
            AiProviderRequestProfile profile,
            String apiKey,
            AiCapabilityValue currentValue
    ) {
        return currentValue;
    }

    protected AiModelCapabilities inferCapabilities(String protocolType, String modelName, boolean stableAvailable) {
        return AiModelCapabilities.infer(protocolType, modelName, stableAvailable);
    }

    protected String requestStructuredContentWithChat(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            boolean stream
    ) {
        String endpoint = resolveChatEndpoint(profile.baseUrl());
        try {
            String requestBody = buildChatCompletionsRequestBody(profile, prompt, images, stream);
            HttpResponse<String> response = sendRequest("POST", endpoint, apiKey, requestBody, profile.requestTimeoutSeconds());
            if (response.statusCode() >= 400) {
                if (requiresImageCapability(response.body(), images)) {
                    throw new BadRequestException("当前模型或服务不支持图片输入");
                }
                if (!stream && requiresStreamFallback(response.body())) {
                    return requestStructuredContentWithChat(profile, apiKey, prompt, images, true);
                }
                throw new BadRequestException("AI 提供方请求失败: " + abbreviate(response.body()));
            }
            if (stream) {
                String merged = mergeStreamingContent(response.body());
                if (merged.isBlank()) {
                    throw new BadRequestException("AI 提供方返回了空的流式内容");
                }
                return stripJsonFence(merged);
            }
            return extractChatCompletionsContent(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("AI provider request interrupted", exception);
            throw new BadRequestException("AI 提供方请求被中断");
        } catch (IOException exception) {
            log.error("AI provider request failed", exception);
            throw new BadRequestException("AI 提供方请求失败");
        }
    }

    protected String streamStructuredContentWithChat(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            Consumer<String> deltaConsumer
    ) {
        String endpoint = resolveChatEndpoint(profile.baseUrl());
        try {
            String requestBody = buildChatCompletionsRequestBody(profile, prompt, images, true);
            HttpResponse<java.util.stream.Stream<String>> response = sendStreamingRequest(
                    endpoint,
                    apiKey,
                    requestBody,
                    profile.requestTimeoutSeconds()
            );
            if (response.statusCode() >= 400) {
                String errorBody = readResponseBody(response.body());
                if (requiresImageCapability(errorBody, images)) {
                    throw new BadRequestException("当前模型或服务不支持图片输入");
                }
                throw new BadRequestException("AI 提供方流式请求失败: " + abbreviate(errorBody));
            }
            String merged = consumeChatStreamingLines(response.body(), deltaConsumer, profile.requestTimeoutSeconds());
            if (merged.isBlank()) {
                throw new BadRequestException("AI 提供方返回了空的流式内容");
            }
            return stripJsonFence(merged);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("AI provider streaming request interrupted", exception);
            throw new BadRequestException("AI 提供方流式请求被中断");
        } catch (IOException exception) {
            log.error("AI provider streaming request failed", exception);
            throw new BadRequestException("AI 提供方流式请求失败");
        }
    }

    protected String requestStructuredContentWithResponses(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<AiProviderClient.ImageInput> images
    ) {
        String endpoint = resolveResponsesEndpoint(profile.baseUrl());
        try {
            String requestBody = buildResponsesRequestBody(profile, prompt, images);
            HttpResponse<String> response = sendRequest("POST", endpoint, apiKey, requestBody, profile.requestTimeoutSeconds());
            if (response.statusCode() >= 400) {
                if (requiresImageCapability(response.body(), images)) {
                    throw new BadRequestException("当前模型或服务不支持图片输入");
                }
                throw new BadRequestException("AI 提供方请求失败: " + abbreviate(response.body()));
            }
            return extractResponsesContent(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("AI provider request interrupted", exception);
            throw new BadRequestException("AI 提供方请求被中断");
        } catch (IOException exception) {
            log.error("AI provider request failed", exception);
            throw new BadRequestException("AI 提供方请求失败");
        }
    }

    protected String streamStructuredContentWithResponses(
            AiProviderRequestProfile profile,
            String apiKey,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            Consumer<String> deltaConsumer
    ) {
        String endpoint = resolveResponsesEndpoint(profile.baseUrl());
        try {
            String requestBody = buildResponsesRequestBody(profile, prompt, images, true);
            HttpResponse<java.util.stream.Stream<String>> response = sendStreamingRequest(
                    endpoint,
                    apiKey,
                    requestBody,
                    profile.requestTimeoutSeconds()
            );
            if (response.statusCode() >= 400) {
                String errorBody = readResponseBody(response.body());
                if (requiresImageCapability(errorBody, images)) {
                    throw new BadRequestException("当前模型或服务不支持图片输入");
                }
                throw new BadRequestException("AI 提供方流式请求失败: " + abbreviate(errorBody));
            }
            String merged = consumeResponsesStreamingLines(response.body(), deltaConsumer, profile.requestTimeoutSeconds());
            if (merged.isBlank()) {
                throw new BadRequestException("AI 提供方返回了空的流式内容");
            }
            return stripJsonFence(merged);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.error("AI provider responses streaming request interrupted", exception);
            throw new BadRequestException("AI 提供方流式请求被中断");
        } catch (IOException exception) {
            log.error("AI provider responses streaming request failed", exception);
            throw new BadRequestException("AI 提供方流式请求失败");
        }
    }

    protected String buildChatCompletionsRequestBody(
            AiProviderRequestProfile profile,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            boolean stream
    ) throws IOException {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("model", profile.model());
        request.put("temperature", profile.temperature());
        request.put("top_p", profile.topP());
        request.put("stream", stream);
        request.put("messages", List.of(
                Map.of("role", "system", "content", "You are a QA assistant that outputs only structured JSON."),
                Map.of("role", "user", "content", buildChatUserContent(prompt, images))
        ));
        return objectMapper.writeValueAsString(request);
    }

    protected Object buildChatUserContent(String prompt, List<AiProviderClient.ImageInput> images) {
        if (images == null || images.isEmpty()) {
            return prompt;
        }
        List<Object> userContent = new ArrayList<>();
        userContent.add(Map.of("type", "text", "text", prompt));
        for (AiProviderClient.ImageInput image : images) {
            userContent.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of("url", buildDataUrl(image))
            ));
        }
        return userContent;
    }

    protected String buildResponsesRequestBody(
            AiProviderRequestProfile profile,
            String prompt,
            List<AiProviderClient.ImageInput> images
    ) throws IOException {
        return buildResponsesRequestBody(profile, prompt, images, false);
    }

    protected String buildResponsesRequestBody(
            AiProviderRequestProfile profile,
            String prompt,
            List<AiProviderClient.ImageInput> images,
            boolean stream
    ) throws IOException {
        List<Object> inputContent = new ArrayList<>();
        inputContent.add(Map.of("type", "input_text", "text", prompt));
        for (AiProviderClient.ImageInput image : images) {
            inputContent.add(Map.of(
                    "type", "input_image",
                    "image_url", buildDataUrl(image)
            ));
        }
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("model", profile.model());
        request.put("temperature", profile.temperature());
        request.put("top_p", profile.topP());
        if (stream) {
            request.put("stream", true);
        }
        request.put("instructions", "You are a QA assistant that outputs only structured JSON.");
        request.put("input", List.of(
                Map.of("role", "user", "content", inputContent)
        ));
        return objectMapper.writeValueAsString(request);
    }

    protected HttpResponse<String> sendRequest(
            String method,
            String endpoint,
            String apiKey,
            String requestBody,
            Integer requestTimeoutSeconds
    )
            throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(resolveRequestTimeoutSeconds(requestTimeoutSeconds)))
                .header("Content-Type", "application/json");
        applyAuthHeader(builder, apiKey);
        if ("GET".equalsIgnoreCase(method)) {
            return httpClient.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
        }
        return httpClient.send(
                builder.POST(HttpRequest.BodyPublishers.ofString(requestBody == null ? "" : requestBody)).build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    protected HttpResponse<java.util.stream.Stream<String>> sendStreamingRequest(
            String endpoint,
            String apiKey,
            String requestBody,
            Integer requestTimeoutSeconds
    ) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(resolveRequestTimeoutSeconds(requestTimeoutSeconds)))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream");
        applyAuthHeader(builder, apiKey);
        return httpClient.send(
                builder.POST(HttpRequest.BodyPublishers.ofString(requestBody == null ? "" : requestBody)).build(),
                HttpResponse.BodyHandlers.ofLines()
        );
    }

    protected long resolveRequestTimeoutSeconds(Integer requestTimeoutSeconds) {
        if (requestTimeoutSeconds == null) {
            return defaultRequestTimeoutSeconds;
        }
        return Math.max(5, requestTimeoutSeconds);
    }

    protected void applyAuthHeader(HttpRequest.Builder builder, String apiKey) {
        builder.header("Authorization", "Bearer " + apiKey);
    }

    protected String resolveServiceRoot(String baseUrl) {
        String trimmed = baseUrl == null ? "" : baseUrl.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("AI API URL 不能为空");
        }
        if (trimmed.endsWith("/chat/completions")) {
            return trimmed.substring(0, trimmed.length() - "/chat/completions".length());
        }
        if (trimmed.endsWith("/responses")) {
            return trimmed.substring(0, trimmed.length() - "/responses".length());
        }
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    protected String resolveChatEndpoint(String baseUrl) {
        String root = resolveServiceRoot(baseUrl);
        return root + "/chat/completions";
    }

    protected String resolveResponsesEndpoint(String baseUrl) {
        String root = resolveServiceRoot(baseUrl);
        return root + "/responses";
    }

    protected String resolveModelsEndpoint(String baseUrl) {
        return resolveServiceRoot(baseUrl) + "/models";
    }

    protected String extractChatCompletionsContent(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.isNull()) {
            throw new BadRequestException("AI 提供方返回了空内容");
        }
        return stripJsonFence(extractContent(contentNode));
    }

    protected String extractResponsesContent(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode outputText = root.path("output_text");
        if (outputText.isTextual() && !outputText.asText().isBlank()) {
            return stripJsonFence(outputText.asText());
        }
        JsonNode output = root.path("output");
        if (!output.isArray()) {
            throw new BadRequestException("AI 提供方返回了空内容");
        }
        StringBuilder builder = new StringBuilder();
        for (JsonNode item : output) {
            JsonNode content = item.path("content");
            if (!content.isArray()) {
                continue;
            }
            for (JsonNode contentItem : content) {
                JsonNode textNode = contentItem.path("text");
                if (textNode.isTextual()) {
                    builder.append(textNode.asText());
                }
            }
        }
        String merged = builder.toString().trim();
        if (merged.isEmpty()) {
            throw new BadRequestException("AI 提供方返回了空内容");
        }
        return stripJsonFence(merged);
    }

    protected String buildDataUrl(AiProviderClient.ImageInput image) {
        return "data:" + image.contentType() + ";base64," + Base64.getEncoder().encodeToString(image.bytes());
    }

    protected String stripJsonFence(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstLineBreak = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstLineBreak > 0 && lastFence > firstLineBreak) {
                return trimmed.substring(firstLineBreak + 1, lastFence).trim();
            }
        }
        return trimmed;
    }

    protected String extractContent(JsonNode contentNode) {
        if (contentNode.isTextual()) {
            return contentNode.asText();
        }
        if (contentNode.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode node : contentNode) {
                JsonNode textNode = node.path("text");
                if (textNode.isTextual()) {
                    builder.append(textNode.asText());
                }
            }
            return builder.toString();
        }
        return contentNode.toString();
    }

    protected boolean requiresStreamFallback(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return false;
        }
        String lower = responseBody.toLowerCase(Locale.ROOT);
        return lower.contains("only support stream mode") || lower.contains("enable the stream parameter");
    }

    protected boolean requiresImageCapability(String responseBody, List<AiProviderClient.ImageInput> images) {
        if (images == null || images.isEmpty() || responseBody == null || responseBody.isBlank()) {
            return false;
        }
        String lower = responseBody.toLowerCase(Locale.ROOT);
        return lower.contains("unknown variant")
                || lower.contains("expected `text`")
                || (lower.contains("failed to deserialize") && lower.contains("image"))
                || lower.contains("image_url")
                || lower.contains("does not support image")
                || lower.contains("image is not supported")
                || lower.contains("image input is not supported");
    }

    protected String mergeStreamingContent(String responseBody) throws IOException {
        StringBuilder builder = new StringBuilder();
        String[] lines = responseBody.split("\\n?\\n");
        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty() || !line.startsWith("data:")) {
                continue;
            }
            String payload = line.substring(5).trim();
            if (payload.isEmpty() || "[DONE]".equals(payload)) {
                continue;
            }
            JsonNode root = objectMapper.readTree(payload);
            JsonNode delta = root.path("choices").path(0).path("delta");
            if (delta.isMissingNode() || delta.isNull()) {
                continue;
            }
            JsonNode contentNode = delta.path("content");
            if (contentNode.isMissingNode() || contentNode.isNull()) {
                continue;
            }
            builder.append(extractContent(contentNode));
        }
        return builder.toString();
    }

    protected String consumeChatStreamingLines(
            java.util.stream.Stream<String> lines,
            Consumer<String> deltaConsumer,
            Integer idleTimeoutSeconds
    ) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (lines) {
            var iterator = lines.iterator();
            try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
                while (nextStreamLine(iterator, executor, idleTimeoutSeconds)) {
                    String rawLine = iterator.next();
                    String delta = extractChatStreamingDelta(rawLine);
                    if (delta == null || delta.isEmpty()) {
                        continue;
                    }
                    builder.append(delta);
                    if (deltaConsumer != null) {
                        deltaConsumer.accept(delta);
                    }
                }
            }
        }
        return builder.toString();
    }

    protected String extractChatStreamingDelta(String rawLine) throws IOException {
        String line = rawLine == null ? "" : rawLine.trim();
        if (line.isEmpty() || !line.startsWith("data:")) {
            return null;
        }
        String payload = line.substring(5).trim();
        if (payload.isEmpty() || "[DONE]".equals(payload)) {
            return null;
        }
        JsonNode root = objectMapper.readTree(payload);
        JsonNode delta = root.path("choices").path(0).path("delta");
        if (delta.isMissingNode() || delta.isNull()) {
            return null;
        }
        JsonNode contentNode = delta.path("content");
        if (contentNode.isMissingNode() || contentNode.isNull()) {
            return null;
        }
        return extractContent(contentNode);
    }

    protected String consumeResponsesStreamingLines(
            java.util.stream.Stream<String> lines,
            Consumer<String> deltaConsumer,
            Integer idleTimeoutSeconds
    ) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (lines) {
            var iterator = lines.iterator();
            try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
                while (nextStreamLine(iterator, executor, idleTimeoutSeconds)) {
                    String rawLine = iterator.next();
                    String delta = extractResponsesStreamingDelta(rawLine);
                    if (delta == null || delta.isEmpty()) {
                        continue;
                    }
                    builder.append(delta);
                    if (deltaConsumer != null) {
                        deltaConsumer.accept(delta);
                    }
                }
            }
        }
        return builder.toString();
    }

    private boolean nextStreamLine(
            java.util.Iterator<String> iterator,
            ExecutorService executor,
            Integer idleTimeoutSeconds
    ) throws IOException {
        Future<Boolean> next = executor.submit(iterator::hasNext);
        try {
            return next.get(resolveRequestTimeoutSeconds(idleTimeoutSeconds), TimeUnit.SECONDS);
        } catch (TimeoutException exception) {
            next.cancel(true);
            throw new BadRequestException("AI 提供方流式响应空闲超时");
        } catch (InterruptedException exception) {
            next.cancel(true);
            Thread.currentThread().interrupt();
            throw new BadRequestException("AI 提供方流式读取被中断");
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new IOException("AI 提供方流式读取失败", cause);
        }
    }

    protected String extractResponsesStreamingDelta(String rawLine) throws IOException {
        String line = rawLine == null ? "" : rawLine.trim();
        if (line.isEmpty() || !line.startsWith("data:")) {
            return null;
        }
        String payload = line.substring(5).trim();
        if (payload.isEmpty() || "[DONE]".equals(payload)) {
            return null;
        }
        JsonNode root = objectMapper.readTree(payload);
        String type = root.path("type").asText("");
        if ("response.output_text.delta".equals(type) || "response.text.delta".equals(type)) {
            JsonNode delta = root.path("delta");
            return delta.isTextual() ? delta.asText() : null;
        }
        JsonNode outputTextDelta = root.path("output_text_delta");
        if (outputTextDelta.isTextual()) {
            return outputTextDelta.asText();
        }
        return null;
    }

    protected String readResponseBody(java.util.stream.Stream<String> lines) {
        if (lines == null) {
            return "";
        }
        try (lines) {
            return String.join("\n", lines.toList());
        }
    }

    protected String abbreviate(String value) {
        if (value == null || value.length() <= LOG_BODY_LIMIT) {
            return value;
        }
        return value.substring(0, LOG_BODY_LIMIT) + "...(truncated)";
    }
}
