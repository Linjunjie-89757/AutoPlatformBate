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
                .header("Content-Type", "application/json");
        applyRequestTimeout(builder, requestTimeoutSeconds);
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
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream");
        applyRequestTimeout(builder, requestTimeoutSeconds);
        applyAuthHeader(builder, apiKey);
        return httpClient.send(
                builder.POST(HttpRequest.BodyPublishers.ofString(requestBody == null ? "" : requestBody)).build(),
                HttpResponse.BodyHandlers.ofLines()
        );
    }

    private void applyRequestTimeout(HttpRequest.Builder builder, Integer requestTimeoutSeconds) {
        // Generation tasks own cancellation and timing, including non-streaming requests.
        // A provider's shorter timeout must not cut off a healthy task or its first response.
        if (AiTaskTimeout.current() == null) {
            builder.timeout(Duration.ofSeconds(resolveRequestTimeoutSeconds(requestTimeoutSeconds)));
        }
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
        return consumeStreamingLines(lines, deltaConsumer, idleTimeoutSeconds, false);
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

    protected String consumeResponsesStreamingLines(java.util.stream.Stream<String> lines,
            Consumer<String> deltaConsumer, Integer idleTimeoutSeconds) throws IOException {
        return consumeStreamingLines(lines, deltaConsumer, idleTimeoutSeconds, true);
    }

    private String consumeStreamingLines(java.util.stream.Stream<String> lines, Consumer<String> deltaConsumer,
            Integer idleTimeoutSeconds, boolean responses) throws IOException {
        StringBuilder content = new StringBuilder();
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        Future<Boolean> pending = null;
        long idleNanos = TimeUnit.SECONDS.toNanos(resolveRequestTimeoutSeconds(idleTimeoutSeconds));
        long lastContentAt = System.nanoTime();
        AiTaskTimeout taskTimeout = AiTaskTimeout.current();
        try {
            var iterator = lines.iterator();
            while (true) {
                if (Thread.currentThread().isInterrupted()) throw new BadRequestException("AI 提供方流式读取被中断");
                long remaining = taskTimeout == null
                        ? idleNanos - (System.nanoTime() - lastContentAt) : taskTimeout.remainingNanos();
                if (remaining <= 0) {
                    if (taskTimeout != null) throw taskTimeout.failure();
                    throw new BadRequestException("AI 提供方流式响应有效输出空闲超时");
                }
                pending = executor.submit(iterator::hasNext);
                if (!pending.get(remaining, TimeUnit.NANOSECONDS)) break;
                String line = iterator.next();
                if (isTerminalStreamLine(line, responses)) break;
                String delta = responses ? extractResponsesStreamingDelta(line) : extractChatStreamingDelta(line);
                if (delta == null || delta.isEmpty()) continue;
                lastContentAt = System.nanoTime();
                content.append(delta);
                if (content.length() > 1_000_000) throw new BadRequestException("AI 输出超过安全长度，已保留已解析内容");
                if (deltaConsumer != null) deltaConsumer.accept(delta);
            }
            return content.toString();
        } catch (TimeoutException exception) {
            if (taskTimeout != null) throw taskTimeout.failure();
            throw new BadRequestException("AI 提供方流式响应有效输出空闲超时");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("AI 提供方流式读取被中断");
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof RuntimeException runtime) throw runtime;
            throw new IOException("AI 提供方流式读取失败", exception.getCause());
        } finally {
            if (pending != null) pending.cancel(true);
            // Close the body before releasing the executor: an idle socket read may ignore interruption.
            try { lines.close(); } finally { executor.shutdownNow(); }
        }
    }

    private boolean isTerminalStreamLine(String rawLine, boolean responses) throws IOException {
        String line = rawLine == null ? "" : rawLine.trim();
        if (!line.startsWith("data:")) {
            if (!line.isBlank()) AiStreamDiagnostics.wire(0, null);
            return false;
        }
        String payload = line.substring(5).trim();
        if ("[DONE]".equals(payload)) { AiStreamDiagnostics.wire(0, "DONE"); return true; }
        if (payload.isEmpty()) return false;
        JsonNode event = objectMapper.readTree(payload);
        String type = event.path("type").asText("");
        String finishReason = event.path("choices").path(0).path("finish_reason").asText("");
        AiStreamDiagnostics.wire(event.path("choices").path(0).path("delta").path("reasoning_content").asText("").length(),
                finishReason.isBlank() ? ("response.completed".equals(type) ? type : null) : finishReason);
        if (event.has("error") || "response.failed".equals(type) || "response.incomplete".equals(type)
                || "length".equals(finishReason) || "content_filter".equals(finishReason)) {
            throw new BadRequestException("AI 响应未正常完成，已保留已解析内容");
        }
        return responses && "response.completed".equals(type);
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
