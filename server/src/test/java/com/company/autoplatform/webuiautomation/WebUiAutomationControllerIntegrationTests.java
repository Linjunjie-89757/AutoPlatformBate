package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.ai.AiCaseService;
import com.company.autoplatform.ai.AiProviderClient;
import com.company.autoplatform.ai.AiProviderConnectionItem;
import com.company.autoplatform.ai.SaveAiProviderConnectionRequest;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class WebUiAutomationControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AiCaseService aiCaseService;

    @MockitoBean
    private WebUiLocatorValidationRunner locatorValidationRunner;

    @MockitoBean
    private AiProviderClient aiProviderClient;

    @Test
    void createUpdateListAndDeleteCaseWithSteps() throws Exception {
        String unique = uniquePrefix("case");
        Long caseId = createCase(unique + "-case", "checkout", List.of(
                openStep("Open home", "https://example.com/home", 2),
                clickStep("Click login", "CSS", "#login", 1)
        ));

        mockMvc.perform(get("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(caseId.intValue()))
                .andExpect(jsonPath("$.data.caseName").value(unique + "-case"))
                .andExpect(jsonPath("$.data.browserType").value("CHROMIUM"))
                .andExpect(jsonPath("$.data.defaultTimeoutMs").value(60000))
                .andExpect(jsonPath("$.data.status").value("ENABLED"))
                .andExpect(jsonPath("$.data.steps.length()").value(2))
                .andExpect(jsonPath("$.data.steps[0].stepName").value("Click login"))
                .andExpect(jsonPath("$.data.steps[0].sortOrder").value(1))
                .andExpect(jsonPath("$.data.steps[0].timeoutMs").value(5000))
                .andExpect(jsonPath("$.data.steps[0].screenshotPolicy").value("ON_FAILURE"));

        Map<String, Object> contextStep = new LinkedHashMap<>(clickStep("Click iframe button", "CSS", "#inner-submit", 1));
        contextStep.put("framePath", List.of(Map.of("selector", "iframe#orders")));
        contextStep.put("shadowPath", List.of(Map.of("selector", "order-shell")));
        Long contextCaseId = createCase(unique + "-context-case", "checkout", List.of(contextStep));
        mockMvc.perform(get("/api/automation/web/cases/{id}", contextCaseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.steps[0].framePath[0].selector").value("iframe#orders"))
                .andExpect(jsonPath("$.data.steps[0].shadowPath[0].selector").value("order-shell"));

        mockMvc.perform(put("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(unique + "-case-updated", "payments", List.of(
                                fillStep("Fill user", "CSS", "#user", "alice", 1)
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.caseName").value(unique + "-case-updated"))
                .andExpect(jsonPath("$.data.moduleName").value("payments"))
                .andExpect(jsonPath("$.data.steps.length()").value(1))
                .andExpect(jsonPath("$.data.steps[0].stepType").value("FILL"))
                .andExpect(jsonPath("$.data.steps[0].inputValue").value("alice"));

        mockMvc.perform(get("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("moduleName", "payments")
                        .param("status", "enabled")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(caseId.intValue()))
                .andExpect(jsonPath("$.data.items[0].caseName").value(unique + "-case-updated"))
                .andExpect(jsonPath("$.data.items[0].moduleName").value("payments"))
                .andExpect(jsonPath("$.data.items[0].stepCount").value(1));

        mockMvc.perform(delete("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isNotFound());
    }

    @Test
    void createCaseAllowsMissingBaseUrl() throws Exception {
        String unique = uniquePrefix("case-no-base-url");

        String response = mockMvc.perform(post("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(unique + "-case", "checkout", List.of(
                                clickStep("Click login", "CSS", "#login", 1)
                        ), false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.caseName").value(unique + "-case"))
                .andExpect(jsonPath("$.data.baseUrl").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long caseId = objectMapper.readTree(response).at("/data/id").asLong();
        mockMvc.perform(get("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.baseUrl").doesNotExist());
    }

    @Test
    void createCaseAcceptsHighFrequencyStepTypes() throws Exception {
        String unique = uniquePrefix("high-frequency-steps");

        mockMvc.perform(post("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(unique + "-case", "checkout", List.of(
                                locatorOnlyStep("Hover menu", "hover", "#menu", 1),
                                locatorOnlyStep("Double click row", "double_click", ".row", 2),
                                locatorOnlyStep("Right click row", "right_click", ".row", 3),
                                inputOnlyStep("Press enter", "press_key", "Enter", 4),
                                locatorInputStep("Select status", "select", "#status", "APPROVED", 5),
                                locatorInputStep("Upload file", "file_upload", "input[type=file]", "D:/tmp/sample.txt", 6),
                                inputOnlyStep("Assert URL", "assert_url", "/orders", 7),
                                inputOnlyStep("Assert title", "assert_title", "Orders", 8),
                                locatorInputStep("Assert attribute", "assert_attribute", "#submit", "aria-label=Submit", 9),
                                locatorInputStep("Assert count", "assert_count", ".order-row", ">0", 10)
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.steps.length()").value(10))
                .andExpect(jsonPath("$.data.steps[0].stepType").value("HOVER"))
                .andExpect(jsonPath("$.data.steps[1].stepType").value("DOUBLE_CLICK"))
                .andExpect(jsonPath("$.data.steps[2].stepType").value("RIGHT_CLICK"))
                .andExpect(jsonPath("$.data.steps[3].stepType").value("PRESS_KEY"))
                .andExpect(jsonPath("$.data.steps[4].stepType").value("SELECT"))
                .andExpect(jsonPath("$.data.steps[5].stepType").value("FILE_UPLOAD"))
                .andExpect(jsonPath("$.data.steps[6].stepType").value("ASSERT_URL"))
                .andExpect(jsonPath("$.data.steps[7].stepType").value("ASSERT_TITLE"))
                .andExpect(jsonPath("$.data.steps[8].stepType").value("ASSERT_ATTRIBUTE"))
                .andExpect(jsonPath("$.data.steps[9].stepType").value("ASSERT_COUNT"));
    }

    @Test
    void createCasePersistsFileUploadArtifactBinding() throws Exception {
        String unique = uniquePrefix("upload-binding");

        String response = mockMvc.perform(post("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(unique + "-case", "upload", List.of(
                                fileUploadArtifactStep("Upload avatar", "#avatar", "avatar-file", "avatar.png", "YXZhdGFyLXBheWxvYWQ=", 1)
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.steps[0].stepType").value("FILE_UPLOAD"))
                .andExpect(jsonPath("$.data.steps[0].inputValue").value("artifact:avatar-file"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.fileId").value("avatar-file"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.fileName").value("avatar.png"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.contentBase64").value("YXZhdGFyLXBheWxvYWQ="))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long caseId = objectMapper.readTree(response).at("/data/id").asLong();
        mockMvc.perform(get("/api/automation/web/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.fileId").value("avatar-file"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.contentType").value("text/plain"));
    }

    @Test
    void createListSaveFromCaseAndDeleteTemplate() throws Exception {
        String unique = uniquePrefix("template");
        Long caseId = createCase(unique + "-case", "template-source", List.of(
                openStep("Open template source", "/source", 1),
                fillStep("Fill keyword", "CSS", "#keyword", "codex", 2)
        ));

        String templateResponse = mockMvc.perform(post("/api/automation/web/templates")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(templateRequest(unique + "-manual", "template-library", List.of(
                                openStep("Open manual template", "/manual", 1)
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.templateName").value(unique + "-manual"))
                .andExpect(jsonPath("$.data.stepCount").value(1))
                .andExpect(jsonPath("$.data.steps[0].stepType").value("OPEN"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long templateId = objectMapper.readTree(templateResponse).at("/data/id").asLong();

        mockMvc.perform(get("/api/automation/web/templates")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(templateId.intValue()))
                .andExpect(jsonPath("$.data.items[0].templateName").value(unique + "-manual"));

        String savedTemplateResponse = mockMvc.perform(post("/api/automation/web/cases/{id}/save-as-template", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "templateName", unique + "-from-case",
                                "description", "saved from case"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.templateName").value(unique + "-from-case"))
                .andExpect(jsonPath("$.data.moduleName").value("template-source"))
                .andExpect(jsonPath("$.data.steps.length()").value(2))
                .andExpect(jsonPath("$.data.steps[1].inputValue").value("codex"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long savedTemplateId = objectMapper.readTree(savedTemplateResponse).at("/data/id").asLong();

        mockMvc.perform(delete("/api/automation/web/templates/{id}", templateId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/automation/web/templates")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(savedTemplateId.intValue()))
                .andExpect(jsonPath("$.data.items[0].templateName").value(unique + "-from-case"));
    }

    @Test
    void saveCaseAsTemplatePreservesFileUploadArtifactBinding() throws Exception {
        String unique = uniquePrefix("template-upload-binding");
        Long caseId = createCase(unique + "-case", "template-source", List.of(
                fileUploadArtifactStep("Upload contract", "input[type=file]", "contract-file", "contract.pdf", "Y29udHJhY3Q=", 1)
        ));

        mockMvc.perform(post("/api/automation/web/cases/{id}/save-as-template", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "templateName", unique + "-template"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.steps[0].stepType").value("FILE_UPLOAD"))
                .andExpect(jsonPath("$.data.steps[0].inputValue").value("artifact:contract-file"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.fileId").value("contract-file"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.fileName").value("contract.pdf"))
                .andExpect(jsonPath("$.data.steps[0].uploadArtifactBinding.contentBase64").value("Y29udHJhY3Q="));
    }

    @Test
    void createUpdateListAndDeleteEnvironment() throws Exception {
        String unique = uniquePrefix("env");
        Long firstId = createEnvironment(unique + "-local", "https://local.example");
        Long secondId = createEnvironment(unique + "-staging", "https://staging.example");

        mockMvc.perform(put("/api/automation/web/environments/{id}", firstId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(environmentRequest(
                                unique + "-local-updated",
                                "https://local-updated.example",
                                "webkit",
                                false,
                                999999,
                                0
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(firstId.intValue()))
                .andExpect(jsonPath("$.data.environmentName").value(unique + "-local-updated"))
                .andExpect(jsonPath("$.data.browserType").value("WEBKIT"))
                .andExpect(jsonPath("$.data.defaultTimeoutMs").value(60000))
                .andExpect(jsonPath("$.data.status").value(0));

        mockMvc.perform(get("/api/automation/web/environments")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[*].id", containsInAnyOrder(firstId.intValue(), secondId.intValue())))
                .andExpect(jsonPath("$.data.items[*].environmentName", hasItem(unique + "-local-updated")))
                .andExpect(jsonPath("$.data.items[*].status", containsInAnyOrder(0, 1)));

        mockMvc.perform(delete("/api/automation/web/environments/{id}", firstId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/automation/web/environments")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(firstId.intValue()))))
                .andExpect(jsonPath("$.data.items[*].id", hasItem(secondId.intValue())));
    }

    @Test
    void listRunsReturnsEmptyPageBeforeAnyExecution() throws Exception {
        mockMvc.perform(get("/api/automation/web/runs")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(0))
                .andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    void clickStepRequiresLocator() throws Exception {
        String unique = uniquePrefix("invalid");

        mockMvc.perform(post("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(unique + "-case", "invalid", List.of(
                                Map.of(
                                        "stepName", "Click without locator",
                                        "stepType", "CLICK",
                                        "sortOrder", 1
                                )
                        )))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void validateLocatorReturnsMatchCountAndScreenshot() throws Exception {
        when(locatorValidationRunner.validate(any())).thenReturn(new WebUiLocatorValidationRunner.LocatorValidationResult(
                true,
                2,
                null,
                "fake-png".getBytes()
        ));

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("baseUrl", "https://example.com/login");
        request.put("browserType", "chromium");
        request.put("headless", true);
        request.put("locatorType", "CSS");
        request.put("locatorValue", ".login-button");
        request.put("timeoutMs", 3000);

        mockMvc.perform(post("/api/automation/web/locators/validate")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.matched").value(true))
                .andExpect(jsonPath("$.data.matchCount").value(2))
                .andExpect(jsonPath("$.data.screenshotBase64").isNotEmpty());
    }

    @Test
    void createLocalRunnerCollectTaskStoresSnapshotAndReturnsStaticCandidates() throws Exception {
        String unique = uniquePrefix("local-collect");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-1");
        request.put("sessionId", "session-local-1");
        request.put("actualUrl", "https://example.test/orders");
        request.put("pageTitle", "Orders");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 1);
        request.put("screenshotBase64", "fake-screen");
        Map<String, Object> candidate = new LinkedHashMap<>();
        candidate.put("groupName", "页面元素");
        candidate.put("elementName", "搜索按钮");
        candidate.put("locatorType", "CSS");
        candidate.put("locatorValue", "#search");
        candidate.put("framePath", List.of(Map.of("selector", "iframe#orders")));
        candidate.put("shadowPath", List.of("order-shell"));
        candidate.put("confidence", 88);
        candidate.put("reason", "本地 Runner 静态规则采集");
        candidate.put("tagName", "button");
        candidate.put("elementType", "BUTTON");
        candidate.put("candidateSource", "STATIC_RULE");
        candidate.put("recommendedToSave", true);
        candidate.put("validationStatus", "UNVERIFIED");
        candidate.put("validationMessage", "静态生成，尚未经过 Runner 真机验证");
        request.put("candidates", List.of(candidate));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").isNumber())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(75))
                .andExpect(jsonPath("$.data.source").value("LOCAL_RUNNER_STATIC"))
                .andExpect(jsonPath("$.data.rawCount").value(1))
                .andExpect(jsonPath("$.data.finalCount").value(1))
                .andExpect(jsonPath("$.data.candidates[0].candidateSource").value("STATIC_RULE"))
                .andExpect(jsonPath("$.data.candidates[0].framePath[0].selector").value("iframe#orders"))
                .andExpect(jsonPath("$.data.candidates[0].shadowPath[0]").value("order-shell"))
                .andExpect(jsonPath("$.data.candidates[0].validationStatus").value("UNVERIFIED"));
    }

    @Test
    void createLocalRunnerCollectTaskEnhancesCandidateMetadataWithAiProviderPool() throws Exception {
        String unique = uniquePrefix("local-collect-ai");
        AiProviderConnectionItem provider = createAiProvider(unique, "web-ui-ai-model");
        when(aiProviderClient.requestStructuredContent(any(), eq(unique + "-secret"), any())).thenReturn("""
                {
                  "message": "AI 已完成候选元素命名、分组和说明增强",
                  "candidates": [
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#search",
                      "groupName": "筛选区",
                      "elementName": "订单搜索按钮",
                      "confidence": 96,
                      "reason": "按钮位于订单筛选区域，id 定位稳定",
                      "businessMeaning": "触发订单列表查询",
                      "recommendedToSave": true,
                      "maintenanceSuggestion": "建议保留 id 或补充 data-testid",
                      "stabilityNote": "id 定位稳定"
                    }
                  ]
                }
                """);

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-ai");
        request.put("sessionId", "session-local-ai");
        request.put("actualUrl", "https://example.test/orders");
        request.put("pageTitle", "Orders");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", provider.id());
        request.put("modelName", "web-ui-ai-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 88)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.aiModelConfigId").value(provider.id().intValue()))
                .andExpect(jsonPath("$.data.aiModelName").value("web-ui-ai-model"))
                .andExpect(jsonPath("$.data.message").value("AI 已完成候选元素命名、分组和说明增强"))
                .andExpect(jsonPath("$.data.filterLogs[?(@.stage=='AI_METADATA')].message").value(hasItem("AI 已完成候选元素命名、分组和说明增强")))
                .andExpect(jsonPath("$.data.candidates[0].groupName").value("筛选表单区"))
                .andExpect(jsonPath("$.data.candidates[0].elementName").value("订单搜索按钮"))
                .andExpect(jsonPath("$.data.candidates[0].locatorType").value("CSS"))
                .andExpect(jsonPath("$.data.candidates[0].locatorValue").value("#search"))
                .andExpect(jsonPath("$.data.candidates[0].businessMeaning").value("触发订单列表查询"))
                .andExpect(jsonPath("$.data.candidates[0].candidateSource").value("STATIC_RULE"))
                .andExpect(jsonPath("$.data.candidates[0].validationStatus").value("UNVERIFIED"));
    }

    @Test
    void aiSupplementCandidateRequiresLocalRunnerValidationBeforeSave() throws Exception {
        String unique = uniquePrefix("local-collect-ai-supplement");
        AiProviderConnectionItem provider = createAiProvider(unique, "web-ui-ai-model");
        when(aiProviderClient.requestStructuredContent(any(), eq(unique + "-secret"), any())).thenReturn("""
                {
                  "message": "AI 已补充可能漏采的候选元素",
                  "candidates": [
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#search",
                      "groupName": "筛选区",
                      "elementName": "订单搜索按钮",
                      "confidence": 96,
                      "reason": "按钮位于订单筛选区域，id 定位稳定",
                      "businessMeaning": "触发订单列表查询",
                      "recommendedToSave": true,
                      "maintenanceSuggestion": "建议保留 id 或补充 data-testid",
                      "stabilityNote": "id 定位稳定"
                    },
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#export",
                      "groupName": "操作区",
                      "elementName": "导出按钮",
                      "confidence": 88,
                      "reason": "AI 根据页面语义补充可能漏采的导出操作",
                      "businessMeaning": "导出订单列表",
                      "recommendedToSave": true,
                      "maintenanceSuggestion": "建议补充 data-testid 后再保存",
                      "stabilityNote": "AI 补充候选，需 Runner 真机验证",
                      "candidateSource": "AI_SUPPLEMENT"
                    }
                  ]
                }
                """);

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-ai-supplement");
        request.put("sessionId", "session-local-ai-supplement");
        request.put("actualUrl", "https://example.test/orders");
        request.put("pageTitle", "Orders");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", provider.id());
        request.put("modelName", "web-ui-ai-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 88)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.finalCount").value(2))
                .andExpect(jsonPath("$.data.filterLogs[?(@.reason=='AI_METADATA_ENHANCE')].count").value(hasItem(2)))
                .andExpect(jsonPath("$.data.filterLogs[?(@.reason=='FINAL_CANDIDATE')].count").value(hasItem(2)))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].candidateSource").value(hasItem("AI_SUPPLEMENT")))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].validationStatus").value(hasItem("AI_UNVERIFIED")))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].recommendedToSave").value(hasItem(false)))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].saveBlockedReason").value(hasItem("AI 补充候选需通过本地 Runner 验证后才能保存")));

        Map<String, Object> validationPayload = new LinkedHashMap<>();
        validationPayload.put("results", List.of(
                Map.of(
                        "locatorType", "CSS",
                        "locatorValue", "#search",
                        "validationStatus", "PASSED",
                        "matchCount", 1,
                        "validationMessage", "真机验证通过",
                        "screenshotBase64", "search-png"
                ),
                Map.of(
                        "locatorType", "CSS",
                        "locatorValue", "#export",
                        "validationStatus", "PASSED",
                        "matchCount", 1,
                        "validationMessage", "真机验证通过",
                        "screenshotBase64", "export-png"
                )
        ));

        mockMvc.perform(post("/api/automation/web/elements/collect-tasks/{taskId}/local-validation-results", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validationPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].validationStatus").value(hasItem("PASSED")))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].recommendedToSave").value(hasItem(true)))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#export')].saveBlockedReason").value(hasItem(nullValue())));
    }

    @Test
    void createLocalRunnerCollectTaskFallsBackWhenAiProviderFails() throws Exception {
        String unique = uniquePrefix("local-collect-ai-fallback");
        AiProviderConnectionItem provider = createAiProvider(unique, "web-ui-ai-model");
        when(aiProviderClient.requestStructuredContent(any(), eq(unique + "-secret"), any()))
                .thenThrow(new IllegalStateException("AI service unavailable"));

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-ai-fallback");
        request.put("sessionId", "session-local-ai-fallback");
        request.put("actualUrl", "https://example.test/orders-fallback");
        request.put("pageTitle", "Orders");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", provider.id());
        request.put("modelName", "web-ui-ai-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 88)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.message").value("AI service unavailable"))
                .andExpect(jsonPath("$.data.candidates[0].elementName").value("搜索按钮"))
                .andExpect(jsonPath("$.data.candidates[0].locatorValue").value("#search"))
                .andExpect(jsonPath("$.data.candidates[0].validationStatus").value("UNVERIFIED"));
    }

    @Test
    void createLocalRunnerCollectTaskIsIdempotentInShortWindow() throws Exception {
        String unique = uniquePrefix("local-collect-idempotent");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-idempotent");
        request.put("sessionId", "session-local-idempotent");
        request.put("actualUrl", "https://example.test/idempotent");
        request.put("pageTitle", "Idempotent");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 92)
        ));

        String firstResponse = createLocalRunnerCollectTask(request);
        Long firstTaskId = objectMapper.readTree(firstResponse).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(firstTaskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        createLocalRunnerCollectTask(request);
        awaitLocalRunnerCollectTaskReady(firstTaskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.taskId").value(firstTaskId))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.finalCount").value(1));
    }

    @Test
    void createLocalRunnerCollectTaskFiltersDuplicatesAndReportsStaticRuleSummary() throws Exception {
        String unique = uniquePrefix("local-collect-filter");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-2");
        request.put("sessionId", "session-local-2");
        request.put("actualUrl", "https://example.test/orders");
        request.put("pageTitle", "Orders");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 4);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 90),
                localRunnerCandidate("重复搜索按钮", "CSS", "#search", 88),
                localRunnerCandidate("低稳定容器", "CSS", "div", 45),
                localRunnerCandidate("空定位器", "CSS", "", 80)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(75))
                .andExpect(jsonPath("$.data.rawCount").value(4))
                .andExpect(jsonPath("$.data.finalCount").value(1))
                .andExpect(jsonPath("$.data.filterSummary.originalCount").value(4))
                .andExpect(jsonPath("$.data.filterSummary.emptyLocatorCount").value(1))
                .andExpect(jsonPath("$.data.filterSummary.duplicateCount").value(1))
                .andExpect(jsonPath("$.data.filterSummary.lowStabilityCount").value(1))
                .andExpect(jsonPath("$.data.filterSummary.finalCount").value(1))
                .andExpect(jsonPath("$.data.candidates[0].elementName").value("搜索按钮"))
                .andExpect(jsonPath("$.data.candidates[0].confidence").value(90));
    }

    @Test
    void getLocalRunnerCollectTaskReturnsTaskDetailAndFilterLogs() throws Exception {
        String unique = uniquePrefix("local-collect-detail");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-3");
        request.put("sessionId", "session-local-3");
        request.put("actualUrl", "https://example.test/detail");
        request.put("pageTitle", "Detail");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 4);
        request.put("candidates", List.of(
                localRunnerCandidate("详情按钮", "CSS", "#detail", 92),
                localRunnerCandidate("重复详情按钮", "CSS", "#detail", 88),
                localRunnerCandidate("低稳定容器", "CSS", "div", 45),
                localRunnerCandidate("空定位器", "CSS", "", 80)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        mockMvc.perform(get("/api/automation/web/elements/collect-tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(75))
                .andExpect(jsonPath("$.data.actualUrl").value("https://example.test/detail"))
                .andExpect(jsonPath("$.data.finalCount").value(1))
                .andExpect(jsonPath("$.data.filterSummary.duplicateCount").value(1))
                .andExpect(jsonPath("$.data.candidates[0].elementName").value("详情按钮"))
                .andExpect(jsonPath("$.data.filterLogs[0].stage").value("STATIC_RULE"))
                .andExpect(jsonPath("$.data.filterLogs[0].reason").value("EMPTY_LOCATOR"))
                .andExpect(jsonPath("$.data.filterLogs[0].count").value(1))
                .andExpect(jsonPath("$.data.filterLogs[1].reason").value("DUPLICATE_LOCATOR"))
                .andExpect(jsonPath("$.data.filterLogs[2].reason").value("LOW_STABILITY"))
                .andExpect(jsonPath("$.data.filterLogs[?(@.reason=='FINAL_CANDIDATE')].count").value(hasItem(1)));
    }

    @Test
    void getLocalRunnerCollectTaskFilterDetailsReturnsRecoverableFilteredCandidates() throws Exception {
        String unique = uniquePrefix("local-collect-filter-detail");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-filter-detail");
        request.put("sessionId", "session-local-filter-detail");
        request.put("actualUrl", "https://example.test/filter-detail");
        request.put("pageTitle", "Filter Detail");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 4);
        request.put("candidates", List.of(
                localRunnerCandidate("主按钮", "CSS", "#primary", 90),
                localRunnerCandidate("重复按钮", "CSS", "#primary", 88),
                localRunnerCandidate("低稳定容器", "CSS", "div", 45),
                localRunnerCandidate("空定位候选", "CSS", "", 80)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        mockMvc.perform(get("/api/automation/web/elements/collect-tasks/{taskId}/filter-details", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.details.length()").value(3))
                .andExpect(jsonPath("$.data.details[?(@.reason=='EMPTY_LOCATOR')].candidate.elementName").value(hasItem("空定位候选")))
                .andExpect(jsonPath("$.data.details[?(@.reason=='DUPLICATE_LOCATOR')].candidate.elementName").value(hasItem("重复按钮")))
                .andExpect(jsonPath("$.data.details[?(@.reason=='LOW_STABILITY')].candidate.elementName").value(hasItem("低稳定容器")))
                .andExpect(jsonPath("$.data.details[?(@.reason=='DUPLICATE_LOCATOR')].recoverable").value(hasItem(true)))
                .andExpect(jsonPath("$.data.details[?(@.reason=='EMPTY_LOCATOR')].recoverable").value(hasItem(false)));
    }

    @Test
    void submitLocalRunnerCollectValidationResultsCompletesTaskAndMergesCandidateValidation() throws Exception {
        String unique = uniquePrefix("local-collect-validation");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-validation");
        request.put("sessionId", "session-local-validation");
        request.put("actualUrl", "https://example.test/validate");
        request.put("pageTitle", "Validate");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 2);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 92),
                localRunnerCandidate("缺失按钮", "CSS", "#missing", 88)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        Map<String, Object> validationPayload = new LinkedHashMap<>();
        validationPayload.put("results", List.of(
                Map.of(
                        "locatorType", "CSS",
                        "locatorValue", "#search",
                        "validationStatus", "PASSED",
                        "matchCount", 1,
                        "validationMessage", "真机验证通过",
                        "screenshotBase64", "ok-png"
                ),
                Map.of(
                        "locatorType", "CSS",
                        "locatorValue", "#missing",
                        "validationStatus", "FAILED",
                        "matchCount", 0,
                        "validationMessage", "真机验证未找到元素"
                )
        ));

        mockMvc.perform(post("/api/automation/web/elements/collect-tasks/{taskId}/local-validation-results", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validationPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.currentStage").value("FINALIZE"))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#search')].validationStatus").value(hasItem("PASSED")))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#search')].matchCount").value(hasItem(1)))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#missing')].validationStatus").value(hasItem("FAILED")))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#missing')].recommendedToSave").value(hasItem(false)))
                .andExpect(jsonPath("$.data.candidates[?(@.locatorValue=='#missing')].saveBlockedReason").value(hasItem("真机验证未通过，暂不建议保存")));
    }

    @Test
    void degradeLocalRunnerCollectTaskKeepsCandidatesAsUnverified() throws Exception {
        String unique = uniquePrefix("local-collect-degrade");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-degrade");
        request.put("sessionId", "session-local-degrade");
        request.put("actualUrl", "https://example.test/degrade");
        request.put("pageTitle", "Degrade");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 92)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        Map<String, Object> degradePayload = new LinkedHashMap<>();
        degradePayload.put("reason", "Runner 真机验证失败：本地服务离线");

        mockMvc.perform(post("/api/automation/web/elements/collect-tasks/{taskId}/degrade", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(degradePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("DEGRADED"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(80))
                .andExpect(jsonPath("$.data.message").value("Runner 真机验证失败：本地服务离线"))
                .andExpect(jsonPath("$.data.candidates[0].validationStatus").value("UNVERIFIED"));
    }

    @Test
    void cancelLocalRunnerCollectTaskStopsWaitingTask() throws Exception {
        String unique = uniquePrefix("local-collect-cancel");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-cancel");
        request.put("sessionId", "session-local-cancel");
        request.put("actualUrl", "https://example.test/cancel");
        request.put("pageTitle", "Cancel");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 92)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        mockMvc.perform(post("/api/automation/web/elements/collect-tasks/{taskId}/cancel", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "用户取消采集任务"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(100))
                .andExpect(jsonPath("$.data.message").value("用户取消采集任务"));
    }

    @Test
    void timeoutLocalRunnerCollectValidationDegradesWaitingTask() throws Exception {
        String unique = uniquePrefix("local-collect-timeout");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("runnerId", "runner-local-timeout");
        request.put("sessionId", "session-local-timeout");
        request.put("actualUrl", "https://example.test/timeout");
        request.put("pageTitle", "Timeout");
        request.put("moduleId", createElementModule(unique + "-module"));
        request.put("pageName", unique + "-page");
        request.put("scope", "ALL");
        request.put("providerConnectionId", 1L);
        request.put("modelName", "test-model");
        request.put("rawCount", 1);
        request.put("candidates", List.of(
                localRunnerCandidate("搜索按钮", "CSS", "#search", 92)
        ));

        String response = createLocalRunnerCollectTask(request);
        Long taskId = objectMapper.readTree(response).path("data").path("taskId").asLong();
        awaitLocalRunnerCollectTaskReady(taskId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WAITING_LOCAL_VALIDATION"));

        mockMvc.perform(post("/api/automation/web/elements/collect-tasks/{taskId}/validation-timeout", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("DEGRADED"))
                .andExpect(jsonPath("$.data.currentStage").value("LOCAL_VALIDATE"))
                .andExpect(jsonPath("$.data.progressPercent").value(80))
                .andExpect(jsonPath("$.data.message").value("Runner 真机验证超时，已降级为未验证候选"))
                .andExpect(jsonPath("$.data.candidates[0].validationStatus").value("UNVERIFIED"));
    }

    @Test
    void batchUpdateAndInspectElementQuality() throws Exception {
        String unique = uniquePrefix("element-batch");
        Long moduleId = createElementModule(unique + "-module");
        Long pageId = createElementPage(moduleId, unique + "-page");
        Long firstGroupId = createElementGroup(pageId, unique + "-search");
        Long secondGroupId = createElementGroup(pageId, unique + "-result");
        Long buttonId = createElement(pageId, firstGroupId, unique + "-submit", "CSS", ".el-button");
        Long inputId = createElement(pageId, null, unique + "-keyword", "CSS", "#keyword");

        mockMvc.perform(post("/api/automation/web/elements/batch/status")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "elementIds", List.of(buttonId, inputId),
                                "status", "disabled"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.requestedCount").value(2))
                .andExpect(jsonPath("$.data.updatedCount").value(2));

        mockMvc.perform(post("/api/automation/web/elements/batch/move")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "elementIds", List.of(buttonId),
                                "pageId", pageId,
                                "groupId", secondGroupId
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.updatedCount").value(1));

        mockMvc.perform(get("/api/automation/web/elements")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("status", "disabled")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items[?(@.id==" + buttonId + ")].groupName").value(hasItem(unique + "-result")));

        mockMvc.perform(get("/api/automation/web/elements/quality-check")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.issues[?(@.elementId==" + buttonId + ")].title").value(hasItem("定位器过宽")))
                .andExpect(jsonPath("$.data.issues[?(@.elementId==" + inputId + ")].title").value(hasItem("未归入分组")));
    }

    @Test
    void batchValidateElementsReturnsPerElementResultsAndUpdatesSnapshots() throws Exception {
        when(locatorValidationRunner.validate(any()))
                .thenReturn(new WebUiLocatorValidationRunner.LocatorValidationResult(true, 1, null, "ok-png".getBytes()))
                .thenReturn(new WebUiLocatorValidationRunner.LocatorValidationResult(false, 0, "not found", "fail-png".getBytes()));

        String unique = uniquePrefix("element-validate");
        Long moduleId = createElementModule(unique + "-module");
        Long pageId = createElementPage(moduleId, unique + "-page");
        Long groupId = createElementGroup(pageId, unique + "-form");
        Long usernameId = createElement(pageId, groupId, unique + "-username", "CSS", "#username");
        Long passwordId = createElement(pageId, groupId, unique + "-password", "CSS", "#password");

        mockMvc.perform(post("/api/automation/web/elements/batch/validate")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "elementIds", List.of(usernameId, passwordId),
                                "baseUrl", "https://example.com/login",
                                "browserType", "chromium",
                                "headless", true,
                                "timeoutMs", 3000
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalCount").value(2))
                .andExpect(jsonPath("$.data.passedCount").value(1))
                .andExpect(jsonPath("$.data.failedCount").value(1))
                .andExpect(jsonPath("$.data.results[?(@.elementId==" + usernameId + ")].matched").value(hasItem(true)))
                .andExpect(jsonPath("$.data.results[?(@.elementId==" + passwordId + ")].errorMessage").value(hasItem("not found")));

        mockMvc.perform(get("/api/automation/web/elements")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id==" + usernameId + ")].lastValidateResult").value(hasItem("PASSED")))
                .andExpect(jsonPath("$.data.items[?(@.id==" + passwordId + ")].lastValidateResult").value(hasItem("FAILED")));
    }

    private Long createCase(String caseName, String moduleName, List<Map<String, Object>> steps) throws Exception {
        String response = mockMvc.perform(post("/api/automation/web/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(caseRequest(caseName, moduleName, steps))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.caseName").value(caseName))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private Long createElementModule(String moduleName) throws Exception {
        String response = mockMvc.perform(post("/api/automation/web/elements/modules")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "workspaceCode", WORKSPACE_CODE,
                                "moduleName", moduleName,
                                "status", "enabled"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private Long createElementPage(Long moduleId, String pageName) throws Exception {
        String response = mockMvc.perform(post("/api/automation/web/elements/pages")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "workspaceCode", WORKSPACE_CODE,
                                "moduleId", moduleId,
                                "pageName", pageName,
                                "status", "enabled"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private Long createElementGroup(Long pageId, String groupName) throws Exception {
        String response = mockMvc.perform(post("/api/automation/web/elements/groups")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "workspaceCode", WORKSPACE_CODE,
                                "pageId", pageId,
                                "groupName", groupName,
                                "status", "enabled"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private Long createElement(Long pageId, Long groupId, String elementName, String locatorType, String locatorValue) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("workspaceCode", WORKSPACE_CODE);
        request.put("pageId", pageId);
        request.put("groupId", groupId);
        request.put("pageName", elementName + "-page-snapshot");
        request.put("elementName", elementName);
        request.put("locatorType", locatorType);
        request.put("locatorValue", locatorValue);
        request.put("status", "enabled");

        String response = mockMvc.perform(post("/api/automation/web/elements")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private String createLocalRunnerCollectTask(Map<String, Object> request) throws Exception {
        return mockMvc.perform(post("/api/automation/web/elements/collect-tasks/local-runner")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private ResultActions awaitLocalRunnerCollectTaskReady(Long taskId) throws Exception {
        String lastStatus = null;
        for (int attempt = 0; attempt < 60; attempt++) {
            String response = mockMvc.perform(get("/api/automation/web/elements/collect-tasks/{taskId}", taskId)
                            .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            lastStatus = objectMapper.readTree(response).at("/data/status").asText();
            if (!List.of("UPLOADED", "RULE_CLEANING", "AI_ANALYZING").contains(lastStatus)) {
                return mockMvc.perform(get("/api/automation/web/elements/collect-tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE));
            }
            Thread.sleep(50);
        }
        throw new AssertionError("采集任务未在预期时间内完成异步处理，taskId=" + taskId + ", status=" + lastStatus);
    }

    private Long createEnvironment(String name, String baseUrl) throws Exception {
        String response = mockMvc.perform(post("/api/automation/web/environments")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(environmentRequest(
                                name,
                                baseUrl,
                                null,
                                true,
                                500,
                                null
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).at("/data/id").asLong();
    }

    private AiProviderConnectionItem createAiProvider(String unique, String model) {
        return aiCaseService.createProvider(WORKSPACE_CODE, new SaveAiProviderConnectionRequest(
                WORKSPACE_CODE,
                "custom",
                unique + "-provider",
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "https://ai.example.test/v1",
                30,
                model,
                unique + "-secret",
                1
        ));
    }

    private Map<String, Object> caseRequest(String caseName, String moduleName, List<Map<String, Object>> steps) {
        return caseRequest(caseName, moduleName, steps, true);
    }

    private Map<String, Object> caseRequest(
            String caseName,
            String moduleName,
            List<Map<String, Object>> steps,
            boolean includeBaseUrl
    ) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("workspaceCode", WORKSPACE_CODE);
        request.put("moduleName", moduleName);
        request.put("caseName", caseName);
        request.put("description", "web ui asset regression");
        if (includeBaseUrl) {
            request.put("baseUrl", "https://example.com");
        }
        request.put("browserType", "chromium");
        request.put("headless", true);
        request.put("defaultTimeoutMs", 120000);
        request.put("status", "enabled");
        request.put("steps", steps);
        return request;
    }

    private Map<String, Object> templateRequest(String templateName, String moduleName, List<Map<String, Object>> steps) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("workspaceCode", WORKSPACE_CODE);
        request.put("moduleName", moduleName);
        request.put("templateName", templateName);
        request.put("description", "web ui template regression");
        request.put("baseUrl", "https://template.example");
        request.put("browserType", "chromium");
        request.put("headless", true);
        request.put("defaultTimeoutMs", 120000);
        request.put("status", "enabled");
        request.put("steps", steps);
        return request;
    }

    private Map<String, Object> environmentRequest(
            String name,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Integer status
    ) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("workspaceCode", WORKSPACE_CODE);
        request.put("environmentName", name);
        request.put("baseUrl", baseUrl);
        request.put("browserType", browserType == null ? "" : browserType);
        request.put("headless", headless);
        request.put("defaultTimeoutMs", defaultTimeoutMs);
        if (status != null) {
            request.put("status", status);
        }
        return request;
    }

    private Map<String, Object> openStep(String name, String url, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", "open",
                "inputValue", url,
                "timeoutMs", 500,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> clickStep(String name, String locatorType, String locatorValue, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", "click",
                "locatorType", locatorType,
                "locatorValue", locatorValue,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> fillStep(String name, String locatorType, String locatorValue, String inputValue, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", "fill",
                "locatorType", locatorType,
                "locatorValue", locatorValue,
                "inputValue", inputValue,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> locatorOnlyStep(String name, String stepType, String locatorValue, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", stepType,
                "locatorType", "CSS",
                "locatorValue", locatorValue,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> inputOnlyStep(String name, String stepType, String inputValue, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", stepType,
                "inputValue", inputValue,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> locatorInputStep(String name, String stepType, String locatorValue, String inputValue, int sortOrder) {
        return Map.of(
                "stepName", name,
                "stepType", stepType,
                "locatorType", "CSS",
                "locatorValue", locatorValue,
                "inputValue", inputValue,
                "enabled", true,
                "sortOrder", sortOrder
        );
    }

    private Map<String, Object> fileUploadArtifactStep(
            String name,
            String locatorValue,
            String fileId,
            String fileName,
            String contentBase64,
            int sortOrder
    ) {
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("stepName", name);
        step.put("stepType", "file_upload");
        step.put("locatorType", "CSS");
        step.put("locatorValue", locatorValue);
        step.put("inputValue", "artifact:" + fileId);
        step.put("uploadArtifactBinding", Map.of(
                "fileId", fileId,
                "fileName", fileName,
                "contentType", "text/plain",
                "contentBase64", contentBase64,
                "size", 12
        ));
        step.put("enabled", true);
        step.put("sortOrder", sortOrder);
        return step;
    }

    private Map<String, Object> localRunnerCandidate(String elementName, String locatorType, String locatorValue, int confidence) {
        Map<String, Object> candidate = new LinkedHashMap<>();
        candidate.put("groupName", "页面元素");
        candidate.put("elementName", elementName);
        candidate.put("locatorType", locatorType);
        candidate.put("locatorValue", locatorValue);
        candidate.put("confidence", confidence);
        candidate.put("reason", "本地 Runner 静态规则采集");
        candidate.put("tagName", "button");
        candidate.put("elementType", "BUTTON");
        candidate.put("candidateSource", "STATIC_RULE");
        candidate.put("recommendedToSave", true);
        candidate.put("validationStatus", "UNVERIFIED");
        candidate.put("validationMessage", "静态生成，尚未经过 Runner 真机验证");
        return candidate;
    }

    private String uniquePrefix(String label) {
        return "web-ui-" + label + "-" + System.nanoTime();
    }
}
