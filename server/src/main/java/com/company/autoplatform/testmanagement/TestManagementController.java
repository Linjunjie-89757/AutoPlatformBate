package com.company.autoplatform.testmanagement;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.bug.BugEntity;
import com.company.autoplatform.bug.BugDetailResponse;
import com.company.autoplatform.bug.CreateBugRequest;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/test-management")
public class TestManagementController {

    private final TestVersionService versionService;
    private final TestRequirementService requirementService;
    private final TestPlanService planService;

    public TestManagementController(TestVersionService versionService, TestRequirementService requirementService, TestPlanService planService) {
        this.versionService = versionService;
        this.requirementService = requirementService;
        this.planService = planService;
    }

    @GetMapping("/versions")
    public ApiResponse<PageResponse<TestVersionResponse>> listVersions(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "versionType", required = false) String versionType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "ownerId", required = false) Long ownerId,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(versionService.list(workspaceCode, keyword, versionType, status, ownerId, pageNo, pageSize));
    }

    @PostMapping("/versions")
    public ApiResponse<TestVersionResponse> createVersion(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTestVersionRequest request
    ) {
        return ApiResponse.ok(versionService.create(workspaceCode, request), "版本创建成功");
    }

    @GetMapping("/versions/{id}")
    public ApiResponse<TestVersionResponse> getVersion(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(versionService.get(id, workspaceCode));
    }

    @PutMapping("/versions/{id}")
    public ApiResponse<TestVersionResponse> updateVersion(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateTestVersionRequest request
    ) {
        return ApiResponse.ok(versionService.update(id, workspaceCode, request), "版本更新成功");
    }

    @PostMapping("/versions/{id}/transition")
    public ApiResponse<TestVersionResponse> transitionVersion(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TransitionTestVersionRequest request
    ) {
        return ApiResponse.ok(versionService.transition(id, workspaceCode, request), "版本状态更新成功");
    }

    @GetMapping("/versions/{id}/requirements")
    public ApiResponse<PageResponse<TestRequirementResponse>> listVersionRequirements(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        versionService.get(id, workspaceCode);
        return ApiResponse.ok(requirementService.list(
                workspaceCode, id, null, null, null, null, null, null, pageNo, pageSize));
    }

    @GetMapping("/versions/{id}/activities")
    public ApiResponse<PageResponse<TestActivityItem>> listVersionActivities(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(versionService.listActivities(id, workspaceCode, pageNo, pageSize));
    }

    @GetMapping("/requirements")
    public ApiResponse<PageResponse<TestRequirementResponse>> listRequirements(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "versionId", required = false) Long versionId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String qualityStatus,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "sourceType", required = false) String sourceType,
            @RequestParam(value = "reviewStatus", required = false) String reviewStatus,
            @RequestParam(value = "assigneeId", required = false) Long assigneeId,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(requirementService.list(
                workspaceCode, versionId, keyword, qualityStatus, priority, sourceType,
                reviewStatus, assigneeId, pageNo, pageSize));
    }

    @PostMapping("/requirements")
    public ApiResponse<TestRequirementResponse> createRequirement(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTestRequirementRequest request
    ) {
        return ApiResponse.ok(requirementService.create(workspaceCode, request), "需求创建成功");
    }

    @GetMapping("/requirements/{id}")
    public ApiResponse<TestRequirementResponse> getRequirement(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(requirementService.get(id, workspaceCode));
    }

    @PutMapping("/requirements/{id}")
    public ApiResponse<TestRequirementResponse> updateRequirement(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateTestRequirementRequest request
    ) {
        return ApiResponse.ok(requirementService.update(id, workspaceCode, request), "需求更新成功");
    }

    @DeleteMapping("/requirements/{id}")
    public ApiResponse<Void> deleteRequirement(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam("expectedVersion") Integer expectedVersion
    ) {
        requirementService.delete(id, workspaceCode, expectedVersion);
        return ApiResponse.ok(null, "需求删除成功");
    }

    @PutMapping("/requirements/{id}/cases")
    public ApiResponse<TestRequirementResponse> replaceRequirementCases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReplaceRequirementCasesRequest request
    ) {
        return ApiResponse.ok(requirementService.replaceCases(id, workspaceCode, request), "关联用例已更新");
    }

    @PostMapping("/requirements/{id}/review/start")
    public ApiResponse<TestRequirementResponse> startRequirementReview(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody StartRequirementReviewRequest request
    ) {
        return ApiResponse.ok(requirementService.startReview(id, workspaceCode, request), "需求用例评审已发起");
    }

    @PostMapping("/requirements/{id}/cases/{caseId}/review")
    public ApiResponse<TestRequirementResponse> reviewRequirementCase(
            @PathVariable Long id,
            @PathVariable Long caseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReviewRequirementCaseRequest request
    ) {
        return ApiResponse.ok(requirementService.reviewCase(id, caseId, workspaceCode, request), "用例评审结果已保存");
    }

    @GetMapping("/requirements/{id}/activities")
    public ApiResponse<PageResponse<TestActivityItem>> listRequirementActivities(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(requirementService.listActivities(id, workspaceCode, pageNo, pageSize));
    }

    @GetMapping("/plans")
    public ApiResponse<PageResponse<TestPlanResponse>> listPlans(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "purpose", required = false) String purpose,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "versionId", required = false) Long versionId,
            @RequestParam(value = "ownerId", required = false) Long ownerId,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(planService.list(workspaceCode, keyword, purpose, status, versionId, ownerId, pageNo, pageSize));
    }

    @PostMapping("/plans")
    public ApiResponse<TestPlanResponse> createPlan(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTestPlanRequest request
    ) {
        return ApiResponse.ok(planService.create(workspaceCode, request), "测试计划创建成功");
    }

    @PostMapping("/plans/create-and-start")
    public ApiResponse<TestPlanResponse> createAndStartPlan(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTestPlanRequest request
    ) {
        return ApiResponse.ok(planService.createAndStart(workspaceCode, request), "测试计划已创建并开始");
    }

    @GetMapping("/plans/{id}")
    public ApiResponse<TestPlanResponse> getPlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(planService.get(id, workspaceCode));
    }

    @PutMapping("/plans/{id}")
    public ApiResponse<TestPlanResponse> updatePlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateTestPlanRequest request
    ) {
        return ApiResponse.ok(planService.update(id, workspaceCode, request), "测试计划更新成功");
    }

    @PostMapping("/plans/{id}/copy")
    public ApiResponse<TestPlanResponse> copyPlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CopyTestPlanRequest request
    ) {
        return ApiResponse.ok(planService.copy(id, workspaceCode, request), "测试计划复制成功");
    }

    @DeleteMapping("/plans/{id}")
    public ApiResponse<Void> deletePlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam("expectedVersion") Integer expectedVersion
    ) {
        planService.delete(id, workspaceCode, expectedVersion);
        return ApiResponse.ok(null, "测试计划删除成功");
    }

    @PutMapping("/plans/{id}/requirements")
    public ApiResponse<TestPlanResponse> replacePlanRequirements(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReplaceTestPlanRequirementsRequest request
    ) {
        return ApiResponse.ok(planService.replaceRequirements(id, workspaceCode, request), "测试计划需求已更新");
    }

    @PutMapping("/plans/{id}/cases")
    public ApiResponse<TestPlanResponse> replacePlanCases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReplaceTestPlanCasesRequest request
    ) {
        return ApiResponse.ok(planService.replaceCases(id, workspaceCode, request), "测试计划手动用例已更新");
    }

    @PostMapping("/plans/{id}/cases")
    public ApiResponse<TestPlanResponse> addPlanCases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody AddTestPlanCasesRequest request
    ) {
        return ApiResponse.ok(planService.addCases(id, workspaceCode, request), "测试用例已添加");
    }

    @DeleteMapping("/plans/{id}/cases/{planCaseId}")
    public ApiResponse<TestPlanResponse> removePlanCase(
            @PathVariable Long id,
            @PathVariable Long planCaseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam("expectedVersion") Integer expectedVersion,
            @RequestParam(value = "reason", required = false) String reason
    ) {
        return ApiResponse.ok(planService.removeCase(id, planCaseId, workspaceCode, expectedVersion, reason), "测试用例已移除");
    }

    @PutMapping("/plans/{id}/cases/{planCaseId}/assignee")
    public ApiResponse<TestPlanResponse> assignPlanCase(
            @PathVariable Long id,
            @PathVariable Long planCaseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody AssignTestPlanCaseRequest request
    ) {
        return ApiResponse.ok(planService.assignCase(id, planCaseId, workspaceCode, request), "测试用例负责人已更新");
    }

    @PostMapping("/plans/{id}/cases/{planCaseId}/results")
    public ApiResponse<TestPlanResponse> recordPlanCaseResult(
            @PathVariable Long id,
            @PathVariable Long planCaseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody RecordTestPlanCaseResultRequest request
    ) {
        return ApiResponse.ok(planService.recordResult(id, planCaseId, workspaceCode, request), "测试结果已保存");
    }

    @PostMapping("/plans/{id}/start")
    public ApiResponse<TestPlanResponse> startPlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.start(id, workspaceCode, request), "测试计划已开始");
    }

    @PostMapping("/plans/{id}/block")
    public ApiResponse<TestPlanResponse> blockPlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.block(id, workspaceCode, request), "测试计划已阻塞");
    }

    @PostMapping("/plans/{id}/resume")
    public ApiResponse<TestPlanResponse> resumePlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.resume(id, workspaceCode, request), "测试计划已恢复");
    }

    @PostMapping("/plans/{id}/complete")
    public ApiResponse<TestPlanResponse> completePlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.complete(id, workspaceCode, request), "测试计划已完成");
    }

    @PostMapping("/plans/{id}/cancel")
    public ApiResponse<TestPlanResponse> cancelPlan(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.cancel(id, workspaceCode, request), "测试计划已取消");
    }

    @GetMapping("/plans/{id}/defects")
    public ApiResponse<List<BugEntity>> listPlanDefects(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(planService.listDefects(id, workspaceCode));
    }

    @PostMapping("/plans/{id}/cases/{planCaseId}/defects")
    public ApiResponse<Object> createPlanDefect(
            @PathVariable Long id,
            @PathVariable Long planCaseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateBugRequest request
    ) {
        return ApiResponse.ok(planService.createDefect(id, planCaseId, workspaceCode, request), "缺陷创建成功");
    }

    @GetMapping("/plans/{id}/report")
    public ApiResponse<TestPlanReportResponse> getPlanReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(planService.getReport(id, workspaceCode));
    }

    @PostMapping("/plans/{id}/report/generate")
    public ApiResponse<TestPlanReportResponse> generatePlanReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(planService.generateReport(id, workspaceCode), "测试报告已生成");
    }

    @PostMapping("/plans/{id}/report/sign")
    public ApiResponse<TestPlanReportResponse> signPlanReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.signReport(id, workspaceCode, request), "测试报告已签署");
    }

    @PostMapping("/plans/{id}/report/revoke-signature")
    public ApiResponse<TestPlanReportResponse> revokePlanReportSignature(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TestPlanActionRequest request
    ) {
        return ApiResponse.ok(planService.revokeReportSignature(id, workspaceCode, request), "测试报告签署已撤回");
    }

    @GetMapping("/plans/{id}/activities")
    public ApiResponse<PageResponse<TestActivityItem>> listPlanActivities(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(planService.listActivities(id, workspaceCode, pageNo, pageSize));
    }
}
