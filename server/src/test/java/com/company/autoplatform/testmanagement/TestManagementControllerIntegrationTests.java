package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.bug.BugEntity;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class TestManagementControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CaseMapper caseMapper;

    @Autowired
    private TestVersionMapper versionMapper;

    @Autowired
    private TestPlanMapper planMapper;

    @Autowired
    private TestPlanCaseMapper planCaseMapper;

    @Autowired
    private TestPlanRequirementMapper planRequirementMapper;

    @Autowired
    private TestPlanCaseRequirementMapper planCaseRequirementMapper;

    @Autowired
    private TestPlanCaseExecutionMapper planCaseExecutionMapper;

    @Autowired
    private TestRequirementMapper requirementMapper;

    @Autowired
    private TestRequirementCaseMapper requirementCaseMapper;

    @Autowired
    private TestActivityLogMapper activityLogMapper;

    @Autowired
    private BugMapper bugMapper;

    @Test
    void versionAndRequirementLifecycleEnforcesIsolationReviewAndQualityGates() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "integration-version-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11,
                                "startDate", "2026-08-17",
                                "testDate", "2026-08-20",
                                "releaseDate", "2026-08-30",
                                "goal", "验证版本和需求后端闭环"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLANNING"))
                .andExpect(jsonPath("$.data.lockVersion").value(0))
                .andReturn());
        long versionId = version.path("id").asLong();

        version = data(mockMvc.perform(put("/api/test-management/versions/{id}", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "integration-version-updated-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11,
                                "startDate", "2026-08-17",
                                "testDate", "2026-08-20",
                                "releaseDate", "2026-08-30",
                                "goal", "更新后的测试目标",
                                "expectedVersion", 0
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lockVersion").value(1))
                .andReturn());

        mockMvc.perform(put("/api/test-management/versions/{id}", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "stale-update-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11,
                                "expectedVersion", 0
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_CONCURRENT_MODIFICATION"));

        version = transitionVersion(versionId, "DEVELOPING", 1, false, null, 200);
        assertThat(version.path("lockVersion").asInt()).isEqualTo(2);

        mockMvc.perform(post("/api/test-management/versions/{id}/transition", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "targetStatus", "TESTING",
                                "expectedVersion", 2,
                                "force", false
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("TM_QUALITY_GATE_FAILED"));

        JsonNode requirement = data(mockMvc.perform(post("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "integration-requirement-" + suffix,
                                "priority", "P1",
                                "sourceType", "MANUAL",
                                "description", "用于验证需求关联与评审"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.qualityStatus").value("UNCOVERED"))
                .andReturn());
        long requirementId = requirement.path("id").asLong();

        CaseEntity testCase = firstCaseInRiskWorkspace();
        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("REVIEWING"))
                .andExpect(jsonPath("$.data.caseTotal").value(1))
                .andReturn());
        assertThat(requirement.path("lockVersion").asInt()).isEqualTo(1);

        mockMvc.perform(post("/api/test-management/requirements/{id}/cases/{caseId}/review", requirementId, testCase.getId())
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("decision", "PASSED", "expectedVersion", 1))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_INVALID_TRANSITION"));

        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/review/start", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cases[0].reviewStatus").value("REVIEWING"))
                .andReturn());

        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/cases/{caseId}/review", requirementId, testCase.getId())
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("decision", "PASSED", "comment", "覆盖充分", "expectedVersion", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("PASSED"))
                .andExpect(jsonPath("$.data.qualityStatus").value("COVERED"))
                .andReturn());
        assertThat(requirement.path("lockVersion").asInt()).isEqualTo(3);

        version = transitionVersion(versionId, "TESTING", 2, false, null, 200);
        assertThat(version.path("status").asText()).isEqualTo("TESTING");

        mockMvc.perform(post("/api/test-management/versions/{id}/transition", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "targetStatus", "PENDING_RELEASE",
                                "expectedVersion", 3,
                                "force", false
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details.failedChecks[0].key").value("COMPLETED_PLAN_COUNT"));

        assertRequirementUsesLatestExecutionResult(versionId, requirementId, testCase);

        mockMvc.perform(get("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("versionId", String.valueOf(versionId))
                        .param("status", "covered"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));

        mockMvc.perform(get("/api/test-management/versions/{id}", versionId)
                        .header("X-Workspace-Code", "payments-core"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TM_RESOURCE_NOT_FOUND"));

        mockMvc.perform(get("/api/test-management/versions/{id}/activities", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(4));

        createAndSoftDeleteRequirement(versionId, "integration-requirement-" + suffix);
    }

    @Test
    void deletingDraftPlanRemovesItsRequirementAndCaseConfiguration() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "draft-delete-version-" + suffix,
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
                                "title", "draft-delete-requirement-" + suffix,
                                "priority", "P2",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long requirementId = requirement.path("id").asLong();
        CaseEntity testCase = firstCaseInRiskWorkspace();

        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", 0))))
                .andExpect(status().isOk())
                .andReturn());
        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/review/start", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", requirement.path("lockVersion").asInt()))))
                .andExpect(status().isOk())
                .andReturn());
        requirement = data(mockMvc.perform(post("/api/test-management/requirements/{id}/cases/{caseId}/review", requirementId, testCase.getId())
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "decision", "PASSED",
                                "expectedVersion", requirement.path("lockVersion").asInt()
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(requirement.path("reviewStatus").asText()).isEqualTo("PASSED");

        JsonNode plan = data(mockMvc.perform(post("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "purpose", "VERSION",
                                "versionId", versionId,
                                "name", "draft-delete-plan-" + suffix,
                                "requirementIds", List.of(requirementId),
                                "draft", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.caseCount").value(1))
                .andReturn());
        long planId = plan.path("id").asLong();
        List<Long> planCaseIds = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>()
                        .eq(TestPlanCaseEntity::getPlanId, planId))
                .stream().map(TestPlanCaseEntity::getId).toList();
        assertThat(planCaseIds).hasSize(1);

        mockMvc.perform(delete("/api/test-management/plans/{id}", planId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", String.valueOf(plan.path("lockVersion").asInt())))
                .andExpect(status().isOk());

        assertThat(planMapper.selectById(planId)).isNull();
        assertThat(planRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanRequirementEntity>()
                .eq(TestPlanRequirementEntity::getPlanId, planId))).isZero();
        assertThat(planCaseMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseEntity>()
                .eq(TestPlanCaseEntity::getPlanId, planId))).isZero();
        assertThat(planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .in(TestPlanCaseRequirementEntity::getPlanCaseId, planCaseIds))).isZero();

        JsonNode protectedPlan = data(mockMvc.perform(post("/api/test-management/plans")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "purpose", "TEMP",
                                "name", "draft-with-execution-" + suffix,
                                "manualCaseIds", List.of(testCase.getId()),
                                "draft", true
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long protectedPlanId = protectedPlan.path("id").asLong();
        TestPlanCaseEntity protectedPlanCase = planCaseMapper.selectOne(new LambdaQueryWrapper<TestPlanCaseEntity>()
                .eq(TestPlanCaseEntity::getPlanId, protectedPlanId));
        LocalDateTime now = LocalDateTime.now();
        TestPlanCaseExecutionEntity execution = new TestPlanCaseExecutionEntity();
        execution.setWorkspaceId(protectedPlanCase.getWorkspaceId());
        execution.setPlanId(protectedPlanId);
        execution.setPlanCaseId(protectedPlanCase.getId());
        execution.setPreviousStatus(PlanCaseExecutionStatus.PENDING);
        execution.setExecutionStatus(PlanCaseExecutionStatus.PASSED);
        execution.setExecutorId(11L);
        execution.setExecutedAt(now);
        execution.setCreatedAt(now);
        execution.setUpdatedAt(now);
        planCaseExecutionMapper.insert(execution);

        mockMvc.perform(delete("/api/test-management/plans/{id}", protectedPlanId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", String.valueOf(protectedPlan.path("lockVersion").asInt())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));
        assertThat(planMapper.selectById(protectedPlanId)).isNotNull();
    }

    @Test
    void allWorkspaceScopeIsReadOnly() throws Exception {
        mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", "ALL")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "invalid-all-scope-" + UUID.randomUUID(),
                                "versionType", "ITERATION",
                                "ownerId", 11
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TM_VALIDATION_FAILED"));
    }

    @Test
    void testEngineerPermissionsAllowDailyWorkButProtectReviewDeleteAndRelease() throws Exception {
        Authentication engineer = authenticationFor(12L, "chennan", "Chen Nan", PlatformRole.MEMBER);

        mockMvc.perform(get("/api/test-management/versions")
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/test-management/plans/{id}/report/pdf", 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/test-management/plans/{id}/start", 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding")
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 0))))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/test-management/requirements/{id}", 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding")
                        .param("expectedVersion", "0"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/test-management/requirements/{id}/review/start", 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding")
                        .contentType("application/json")
                        .content(json(Map.of("expectedVersion", 0))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/test-management/versions/{id}/transition", 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "targetStatus", "DEVELOPING",
                                "expectedVersion", 0,
                                "force", false
                        ))))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/test-management/plans/{id}/cases/{planCaseId}/evidence/{attachmentId}", 999999L, 999999L, 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/test-management/plans/{id}/cases/{planCaseId}/defects/{defectId}", 999999L, 999999L, 999999L)
                        .with(authentication(engineer))
                        .header("X-Workspace-Code", "retail-onboarding"))
                .andExpect(status().isNotFound());
    }

    @Test
    void excelRequirementImportValidatesRowsSkipsDuplicatesAndKeepsPartialSuccess() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "import-version-" + suffix,
                                "versionType", "ITERATION",
                                "ownerId", 11
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long versionId = version.path("id").asLong();
        String versionName = version.path("name").asText();
        String firstTitle = "import-valid-first-" + suffix;
        String secondTitle = "import-valid-second-" + suffix;
        String sourceRef = "IMPORT-REF-" + suffix;
        byte[] workbook = requirementWorkbook(List.of(
                List.of(firstTitle, "P1", "chennan", "", sourceRef, "第一条合法需求"),
                List.of(firstTitle, "P2", "12", "", "IMPORT-SECOND-" + suffix, "文件内同版本同标题"),
                List.of("import-invalid-priority-" + suffix, "PX", "chennan", "", "", "优先级错误"),
                List.of("import-invalid-owner-" + suffix, "P2", "missing-owner", "", "", "负责人不存在"),
                List.of(secondTitle, "P0", "chennan@demo.local", versionName, "IMPORT-THIRD-" + suffix, "按版本名称导入"),
                List.of("import-duplicate-ref-" + suffix, "P3", "12", "", sourceRef, "外部标识重复")
        ));
        MockMultipartFile file = new MockMultipartFile(
                "file", "requirements.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", workbook);

        MvcResult importResult = mockMvc.perform(multipart("/api/test-management/requirements/import")
                        .file(file)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("defaultVersionId", String.valueOf(versionId))
                        .param("duplicateStrategy", "SKIP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(6))
                .andExpect(jsonPath("$.data.importedCount").value(2))
                .andExpect(jsonPath("$.data.skippedCount").value(2))
                .andExpect(jsonPath("$.data.failedCount").value(2))
                .andReturn();

        JsonNode importedIds = data(importResult).path("importedRequirementIds");
        assertThat(importedIds.size()).isEqualTo(2);
        List<TestRequirementEntity> imported = requirementMapper.selectBatchIds(List.of(
                importedIds.get(0).asLong(), importedIds.get(1).asLong()));
        assertThat(imported).extracting(TestRequirementEntity::getTitle)
                .containsExactlyInAnyOrder(firstTitle, secondTitle);
        assertThat(imported).allSatisfy(item -> {
            assertThat(item.getVersionId()).isEqualTo(versionId);
            assertThat(item.getSourceType()).isEqualTo(RequirementSourceType.EXCEL);
            assertThat(item.getAssigneeId()).isEqualTo(12L);
        });

        byte[] template = mockMvc.perform(get("/api/test-management/requirements/import-template")
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentType())
                        .isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        try (XSSFWorkbook templateWorkbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(template))) {
            Row header = templateWorkbook.getSheetAt(0).getRow(0);
            assertThat(header.getCell(0).getStringCellValue()).isEqualTo("需求标题*");
            assertThat(header.getCell(2).getStringCellValue()).isEqualTo("负责人*");
        }
    }

    @Test
    void requirementMutationsPreserveFrozenPlanAndDefectTraceability() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "requirement-safety-version-" + suffix,
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
                                "title", "requirement-safety-" + suffix,
                                "priority", "P1",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long requirementId = requirement.path("id").asLong();

        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "requirement-safety-updated-" + suffix,
                                "priority", "P2",
                                "sourceType", "MANUAL",
                                "description", "验证编辑审计、快照保留和软删除",
                                "expectedVersion", 0
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lockVersion").value(1))
                .andReturn());

        mockMvc.perform(put("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "stale-requirement-" + suffix,
                                "priority", "P2",
                                "sourceType", "MANUAL",
                                "expectedVersion", 0
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_CONCURRENT_MODIFICATION"));

        CaseEntity testCase = firstCaseInRiskWorkspace();
        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(testCase.getId()), "expectedVersion", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lockVersion").value(2))
                .andReturn());

        TestPlanEntity frozenPlan = createPlanExecution(
                versionId, requirementId, testCase, PlanCaseExecutionStatus.PASSED, LocalDateTime.now());
        TestPlanCaseEntity frozenPlanCase = planCaseMapper.selectOne(new LambdaQueryWrapper<TestPlanCaseEntity>()
                .eq(TestPlanCaseEntity::getPlanId, frozenPlan.getId())
                .last("limit 1"));

        requirement = data(mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(), "expectedVersion", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.caseTotal").value(0))
                .andExpect(jsonPath("$.data.lockVersion").value(3))
                .andReturn());
        assertThat(requirement.path("id").asLong()).isEqualTo(requirementId);
        assertThat(requirementCaseMapper.selectCount(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                .eq(TestRequirementCaseEntity::getRequirementId, requirementId))).isZero();
        assertThat(planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getRequirementId, requirementId)
                .eq(TestPlanCaseRequirementEntity::getPlanCaseId, frozenPlanCase.getId()))).isEqualTo(1);

        mockMvc.perform(put("/api/test-management/requirements/{id}/cases", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of("caseIds", List.of(), "expectedVersion", 2))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_CONCURRENT_MODIFICATION"));
        mockMvc.perform(delete("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", "2"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_CONCURRENT_MODIFICATION"));

        BugEntity defect = new BugEntity();
        defect.setWorkspaceId(testCase.getWorkspaceId());
        defect.setBugNo("BUG-REQ-SAFETY-" + suffix);
        defect.setTitle("requirement-trace-defect-" + suffix);
        defect.setDescription("验证需求软删除后缺陷追溯仍保留");
        defect.setPriority("P2");
        defect.setSeverity("MEDIUM");
        defect.setStatus("TODO");
        defect.setSourceType("CASE");
        defect.setReporterId(11L);
        defect.setRelatedCaseId(testCase.getId());
        defect.setTestVersionId(versionId);
        defect.setTestRequirementId(requirementId);
        defect.setTestPlanId(frozenPlan.getId());
        defect.setTestPlanCaseId(frozenPlanCase.getId());
        defect.setCreatedAt(LocalDateTime.now());
        defect.setUpdatedAt(LocalDateTime.now());
        bugMapper.insert(defect);

        mockMvc.perform(delete("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", "3"))
                .andExpect(status().isOk());

        TestRequirementEntity deletedRequirement = requirementMapper.selectById(requirementId);
        assertThat(deletedRequirement.getDeletedAt()).isNotNull();
        assertThat(planCaseMapper.selectById(frozenPlanCase.getId())).isNotNull();
        assertThat(planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getRequirementId, requirementId))).isEqualTo(1);
        assertThat(bugMapper.selectById(defect.getId()).getTestRequirementId()).isEqualTo(requirementId);

        List<TestActivityLogEntity> activities = activityLogMapper.selectList(new LambdaQueryWrapper<TestActivityLogEntity>()
                .eq(TestActivityLogEntity::getEntityType, ActivityEntityType.REQUIREMENT)
                .eq(TestActivityLogEntity::getEntityId, requirementId)
                .orderByDesc(TestActivityLogEntity::getId));
        TestActivityLogEntity unlinkActivity = activities.stream()
                .filter(item -> "REQUIREMENT_CASES_REPLACED".equals(item.getActionCode()))
                .filter(item -> item.getDetail() != null && !item.getDetail().contains("\"removedCaseIds\":[]"))
                .findFirst()
                .orElseThrow();
        JsonNode unlinkDetail = objectMapper.readTree(unlinkActivity.getDetail());
        assertThat(unlinkDetail.path("removedCaseIds").toString())
                .contains(String.valueOf(testCase.getId()));
        assertThat(unlinkDetail.path("retainedSnapshotPlanIds").toString())
                .contains(String.valueOf(frozenPlan.getId()));
        TestActivityLogEntity deleteActivity = activities.stream()
                .filter(item -> "REQUIREMENT_DELETED".equals(item.getActionCode()))
                .findFirst()
                .orElseThrow();
        JsonNode deleteDetail = objectMapper.readTree(deleteActivity.getDetail());
        assertThat(deleteDetail.path("retainedSnapshotPlanIds").toString())
                .contains(String.valueOf(frozenPlan.getId()));
        assertThat(deleteDetail.path("retainedDefectIds").toString())
                .contains(String.valueOf(defect.getId()));

        mockMvc.perform(get("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isNotFound());
    }

    @Test
    void releasingVersionRequiresReason() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode version = data(mockMvc.perform(post("/api/test-management/versions")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "name", "release-reason-version-" + suffix,
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
                                "title", "released-version-requirement-" + suffix,
                                "priority", "P2",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long requirementId = requirement.path("id").asLong();
        TestVersionEntity entity = versionMapper.selectById(versionId);
        entity.setStatus(VersionStatus.PENDING_RELEASE);
        entity.setUpdatedAt(LocalDateTime.now());
        assertThat(versionMapper.updateById(entity)).isEqualTo(1);

        mockMvc.perform(post("/api/test-management/versions/{id}/transition", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "targetStatus", "RELEASED",
                                "expectedVersion", 1,
                                "force", false
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TM_VALIDATION_FAILED"));

        mockMvc.perform(post("/api/test-management/versions/{id}/transition", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "targetStatus", "RELEASED",
                                "expectedVersion", 1,
                                "force", false,
                                "reason", "版本验收完成"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RELEASED"));

        mockMvc.perform(put("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", "should-not-update-" + suffix,
                                "priority", "P2",
                                "sourceType", "MANUAL",
                                "expectedVersion", 0
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TM_SNAPSHOT_LOCKED"));
    }

    private void assertRequirementUsesLatestExecutionResult(
            long versionId,
            long requirementId,
            CaseEntity testCase
    ) throws Exception {
        createPlanExecution(versionId, requirementId, testCase, PlanCaseExecutionStatus.PASSED, LocalDateTime.now().minusMinutes(5));
        mockMvc.perform(get("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.qualityStatus").value("PASSED"));

        createPlanExecution(versionId, requirementId, testCase, PlanCaseExecutionStatus.FAILED, LocalDateTime.now());
        mockMvc.perform(get("/api/test-management/requirements/{id}", requirementId)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.qualityStatus").value("COVERED"));
        mockMvc.perform(get("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("versionId", String.valueOf(versionId))
                        .param("status", "passed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));
        mockMvc.perform(get("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("versionId", String.valueOf(versionId))
                        .param("status", "covered"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    private TestPlanEntity createPlanExecution(
            long versionId,
            long requirementId,
            CaseEntity testCase,
            PlanCaseExecutionStatus executionStatus,
            LocalDateTime executedAt
    ) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        TestPlanEntity plan = new TestPlanEntity();
        plan.setWorkspaceId(testCase.getWorkspaceId());
        plan.setPlanNo("PLAN-TEST-" + suffix);
        plan.setPurpose(PlanPurpose.VERSION);
        plan.setPlanType(PlanType.REGRESSION);
        plan.setStatus(PlanStatus.COMPLETED);
        plan.setVersionId(versionId);
        plan.setName("latest-execution-plan-" + suffix);
        plan.setOwnerId(11L);
        plan.setStartDate(LocalDate.now());
        plan.setEndDate(LocalDate.now());
        plan.setMinExecuteRate(BigDecimal.ZERO);
        plan.setMinPassRate(BigDecimal.ZERO);
        plan.setAllowP0(false);
        plan.setMaxP1(0);
        plan.setAutoReport(false);
        plan.setOwnerConfirmRequired(false);
        plan.setLockVersion(0);
        plan.setCreatedBy(11L);
        plan.setUpdatedBy(11L);
        plan.setCreatedAt(executedAt.minusMinutes(1));
        plan.setUpdatedAt(executedAt);
        planMapper.insert(plan);

        TestPlanCaseEntity planCase = new TestPlanCaseEntity();
        planCase.setWorkspaceId(testCase.getWorkspaceId());
        planCase.setPlanId(plan.getId());
        planCase.setSourceCaseId(testCase.getId());
        planCase.setOriginType(PlanCaseOriginType.REQUIREMENT);
        planCase.setSnapshotCaseNo(testCase.getCaseNo());
        planCase.setSnapshotTitle(testCase.getTitle());
        planCase.setSnapshotPriority(testCase.getPriority());
        planCase.setAddedAfterStart(false);
        planCase.setExecutionStatus(executionStatus);
        planCase.setExecutedBy(11L);
        planCase.setExecutedAt(executedAt);
        planCase.setSortOrder(0);
        planCase.setLockVersion(0);
        planCase.setCreatedBy(11L);
        planCase.setCreatedAt(executedAt.minusMinutes(1));
        planCase.setUpdatedAt(executedAt);
        planCaseMapper.insert(planCase);

        TestPlanCaseRequirementEntity link = new TestPlanCaseRequirementEntity();
        link.setWorkspaceId(testCase.getWorkspaceId());
        link.setPlanCaseId(planCase.getId());
        link.setRequirementId(requirementId);
        link.setCreatedAt(executedAt);
        link.setUpdatedAt(executedAt);
        planCaseRequirementMapper.insert(link);
        return plan;
    }

    private void createAndSoftDeleteRequirement(long versionId, String title) throws Exception {
        JsonNode requirement = data(mockMvc.perform(post("/api/test-management/requirements")
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(Map.of(
                                "versionId", versionId,
                                "title", title,
                                "priority", "P2",
                                "sourceType", "MANUAL"
                        ))))
                .andExpect(status().isOk())
                .andReturn());
        long id = requirement.path("id").asLong();
        mockMvc.perform(delete("/api/test-management/requirements/{id}", id)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .param("expectedVersion", "0"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/test-management/requirements/{id}", id)
                        .header("X-Workspace-Code", WORKSPACE_CODE))
                .andExpect(status().isNotFound());
    }

    private JsonNode transitionVersion(
            long versionId,
            String targetStatus,
            int expectedVersion,
            boolean force,
            String reason,
            int expectedHttpStatus
    ) throws Exception {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("targetStatus", targetStatus);
        body.put("expectedVersion", expectedVersion);
        body.put("force", force);
        if (reason != null) body.put("reason", reason);
        MvcResult result = mockMvc.perform(post("/api/test-management/versions/{id}/transition", versionId)
                        .header("X-Workspace-Code", WORKSPACE_CODE)
                        .contentType("application/json")
                        .content(json(body)))
                .andExpect(status().is(expectedHttpStatus))
                .andReturn();
        return data(result);
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

    private Authentication authenticationFor(Long userId, String username, String displayName, String role) {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                userId, username, displayName, "{noop}123456", role, 1);
        return new UsernamePasswordAuthenticationToken(principal, principal.getPassword(), principal.getAuthorities());
    }

    private byte[] requirementWorkbook(List<List<String>> values) throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("需求导入");
            Row header = sheet.createRow(0);
            List<String> headers = List.of("需求标题*", "优先级*", "负责人*", "版本", "外部需求标识", "需求描述");
            for (int column = 0; column < headers.size(); column++) header.createCell(column).setCellValue(headers.get(column));
            for (int rowIndex = 0; rowIndex < values.size(); rowIndex++) {
                Row row = sheet.createRow(rowIndex + 1);
                List<String> rowValues = values.get(rowIndex);
                for (int column = 0; column < rowValues.size(); column++) row.createCell(column).setCellValue(rowValues.get(column));
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private JsonNode data(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
