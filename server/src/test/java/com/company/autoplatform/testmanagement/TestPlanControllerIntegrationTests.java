package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

@AutoConfigureMockMvc
class TestPlanControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CaseMapper caseMapper;

    @Test
    void versionPlanFreezesExecutesGeneratesAndSignsReport() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "plan-version-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long versionId = version.path("id").asLong();
        CaseEntity testCase = firstCaseInRiskWorkspace();

        JsonNode requirement = data(mockMvc.perform(post("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "plan-requirement-" + suffix,
                                "priority", "P1",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long requirementId = requirement.path("id").asLong();

        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", 0))))
                .andExpect(status().isOk())
                .andReturn());
        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/review/start", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 1))))
                .andExpect(status().isOk())
                .andReturn());
        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/cases/{caseId}/review", requirementId, testCase.getId())
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("decision", "PASSED", "expectedVersion", 2))))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(requirement.path("qualityStatus").asText()).isEqualTo("COVERED");

        Map<String, Object> planPayload = new LinkedHashMap<>();
        planPayload.put("purpose", "VERSION");
        planPayload.put("planType", "REGRESSION");
        planPayload.put("versionId", versionId);
        planPayload.put("name", "regression-plan-" + suffix);
        planPayload.put("ownerId", 11);
        planPayload.put("startDate", "2026-08-18");
        planPayload.put("endDate", "2026-08-20");
        planPayload.put("requirementIds", List.of(requirementId));
        planPayload.put("excludedAutoCaseIds", List.of());
        planPayload.put("manualCaseIds", List.of());
        planPayload.put("maxP1", 1);
        planPayload.put("draft", false);
        JsonNode plan = data(mockMvc.perform(post("/api/test-management/plans/create-and-start")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(planPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.requirementCount").value(1))
                .andExpect(jsonPath("$.data.caseCount").value(1))
                .andExpect(jsonPath("$.data.cases[0].originType").value("REQUIREMENT"))
                .andExpect(jsonPath("$.data.snapshotFrozenAt").exists())
                .andReturn());
        long planId = plan.path("id").asLong();
        long planCaseId = plan.path("cases").path(0).path("id").asLong();

        plan = data(mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/results", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("status", "FAILED", "note", "支付重试失败", "expectedVersion", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executedCount").value(1))
                .andExpect(jsonPath("$.data.passedCount").value(0))
                .andReturn());

        JsonNode defect = data(mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/defects", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "title", "payment-retry-defect-" + suffix,
                                "description", "验证失败用例的完整缺陷追溯",
                                "priority", "P1",
                                "severity", "HIGH",
                                "assigneeId", 11,
                                "sourceType", "TEST_PLAN",
                                "tags", List.of("闭环验收", "支付重试")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourceType").value("TEST_PLAN"))
                .andExpect(jsonPath("$.data.relatedCaseId").value(testCase.getId()))
                .andExpect(jsonPath("$.data.tags[0]").value("闭环验收"))
                .andExpect(jsonPath("$.data.tags[1]").value("支付重试"))
                .andReturn());

        mockMvc.perform(get("/api/test-management/plans/{id}/defects", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(defect.path("id").asLong()))
                .andExpect(jsonPath("$.data[0].testVersionId").value(versionId))
                .andExpect(jsonPath("$.data[0].testRequirementId").value(requirementId))
                .andExpect(jsonPath("$.data[0].testPlanId").value(planId))
                .andExpect(jsonPath("$.data[0].testPlanCaseId").value(planCaseId))
                .andExpect(jsonPath("$.data[0].relatedCaseId").value(testCase.getId()));

        plan = data(mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/results", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("status", "PASSED", "note", "修复验证通过", "expectedVersion", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.passedCount").value(1))
                .andReturn());

        mockMvc.perform(get("/api/test-management/plans/{id}/cases/{planCaseId}/executions", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].executionStatus").value("PASSED"))
                .andExpect(jsonPath("$.data[1].executionStatus").value("FAILED"));

        plan = data(mockMvc.perform(post("/api/test-management/plans/{id}/complete", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 1, "force", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.report.status").value("GENERATED"))
                .andReturn());
        int reportVersion = plan.path("report").path("lockVersion").asInt();

        mockMvc.perform(put("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "completed-plan-edit-attempt",
                                "ownerId", 11,
                                "expectedVersion", plan.path("lockVersion").asInt()
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(post("/api/test-management/plans/{id}/cases", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", plan.path("lockVersion").asInt()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(delete("/api/test-management/plans/{id}/cases/{planCaseId}", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", String.valueOf(plan.path("lockVersion").asInt())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(put("/api/test-management/plans/{id}/cases/{planCaseId}/assignee", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("assigneeId", 11, "expectedVersion", 2))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(put("/api/test-management/plans/{id}/cases/{planCaseId}", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "title", "completed-plan-case-edit-attempt",
                                "priority", "P1",
                                "expectedVersion", 2
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(post("/api/test-management/plans/{id}/report/sign", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", reportVersion, "force", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SIGNED"));

        byte[] pdf = mockMvc.perform(get("/api/test-management/plans/{id}/report/pdf", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentType()).isEqualTo("application/pdf"))
                .andExpect(result -> assertThat(result.getResponse().getHeader("Content-Disposition"))
                        .contains("attachment"))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        assertThat(pdf).startsWith("%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try (PDDocument document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("测试计划报告", "regression-plan-" + suffix, "已确认签字");
        }

        byte[] versionPdf = mockMvc.perform(get("/api/test-management/versions/{id}/report/pdf", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentType()).isEqualTo("application/pdf"))
                .andExpect(result -> assertThat(result.getResponse().getHeader("Content-Disposition"))
                        .contains("attachment"))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        assertThat(versionPdf).startsWith("%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try (PDDocument document = Loader.loadPDF(versionPdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("版本测试汇总报告", "plan-version-" + suffix, "regression-plan-" + suffix);
        }

        mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/results", planId, planCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("status", "FAILED", "expectedVersion", 2))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_INVALID_TRANSITION"));

        mockMvc.perform(get("/api/test-management/plans/{id}/activities", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(7));
    }

    @Test
    void cancelledPlanRejectsSnapshotMutations() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        CaseEntity testCase = firstCaseInRiskWorkspace();
        JsonNode draft = data(mockMvc.perform(post("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "purpose", "TEMP",
                                "planType", "MIXED",
                                "name", "cancelled-plan-" + suffix,
                                "draft", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn());
        long planId = draft.path("id").asLong();

        draft = data(mockMvc.perform(post("/api/test-management/plans/{id}/cancel", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 0, "reason", "取消本次临时测试"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"))
                .andReturn());
        int planVersion = draft.path("lockVersion").asInt();

        mockMvc.perform(put("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("name", "cancelled-plan-edit-attempt", "expectedVersion", planVersion))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(post("/api/test-management/plans/{id}/cases", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", planVersion))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(delete("/api/test-management/plans/{id}/cases/{planCaseId}", planId, 999999L)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", String.valueOf(planVersion)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(put("/api/test-management/plans/{id}/cases/{planCaseId}/assignee", planId, 999999L)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("assigneeId", 11, "expectedVersion", 0))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));

        mockMvc.perform(put("/api/test-management/plans/{id}/cases/{planCaseId}", planId, 999999L)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("title", "cancelled-plan-case-edit-attempt", "priority", "P1", "expectedVersion", 0))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));
    }

    @Test
    void createAndStartRollsBackWhenStartValidationFails() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "rollback-version-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long versionId = version.path("id").asLong();
        JsonNode requirement = data(mockMvc.perform(post("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "rollback-requirement-" + suffix,
                                "priority", "P1",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("purpose", "VERSION");
        payload.put("planType", "REGRESSION");
        payload.put("versionId", versionId);
        payload.put("name", "rollback-plan-" + suffix);
        payload.put("ownerId", 11);
        payload.put("startDate", "2026-08-18");
        payload.put("endDate", "2026-08-20");
        payload.put("requirementIds", List.of(requirement.path("id").asLong()));
        payload.put("draft", false);

        mockMvc.perform(post("/api/test-management/plans/create-and-start")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(payload)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("TM_REVIEW_REQUIRED"));

        mockMvc.perform(get("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("keyword", "rollback-plan-" + suffix))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    void draftPlanCanUpdateDefinitionAndRejectStaleVersion() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        CaseEntity testCase = firstCaseInRiskWorkspace();
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "editable-version-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        JsonNode plan = data(mockMvc.perform(post("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "purpose", "VERSION",
                                "planType", "MIXED",
                                "name", "editable-plan-" + suffix,
                                "draft", true
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long planId = plan.path("id").asLong();

        Map<String, Object> updatePayload = new LinkedHashMap<>();
        updatePayload.put("name", "edited-plan-" + suffix);
        updatePayload.put("planType", "FUNCTIONAL");
        updatePayload.put("versionId", version.path("id").asLong());
        updatePayload.put("ownerId", 11);
        updatePayload.put("startDate", "2026-08-19");
        updatePayload.put("endDate", "2026-08-21");
        updatePayload.put("goal", "编辑后的测试目标");
        updatePayload.put("minExecuteRate", 95);
        updatePayload.put("minPassRate", 90);
        updatePayload.put("allowP0", false);
        updatePayload.put("maxP1", 1);
        updatePayload.put("autoReport", true);
        updatePayload.put("ownerConfirmRequired", true);
        updatePayload.put("requirementIds", List.of());
        updatePayload.put("excludedAutoCaseIds", List.of());
        updatePayload.put("manualCaseIds", List.of(testCase.getId()));
        updatePayload.put("expectedVersion", 0);

        mockMvc.perform(put("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(updatePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("edited-plan-" + suffix))
                .andExpect(jsonPath("$.data.planType").value("FUNCTIONAL"))
                .andExpect(jsonPath("$.data.versionId").value(version.path("id").asLong()))
                .andExpect(jsonPath("$.data.caseCount").value(1))
                .andExpect(jsonPath("$.data.cases[0].executionStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.lockVersion").value(1));

        mockMvc.perform(put("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(updatePayload)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_CONCURRENT_MODIFICATION"));

        mockMvc.perform(get("/api/test-management/plans/{id}/activities", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items[0].actionCode").value("PLAN_UPDATED"));
    }

    @Test
    void copyingPlanResetsExecutionAndOmitsDefectsReportsAndHistory() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        CaseEntity testCase = firstCaseInRiskWorkspace();
        Map<String, Object> createPayload = new LinkedHashMap<>();
        createPayload.put("purpose", "TEMP");
        createPayload.put("planType", "REGRESSION");
        createPayload.put("name", "copy-source-" + suffix);
        createPayload.put("ownerId", 11);
        createPayload.put("startDate", "2026-08-18");
        createPayload.put("endDate", "2026-08-20");
        createPayload.put("manualCaseIds", List.of(testCase.getId()));
        createPayload.put("draft", false);
        JsonNode source = data(mockMvc.perform(post("/api/test-management/plans/create-and-start")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(createPayload)))
                .andExpect(status().isOk())
                .andReturn());
        long sourcePlanId = source.path("id").asLong();
        long sourcePlanCaseId = source.path("cases").path(0).path("id").asLong();

        mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/results", sourcePlanId, sourcePlanCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("status", "FAILED", "note", "复制前失败", "expectedVersion", 1))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/defects", sourcePlanId, sourcePlanCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "title", "copy-source-defect-" + suffix,
                                "description", "验证复制计划不携带缺陷",
                                "priority", "P1",
                                "severity", "HIGH",
                                "assigneeId", 11,
                                "sourceType", "TEST_PLAN"
                        ))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/test-management/plans/{id}/cases/{planCaseId}/results", sourcePlanId, sourcePlanCaseId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("status", "PASSED", "note", "复制前最终通过", "expectedVersion", 2))))
                .andExpect(status().isOk());
        source = data(mockMvc.perform(post("/api/test-management/plans/{id}/complete", sourcePlanId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 1, "force", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.report.status").value("GENERATED"))
                .andReturn());

        JsonNode copied = data(mockMvc.perform(post("/api/test-management/plans/{id}/copy", sourcePlanId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", source.path("lockVersion").asInt()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.name").value("copy-source-" + suffix + " - 副本"))
                .andExpect(jsonPath("$.data.caseCount").value(1))
                .andExpect(jsonPath("$.data.cases[0].executionStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.cases[0].assigneeId").doesNotExist())
                .andExpect(jsonPath("$.data.defectCount").value(0))
                .andExpect(jsonPath("$.data.report").doesNotExist())
                .andExpect(jsonPath("$.data.snapshotFrozenAt").doesNotExist())
                .andReturn());
        long copiedPlanId = copied.path("id").asLong();

        mockMvc.perform(get("/api/test-management/plans/{id}/activities", copiedPlanId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].actionCode").value("PLAN_COPIED"));
    }

    @Test
    void draftTemporaryPlanCanBeDeleted() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode plan = data(mockMvc.perform(post("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "purpose", "TEMP",
                                "planType", "MIXED",
                                "name", "draft-plan-" + suffix,
                                "draft", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.caseCount").value(0))
                .andReturn());
        long planId = plan.path("id").asLong();
        mockMvc.perform(delete("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", "0"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isNotFound());
    }

    private CaseEntity firstCaseInRiskWorkspace() {
        return caseMapper.selectList(new LambdaQueryWrapper<CaseEntity>()
                        .eq(CaseEntity::getWorkspaceId, 13L)
                        .orderByAsc(CaseEntity::getId)
                        .last("limit 1"))
                .stream()
                .findFirst()
                .orElseThrow(() -> new AssertionError("risk-ops workspace has no seeded case"));
    }

    private JsonNode data(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
