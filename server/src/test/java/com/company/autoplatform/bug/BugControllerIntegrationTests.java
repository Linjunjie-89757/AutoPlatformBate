package com.company.autoplatform.bug;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.casecenter.CaseService;
import com.company.autoplatform.casecenter.CaseSummaryResponse;
import com.company.autoplatform.casecenter.CreateCaseRequest;
import com.company.autoplatform.execution.CreateReportRequest;
import com.company.autoplatform.execution.CreateTaskRequest;
import com.company.autoplatform.execution.ExecutionService;
import com.company.autoplatform.execution.ReportSummaryResponse;
import com.company.autoplatform.execution.TaskSummaryResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class BugControllerIntegrationTests extends IntegrationTestSupport {

    private static final Long ASSIGNEE_ID = 11L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CaseService caseService;

    @Autowired
    private ExecutionService executionService;

    @Test
    void createAndGetBugKeepsDetailResponseShape() throws Exception {
        String unique = uniquePrefix("create-detail");

        Integer bugId = createBug(unique + "-manual", "P1", "HIGH", null, null, null);

        mockMvc.perform(get("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(bugId))
                .andExpect(jsonPath("$.data.title").value(unique + "-manual"))
                .andExpect(jsonPath("$.data.reproductionSteps").value("1. Open the page\n2. Submit the form"))
                .andExpect(jsonPath("$.data.expectedResult").value("The request succeeds"))
                .andExpect(jsonPath("$.data.actualResult").value("The request fails"))
                .andExpect(jsonPath("$.data.moduleName").value("接口自动化"))
                .andExpect(jsonPath("$.data.priority").value("P1"))
                .andExpect(jsonPath("$.data.severity").value("HIGH"))
                .andExpect(jsonPath("$.data.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.data.sourceType").value("MANUAL"))
                .andExpect(jsonPath("$.data.assigneeId").value(ASSIGNEE_ID.intValue()))
                .andExpect(jsonPath("$.data.reporterId").value(11))
                .andExpect(jsonPath("$.data.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.tags", hasItem("bug-regression")))
                .andExpect(jsonPath("$.data.attachments.length()").value(0))
                .andExpect(jsonPath("$.data.sourceContext.sourceType").value("MANUAL"))
                .andExpect(jsonPath("$.data.sourceContext.caseSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.sourceContext.reportSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.sourceContext.taskSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.flows.length()").value(1))
                .andExpect(jsonPath("$.data.flows[0].fromStatus").value("TODO"))
                .andExpect(jsonPath("$.data.flows[0].toStatus").value("ASSIGNED"))
                .andExpect(jsonPath("$.data.comments.length()").value(0))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("CREATED")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("ASSIGNED")));
    }

    @Test
    void manualCreateAcceptsSelectedSourceType() throws Exception {
        String title = uniquePrefix("selected-source");

        mockMvc.perform(post("/api/bugs")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(bugRequest(title, "P1", "MEDIUM", null, null, null, "AI_DETECTION")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value(title))
                .andExpect(jsonPath("$.data.sourceType").value("AI_DETECTION"))
                .andExpect(jsonPath("$.data.sourceContext.sourceType").value("AI_DETECTION"));
    }

    @Test
    void listBugsSupportsPaginationAndFilters() throws Exception {
        String unique = uniquePrefix("list-filter");
        Integer first = createBug(unique + "-p1-high-first", "P1", "HIGH", null, null, null);
        Integer second = createBug(unique + "-p1-high-second", "P1", "HIGH", null, null, null);
        createBug(unique + "-p2-medium", "P2", "MEDIUM", null, null, null);

        mockMvc.perform(get("/api/bugs")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("priority", "p1")
                        .param("severity", "high")
                        .param("status", "assigned")
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
                .andExpect(jsonPath("$.data.items[*].priority", containsInAnyOrder("P1", "P1")))
                .andExpect(jsonPath("$.data.items[*].severity", containsInAnyOrder("HIGH", "HIGH")))
                .andExpect(jsonPath("$.data.items[*].status", containsInAnyOrder("ASSIGNED", "ASSIGNED")));
    }

    @Test
    void createBugFromCaseAndReportKeepsSourceContextShape() throws Exception {
        String unique = uniquePrefix("source");
        CaseSummaryResponse relatedCase = createCase(unique + "-case");
        TaskSummaryResponse relatedTask = createTask(unique + "-task");
        ReportSummaryResponse relatedReport = createReport(relatedTask.id(), unique + "-report");

        Integer caseBugId = createBugFromCase(relatedCase.id(), unique + "-case-bug");
        mockMvc.perform(get("/api/bugs/{id}", caseBugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sourceType").value("CASE"))
                .andExpect(jsonPath("$.data.relatedCaseId").value(relatedCase.id().intValue()))
                .andExpect(jsonPath("$.data.relatedReportId").value(nullValue()))
                .andExpect(jsonPath("$.data.relatedTaskId").value(nullValue()))
                .andExpect(jsonPath("$.data.sourceContext.sourceType").value("CASE"))
                .andExpect(jsonPath("$.data.sourceContext.caseSummary.id").value(relatedCase.id().intValue()))
                .andExpect(jsonPath("$.data.sourceContext.caseSummary.title").value(unique + "-case"))
                .andExpect(jsonPath("$.data.sourceContext.caseSummary.workspaceCode").value(WORKSPACE_CODE))
                .andExpect(jsonPath("$.data.sourceContext.reportSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.sourceContext.taskSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.flows.length()").value(1))
                .andExpect(jsonPath("$.data.comments.length()").value(0))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("CREATED")));

        Integer reportBugId = createBugFromReport(relatedReport.id(), unique + "-report-bug");
        mockMvc.perform(get("/api/bugs/{id}", reportBugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sourceType").value("REPORT"))
                .andExpect(jsonPath("$.data.relatedCaseId").value(nullValue()))
                .andExpect(jsonPath("$.data.relatedReportId").value(relatedReport.id().intValue()))
                .andExpect(jsonPath("$.data.relatedTaskId").value(relatedTask.id().intValue()))
                .andExpect(jsonPath("$.data.sourceContext.sourceType").value("REPORT"))
                .andExpect(jsonPath("$.data.sourceContext.caseSummary").value(nullValue()))
                .andExpect(jsonPath("$.data.sourceContext.reportSummary.id").value(relatedReport.id().intValue()))
                .andExpect(jsonPath("$.data.sourceContext.reportSummary.reportName").value(unique + "-report"))
                .andExpect(jsonPath("$.data.sourceContext.reportSummary.taskId").value(relatedTask.id().intValue()))
                .andExpect(jsonPath("$.data.sourceContext.taskSummary.id").value(relatedTask.id().intValue()))
                .andExpect(jsonPath("$.data.sourceContext.taskSummary.taskName").value(unique + "-task"))
                .andExpect(jsonPath("$.data.flows.length()").value(1))
                .andExpect(jsonPath("$.data.comments.length()").value(0))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("CREATED")));
    }

    @Test
    void commentAssignAndTransitionKeepDetailTimelineShape() throws Exception {
        String unique = uniquePrefix("workflow");
        Integer bugId = createBug(unique + "-workflow", "P2", "MEDIUM", null, null, null);
        String commentContent = unique + " comment";

        mockMvc.perform(post("/api/bugs/{id}/comments", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "content": "%s"
                                }
                                """.formatted(WORKSPACE_CODE, commentContent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value(commentContent))
                .andExpect(jsonPath("$.data.commenterId").value(11))
                .andExpect(jsonPath("$.data.commenterName").value("Zhang Li"));

        mockMvc.perform(post("/api/bugs/{id}/assign", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "assigneeId": 12
                                }
                                """.formatted(WORKSPACE_CODE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.assigneeId").value(12))
                .andExpect(jsonPath("$.data.assigneeName").value("Chen Nan"))
                .andExpect(jsonPath("$.data.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.data.flows.length()").value(2))
                .andExpect(jsonPath("$.data.flows[*].toStatus", hasItem("ASSIGNED")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("ASSIGNED")));

        mockMvc.perform(post("/api/bugs/{id}/transition", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "toStatus": "IN_PROGRESS",
                                  "assigneeId": 12,
                                  "actionComment": "start fixing"
                                }
                                """.formatted(WORKSPACE_CODE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.flows.length()").value(3))
                .andExpect(jsonPath("$.data.flows[*].toStatus", hasItem("IN_PROGRESS")))
                .andExpect(jsonPath("$.data.flows[*].actionComment", hasItem("start fixing")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("STATUS_CHANGED")));

        mockMvc.perform(get("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.assigneeId").value(12))
                .andExpect(jsonPath("$.data.comments.length()").value(1))
                .andExpect(jsonPath("$.data.comments[0].content").value(commentContent))
                .andExpect(jsonPath("$.data.flows.length()").value(3))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("CREATED")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("COMMENT_ADDED")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("ASSIGNED")))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("STATUS_CHANGED")));
    }

    @Test
    void attachmentUploadDetailDownloadAndDeleteKeepMainFlow() throws Exception {
        String unique = uniquePrefix("attachment");
        Integer bugId = createBug(unique + "-attachment", "P3", "LOW", null, null, null);
        byte[] content = "bug attachment evidence".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "files",
                "bug-evidence.txt",
                "text/plain",
                content
        );

        String uploadResponse = mockMvc.perform(multipart("/api/bugs/{id}/attachments", bugId)
                        .file(file)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].fileName").value("bug-evidence.txt"))
                .andExpect(jsonPath("$.data[0].contentType").value("text/plain"))
                .andExpect(jsonPath("$.data[0].fileSize").value(content.length))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Integer attachmentId = objectMapper.readTree(uploadResponse).path("data").get(0).path("id").asInt();

        mockMvc.perform(get("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attachments.length()").value(1))
                .andExpect(jsonPath("$.data.attachments[0].id").value(attachmentId))
                .andExpect(jsonPath("$.data.attachments[0].fileName").value("bug-evidence.txt"))
                .andExpect(jsonPath("$.data.attachments[0].downloadUrl")
                        .value("/api/bugs/" + bugId + "/attachments/" + attachmentId + "/download"))
                .andExpect(jsonPath("$.data.activities[*].type", hasItem("ATTACHMENT_ADDED")))
                .andExpect(jsonPath("$.data.activities[*].attachmentId", hasItem(attachmentId)));

        mockMvc.perform(get("/api/bugs/{id}/attachments/{attachmentId}/download", bugId, attachmentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(content().string("bug attachment evidence"));

        mockMvc.perform(delete("/api/bugs/{id}/attachments/{attachmentId}", bugId, attachmentId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attachments.length()").value(0));
    }

    @Test
    void deleteBugRemovesMainRecordCommentsFlowsAndAttachmentFiles() throws Exception {
        String unique = uniquePrefix("delete");
        Integer bugId = createBug("DISPOSABLE-153-" + unique, "P1", "HIGH", null, null, null);
        String commentContent = unique + " comment";

        mockMvc.perform(post("/api/bugs/{id}/comments", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content("""
                                {
                                  "workspaceCode": "%s",
                                  "content": "%s"
                                }
                                """.formatted(WORKSPACE_CODE, commentContent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        byte[] content = "delete bug attachment evidence".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "files",
                "delete-bug-evidence.txt",
                "text/plain",
                content
        );

        mockMvc.perform(multipart("/api/bugs/{id}/attachments", bugId)
                        .file(file)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Path attachmentDirectory = Path.of("data/bug-files/workspace-11/bug-" + bugId).toAbsolutePath().normalize();
        org.junit.jupiter.api.Assertions.assertTrue(Files.exists(attachmentDirectory));

        mockMvc.perform(delete("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/bugs/{id}", bugId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/bugs")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", "DISPOSABLE-153-" + unique)
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(0))
                .andExpect(jsonPath("$.data.items.length()").value(0));

        org.junit.jupiter.api.Assertions.assertFalse(Files.exists(attachmentDirectory));
    }

    private Integer createBug(String title, String priority, String severity, Long caseId, Long reportId, Long taskId) throws Exception {
        String response = mockMvc.perform(post("/api/bugs")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(bugRequest(title, priority, severity, caseId, reportId, taskId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.title").value(title))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asInt();
    }

    private Integer createBugFromCase(Long caseId, String title) throws Exception {
        String response = mockMvc.perform(post("/api/cases/{id}/bugs", caseId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(bugRequest(title, "P2", "MEDIUM", null, null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.title").value(title))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asInt();
    }

    private Integer createBugFromReport(Long reportId, String title) throws Exception {
        String response = mockMvc.perform(post("/api/reports/{id}/bugs", reportId)
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(bugRequest(title, "P0", "CRITICAL", null, null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.title").value(title))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asInt();
    }

    private String bugRequest(String title, String priority, String severity, Long caseId, Long reportId, Long taskId) {
        return bugRequest(title, priority, severity, caseId, reportId, taskId, null);
    }

    private String bugRequest(
            String title,
            String priority,
            String severity,
            Long caseId,
            Long reportId,
            Long taskId,
            String sourceType
    ) {
        return """
                {
                  "workspaceCode": "%s",
                  "title": "%s",
                  "description": "Created by bug integration regression",
                  "reproductionSteps": "1. Open the page\\n2. Submit the form",
                  "expectedResult": "The request succeeds",
                  "actualResult": "The request fails",
                  "moduleName": "接口自动化",
                  "priority": "%s",
                  "severity": "%s",
                  "sourceType": %s,
                  "assigneeId": %d,
                  "relatedCaseId": %s,
                  "relatedReportId": %s,
                  "relatedTaskId": %s,
                  "tags": ["bug-regression", "step47"]
                }
                """.formatted(
                WORKSPACE_CODE,
                title,
                priority,
                severity,
                sourceType == null ? "null" : "\"" + sourceType + "\"",
                ASSIGNEE_ID,
                jsonNumberOrNull(caseId),
                jsonNumberOrNull(reportId),
                jsonNumberOrNull(taskId)
        );
    }

    private CaseSummaryResponse createCase(String title) {
        return caseService.createCase(WORKSPACE_CODE, new CreateCaseRequest(
                WORKSPACE_CODE,
                null,
                title,
                "FUNCTION",
                "P1",
                "MANUAL",
                "CONFIRMED",
                ASSIGNEE_ID,
                "precondition",
                "steps",
                "expected result"
        ));
    }

    private TaskSummaryResponse createTask(String taskName) {
        return executionService.createTask(WORKSPACE_CODE, new CreateTaskRequest(
                WORKSPACE_CODE,
                taskName,
                "API",
                "SUCCESS",
                "created by bug integration regression"
        ));
    }

    private ReportSummaryResponse createReport(Long taskId, String reportName) {
        return executionService.createReport(WORKSPACE_CODE, new CreateReportRequest(
                WORKSPACE_CODE,
                taskId,
                reportName,
                "FAILED",
                "API",
                "failure summary"
        ));
    }

    private String jsonNumberOrNull(Long value) {
        return value == null ? "null" : value.toString();
    }

    private String uniquePrefix(String label) {
        return "bug-" + label + "-" + System.nanoTime();
    }
}
