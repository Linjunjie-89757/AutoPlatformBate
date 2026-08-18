package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
    private TestPlanCaseRequirementMapper planCaseRequirementMapper;

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

    private void createPlanExecution(
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

    private JsonNode data(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
