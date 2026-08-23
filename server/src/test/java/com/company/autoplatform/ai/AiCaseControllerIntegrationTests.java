package com.company.autoplatform.ai;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@TestPropertySource(properties = "app.ai.asset-storage-root=./target/test-ai-assets/ai-case-controller")
class AiCaseControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiProviderClient aiProviderClient;

    @Test
    void providerCreateListUpdateAndSecretKeepResponseShape() throws Exception {
        String unique = uniquePrefix("provider");
        String createdSecret = unique + "-secret";
        String updatedSecret = unique + "-updated-secret";

        Long providerId = createProvider(unique + "-connection", "gpt-5-mini", createdSecret);

        mockMvc.perform(get("/api/cases/ai/providers")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].id", hasItem(providerId.intValue())))
                .andExpect(jsonPath("$.data[*].connectionName", hasItem(unique + "-connection")));

        mockMvc.perform(put("/api/cases/ai/providers/{id}", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(providerRequest(unique + "-connection-updated", "gpt-5.1", updatedSecret)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.workspaceCode").value("PERSONAL"))
                .andExpect(jsonPath("$.data.connectionName").value(unique + "-connection-updated"))
                .andExpect(jsonPath("$.data.protocolType").value(AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT))
                .andExpect(jsonPath("$.data.baseUrl").value("https://ai.example.test/v1"))
                .andExpect(jsonPath("$.data.requestTimeoutSeconds").value(30))
                .andExpect(jsonPath("$.data.modelName").value("gpt-5.1"))
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.status").value(1));

        mockMvc.perform(get("/api/cases/ai/providers/{id}/secret", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.apiKey").value(updatedSecret));
    }

    @Test
    void configCreateGetUpdateAndSecretKeepResponseShape() throws Exception {
        String unique = uniquePrefix("config");
        Long providerId = createProvider(unique + "-provider", "gpt-5-mini", unique + "-provider-secret");

        String createResponse = mockMvc.perform(post("/api/cases/ai/config")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(configRequest(providerId, "CASE_GENERATOR", "gpt-5-mini", unique + " prompt", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.workspaceCode").value("PERSONAL"))
                .andExpect(jsonPath("$.data.roleType").value("CASE_GENERATOR"))
                .andExpect(jsonPath("$.data.providerConnectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.providerConnectionName").value(unique + "-provider"))
                .andExpect(jsonPath("$.data.protocolType").value(AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT))
                .andExpect(jsonPath("$.data.provider").value("OPENAI_COMPATIBLE_CHAT"))
                .andExpect(jsonPath("$.data.model").value("gpt-5-mini"))
                .andExpect(jsonPath("$.data.baseUrl").value("https://ai.example.test/v1"))
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.promptTemplate").value(unique + " prompt"))
                .andExpect(jsonPath("$.data.temperature").value(0.3))
                .andExpect(jsonPath("$.data.topP").value(0.9))
                .andExpect(jsonPath("$.data.maxCases").value(12))
                .andExpect(jsonPath("$.data.supportsImageInput").isBoolean())
                .andExpect(jsonPath("$.data.status").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long configId = objectMapper.readTree(createResponse).path("data").path("id").asLong();

        mockMvc.perform(get("/api/cases/ai/config")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.generatorConfig.id").value(configId.intValue()))
                .andExpect(jsonPath("$.data.generatorConfig.roleType").value("CASE_GENERATOR"))
                .andExpect(jsonPath("$.data.generatorConfig.providerConnectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.generatorConfig.promptTemplate").value(unique + " prompt"))
                .andExpect(jsonPath("$.data.hasLegacyConfig").isBoolean())
                .andExpect(jsonPath("$.data.canBootstrapFromLegacy").isBoolean());

        mockMvc.perform(put("/api/cases/ai/config/{id}", configId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(configRequest(providerId, "CASE_GENERATOR", "gpt-5.1", unique + " prompt updated", 0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(configId.intValue()))
                .andExpect(jsonPath("$.data.roleType").value("CASE_GENERATOR"))
                .andExpect(jsonPath("$.data.model").value("gpt-5.1"))
                .andExpect(jsonPath("$.data.promptTemplate").value(unique + " prompt updated"))
                .andExpect(jsonPath("$.data.status").value(0));

        mockMvc.perform(get("/api/cases/ai/config/{id}/secret", configId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(configId.intValue()))
                .andExpect(jsonPath("$.data.roleType").value("CASE_GENERATOR"))
                .andExpect(jsonPath("$.data.apiKey").value(unique + "-provider-secret"));
    }

    @Test
    void txtRequirementDocumentImportKeepsResponseShape() throws Exception {
        String unique = uniquePrefix("requirement");
        byte[] content = ("# " + unique + " title\n\n- login with valid account\n- verify dashboard").getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", unique + ".txt", "text/plain", content);

        mockMvc.perform(multipart("/api/cases/ai/requirement-import")
                        .file(file)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fileName").value(unique + ".txt"))
                .andExpect(jsonPath("$.data.title").value(unique + " title"))
                .andExpect(jsonPath("$.data.content").value(new String(content, StandardCharsets.UTF_8).trim()))
                .andExpect(jsonPath("$.data.charCount").value(new String(content, StandardCharsets.UTF_8).trim().length()))
                .andExpect(jsonPath("$.data.assets.length()").value(0));
    }

    @Test
    void imageAssetUploadDownloadAndDeleteKeepMainFlow() throws Exception {
        String unique = uniquePrefix("asset");
        byte[] png = tinyPng();
        MockMultipartFile file = new MockMultipartFile("files", unique + ".png", "image/png", png);

        String uploadResponse = mockMvc.perform(multipart("/api/cases/ai/assets")
                        .file(file)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").isNumber())
                .andExpect(jsonPath("$.data[0].sourceType").value("MANUAL_UPLOAD"))
                .andExpect(jsonPath("$.data[0].fileName").value(unique + ".png"))
                .andExpect(jsonPath("$.data[0].contentType").value("image/png"))
                .andExpect(jsonPath("$.data[0].fileSize").value(png.length))
                .andExpect(jsonPath("$.data[0].extractedText").doesNotExist())
                .andExpect(jsonPath("$.data[0].downloadUrl", notNullValue()))
                .andExpect(jsonPath("$.data[0].createdAt", notNullValue()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long assetId = objectMapper.readTree(uploadResponse).path("data").get(0).path("id").asLong();

        mockMvc.perform(get("/api/cases/ai/assets/{id}/download", assetId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().longValue("Content-Length", png.length))
                .andExpect(content().bytes(png));

        mockMvc.perform(delete("/api/cases/ai/assets/{id}", assetId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void providerTestFetchModelsListModelsAndProbeKeepResponseShape() throws Exception {
        reset(aiProviderClient);
        String unique = uniquePrefix("provider-models");
        Long providerId = createProvider(unique + "-provider", "gpt-5-mini", unique + "-secret");
        AiModelCapabilities fetchedCapabilities = capabilities(true, true, false);
        AiModelCapabilities probedCapabilities = capabilities(true, true, true);
        when(aiProviderClient.fetchModels(any(), any())).thenReturn(new AiModelFetchResult(List.of(
                new AiProviderModelItem(
                        null,
                        null,
                        unique + "-model-a",
                        unique + " Model A",
                        fetchedCapabilities,
                        true,
                        "{\"source\":\"mock\"}",
                        null
                ),
                new AiProviderModelItem(
                        null,
                        null,
                        unique + "-model-b",
                        unique + " Model B",
                        fetchedCapabilities,
                        false,
                        null,
                        null
                )
        ), "mock models fetched"));
        when(aiProviderClient.probeCapabilities(any(), any())).thenReturn(probedCapabilities);

        mockMvc.perform(post("/api/cases/ai/providers/{id}/test", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.connectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.connectionName").value(unique + "-provider"))
                .andExpect(jsonPath("$.data.protocolType").value(AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT))
                .andExpect(jsonPath("$.data.message").isString())
                .andExpect(jsonPath("$.data.verifiedAt", notNullValue()));

        mockMvc.perform(get("/api/cases/ai/providers")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id == %d)].status".formatted(providerId), hasItem(1)))
                .andExpect(jsonPath("$.data[?(@.id == %d)].lastVerifiedAt".formatted(providerId), hasItem(notNullValue())));

        mockMvc.perform(post("/api/cases/ai/providers/{id}/fetch-models", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.connectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.connectionName").value(unique + "-provider"))
                .andExpect(jsonPath("$.data.models.length()").value(2))
                .andExpect(jsonPath("$.data.models[*].modelName", hasItem(unique + "-model-a")))
                .andExpect(jsonPath("$.data.models[*].modelName", hasItem(unique + "-model-b")))
                .andExpect(jsonPath("$.data.models[?(@.modelName == '%s')].displayName".formatted(unique + "-model-a"),
                        hasItem(unique + " Model A")))
                .andExpect(jsonPath("$.data.models[?(@.modelName == '%s')].selectable".formatted(unique + "-model-a"),
                        hasItem(true)))
                .andExpect(jsonPath("$.data.models[?(@.modelName == '%s')].detectedCapabilities.imageInput.supported".formatted(unique + "-model-a"),
                        hasItem(false)))
                .andExpect(jsonPath("$.data.fetchedAt", notNullValue()))
                .andExpect(jsonPath("$.data.message").value("mock models fetched"));

        mockMvc.perform(get("/api/cases/ai/providers/{id}/models", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[*].connectionId", hasItem(providerId.intValue())))
                .andExpect(jsonPath("$.data[*].modelName", hasItem(unique + "-model-a")))
                .andExpect(jsonPath("$.data[*].modelName", hasItem(unique + "-model-b")));

        mockMvc.perform(post("/api/cases/ai/providers/{id}/models/probe", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "modelName": "%s"
                                }
                                """.formatted(unique + "-model-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.connectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.modelName").value(unique + "-model-a"))
                .andExpect(jsonPath("$.data.displayName").value(unique + " Model A"))
                .andExpect(jsonPath("$.data.detectedCapabilities.imageInput.supported").value(true))
                .andExpect(jsonPath("$.data.detectedCapabilities.imageInput.source").value(AiModelCapabilities.SOURCE_PROBED))
                .andExpect(jsonPath("$.data.selectable").value(true))
                .andExpect(jsonPath("$.data.lastProbedAt", notNullValue()));
    }

    @Test
    void providerTestFailureRecordsHealthWithoutDisablingConnectionAndConfigTestUsesBoundProvider() throws Exception {
        reset(aiProviderClient);
        String unique = uniquePrefix("provider-test");
        Long failingProviderId = createProvider(unique + "-failing-provider", "gpt-5-mini", unique + "-failing-secret");
        doThrow(new BadRequestException("mock connection failed"))
                .when(aiProviderClient)
                .testConnection(any(), any());

        mockMvc.perform(post("/api/cases/ai/providers/{id}/test", failingProviderId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("mock connection failed"));

        mockMvc.perform(get("/api/cases/ai/providers")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id == %d)].status".formatted(failingProviderId), hasItem(1)))
                .andExpect(jsonPath("$.data[?(@.id == %d)].lastTestStatus".formatted(failingProviderId), hasItem("FAILED")))
                .andExpect(jsonPath("$.data[?(@.id == %d)].lastTestAt".formatted(failingProviderId), hasItem(notNullValue())));

        reset(aiProviderClient);
        Long providerId = createProvider(unique + "-config-provider", "gpt-5.1", unique + "-config-secret");
        mockMvc.perform(post("/api/cases/ai/config/test")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(configRequest(providerId, "CASE_REVIEWER", "gpt-5.1", unique + " reviewer prompt", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.provider").value("OPENAI_COMPATIBLE_CHAT"))
                .andExpect(jsonPath("$.data.model").value("gpt-5.1"))
                .andExpect(jsonPath("$.data.message").value("AI 连接可用"));
    }

    @Test
    void providerModelStatusAndDeleteEnforceDefaultAndBindingRules() throws Exception {
        reset(aiProviderClient);
        switchToTestUser(14L, "zhaofeng");
        String unique = uniquePrefix("provider-model-actions");
        Long providerId = createProvider(unique + "-provider", unique + "-default", unique + "-secret");
        AiModelCapabilities capabilities = capabilities(true, true, false);
        when(aiProviderClient.fetchModels(any(), any())).thenReturn(new AiModelFetchResult(List.of(
                new AiProviderModelItem(null, null, unique + "-default", "Default Model", capabilities, true, null, null),
                new AiProviderModelItem(null, null, unique + "-alternate", "Alternate Model", capabilities, true, null, null),
                new AiProviderModelItem(null, null, unique + "-disposable", "Disposable Model", capabilities, true, null, null)
        ), "mock models fetched"));

        String fetchResponse = mockMvc.perform(post("/api/cases/ai/providers/{id}/fetch-models", providerId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        var fetchedModels = objectMapper.readTree(fetchResponse).path("data").path("models");
        Long alternateModelId = java.util.stream.StreamSupport.stream(fetchedModels.spliterator(), false)
                .filter(model -> model.path("modelName").asText().equals(unique + "-alternate"))
                .findFirst()
                .orElseThrow()
                .path("id")
                .asLong();
        Long defaultModelId = java.util.stream.StreamSupport.stream(fetchedModels.spliterator(), false)
                .filter(model -> model.path("modelName").asText().equals(unique + "-default"))
                .findFirst()
                .orElseThrow()
                .path("id")
                .asLong();
        Long disposableModelId = java.util.stream.StreamSupport.stream(fetchedModels.spliterator(), false)
                .filter(model -> model.path("modelName").asText().equals(unique + "-disposable"))
                .findFirst()
                .orElseThrow()
                .path("id")
                .asLong();

        mockMvc.perform(put("/api/cases/ai/providers/{id}/models/{modelId}", providerId, alternateModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("{\"selectable\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(alternateModelId.intValue()))
                .andExpect(jsonPath("$.data.selectable").value(false));

        mockMvc.perform(put("/api/cases/ai/providers/{id}/models/{modelId}", providerId, alternateModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("{\"selectable\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selectable").value(true));

        createConfig(providerId, "CASE_GENERATOR", unique + "-alternate", unique + " binding", 1, true);

        mockMvc.perform(put("/api/cases/ai/providers/{id}/models/{modelId}", providerId, alternateModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("{\"selectable\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("该模型已被 AI 用途绑定，不能停用"));

        mockMvc.perform(delete("/api/cases/ai/providers/{id}/models/{modelId}", providerId, alternateModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("该模型已被 AI 用途绑定，请先解除绑定后再删除"));

        mockMvc.perform(delete("/api/cases/ai/providers/{id}/models/{modelId}", providerId, defaultModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("当前模型是默认模型，请先切换默认模型后再删除"));

        mockMvc.perform(delete("/api/cases/ai/providers/{id}/models/{modelId}", providerId, disposableModelId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void generateReviewAndImageSupportValidateKeepSynchronousResponseShape() throws Exception {
        reset(aiProviderClient);
        switchToTestUser(12L, "chennan");
        String unique = uniquePrefix("sync");
        Long providerId = createProvider(unique + "-provider", "gpt-4o-mini", unique + "-secret");
        createConfig(providerId, "CASE_GENERATOR", "gpt-4o-mini", unique + " generator prompt", 1, true);
        createConfig(providerId, "CASE_REVIEWER", "gpt-4o-mini", unique + " reviewer prompt", 1, true);
        Long assetId = uploadImageAsset(unique + "-asset");
        GeneratedAiCaseItem generatedCase = generatedCase(unique + " generated case");
        AiReviewResult reviewResult = new AiReviewResult(
                "APPROVE",
                "review summary",
                List.of("issue one"),
                List.of("suggestion one"),
                List.of(new AiReviewCaseDecision(
                        1,
                        "APPROVED",
                        "case approved",
                        "coverage ok",
                        "evidence ok",
                        "review comment",
                        null,
                        null,
                        null
                )),
                List.of(),
                List.of("unresolved gap"),
                "{\"result\":\"APPROVE\"}",
                true
        );
        when(aiProviderClient.generate(any(), any(), any(), any())).thenReturn(new AiGeneratedCasesResult(
                List.of(generatedCase),
                "coverage summary",
                List.of("remaining gap"),
                List.of("generation warning"),
                List.of(),
                "{\"cases\":[{\"title\":\"" + unique + "\"}]}"
        ));
        when(aiProviderClient.review(any(), any(), any())).thenReturn(reviewResult);

        mockMvc.perform(post("/api/cases/ai/tasks/image-support/validate")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "assetIds": [%d]
                                }
                                """.formatted(assetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("AI generation image support validated"));

        mockMvc.perform(post("/api/cases/ai/generate")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "requirementTitle": "%s requirement",
                                  "requirementContent": "User can login and view dashboard.",
                                  "sceneFocus": "login",
                                  "improvementNotes": "cover happy path",
                                  "assetIds": [],
                                  "existingCases": [],
                                  "ownerId": 101,
                                  "maxCases": 2
                                }
                                """.formatted(WORKSPACE_CODE, unique)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.provider").value("OPENAI_COMPATIBLE_CHAT"))
                .andExpect(jsonPath("$.data.model").value("gpt-4o-mini"))
                .andExpect(jsonPath("$.data.systemMaxCases").value(200))
                .andExpect(jsonPath("$.data.requestedMaxCases").value(2))
                .andExpect(jsonPath("$.data.effectiveMaxCases").value(2))
                .andExpect(jsonPath("$.data.actualGeneratedCount").value(1))
                .andExpect(jsonPath("$.data.generatedCases.length()").value(1))
                .andExpect(jsonPath("$.data.generatedCases[0].title").value(unique + " generated case"))
                .andExpect(jsonPath("$.data.generatedCases[0].caseType").value("FUNCTION"))
                .andExpect(jsonPath("$.data.generatedCases[0].priority").value("P1"))
                .andExpect(jsonPath("$.data.generatedCases[0].steps").value("1. Open login page"))
                .andExpect(jsonPath("$.data.generatedCases[0].expectedResult").value("Dashboard is visible"))
                .andExpect(jsonPath("$.data.generatedCases[0].aiSource").value("AI_GENERATED"))
                .andExpect(jsonPath("$.data.coverageSummary").value("coverage summary"))
                .andExpect(jsonPath("$.data.remainingCoverageGaps[0]").value("remaining gap"))
                .andExpect(jsonPath("$.data.warnings[0]").value("generation warning"))
                .andExpect(jsonPath("$.data.invalidCases.length()").value(0))
                .andExpect(jsonPath("$.data.rawContent").isString())
                .andExpect(jsonPath("$.data.ignoredImages").value(false));

        mockMvc.perform(post("/api/cases/ai/review")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "requirementTitle": "%s requirement",
                                  "requirementContent": "User can login and view dashboard.",
                                  "sceneFocus": "login",
                                  "remainingCoverageGaps": ["remaining gap"],
                                  "generatedCases": [
                                    %s
                                  ]
                                }
                                """.formatted(unique, existingCaseJson(unique + " generated case"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.result").value("APPROVE"))
                .andExpect(jsonPath("$.data.summary").value("review summary"))
                .andExpect(jsonPath("$.data.issues[0]").value("issue one"))
                .andExpect(jsonPath("$.data.suggestions[0]").value("suggestion one"))
                .andExpect(jsonPath("$.data.caseDecisions.length()").value(1))
                .andExpect(jsonPath("$.data.caseDecisions[0].caseIndex").value(1))
                .andExpect(jsonPath("$.data.caseDecisions[0].status").value("APPROVED"))
                .andExpect(jsonPath("$.data.caseDecisions[0].summary").value("case approved"))
                .andExpect(jsonPath("$.data.supplementCases.length()").value(0))
                .andExpect(jsonPath("$.data.unresolvedCoverageGaps[0]").value("unresolved gap"))
                .andExpect(jsonPath("$.data.rawContent").value("{\"result\":\"APPROVE\"}"))
                .andExpect(jsonPath("$.data.structured").value(true));
    }

    @Test
    void imageSupportValidateFailsWhenGeneratorModelDoesNotSupportImages() throws Exception {
        reset(aiProviderClient);
        switchToTestUser(13L, "liping");
        String unique = uniquePrefix("image-fail");
        Long providerId = createProvider(unique + "-provider", "text-only-model", unique + "-secret");
        createConfig(providerId, "CASE_GENERATOR", "text-only-model", unique + " generator prompt", 1, false);
        Long assetId = uploadImageAsset(unique + "-asset");

        mockMvc.perform(post("/api/cases/ai/tasks/image-support/validate")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "assetIds": [%d]
                                }
                                """.formatted(assetId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").isString());
    }

    private Long createProvider(String connectionName, String modelName, String apiKey) throws Exception {
        String response = mockMvc.perform(post("/api/cases/ai/providers")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(providerRequest(connectionName, modelName, apiKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.workspaceCode").value("PERSONAL"))
                .andExpect(jsonPath("$.data.connectionName").value(connectionName))
                .andExpect(jsonPath("$.data.protocolType").value(AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT))
                .andExpect(jsonPath("$.data.baseUrl").value("https://ai.example.test/v1"))
                .andExpect(jsonPath("$.data.modelName").value(modelName))
                .andExpect(jsonPath("$.data.apiKeyMasked").isString())
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.status").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asLong();
    }

    private Long createConfig(
            Long providerId,
            String roleType,
            String model,
            String promptTemplate,
            int status,
            Boolean supportsImageInput
    ) throws Exception {
        String response = mockMvc.perform(post("/api/cases/ai/config")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(configRequest(providerId, roleType, model, promptTemplate, status, supportsImageInput)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.roleType").value(roleType))
                .andExpect(jsonPath("$.data.providerConnectionId").value(providerId.intValue()))
                .andExpect(jsonPath("$.data.model").value(model))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asLong();
    }

    private Long uploadImageAsset(String fileName) throws Exception {
        byte[] png = tinyPng();
        String response = mockMvc.perform(multipart("/api/cases/ai/assets")
                        .file(new MockMultipartFile("files", fileName + ".png", "image/png", png))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").get(0).path("id").asLong();
    }

    private String providerRequest(String connectionName, String modelName, String apiKey) {
        return """
                {
                  "workspaceCode": "%s",
                  "connectionName": "%s",
                  "protocolType": "%s",
                  "baseUrl": "https://ai.example.test/v1",
                  "requestTimeoutSeconds": 30,
                  "modelName": "%s",
                  "apiKey": "%s",
                  "status": 1
                }
                """.formatted(
                WORKSPACE_CODE,
                connectionName,
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                modelName,
                apiKey
        );
    }

    private String configRequest(Long providerId, String roleType, String model, String promptTemplate, int status) {
        return configRequest(providerId, roleType, model, promptTemplate, status, null);
    }

    private String configRequest(
            Long providerId,
            String roleType,
            String model,
            String promptTemplate,
            int status,
            Boolean supportsImageInput
    ) {
        String supportsImageInputField = supportsImageInput == null
                ? ""
                : """
                  ,
                  "supportsImageInput": %s
                """.formatted(supportsImageInput);
        return """
                {
                  "workspaceCode": "%s",
                  "roleType": "%s",
                  "providerConnectionId": %d,
                  "model": "%s",
                  "promptTemplate": "%s",
                  "reviewChecklist": "review checklist",
                  "temperature": 0.3,
                  "topP": 0.9,
                  "maxCases": 12,
                  "status": %d%s
                }
                """.formatted(WORKSPACE_CODE, roleType, providerId, model, promptTemplate, status, supportsImageInputField);
    }

    private AiModelCapabilities capabilities(boolean stableAvailable, boolean streamOutput, boolean imageInput) {
        return new AiModelCapabilities(
                AiModelCapabilities.value(true, AiModelCapabilities.SOURCE_PROBED, "text chat supported"),
                AiModelCapabilities.value(streamOutput, AiModelCapabilities.SOURCE_PROBED, "stream capability"),
                AiModelCapabilities.value(true, AiModelCapabilities.SOURCE_PROBED, "structured output supported"),
                AiModelCapabilities.value(imageInput, AiModelCapabilities.SOURCE_PROBED, "image input capability"),
                AiModelCapabilities.value(false, AiModelCapabilities.SOURCE_PROBED, "long context unsupported"),
                AiModelCapabilities.value(stableAvailable, AiModelCapabilities.SOURCE_PROBED, "stable availability")
        );
    }

    private GeneratedAiCaseItem generatedCase(String title) {
        return new GeneratedAiCaseItem(
                title,
                "FUNCTION",
                "P1",
                "User has valid account",
                "1. Open login page",
                "Dashboard is visible",
                "Login risk",
                "Happy path",
                "Core login flow",
                "Requirement line 1",
                "AI_GENERATED",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                "PENDING_REVIEW",
                "Pending review",
                false,
                null,
                null
        );
    }

    private String existingCaseJson(String title) {
        return """
                {
                  "title": "%s",
                  "caseType": "FUNCTION",
                  "priority": "P1",
                  "precondition": "User has valid account",
                  "steps": "1. Open login page",
                  "expectedResult": "Dashboard is visible",
                  "testAngle": "Happy path",
                  "generationReason": "Core login flow",
                  "requirementEvidence": "Requirement line 1"
                }
                """.formatted(title);
    }

    private void switchToTestUser(Long userId, String username) {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                userId,
                username,
                username,
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities())
        );
    }

    private byte[] tinyPng() {
        return new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4,
                (byte) 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                0x54, 0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, (byte) 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, (byte) 0xAE,
                0x42, 0x60, (byte) 0x82
        };
    }

    private String uniquePrefix(String label) {
        return "ai-" + label + "-" + System.nanoTime();
    }
}
