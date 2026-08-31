package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiProviderClientTests {

    private final OpenAiCompatibleChatAdapter chatAdapter = new OpenAiCompatibleChatAdapter(60);
    private final OpenAiCompatibleResponsesAdapter responsesAdapter = new OpenAiCompatibleResponsesAdapter(60);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void openAiChatAppendsChatCompletionsForServiceRootBaseUrl() {
        String endpoint = (String) ReflectionTestUtils.invokeMethod(chatAdapter, "resolveChatEndpoint", "https://api.openai.com/v1");

        assertThat(endpoint).isEqualTo("https://api.openai.com/v1/chat/completions");
    }

    @Test
    void openAiResponsesAppendsResponsesForServiceRootBaseUrl() {
        String endpoint = (String) ReflectionTestUtils.invokeMethod(responsesAdapter, "resolveResponsesEndpoint", "https://proxy.example/v1");

        assertThat(endpoint).isEqualTo("https://proxy.example/v1/responses");
    }

    @Test
    void explicitChatCompletionsEndpointFallsBackToServiceRoot() {
        String endpoint = (String) ReflectionTestUtils.invokeMethod(chatAdapter, "resolveChatEndpoint", "https://proxy.example/v1/chat/completions");

        assertThat(endpoint).isEqualTo("https://proxy.example/v1/chat/completions");
    }

    @Test
    void buildsChatRequestBodyWithPlainStringContentWhenNoImages() throws Exception {
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "OPENAI_COMPATIBLE_CHAT",
                "gpt-5",
                "https://proxy.example/v1",
                0.3,
                0.9,
                20,
                60
        );

        String body = (String) ReflectionTestUtils.invokeMethod(
                chatAdapter,
                "buildChatCompletionsRequestBody",
                profile,
                "hello",
                List.of(),
                false
        );
        JsonNode root = objectMapper.readTree(body);

        assertThat(root.path("messages").path(1).path("role").asText()).isEqualTo("user");
        assertThat(root.path("messages").path(1).path("content").isTextual()).isTrue();
        assertThat(root.path("messages").path(1).path("content").asText()).isEqualTo("hello");
    }

    @Test
    void buildsChatRequestBodyWithArrayContentWhenImagesPresent() throws Exception {
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "OPENAI_COMPATIBLE_CHAT",
                "gpt-5",
                "https://proxy.example/v1",
                0.3,
                0.9,
                20,
                60
        );

        String body = (String) ReflectionTestUtils.invokeMethod(
                chatAdapter,
                "buildChatCompletionsRequestBody",
                profile,
                "hello",
                List.of(new AiProviderClient.ImageInput("a.png", "image/png", new byte[]{1, 2, 3})),
                false
        );
        JsonNode root = objectMapper.readTree(body);

        assertThat(root.path("messages").path(1).path("content").isArray()).isTrue();
        assertThat(root.path("messages").path(1).path("content").size()).isEqualTo(2);
        assertThat(root.path("messages").path(1).path("content").path(0).path("type").asText()).isEqualTo("text");
        assertThat(root.path("messages").path(1).path("content").path(0).path("text").asText()).isEqualTo("hello");
        assertThat(root.path("messages").path(1).path("content").path(1).path("type").asText()).isEqualTo("image_url");
        assertThat(root.path("messages").path(1).path("content").path(1).path("image_url").path("url").asText())
                .startsWith("data:image/png;base64,");
    }

    @Test
    void buildsResponsesRequestBodyWithInputField() throws Exception {
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_RESPONSES,
                "OPENAI_COMPATIBLE_RESPONSES",
                "gpt-5",
                "https://proxy.example/v1",
                0.3,
                0.9,
                20,
                60
        );

        String body = (String) ReflectionTestUtils.invokeMethod(
                responsesAdapter,
                "buildResponsesRequestBody",
                profile,
                "hello",
                List.of()
        );
        JsonNode root = objectMapper.readTree(body);

        assertThat(root.path("instructions").asText()).contains("structured JSON");
        assertThat(root.has("messages")).isFalse();
        assertThat(root.path("input").isArray()).isTrue();
        assertThat(root.path("input").path(0).path("role").asText()).isEqualTo("user");
        assertThat(root.path("input").path(0).path("content").path(0).path("type").asText()).isEqualTo("input_text");
        assertThat(root.path("input").path(0).path("content").path(0).path("text").asText()).isEqualTo("hello");
    }

    @Test
    void buildsResponsesRequestBodyWithInputImageItems() throws Exception {
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_RESPONSES,
                "OPENAI_COMPATIBLE_RESPONSES",
                "gpt-5",
                "https://proxy.example/v1",
                0.3,
                0.9,
                20,
                60
        );

        String body = (String) ReflectionTestUtils.invokeMethod(
                responsesAdapter,
                "buildResponsesRequestBody",
                profile,
                "hello",
                List.of(new AiProviderClient.ImageInput("a.png", "image/png", new byte[]{1, 2, 3}))
        );
        JsonNode root = objectMapper.readTree(body);

        assertThat(root.path("input").path(0).path("content").size()).isEqualTo(2);
        assertThat(root.path("input").path(0).path("content").path(1).path("type").asText()).isEqualTo("input_image");
        assertThat(root.path("input").path(0).path("content").path(1).path("image_url").asText())
                .startsWith("data:image/png;base64,");
    }

    @Test
    void extractsResponsesOutputText() {
        String content = (String) ReflectionTestUtils.invokeMethod(
                responsesAdapter,
                "extractResponsesContent",
                "{\"output_text\":\"{\\\"ok\\\":true}\"}"
        );

        assertThat(content).isEqualTo("{\"ok\":true}");
    }

    @Test
    void extractsResponsesStreamingOutputTextDelta() {
        String delta = (String) ReflectionTestUtils.invokeMethod(
                responsesAdapter,
                "extractResponsesStreamingDelta",
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}"
        );

        assertThat(delta).isEqualTo("hello");
    }

    @Test
    void requestTimeoutFallsBackToAdapterDefaultWhenProfileDoesNotOverride() throws Exception {
        Method method = AbstractOpenAiCompatibleAdapter.class.getDeclaredMethod("resolveRequestTimeoutSeconds", Integer.class);
        method.setAccessible(true);
        Long timeoutSeconds = (Long) method.invoke(chatAdapter, new Object[]{null});

        assertThat(timeoutSeconds).isEqualTo(60L);
    }

    @Test
    void requestTimeoutUsesProfileOverrideWhenProvided() throws Exception {
        Method method = AbstractOpenAiCompatibleAdapter.class.getDeclaredMethod("resolveRequestTimeoutSeconds", Integer.class);
        method.setAccessible(true);
        Long timeoutSeconds = (Long) method.invoke(chatAdapter, 180);

        assertThat(timeoutSeconds).isEqualTo(180L);
    }

    @Test
    void recognizesProviderMessageWhenModelDoesNotSupportImages() {
        boolean recognized = (boolean) ReflectionTestUtils.invokeMethod(
                chatAdapter,
                "requiresImageCapability",
                "{\"error\":{\"message\":\"This model does not support image\"}}",
                List.of(new AiProviderClient.ImageInput("a.png", "image/png", new byte[]{1, 2, 3}))
        );

        assertThat(recognized).isTrue();
    }

    @Test
    void forwardsImagesToStreamingAdapter() {
        AiProtocolAdapter adapter = mock(AiProtocolAdapter.class);
        when(adapter.protocolType()).thenReturn(AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT);
        when(adapter.supportsStructuredStreaming()).thenReturn(true);
        when(adapter.streamStructuredContent(any(), any(), any(), any(), any())).thenReturn("{}");
        AiProviderClient client = new AiProviderClient(List.of(adapter));
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "OPENAI_COMPATIBLE_CHAT",
                "deepseek-v4-pro",
                "https://proxy.example/v1",
                0.3,
                0.9,
                20,
                60
        );
        List<AiProviderClient.ImageInput> images = List.of(
                new AiProviderClient.ImageInput("a.png", "image/png", new byte[]{1, 2, 3})
        );

        client.streamStructuredContentWithResult(profile, "key", "prompt", images, delta -> { });

        verify(adapter).streamStructuredContent(eq(profile), eq("key"), eq("prompt"), eq(images), any());
    }

    @Test
    void parsesWrappedGeneratedCasesAndKeepsCoverageMetadata() {
        AiProviderClient client = new AiProviderClient(List.of());
        String content = """
                {
                  "coverageSummary":"covered login flows",
                  "remainingCoverageGaps":["rate limiting"],
                  "cases":[
                    {"title":"valid login","caseType":"FUNCTION","priority":"P1","steps":"submit valid credentials","expectedResult":"dashboard opens"}
                  ]
                }
                """;

        AiGeneratedCasesResult result = client.parseGeneratedCasesContent(content, 20);

        assertThat(result.generatedCases()).extracting(GeneratedAiCaseItem::title).containsExactly("valid login");
        assertThat(result.coverageSummary()).isEqualTo("covered login flows");
        assertThat(result.remainingCoverageGaps()).containsExactly("rate limiting");
        assertThat(result.rawContent()).isEqualTo(content);
    }

    @Test
    void parsesMarkdownAndConsecutiveJsonObjectsWithoutLineBoundaries() {
        AiProviderClient client = new AiProviderClient(List.of());
        String content = """
                Generated cases follow:
                ```json
                {"title":"payload with {braces}","caseType":"FUNCTION","priority":"P1","steps":"submit value \\"quoted\\"","expectedResult":"value is saved"}{"title":"empty payload","caseType":"BOUNDARY","priority":"P2","steps":"submit empty value","expectedResult":"validation is shown"}
                ```
                Generation complete.
                """;

        AiGeneratedCasesResult result = client.parseGeneratedCasesContent(content, 20);

        assertThat(result.generatedCases()).extracting(GeneratedAiCaseItem::title)
                .containsExactly("payload with {braces}", "empty payload");
        assertThat(result.generatedCases().get(0).steps()).isEqualTo("submit value \"quoted\"");
    }

    @Test
    void isolatesMalformedObjectAndContinuesWithLaterValidCase() {
        AiProviderClient client = new AiProviderClient(List.of());
        String validCase = "{\"title\":\"valid case\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\",\"steps\":\"run step\",\"expectedResult\":\"success\"}";

        AiGeneratedCasesResult result = client.parseGeneratedCasesContent("{not-json}" + validCase, 20);

        assertThat(result.generatedCases()).extracting(GeneratedAiCaseItem::title).containsExactly("valid case");
        assertThat(result.invalidCases()).hasSize(1);
        assertThat(result.invalidCases().get(0).reason()).isEqualTo("Malformed JSON object");
        assertThat(result.invalidCases().get(0).rawContent()).isEqualTo("{not-json}");
    }

    @Test
    void incrementalBoundaryExtractionWaitsForCompleteJsonAcrossDeltas() {
        StringBuilder buffer = new StringBuilder("prefix {\"title\":\"case with {brace} and ");
        List<String> extracted = new ArrayList<>();

        AiJsonBoundaryExtractor.drainCompleteValues(buffer, extracted::add);
        assertThat(extracted).isEmpty();

        buffer.append("\\\"quote\\\"\",\"steps\":\"run\",\"expectedResult\":\"ok\"}");
        AiJsonBoundaryExtractor.drainCompleteValues(buffer, extracted::add);

        assertThat(extracted).containsExactly("{\"title\":\"case with {brace} and \\\"quote\\\"\",\"steps\":\"run\",\"expectedResult\":\"ok\"}");
        assertThat(buffer).isEmpty();
    }

    @Test
    void rejectsEmptyOrExplanatoryGeneratedContent() {
        AiProviderClient client = new AiProviderClient(List.of());

        assertThatThrownBy(() -> client.parseGeneratedCasesContent("Generation completed without cases.", 20))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("AI 返回内容无法解析为结构化用例");
    }

    @Test
    void parsesReviewEnvelopeWithMarkdownAndLeadingExplanation() {
        AiProviderClient client = new AiProviderClient(List.of());
        AiReviewResult result = client.parseReviewResultContent("""
                Review result:
                ```json
                {"result":"SUGGEST","summary":"coverage needs improvement","caseDecisions":[{"caseIndex":0,"status":"CHANGE_SUGGESTED","reason":"missing boundary case"}]}
                ```
                """);

        assertThat(result.structured()).isTrue();
        assertThat(result.result()).isEqualTo("SUGGEST");
        assertThat(result.caseDecisions()).hasSize(1);
        assertThat(result.caseDecisions().get(0).status()).isEqualTo("CHANGE_SUGGESTED");
    }

    @Test
    void parsesConsecutiveStandaloneReviewObjects() {
        AiProviderClient client = new AiProviderClient(List.of());
        AiReviewResult result = client.parseReviewResultContent("""
                {"caseIndex":0,"status":"APPROVED","summary":"first"}
                {"caseIndex":1,"status":"NOT_RECOMMENDED","summary":"second"}
                """);

        assertThat(result.structured()).isTrue();
        assertThat(result.caseDecisions()).extracting(AiReviewCaseDecision::caseIndex).containsExactly(0, 1);
    }

    @Test
    void skipsMalformedReviewValueAndParsesLaterDecisionArray() {
        AiProviderClient client = new AiProviderClient(List.of());

        AiReviewResult result = client.parseReviewResultContent("""
                {not-json}
                [{"caseIndex":0,"status":"APPROVED","summary":"valid decision"}]
                """);

        assertThat(result.structured()).isTrue();
        assertThat(result.caseDecisions()).extracting(AiReviewCaseDecision::caseIndex).containsExactly(0);
    }

    @Test
    void marksNonStructuredReviewContentAsUnstructured() {
        AiProviderClient client = new AiProviderClient(List.of());

        AiReviewResult result = client.parseReviewResultContent("The review service returned no JSON.");

        assertThat(result.structured()).isFalse();
        assertThat(result.caseDecisions()).isEmpty();
    }

    @Test
    void genericVisionErrorDoesNotTriggerImageDowngrade() {
        AiResponseParsingSupport parsingSupport = new AiResponseParsingSupport(new AiProviderClient(List.of()));

        assertThat(parsingSupport.isImageInputUnsupportedError(new BadRequestException("vision service temporarily unavailable")))
                .isFalse();
        assertThat(parsingSupport.isImageInputUnsupportedError(new BadRequestException("this is not a vision model")))
                .isTrue();
    }
}
