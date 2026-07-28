package com.company.autoplatform.casecenter;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.ai.AiProviderClient;
import com.company.autoplatform.ai.AiReviewResult;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class CaseControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiProviderClient aiProviderClient;

    @Test
    void createGetUpdateDeleteCaseKeepsResponseShape() throws Exception {
        String unique = uniquePrefix("crud");
        Integer caseId = createCase(unique + "-case", "P1", null);

        mockMvc.perform(get("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(caseId))
                .andExpect(jsonPath("$.data.title").value(unique + "-case"))
                .andExpect(jsonPath("$.data.caseType").value("FUNCTION"))
                .andExpect(jsonPath("$.data.priority").value("P1"))
                .andExpect(jsonPath("$.data.sourceType").value("MANUAL"))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.executionStatus").value("NOT_RUN"))
                .andExpect(jsonPath("$.data.reviewStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.attachments.length()").value(0));

        mockMvc.perform(put("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(caseRequest(unique + "-updated", "P2", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(caseId))
                .andExpect(jsonPath("$.data.title").value(unique + "-updated"))
                .andExpect(jsonPath("$.data.priority").value("P2"));

        mockMvc.perform(delete("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void listCasesSupportsPaginationAndFilters() throws Exception {
        String unique = uniquePrefix("list");
        Integer first = createCase(unique + "-p1-first", "P1", null);
        Integer second = createCase(unique + "-p1-second", "P1", null);
        createCase(unique + "-p2-third", "P2", null);

        mockMvc.perform(get("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("priority", "p1")
                        .param("reviewStatus", "pending")
                        .param("executionStatus", "not_run")
                        .param("pageNo", "1")
                        .param("pageSize", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[*].id", containsInAnyOrder(first, second)))
                .andExpect(jsonPath("$.data.items[*].priority", containsInAnyOrder("P1", "P1")));
    }

    @Test
    void directoryCreateRenameMoveDeleteKeepsTreeShape() throws Exception {
        String unique = uniquePrefix("dir");
        Integer parentId = createDirectory(unique + "-parent", null);
        Integer childId = createDirectory(unique + "-child", parentId);

        mockMvc.perform(get("/api/cases/directories")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].workspaceCode", hasItem(WORKSPACE_CODE)))
                .andExpect(jsonPath("$.data[?(@.workspaceCode=='%s')].children[*].id".formatted(WORKSPACE_CODE), hasItem(parentId)));

        mockMvc.perform(put("/api/cases/directories/{id}", childId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "%s-renamed"
                                }
                                """.formatted(unique)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(childId))
                .andExpect(jsonPath("$.data.name").value(unique + "-renamed"))
                .andExpect(jsonPath("$.data.parentId").value(parentId));

        mockMvc.perform(post("/api/cases/directories/{id}/move", childId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "targetParentId": %d
                                }
                                """.formatted(parentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(childId))
                .andExpect(jsonPath("$.data.parentId").value(parentId));

        mockMvc.perform(delete("/api/cases/directories/{id}", parentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(delete("/api/cases/directories/{id}", childId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(delete("/api/cases/directories/{id}", parentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/cases/directories")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.workspaceCode=='%s')].children[*].id".formatted(WORKSPACE_CODE), not(hasItem(parentId))))
                .andExpect(jsonPath("$.data[?(@.workspaceCode=='%s')].children[*].id".formatted(WORKSPACE_CODE), not(hasItem(childId))));
    }

    @Test
    void listCasesSupportsDirectoryFilterIncludingDescendants() throws Exception {
        String unique = uniquePrefix("dir-filter");
        Integer parentId = createDirectory(unique + "-parent", null);
        Integer childId = createDirectory(unique + "-child", parentId);
        Integer matched = createCase(unique + "-matched", "P1", childId);
        Integer hidden = createCase(unique + "-hidden", "P1", null);

        mockMvc.perform(get("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("directoryId", parentId.toString())
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[*].id", hasItem(matched)))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(hidden))));
    }

    @Test
    void batchMoveUpdateAndDeleteKeepMainFlow() throws Exception {
        String unique = uniquePrefix("batch");
        Integer targetDirectoryId = createDirectory(unique + "-target", null);
        Integer first = createCase(unique + "-first", "P1", null);
        Integer second = createCase(unique + "-second", "P1", null);

        mockMvc.perform(post("/api/cases/batch/move")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "caseIds": [%d, %d],
                                  "targetDirectoryId": %d
                                }
                                """.formatted(first, second, targetDirectoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[*].id", containsInAnyOrder(first, second)))
                .andExpect(jsonPath("$.data.items[*].directoryId", containsInAnyOrder(targetDirectoryId, targetDirectoryId)));

        mockMvc.perform(post("/api/cases/batch/update")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "caseIds": [%d, %d],
                                  "priority": "P0",
                                  "reviewStatus": "PASSED",
                                  "executionStatus": "PASSED"
                                }
                                """.formatted(first, second)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[*].priority", containsInAnyOrder("P0", "P0")))
                .andExpect(jsonPath("$.data.items[*].reviewStatus", containsInAnyOrder("PASSED", "PASSED")))
                .andExpect(jsonPath("$.data.items[*].executionStatus", containsInAnyOrder("PASSED", "PASSED")));

        mockMvc.perform(post("/api/cases/batch/delete")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "caseIds": [%d, %d]
                                }
                                """.formatted(first, second)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(first))))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(second))));
    }

    @Test
    void executionAttachmentUploadDownloadAndDeleteKeepMainFlow() throws Exception {
        String unique = uniquePrefix("attachment");
        Integer caseId = createCase(unique + "-case", "P1", null);
        byte[] fileContent = "case execution evidence".getBytes(StandardCharsets.UTF_8);

        String uploadResponse = mockMvc.perform(multipart("/api/cases/{id}/attachments", caseId)
                        .file(new MockMultipartFile("files", unique + ".txt", "text/plain", fileContent))
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").isNumber())
                .andExpect(jsonPath("$.data[0].fileName").value(unique + ".txt"))
                .andExpect(jsonPath("$.data[0].contentType").value("text/plain"))
                .andExpect(jsonPath("$.data[0].downloadUrl").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Integer attachmentId = objectMapper.readTree(uploadResponse).path("data").get(0).path("id").asInt();

        mockMvc.perform(get("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attachments[0].id").value(attachmentId))
                .andExpect(jsonPath("$.data.attachments[0].downloadUrl").value("/api/cases/" + caseId + "/attachments/" + attachmentId + "/download"));

        mockMvc.perform(get("/api/cases/{id}/attachments/{attachmentId}/download", caseId, attachmentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(content().bytes(fileContent));

        mockMvc.perform(delete("/api/cases/{id}/attachments/{attachmentId}", caseId, attachmentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/cases/{id}", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attachments.length()").value(0));
    }

    @Test
    void excelImportSupportsTemplateValidationAndDuplicateStrategies() throws Exception {
        String unique = uniquePrefix("excel-import");

        mockMvc.perform(get("/api/cases/import/template"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

        byte[] workbook = caseImportWorkbook(List.of(
                List.of(unique, "功能", "P0", "准备数据", "提交表单", "提交成功", "启用"),
                List.of(unique, "回归", "P1", "", "重复提交", "仍然成功", "草稿"),
                List.of(unique + "-invalid", "功能", "PX", "", "", "", "启用")
        ));
        mockMvc.perform(multipart("/api/cases/import")
                        .file(new MockMultipartFile(
                                "file",
                                "cases.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                workbook))
                        .param("duplicateStrategy", "SKIP")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalRows").value(3))
                .andExpect(jsonPath("$.data.createdCount").value(1))
                .andExpect(jsonPath("$.data.skippedCount").value(1))
                .andExpect(jsonPath("$.data.failedCount").value(1))
                .andExpect(jsonPath("$.data.issues[*].type", containsInAnyOrder("SKIPPED", "FAILED")));

        mockMvc.perform(get("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].sourceType").value("IMPORTED"))
                .andExpect(jsonPath("$.data.items[0].priority").value("P0"));

        byte[] duplicateWorkbook = caseImportWorkbook(List.of(
                List.of(unique, "异常", "P2", "", "再次提交", "创建重复用例", "归档")
        ));
        mockMvc.perform(multipart("/api/cases/import")
                        .file(new MockMultipartFile(
                                "file",
                                "duplicates.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                duplicateWorkbook))
                        .param("duplicateStrategy", "ALLOW")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.createdCount").value(1))
                .andExpect(jsonPath("$.data.skippedCount").value(0))
                .andExpect(jsonPath("$.data.failedCount").value(0));

        mockMvc.perform(get("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2));
    }

    @Test
    void aiReviewCaseSmokeUsesMockedProviderClient() throws Exception {
        String unique = uniquePrefix("ai-review");
        Integer caseId = createCase(unique + "-case", "P1", null);
        Long providerId = createProvider(unique + "-provider", "gpt-5-mini", unique + "-secret");
        createConfig(providerId, "CASE_REVIEWER", "gpt-5-mini", unique + " reviewer prompt");
        when(aiProviderClient.review(any(), any(), any())).thenReturn(new AiReviewResult(
                "APPROVE",
                "review summary",
                List.of(),
                List.of("looks good"),
                List.of(),
                List.of(),
                List.of(),
                "raw review",
                false
        ));

        mockMvc.perform(post("/api/cases/{id}/ai-review", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.result").value("APPROVE"))
                .andExpect(jsonPath("$.data.summary").value("review summary"))
                .andExpect(jsonPath("$.data.suggestions[0]").value("looks good"));
    }

    private Integer createCase(String title, String priority, Integer directoryId) throws Exception {
        String response = mockMvc.perform(post("/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(caseRequest(title, priority, directoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.title").value(title))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asInt();
    }

    private Integer createDirectory(String name, Integer parentId) throws Exception {
        String response = mockMvc.perform(post("/api/cases/directories")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "parentId": %s,
                                  "name": "%s"
                                }
                                """.formatted(WORKSPACE_CODE, parentId == null ? "null" : parentId.toString(), name)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.name").value(name))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode data = objectMapper.readTree(response).path("data");
        return data.path("id").asInt();
    }

    private Long createProvider(String connectionName, String modelName, String apiKey) throws Exception {
        String response = mockMvc.perform(post("/api/cases/ai/providers")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(providerRequest(connectionName, modelName, apiKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asLong();
    }

    private Long createConfig(Long providerId, String roleType, String model, String promptTemplate) throws Exception {
        String response = mockMvc.perform(post("/api/cases/ai/config")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(configRequest(providerId, roleType, model, promptTemplate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asLong();
    }

    private String caseRequest(String title, String priority, Integer directoryId) {
        return """
                {
                  "workspaceCode": "%s",
                  "directoryId": %s,
                  "title": "%s",
                  "caseType": "FUNCTION",
                  "priority": "%s",
                  "sourceType": "MANUAL",
                  "caseStatus": "CONFIRMED",
                  "ownerId": 11,
                  "precondition": "logged in",
                  "steps": "1. open page\\n2. submit form",
                  "expectedResult": "form submitted"
                }
                """.formatted(WORKSPACE_CODE, directoryId == null ? "null" : directoryId.toString(), title, priority);
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

    private String configRequest(Long providerId, String roleType, String model, String promptTemplate) {
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
                  "status": 1,
                  "supportsImageInput": false
                }
                """.formatted(WORKSPACE_CODE, roleType, providerId, model, promptTemplate);
    }

    private byte[] caseImportWorkbook(List<List<String>> rows) throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("用例导入");
            var header = sheet.createRow(0);
            List<String> headers = List.of("用例标题*", "用例类型", "优先级", "前置条件", "测试步骤", "预期结果", "状态");
            for (int index = 0; index < headers.size(); index++) {
                header.createCell(index).setCellValue(headers.get(index));
            }
            for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                var row = sheet.createRow(rowIndex + 1);
                List<String> values = rows.get(rowIndex);
                for (int columnIndex = 0; columnIndex < values.size(); columnIndex++) {
                    row.createCell(columnIndex).setCellValue(values.get(columnIndex));
                }
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private String uniquePrefix(String label) {
        return "case-" + label + "-" + System.nanoTime();
    }
}
