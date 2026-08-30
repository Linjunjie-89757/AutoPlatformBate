package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AiGenerationTaskControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AiGenerationTaskMapper aiGenerationTaskMapper;

    @Autowired
    private AiGenerationTaskEventService eventService;

    @MockitoBean
    private AiProviderClient aiProviderClient;

    @MockitoBean
    private AiGenerationTaskRunner aiGenerationTaskRunner;

    @Test
    void taskCreateListGetUpdateCancelRetryAndDeleteKeepMainFlow() throws Exception {
        reset(aiProviderClient, aiGenerationTaskRunner);
        String unique = uniquePrefix("task");

        String createResponse = mockMvc.perform(post("/api/cases/ai/tasks")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "requirementTitle": "%s requirement",
                                  "requirementContent": "Generate login and dashboard cases.",
                                  "outputMode": "COMPLETE",
                                  "directoryName": "%s directory",
                                  "assetIds": [],
                                  "ignoredAssetCount": 0
                                }
                                """.formatted(WORKSPACE_CODE, unique, unique)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").isString())
                .andExpect(jsonPath("$.data.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.requirementTitle").value(unique + " requirement"))
                .andExpect(jsonPath("$.data.requirementContent").value("Generate login and dashboard cases."))
                .andExpect(jsonPath("$.data.outputMode").value("COMPLETE"))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.currentStep").value(1))
                .andExpect(jsonPath("$.data.stepMessage").isString())
                .andExpect(jsonPath("$.data.errorMessage").doesNotExist())
                .andExpect(jsonPath("$.data.directoryName").value(unique + " directory"))
                .andExpect(jsonPath("$.data.generatedCount").value(0))
                .andExpect(jsonPath("$.data.savedCaseCount").value(0))
                .andExpect(jsonPath("$.data.warnings.length()").value(0))
                .andExpect(jsonPath("$.data.invalidCases.length()").value(0))
                .andExpect(jsonPath("$.data.generatedCases.length()").value(0))
                .andExpect(jsonPath("$.data.events.length()").value(1))
                .andExpect(jsonPath("$.data.cancelRequested").value(false))
                .andExpect(jsonPath("$.data.createdAt").isString())
                .andExpect(jsonPath("$.data.updatedAt").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String taskId = objectMapper.readTree(createResponse).path("data").path("taskId").asText();
        verify(aiGenerationTaskRunner).runTask(eq(taskId), eq(WORKSPACE_CODE));

        mockMvc.perform(get("/api/cases/ai/tasks")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].taskId", hasItem(taskId)))
                .andExpect(jsonPath("$.data[?(@.taskId == '%s')].status".formatted(taskId), hasItem("PENDING")));

        mockMvc.perform(get("/api/cases/ai/tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.events[0].eventType").value("TASK_CREATED"));

        mockMvc.perform(put("/api/cases/ai/tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "directoryName": "%s updated directory",
                                  "generatedCases": [
                                    %s
                                  ],
                                  "adoptedCaseIndexes": [1, 0, 0],
                                  "deletedCaseIndexes": [2],
                                  "savedCaseCount": 3
                                }
                                """.formatted(WORKSPACE_CODE, unique, generatedCaseJson(unique + " generated case"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.directoryName").value(unique + " updated directory"))
                .andExpect(jsonPath("$.data.generatedCases.length()").value(1))
                .andExpect(jsonPath("$.data.generatedCases[0].title").value(unique + " generated case"))
                .andExpect(jsonPath("$.data.adoptedCaseIndexes[0]").value(0))
                .andExpect(jsonPath("$.data.adoptedCaseIndexes[1]").value(1))
                .andExpect(jsonPath("$.data.deletedCaseIndexes[0]").value(2))
                .andExpect(jsonPath("$.data.savedCaseCount").value(3));

        mockMvc.perform(post("/api/cases/ai/tasks/{taskId}/cancel", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.cancelRequested").value(true))
                .andExpect(jsonPath("$.data.finishedAt").isString());

        String failedTaskId = createFailedTask(unique + "-failed");
        String retryResponse = mockMvc.perform(post("/api/cases/ai/tasks/{taskId}/retry", failedTaskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").isString())
                .andExpect(jsonPath("$.data.sourceTaskId").value(failedTaskId))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.currentStep").value(1))
                .andExpect(jsonPath("$.data.cancelRequested").value(false))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String retryTaskId = objectMapper.readTree(retryResponse).path("data").path("taskId").asText();
        verify(aiGenerationTaskRunner).runTask(eq(retryTaskId), eq(WORKSPACE_CODE));

        mockMvc.perform(delete("/api/cases/ai/tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/cases/ai/tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void taskCreateRejectsRequirementContentAboveSupportedLimit() throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "workspaceCode", WORKSPACE_CODE,
                "requirementTitle", "Oversized requirement",
                "requirementContent", "需".repeat(AiGenerationTaskDomainService.MAX_REQUIREMENT_CONTENT_LENGTH + 1),
                "outputMode", "COMPLETE",
                "assetIds", List.of(),
                "ignoredAssetCount", 0
        ));

        mockMvc.perform(post("/api/cases/ai/tasks")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        "需求内容过长，最多支持 200000 个字符，请精简后重试"
                ));
    }

    @Test
    void taskEventsListAfterAndTerminalSseStreamKeepEventOrder() throws Exception {
        reset(aiProviderClient, aiGenerationTaskRunner);
        String unique = uniquePrefix("events");
        String taskId = createPendingTask(unique, "STREAM");

        AiGenerationTaskEventResponse started = eventService.append(
                taskId,
                "TASK_STARTED",
                "SETUP",
                "INFO",
                "task started",
                null,
                null,
                "OPENAI_COMPATIBLE_CHAT",
                "gpt-5",
                null
        );
        AiGenerationTaskEventResponse generated = eventService.append(
                taskId,
                "CASE_GENERATED",
                "GENERATING",
                "INFO",
                "case generated",
                0,
                unique + " generated case",
                "OPENAI_COMPATIBLE_CHAT",
                "gpt-5",
                "{\"title\":\"" + unique + "\"}"
        );

        mockMvc.perform(get("/api/cases/ai/tasks/{taskId}", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.taskId").value(taskId))
                .andExpect(jsonPath("$.data.events.length()").value(3))
                .andExpect(jsonPath("$.data.events[0].seq").value(1))
                .andExpect(jsonPath("$.data.events[0].eventType").value("TASK_CREATED"))
                .andExpect(jsonPath("$.data.events[1].seq").value(2))
                .andExpect(jsonPath("$.data.events[1].eventType").value("TASK_STARTED"))
                .andExpect(jsonPath("$.data.events[2].seq").value(3))
                .andExpect(jsonPath("$.data.events[2].eventType").value("CASE_GENERATED"))
                .andExpect(jsonPath("$.data.events[2].itemIndex").value(0))
                .andExpect(jsonPath("$.data.events[2].itemTitle").value(unique + " generated case"))
                .andExpect(jsonPath("$.data.events[2].payloadJson").value("{\"title\":\"" + unique + "\"}"));

        List<AiGenerationTaskEventResponse> eventsAfterFirst = eventService.listAfter(taskId, 1);
        assertThat(started.seq()).isEqualTo(2);
        assertThat(generated.seq()).isEqualTo(3);
        assertThat(eventsAfterFirst).extracting(AiGenerationTaskEventResponse::seq).containsExactly(2, 3);
        assertThat(eventsAfterFirst).extracting(AiGenerationTaskEventResponse::eventType)
                .containsExactly("TASK_STARTED", "CASE_GENERATED");

        AiGenerationTaskEntity entity = requireTask(taskId);
        entity.setStatus("CANCELED");
        entity.setCancelRequested(1);
        entity.setFinishedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);

        MvcResult streamResult = mockMvc.perform(get("/api/cases/ai/tasks/{taskId}/events/stream", taskId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(asyncDispatch(streamResult))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data: ")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("TASK_CREATED")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("TASK_STARTED")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("CASE_GENERATED")));
    }

    private String createPendingTask(String unique, String outputMode) throws Exception {
        String response = mockMvc.perform(post("/api/cases/ai/tasks")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "requirementTitle": "%s requirement",
                                  "requirementContent": "AI generation task regression.",
                                  "outputMode": "%s",
                                  "assetIds": []
                                }
                                """.formatted(WORKSPACE_CODE, unique, outputMode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("taskId").asText();
    }

    private String createFailedTask(String unique) throws Exception {
        String taskId = createPendingTask(unique, "COMPLETE");
        AiGenerationTaskEntity entity = requireTask(taskId);
        entity.setStatus("FAILED");
        entity.setCurrentStep(2);
        entity.setStepMessage("failed for retry regression");
        entity.setErrorMessage("mock failure");
        entity.setFinishedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        return taskId;
    }

    private AiGenerationTaskEntity requireTask(String taskId) {
        return aiGenerationTaskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId)
                .last("limit 1"));
    }

    private String generatedCaseJson(String title) {
        return """
                {
                  "title": "%s",
                  "caseType": "FUNCTION",
                  "priority": "P1",
                  "precondition": "User has valid account",
                  "steps": "1. Open login page",
                  "expectedResult": "Dashboard is visible",
                  "riskNotes": "Login risk",
                  "testAngle": "Happy path",
                  "generationReason": "Core login flow",
                  "requirementEvidence": "Requirement line 1",
                  "aiSource": "AI_GENERATED",
                  "warnings": [],
                  "aiReviewStatus": "APPROVED",
                  "aiReviewSummary": "Looks good",
                  "manualEdited": false
                }
                """.formatted(title);
    }

    private String uniquePrefix(String label) {
        return "ai-task-" + label + "-" + System.nanoTime();
    }
}
