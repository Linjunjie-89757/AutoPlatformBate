package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.bug.BugEntity;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.bug.BugSourceType;
import com.company.autoplatform.bug.BugService;
import com.company.autoplatform.bug.CreateBugRequest;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseMapper;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TestPlanService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;
    private static final BigDecimal DEFAULT_EXECUTE_RATE = BigDecimal.valueOf(90);
    private static final BigDecimal DEFAULT_PASS_RATE = BigDecimal.valueOf(85);

    private final TestPlanMapper planMapper;
    private final TestPlanRequirementMapper planRequirementMapper;
    private final TestPlanCaseMapper planCaseMapper;
    private final TestPlanCaseRequirementMapper planCaseRequirementMapper;
    private final TestPlanCaseExecutionMapper executionMapper;
    private final TestPlanCaseDefectRelationMapper planCaseDefectRelationMapper;
    private final TestPlanExecutionAttachmentMapper executionAttachmentMapper;
    private final TestPlanExecutionAttachmentStorageService executionAttachmentStorageService;
    private final TestPlanReportMapper reportMapper;
    private final TestRequirementMapper requirementMapper;
    private final TestRequirementCaseMapper requirementCaseMapper;
    private final TestVersionMapper versionMapper;
    private final CaseMapper caseMapper;
    private final BugMapper bugMapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final BugService bugService;
    private final ObjectMapper objectMapper;
    private final TestManagementWorkspaceSupport workspaceSupport;
    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final TestActivityLogService activityLogService;
    private final TestPlanPdfReportService pdfReportService;

    public TestPlanService(
            TestPlanMapper planMapper,
            TestPlanRequirementMapper planRequirementMapper,
            TestPlanCaseMapper planCaseMapper,
            TestPlanCaseRequirementMapper planCaseRequirementMapper,
            TestPlanCaseExecutionMapper executionMapper,
            TestPlanCaseDefectRelationMapper planCaseDefectRelationMapper,
            TestPlanExecutionAttachmentMapper executionAttachmentMapper,
            TestPlanExecutionAttachmentStorageService executionAttachmentStorageService,
            TestPlanReportMapper reportMapper,
            TestRequirementMapper requirementMapper,
            TestRequirementCaseMapper requirementCaseMapper,
            TestVersionMapper versionMapper,
            CaseMapper caseMapper,
            BugMapper bugMapper,
            UserMapper userMapper,
            UserService userService,
            BugService bugService,
            ObjectMapper objectMapper,
            TestManagementWorkspaceSupport workspaceSupport,
            WorkspaceAccessSupport workspaceAccessSupport,
            TestActivityLogService activityLogService,
            TestPlanPdfReportService pdfReportService
    ) {
        this.planMapper = planMapper;
        this.planRequirementMapper = planRequirementMapper;
        this.planCaseMapper = planCaseMapper;
        this.planCaseRequirementMapper = planCaseRequirementMapper;
        this.executionMapper = executionMapper;
        this.planCaseDefectRelationMapper = planCaseDefectRelationMapper;
        this.executionAttachmentMapper = executionAttachmentMapper;
        this.executionAttachmentStorageService = executionAttachmentStorageService;
        this.reportMapper = reportMapper;
        this.requirementMapper = requirementMapper;
        this.requirementCaseMapper = requirementCaseMapper;
        this.versionMapper = versionMapper;
        this.caseMapper = caseMapper;
        this.bugMapper = bugMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.bugService = bugService;
        this.objectMapper = objectMapper;
        this.workspaceSupport = workspaceSupport;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.activityLogService = activityLogService;
        this.pdfReportService = pdfReportService;
    }

    public PageResponse<TestPlanResponse> list(
            String workspaceCode,
            String keyword,
            String purpose,
            String status,
            Long versionId,
            Long ownerId,
            Integer pageNo,
            Integer pageSize
    ) {
        TestManagementWorkspaceScope scope = workspaceSupport.requireReadScope(workspaceCode);
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        if (scope.workspaceIds().isEmpty()) return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
        LambdaQueryWrapper<TestPlanEntity> query = new LambdaQueryWrapper<TestPlanEntity>()
                .in(TestPlanEntity::getWorkspaceId, scope.workspaceIds())
                .isNull(TestPlanEntity::getDeletedAt);
        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(item -> item.like(TestPlanEntity::getName, normalizedKeyword)
                    .or().like(TestPlanEntity::getPlanNo, normalizedKeyword));
        }
        PlanPurpose parsedPurpose = parseEnum(purpose, PlanPurpose.class, "计划用途");
        PlanStatus parsedStatus = parseEnum(status, PlanStatus.class, "计划状态");
        if (parsedPurpose != null) query.eq(TestPlanEntity::getPurpose, parsedPurpose);
        if (parsedStatus != null) query.eq(TestPlanEntity::getStatus, parsedStatus);
        if (versionId != null) query.eq(TestPlanEntity::getVersionId, versionId);
        if (ownerId != null) query.eq(TestPlanEntity::getOwnerId, ownerId);
        Page<TestPlanEntity> page = planMapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByDesc(TestPlanEntity::getUpdatedAt).orderByDesc(TestPlanEntity::getId)
        );
        return PageResponse.of(assemble(page.getRecords(), scope.workspaces()), page.getTotal(), page.getCurrent(), page.getSize());
    }

    public TestPlanResponse get(Long id, String workspaceCode) {
        TestPlanEntity entity = requireReadable(id, workspaceCode);
        WorkspaceEntity workspace = workspaceSupport.requireReadableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return assemble(List.of(entity), Map.of(workspace.getId(), workspace)).getFirst();
    }

    @Transactional
    public TestPlanResponse create(String workspaceCode, CreateTestPlanRequest request) {
        WorkspaceEntity workspace = workspaceSupport.requireWritableWorkspace(workspaceCode);
        validatePurpose(request.purpose(), request.versionId(), workspace.getId(), request.requirementIds(), request.draft());
        validateDates(request.startDate(), request.endDate());
        if (request.ownerId() != null) requireActiveUser(request.ownerId());
        if (!request.draft()) {
            validateCompleteDefinition(request.purpose(), request.versionId(), request.ownerId(), request.startDate(), request.endDate(), request.requirementIds(), request.manualCaseIds());
        }
        LocalDateTime now = LocalDateTime.now();
        TestPlanEntity plan = new TestPlanEntity();
        plan.setWorkspaceId(workspace.getId());
        plan.setPlanNo("PLAN-TMP-" + java.util.UUID.randomUUID().toString().substring(0, 8));
        plan.setPurpose(request.purpose());
        plan.setPlanType(request.planType() == null ? PlanType.MIXED : request.planType());
        plan.setStatus(request.draft() ? PlanStatus.DRAFT : PlanStatus.PENDING);
        plan.setVersionId(request.versionId());
        plan.setName(request.name().trim());
        plan.setOwnerId(request.ownerId());
        plan.setStartDate(request.startDate());
        plan.setEndDate(request.endDate());
        plan.setGoal(blankToNull(request.goal()));
        plan.setMinExecuteRate(defaultValue(request.minExecuteRate(), DEFAULT_EXECUTE_RATE));
        plan.setMinPassRate(defaultValue(request.minPassRate(), DEFAULT_PASS_RATE));
        plan.setAllowP0(Boolean.TRUE.equals(request.allowP0()));
        plan.setMaxP1(request.maxP1() == null ? 3 : request.maxP1());
        plan.setAutoReport(request.autoReport() == null || request.autoReport());
        plan.setOwnerConfirmRequired(request.ownerConfirmRequired() == null || request.ownerConfirmRequired());
        plan.setLockVersion(0);
        plan.setCreatedBy(CurrentUserContext.get());
        plan.setUpdatedBy(CurrentUserContext.get());
        plan.setCreatedAt(now);
        plan.setUpdatedAt(now);
        try {
            planMapper.insert(plan);
            String planNo = "TP-" + String.format("%06d", plan.getId());
            planMapper.update(null, new LambdaUpdateWrapper<TestPlanEntity>()
                    .eq(TestPlanEntity::getId, plan.getId()).set(TestPlanEntity::getPlanNo, planNo));
            plan.setPlanNo(planNo);
            rebuildScope(plan, request.requirementIds(), request.excludedAutoCaseIds(), request.manualCaseIds());
        } catch (DuplicateKeyException exception) {
            throw TestManagementException.validation("测试计划编号生成冲突，请重试");
        }
        activityLogService.record(workspace.getId(), ActivityEntityType.PLAN, plan.getId(),
                "PLAN_CREATED", "创建测试计划", Map.of("planNo", plan.getPlanNo(), "status", plan.getStatus()));
        return get(plan.getId(), workspace.getWorkspaceCode());
    }

    @Transactional
    public TestPlanResponse createAndStart(String workspaceCode, CreateTestPlanRequest request) {
        if (request.draft()) {
            throw TestManagementException.validation("草稿计划不能直接启动");
        }
        TestPlanResponse created = create(workspaceCode, request);
        return start(created.id(), workspaceCode, new TestPlanActionRequest(created.lockVersion(), false, null));
    }

    @Transactional
    public TestPlanResponse update(Long id, String workspaceCode, UpdateTestPlanRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireEditable(plan);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        validateDates(request.startDate(), request.endDate());
        Long versionId = request.versionId() == null ? plan.getVersionId() : request.versionId();
        if (plan.getStatus() != PlanStatus.DRAFT && !Objects.equals(plan.getVersionId(), versionId)) {
            throw TestManagementException.snapshotLocked("待开始计划不能修改关联版本");
        }
        List<Long> requirementIds = request.requirementIds() == null ? selectedRequirementIds(id) : distinct(request.requirementIds());
        List<Long> manualCaseIds = request.manualCaseIds() == null ? manualCaseIds(id) : distinct(request.manualCaseIds());
        validatePurpose(plan.getPurpose(), versionId, plan.getWorkspaceId(), requirementIds, plan.getStatus() == PlanStatus.DRAFT);
        if (plan.getStatus() != PlanStatus.DRAFT) {
            validateCompleteDefinition(plan.getPurpose(), versionId, request.ownerId(), request.startDate(), request.endDate(), requirementIds, manualCaseIds);
        }
        if (request.ownerId() != null) requireActiveUser(request.ownerId());
        plan.setName(request.name().trim());
        if (request.planType() != null) plan.setPlanType(request.planType());
        plan.setVersionId(versionId);
        plan.setOwnerId(request.ownerId());
        plan.setStartDate(request.startDate());
        plan.setEndDate(request.endDate());
        plan.setGoal(blankToNull(request.goal()));
        plan.setMinExecuteRate(defaultValue(request.minExecuteRate(), plan.getMinExecuteRate()));
        plan.setMinPassRate(defaultValue(request.minPassRate(), plan.getMinPassRate()));
        if (request.allowP0() != null) plan.setAllowP0(request.allowP0());
        if (request.maxP1() != null) plan.setMaxP1(request.maxP1());
        if (request.autoReport() != null) plan.setAutoReport(request.autoReport());
        if (request.ownerConfirmRequired() != null) plan.setOwnerConfirmRequired(request.ownerConfirmRequired());
        if (request.requirementIds() != null || request.excludedAutoCaseIds() != null || request.manualCaseIds() != null) {
            rebuildScope(plan, requirementIds, request.excludedAutoCaseIds(), manualCaseIds);
        }
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id,
                "PLAN_UPDATED", "更新测试计划", null);
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse copy(Long id, String workspaceCode, CopyTestPlanRequest request) {
        TestPlanEntity source = requireWritable(id, workspaceCode);
        requireExpectedVersion(source.getLockVersion(), request.expectedVersion(), "测试计划");
        LocalDateTime now = LocalDateTime.now();
        Long currentUserId = CurrentUserContext.get();
        Long targetVersionId = request.targetVersionId() == null ? source.getVersionId() : request.targetVersionId();
        boolean copyRequirements = request.copyRequirements() == null || request.copyRequirements();
        boolean copyRequirementCases = request.copyRequirementCases() == null || request.copyRequirementCases();
        boolean copyManualCases = request.copyManualCases() == null || request.copyManualCases();
        boolean copyQualityStandards = request.copyQualityStandards() == null || request.copyQualityStandards();

        if (source.getPurpose() == PlanPurpose.TEMP && targetVersionId != null) {
            throw TestManagementException.validation("临时测试计划不能关联版本");
        }
        if (source.getPurpose() == PlanPurpose.VERSION) {
            if (targetVersionId == null) throw TestManagementException.validation("版本测试计划必须选择目标版本");
            TestVersionEntity targetVersion = versionMapper.selectById(targetVersionId);
            if (targetVersion == null || !source.getWorkspaceId().equals(targetVersion.getWorkspaceId())) {
                throw TestManagementException.validation("目标版本不属于当前工作区");
            }
            if (copyRequirements && !Objects.equals(source.getVersionId(), targetVersionId)) {
                throw TestManagementException.validation("跨版本复制不能直接沿用原版本需求，请取消“复制需求范围”后重试");
            }
        }

        TestPlanEntity target = new TestPlanEntity();
        target.setWorkspaceId(source.getWorkspaceId());
        target.setPlanNo("PLAN-TMP-" + java.util.UUID.randomUUID().toString().substring(0, 8));
        target.setPurpose(source.getPurpose());
        target.setPlanType(source.getPlanType());
        target.setStatus(PlanStatus.DRAFT);
        target.setVersionId(targetVersionId);
        target.setName(copyPlanName(source.getName(), request.name()));
        target.setOwnerId(source.getOwnerId());
        target.setStartDate(source.getStartDate());
        target.setEndDate(source.getEndDate());
        target.setGoal(source.getGoal());
        target.setMinExecuteRate(copyQualityStandards ? source.getMinExecuteRate() : DEFAULT_EXECUTE_RATE);
        target.setMinPassRate(copyQualityStandards ? source.getMinPassRate() : DEFAULT_PASS_RATE);
        target.setAllowP0(copyQualityStandards && Boolean.TRUE.equals(source.getAllowP0()));
        target.setMaxP1(copyQualityStandards ? source.getMaxP1() : 3);
        target.setAutoReport(!copyQualityStandards || Boolean.TRUE.equals(source.getAutoReport()));
        target.setOwnerConfirmRequired(!copyQualityStandards || Boolean.TRUE.equals(source.getOwnerConfirmRequired()));
        target.setLockVersion(0);
        target.setCreatedBy(currentUserId);
        target.setUpdatedBy(currentUserId);
        target.setCreatedAt(now);
        target.setUpdatedAt(now);
        try {
            planMapper.insert(target);
            String planNo = "TP-" + String.format("%06d", target.getId());
            planMapper.update(null, new LambdaUpdateWrapper<TestPlanEntity>()
                    .eq(TestPlanEntity::getId, target.getId()).set(TestPlanEntity::getPlanNo, planNo));
            target.setPlanNo(planNo);
            copyPlanScope(source, target, currentUserId, now,
                    copyRequirements, copyRequirementCases, copyManualCases);
        } catch (DuplicateKeyException exception) {
            throw TestManagementException.validation("测试计划编号生成冲突，请重试");
        }
        activityLogService.record(target.getWorkspaceId(), ActivityEntityType.PLAN, target.getId(),
                "PLAN_COPIED", "复制测试计划", Map.of("sourcePlanId", source.getId(), "sourcePlanNo", source.getPlanNo()));
        return get(target.getId(), workspaceCode);
    }

    @Transactional
    public void delete(Long id, String workspaceCode, Integer expectedVersion) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireExpectedVersion(plan.getLockVersion(), expectedVersion, "测试计划");
        if (plan.getStatus() != PlanStatus.DRAFT) throw TestManagementException.snapshotLocked("只有草稿测试计划可以删除");
        if (planCaseMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, id)) > 0
                || reportMapper.selectCount(new LambdaQueryWrapper<TestPlanReportEntity>().eq(TestPlanReportEntity::getPlanId, id)) > 0
                || bugMapper.selectCount(new LambdaQueryWrapper<BugEntity>().eq(BugEntity::getTestPlanId, id)) > 0
                || planCaseDefectRelationMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseDefectRelationEntity>().eq(TestPlanCaseDefectRelationEntity::getPlanId, id)) > 0) {
            throw TestManagementException.snapshotLocked("测试计划已有下游数据，不允许删除");
        }
        deleteScope(id);
        planMapper.deleteById(id);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_DELETED", "删除测试计划", null);
    }

    @Transactional
    public TestPlanResponse replaceRequirements(Long id, String workspaceCode, ReplaceTestPlanRequirementsRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireEditable(plan);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        if (plan.getPurpose() != PlanPurpose.VERSION) throw TestManagementException.validation("临时测试计划不能关联需求");
        rebuildScope(plan, request.requirementIds(), request.excludedAutoCaseIds(), manualCaseIds(id));
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_REQUIREMENTS_REPLACED", "调整测试计划需求", null);
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse replaceCases(Long id, String workspaceCode, ReplaceTestPlanCasesRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireEditable(plan);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        replaceManualCases(plan, request.caseIds(), false);
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_MANUAL_CASES_REPLACED", "调整手动补充用例", null);
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse addCases(Long id, String workspaceCode, AddTestPlanCasesRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireNotTerminal(plan);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        if (plan.getStatus() == PlanStatus.RUNNING && blankToNull(request.reason()) == null) {
            throw TestManagementException.validation("运行中的计划追加用例必须填写原因");
        }
        replaceManualCases(plan, request.caseIds(), plan.getStatus() == PlanStatus.RUNNING);
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CASES_ADDED", "添加测试用例", Map.of("reason", blankToNull(request.reason())));
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse removeCase(Long id, Long planCaseId, String workspaceCode, Integer expectedVersion, String reason) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireNotTerminal(plan);
        requireExpectedVersion(plan.getLockVersion(), expectedVersion, "测试计划");
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        if (plan.getStatus() == PlanStatus.RUNNING) {
            if (planCase.getExecutionStatus() != PlanCaseExecutionStatus.PENDING) throw TestManagementException.snapshotLocked("运行中的计划只能移除未执行用例");
            if (blankToNull(reason) == null) throw TestManagementException.validation("运行中的计划移除用例必须填写原因");
        }
        if (executionMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseExecutionEntity>().eq(TestPlanCaseExecutionEntity::getPlanCaseId, planCaseId)) > 0
                || bugMapper.selectCount(new LambdaQueryWrapper<BugEntity>().eq(BugEntity::getTestPlanCaseId, planCaseId)) > 0) {
            throw TestManagementException.snapshotLocked("该用例已有执行或缺陷记录，不允许移除");
        }
        planCaseRequirementMapper.delete(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>().eq(TestPlanCaseRequirementEntity::getPlanCaseId, planCaseId));
        planCaseMapper.deleteById(planCaseId);
        touch(plan, expectedVersion);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CASE_REMOVED", "移除测试用例", Map.of("planCaseId", planCaseId, "reason", reason == null ? "" : reason));
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse assignCase(Long id, Long planCaseId, String workspaceCode, AssignTestPlanCaseRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireNotTerminal(plan);
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        requireExpectedVersion(planCase.getLockVersion(), request.expectedVersion(), "测试用例快照");
        if (request.assigneeId() != null) requireActiveUser(request.assigneeId());
        planCase.setAssigneeId(request.assigneeId());
        planCase.setUpdatedAt(LocalDateTime.now());
        if (planCaseMapper.updateById(planCase) == 0) {
            throw TestManagementException.conflict(
                    "测试用例负责人已被其他用户修改，请重新加载",
                    Map.of("id", planCaseId));
        }
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CASE_ASSIGNED", "分配测试用例", Map.of("planCaseId", planCaseId));
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse updateCaseSnapshot(Long id, Long planCaseId, String workspaceCode, UpdateTestPlanCaseSnapshotRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        if (plan.getStatus() != PlanStatus.DRAFT && plan.getStatus() != PlanStatus.PENDING) {
            throw TestManagementException.snapshotLocked("测试计划开始后不能编辑用例快照");
        }
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        requireExpectedVersion(planCase.getLockVersion(), request.expectedVersion(), "测试用例快照");
        if (!List.of("P0", "P1", "P2", "P3").contains(request.priority().trim().toUpperCase(Locale.ROOT))) {
            throw TestManagementException.validation("用例优先级不合法");
        }
        planCase.setSnapshotTitle(request.title().trim());
        planCase.setSnapshotModule(blankToNull(request.module()));
        planCase.setSnapshotPriority(request.priority().trim().toUpperCase(Locale.ROOT));
        planCase.setSnapshotPrecondition(blankToNull(request.precondition()));
        planCase.setSnapshotSteps(blankToNull(request.steps()));
        planCase.setSnapshotExpectedResult(blankToNull(request.expectedResult()));
        planCase.setUpdatedAt(LocalDateTime.now());
        if (planCaseMapper.updateById(planCase) == 0) {
            throw TestManagementException.conflict("测试用例快照已被其他用户修改，请重新加载", Map.of("id", planCaseId));
        }
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CASE_SNAPSHOT_UPDATED", "编辑测试用例快照", Map.of("planCaseId", planCaseId));
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse recordResult(Long id, Long planCaseId, String workspaceCode, RecordTestPlanCaseResultRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        if (plan.getStatus() != PlanStatus.RUNNING) throw TestManagementException.invalidTransition("测试计划执行", plan.getStatus(), "RESULT");
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        requireExpectedVersion(planCase.getLockVersion(), request.expectedVersion(), "测试用例快照");
        if (request.status() == PlanCaseExecutionStatus.PENDING) throw TestManagementException.validation("执行结果不能为未执行");
        PlanCaseExecutionStatus previous = planCase.getExecutionStatus();
        LocalDateTime now = LocalDateTime.now();
        TestPlanCaseExecutionEntity history = new TestPlanCaseExecutionEntity();
        history.setWorkspaceId(plan.getWorkspaceId());
        history.setPlanId(id);
        history.setPlanCaseId(planCaseId);
        history.setPreviousStatus(previous);
        history.setExecutionStatus(request.status());
        history.setExecutionNote(blankToNull(request.note()));
        history.setExecutorId(CurrentUserContext.get());
        history.setExecutedAt(now);
        history.setCreatedAt(now);
        history.setUpdatedAt(now);
        executionMapper.insert(history);
        planCase.setExecutionStatus(request.status());
        planCase.setExecutionNote(blankToNull(request.note()));
        planCase.setExecutedBy(CurrentUserContext.get());
        planCase.setExecutedAt(now);
        planCase.setUpdatedAt(now);
        if (planCaseMapper.updateById(planCase) == 0) throw TestManagementException.conflict("测试用例执行结果已被修改，请重新加载", Map.of("id", planCaseId));
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CASE_RESULT_RECORDED", "记录测试结果", Map.of("planCaseId", planCaseId, "status", request.status()));
        return get(id, workspaceCode);
    }

    public List<TestPlanCaseExecutionHistoryResponse> listCaseExecutionHistory(Long id, Long planCaseId, String workspaceCode) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        requirePlanCase(planCaseId, id);
        List<TestPlanCaseExecutionEntity> records = executionMapper.selectList(new LambdaQueryWrapper<TestPlanCaseExecutionEntity>()
                .eq(TestPlanCaseExecutionEntity::getPlanId, id)
                .eq(TestPlanCaseExecutionEntity::getPlanCaseId, planCaseId)
                .orderByDesc(TestPlanCaseExecutionEntity::getExecutedAt)
                .orderByDesc(TestPlanCaseExecutionEntity::getId));
        Map<Long, UserEntity> users = loadUsers(records.stream().map(TestPlanCaseExecutionEntity::getExecutorId).filter(Objects::nonNull).toList());
        return records.stream().map(item -> new TestPlanCaseExecutionHistoryResponse(
                item.getId(), item.getPreviousStatus(), item.getExecutionStatus(), item.getExecutionNote(), item.getExecutorId(),
                users.get(item.getExecutorId()) == null ? null : users.get(item.getExecutorId()).getDisplayName(), item.getExecutedAt()
        )).toList();
    }

    @Transactional
    public TestPlanResponse start(Long id, String workspaceCode, TestPlanActionRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        TestManagementStateMachine.requirePlanTransition(plan.getStatus(), PlanStatus.RUNNING);
        validateStart(plan);
        refreshSnapshots(id);
        LocalDateTime now = LocalDateTime.now();
        plan.setStatus(PlanStatus.RUNNING);
        plan.setSnapshotFrozenAt(now);
        plan.setStartedAt(now);
        plan.setUpdatedAt(now);
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_STARTED", "开始测试计划", null);
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse block(Long id, String workspaceCode, TestPlanActionRequest request) {
        return transitionSimple(id, workspaceCode, request, PlanStatus.BLOCKED, "PLAN_BLOCKED", "阻塞测试计划", true);
    }

    @Transactional
    public TestPlanResponse resume(Long id, String workspaceCode, TestPlanActionRequest request) {
        return transitionSimple(id, workspaceCode, request, PlanStatus.RUNNING, "PLAN_RESUMED", "恢复测试计划", false);
    }

    @Transactional
    public TestPlanResponse complete(Long id, String workspaceCode, TestPlanActionRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        TestManagementStateMachine.requirePlanTransition(plan.getStatus(), PlanStatus.COMPLETED);
        List<Map<String, Object>> failedChecks = qualityChecks(plan);
        if (!failedChecks.isEmpty() && !request.force()) throw TestManagementException.qualityGate("测试计划未达到完成条件", failedChecks);
        if (request.force()) {
            workspaceAccessSupport.requirePermission(workspaceCode, "test_management.release");
            if (blankToNull(request.reason()) == null) throw TestManagementException.validation("强制完成必须填写原因");
        }
        plan.setStatus(PlanStatus.COMPLETED);
        plan.setCompletedAt(LocalDateTime.now());
        touch(plan, request.expectedVersion());
        if (Boolean.TRUE.equals(plan.getAutoReport())) generateReportInternal(plan);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_COMPLETED", "完成测试计划", Map.of("force", request.force(), "reason", request.reason() == null ? "" : request.reason()));
        return get(id, workspaceCode);
    }

    @Transactional
    public TestPlanResponse cancel(Long id, String workspaceCode, TestPlanActionRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        TestManagementStateMachine.requirePlanTransition(plan.getStatus(), PlanStatus.CANCELLED);
        if (blankToNull(request.reason()) == null) throw TestManagementException.validation("取消测试计划必须填写原因");
        plan.setStatus(PlanStatus.CANCELLED);
        plan.setCancelledAt(LocalDateTime.now());
        plan.setCancelReason(blankToNull(request.reason()));
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_CANCELLED", "取消测试计划", Map.of("reason", request.reason()));
        return get(id, workspaceCode);
    }

    public List<BugEntity> listDefects(Long id, String workspaceCode) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        List<BugEntity> direct = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestPlanId, id).eq(BugEntity::getWorkspaceId, plan.getWorkspaceId())
                .orderByDesc(BugEntity::getUpdatedAt).orderByDesc(BugEntity::getId));
        List<Long> linkedIds = planCaseDefectRelationMapper.selectList(new LambdaQueryWrapper<TestPlanCaseDefectRelationEntity>()
                .eq(TestPlanCaseDefectRelationEntity::getPlanId, id).eq(TestPlanCaseDefectRelationEntity::getWorkspaceId, plan.getWorkspaceId()))
                .stream().map(TestPlanCaseDefectRelationEntity::getDefectId).toList();
        if (linkedIds.isEmpty()) return direct;
        List<Long> directIds = direct.stream().map(BugEntity::getId).collect(Collectors.toList());
        List<Long> missingIds = linkedIds.stream().filter(item -> !directIds.contains(item)).distinct().toList();
        if (missingIds.isEmpty()) return direct;
        List<BugEntity> linked = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>().in(BugEntity::getId, missingIds).eq(BugEntity::getWorkspaceId, plan.getWorkspaceId()));
        List<BugEntity> result = new ArrayList<>(direct);
        result.addAll(linked);
        return result.stream().sorted(Comparator.comparing(BugEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(BugEntity::getId, Comparator.reverseOrder())).toList();
    }

    public List<BugEntity> listCaseDefects(Long id, Long planCaseId, String workspaceCode) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        requirePlanCase(planCaseId, id);
        List<Long> relationIds = planCaseDefectRelationMapper.selectList(new LambdaQueryWrapper<TestPlanCaseDefectRelationEntity>()
                .eq(TestPlanCaseDefectRelationEntity::getPlanId, id).eq(TestPlanCaseDefectRelationEntity::getPlanCaseId, planCaseId))
                .stream().map(TestPlanCaseDefectRelationEntity::getDefectId).toList();
        return bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getWorkspaceId, plan.getWorkspaceId())
                .and(query -> {
                    query.eq(BugEntity::getTestPlanCaseId, planCaseId);
                    if (!relationIds.isEmpty()) query.or().in(BugEntity::getId, relationIds);
                })
                .orderByDesc(BugEntity::getUpdatedAt).orderByDesc(BugEntity::getId));
    }

    @Transactional
    public List<BugEntity> linkDefect(Long id, Long planCaseId, String workspaceCode, LinkTestPlanDefectRequest request) {
        workspaceAccessSupport.requirePermission(workspaceCode, "test_management.execute");
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        requireExpectedVersion(planCase.getLockVersion(), request.expectedVersion(), "测试用例快照");
        BugEntity defect = bugMapper.selectById(request.defectId());
        if (defect == null || !plan.getWorkspaceId().equals(defect.getWorkspaceId())) throw TestManagementException.notFound("缺陷", request.defectId());
        TestPlanCaseDefectRelationEntity relation = new TestPlanCaseDefectRelationEntity();
        relation.setWorkspaceId(plan.getWorkspaceId()); relation.setPlanId(id); relation.setPlanCaseId(planCaseId); relation.setDefectId(defect.getId()); relation.setCreatedBy(CurrentUserContext.get());
        relation.setCreatedAt(LocalDateTime.now()); relation.setUpdatedAt(LocalDateTime.now());
        try { planCaseDefectRelationMapper.insert(relation); } catch (DuplicateKeyException ignored) { }
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_DEFECT_LINKED", "关联已有缺陷", Map.of("planCaseId", planCaseId, "bugId", defect.getId()));
        return listDefects(id, workspaceCode);
    }

    @Transactional
    public List<BugEntity> unlinkDefect(Long id, Long planCaseId, Long defectId, String workspaceCode) {
        workspaceAccessSupport.requirePermission(workspaceCode, "test_management.execute");
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requirePlanCase(planCaseId, id);
        planCaseDefectRelationMapper.delete(new LambdaQueryWrapper<TestPlanCaseDefectRelationEntity>()
                .eq(TestPlanCaseDefectRelationEntity::getPlanId, id).eq(TestPlanCaseDefectRelationEntity::getPlanCaseId, planCaseId).eq(TestPlanCaseDefectRelationEntity::getDefectId, defectId));
        long remainingRelations = planCaseDefectRelationMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseDefectRelationEntity>()
                .eq(TestPlanCaseDefectRelationEntity::getDefectId, defectId));
        if (remainingRelations == 0) {
            bugMapper.update(null, new LambdaUpdateWrapper<BugEntity>()
                    .eq(BugEntity::getId, defectId).eq(BugEntity::getTestPlanId, id).eq(BugEntity::getTestPlanCaseId, planCaseId)
                    .set(BugEntity::getTestPlanCaseId, null));
        }
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_DEFECT_UNLINKED", "解除缺陷关联", Map.of("planCaseId", planCaseId, "bugId", defectId));
        return listDefects(id, workspaceCode);
    }

    @Transactional
    public Object createDefect(Long id, Long planCaseId, String workspaceCode, CreateBugRequest request) {
        workspaceAccessSupport.requirePermission(workspaceCode, "bugs.create");
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        TestPlanCaseEntity planCase = requirePlanCase(planCaseId, id);
        if (planCase.getExecutionStatus() != PlanCaseExecutionStatus.FAILED && planCase.getExecutionStatus() != PlanCaseExecutionStatus.BLOCKED) {
            throw TestManagementException.validation("只有失败或阻塞用例可以创建缺陷");
        }
        TestPlanCaseRequirementEntity primaryRequirement = planCaseRequirementMapper.selectOne(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getPlanCaseId, planCaseId).orderByAsc(TestPlanCaseRequirementEntity::getId).last("limit 1"));
        Long requirementId = primaryRequirement == null ? null : primaryRequirement.getRequirementId();
        CreateBugRequest normalized = new CreateBugRequest(
                workspaceCode, request.title(), request.description(), request.reproductionSteps(), request.expectedResult(), request.actualResult(),
                request.moduleName(), request.versionName(), request.priority(), request.severity(), BugSourceType.TEST_PLAN,
                request.assigneeId(), planCase.getSourceCaseId(), request.relatedReportId(), request.relatedTaskId(), request.tags());
        var detail = bugService.createBug(workspaceCode, normalized, BugSourceType.TEST_PLAN);
        bugMapper.update(null, new LambdaUpdateWrapper<BugEntity>().eq(BugEntity::getId, detail.id())
                .set(BugEntity::getTestVersionId, plan.getVersionId())
                .set(BugEntity::getTestRequirementId, requirementId)
                .set(BugEntity::getTestPlanId, id)
                .set(BugEntity::getTestPlanCaseId, planCaseId));
        TestPlanCaseDefectRelationEntity relation = new TestPlanCaseDefectRelationEntity();
        relation.setWorkspaceId(plan.getWorkspaceId()); relation.setPlanId(id); relation.setPlanCaseId(planCaseId); relation.setDefectId(detail.id()); relation.setCreatedBy(CurrentUserContext.get());
        relation.setCreatedAt(LocalDateTime.now()); relation.setUpdatedAt(LocalDateTime.now());
        planCaseDefectRelationMapper.insert(relation);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_DEFECT_CREATED", "从测试用例创建缺陷", Map.of("planCaseId", planCaseId, "bugId", detail.id()));
        return bugService.getBug(detail.id(), workspaceCode);
    }

    @Transactional
    public List<TestPlanExecutionAttachmentResponse> uploadExecutionEvidence(Long id, Long planCaseId, String workspaceCode, List<MultipartFile> files) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requirePlanCase(planCaseId, id);
        TestPlanCaseExecutionEntity execution = latestExecution(id, planCaseId);
        if (execution == null) throw TestManagementException.validation("请先保存本次执行结果，再上传执行证据");
        List<StoredTestPlanExecutionFile> stored = executionAttachmentStorageService.storeAll(plan.getWorkspaceId(), id, execution.getId(), files);
        List<TestPlanExecutionAttachmentEntity> created = new ArrayList<>();
        try {
            for (int index = 0; index < stored.size(); index++) {
                MultipartFile file = files.get(index); StoredTestPlanExecutionFile item = stored.get(index);
                TestPlanExecutionAttachmentEntity attachment = new TestPlanExecutionAttachmentEntity();
                attachment.setWorkspaceId(plan.getWorkspaceId()); attachment.setPlanId(id); attachment.setPlanCaseId(planCaseId); attachment.setExecutionId(execution.getId());
                attachment.setFileName(file.getOriginalFilename()); attachment.setStoredPath(item.storedPath()); attachment.setContentType(item.contentType()); attachment.setFileSize(item.fileSize()); attachment.setCreatedBy(CurrentUserContext.get());
                attachment.setCreatedAt(LocalDateTime.now()); attachment.setUpdatedAt(LocalDateTime.now()); executionAttachmentMapper.insert(attachment); created.add(attachment);
            }
        } catch (RuntimeException exception) {
            created.forEach(item -> { executionAttachmentMapper.deleteById(item.getId()); executionAttachmentStorageService.delete(item.getStoredPath()); });
            stored.forEach(item -> executionAttachmentStorageService.delete(item.storedPath()));
            throw exception;
        }
        return created.stream().map(this::toExecutionAttachmentResponse).toList();
    }

    public List<TestPlanExecutionAttachmentResponse> listExecutionEvidence(Long id, Long planCaseId, String workspaceCode) {
        requireReadable(id, workspaceCode); requirePlanCase(planCaseId, id);
        TestPlanCaseExecutionEntity execution = latestExecution(id, planCaseId);
        if (execution == null) return List.of();
        return executionAttachmentMapper.selectList(new LambdaQueryWrapper<TestPlanExecutionAttachmentEntity>().eq(TestPlanExecutionAttachmentEntity::getExecutionId, execution.getId()).orderByAsc(TestPlanExecutionAttachmentEntity::getId))
                .stream().map(this::toExecutionAttachmentResponse).toList();
    }

    @Transactional
    public void deleteExecutionEvidence(Long id, Long planCaseId, Long attachmentId, String workspaceCode) {
        TestPlanEntity plan = requireWritable(id, workspaceCode); requirePlanCase(planCaseId, id);
        TestPlanExecutionAttachmentEntity attachment = executionAttachmentMapper.selectById(attachmentId);
        if (attachment == null || !id.equals(attachment.getPlanId()) || !planCaseId.equals(attachment.getPlanCaseId())) throw TestManagementException.notFound("执行证据", attachmentId);
        executionAttachmentMapper.deleteById(attachmentId); executionAttachmentStorageService.delete(attachment.getStoredPath());
    }

    public TestPlanExecutionFileDownload downloadExecutionEvidence(Long id, Long planCaseId, Long attachmentId, String workspaceCode) {
        requireReadable(id, workspaceCode); requirePlanCase(planCaseId, id);
        TestPlanExecutionAttachmentEntity attachment = executionAttachmentMapper.selectById(attachmentId);
        if (attachment == null || !id.equals(attachment.getPlanId()) || !planCaseId.equals(attachment.getPlanCaseId())) throw TestManagementException.notFound("执行证据", attachmentId);
        return executionAttachmentStorageService.load(attachment);
    }

    public TestPlanReportResponse getReport(Long id, String workspaceCode) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        TestPlanReportEntity report = reportMapper.selectOne(new LambdaQueryWrapper<TestPlanReportEntity>().eq(TestPlanReportEntity::getPlanId, id));
        if (report == null) throw TestManagementException.notFound("测试报告", id);
        return toReportResponse(report);
    }

    public GeneratedTestPlanPdf exportReportPdf(Long id, String workspaceCode) {
        requireReadable(id, workspaceCode);
        TestPlanReportEntity report = requireReport(id);
        TestPlanResponse plan = get(id, workspaceCode);
        List<BugEntity> defects = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestPlanId, id)
                .orderByAsc(BugEntity::getId));
        return pdfReportService.render(plan, toReportResponse(report), defects);
    }

    @Transactional
    public TestPlanReportResponse generateReport(Long id, String workspaceCode) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        if (plan.getStatus() != PlanStatus.COMPLETED) throw TestManagementException.invalidTransition("测试报告生成", plan.getStatus(), "GENERATED");
        TestPlanReportEntity report = generateReportInternal(plan);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_REPORT_GENERATED", "生成测试报告", null);
        return toReportResponse(report);
    }

    @Transactional
    public TestPlanReportResponse signReport(Long id, String workspaceCode, TestPlanActionRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        TestPlanReportEntity report = requireReport(id);
        requireExpectedVersion(report.getLockVersion(), request.expectedVersion(), "测试报告");
        if (report.getStatus() == PlanReportStatus.SIGNED) throw TestManagementException.invalidTransition("测试报告", report.getStatus(), "SIGNED");
        report.setStatus(PlanReportStatus.SIGNED);
        report.setSignedBy(CurrentUserContext.get());
        report.setSignedAt(LocalDateTime.now());
        report.setUpdatedAt(LocalDateTime.now());
        reportMapper.updateById(report);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_REPORT_SIGNED", "签署测试报告", null);
        return toReportResponse(report);
    }

    @Transactional
    public TestPlanReportResponse revokeReportSignature(Long id, String workspaceCode, TestPlanActionRequest request) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        TestPlanReportEntity report = requireReport(id);
        requireExpectedVersion(report.getLockVersion(), request.expectedVersion(), "测试报告");
        if (report.getStatus() != PlanReportStatus.SIGNED) throw TestManagementException.invalidTransition("测试报告", report.getStatus(), "REVOKE_SIGNATURE");
        report.setStatus(PlanReportStatus.GENERATED);
        report.setSignatureRevokedBy(CurrentUserContext.get());
        report.setSignatureRevokedAt(LocalDateTime.now());
        report.setUpdatedAt(LocalDateTime.now());
        reportMapper.updateById(report);
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, "PLAN_REPORT_SIGNATURE_REVOKED", "撤回测试报告签署", Map.of("reason", request.reason() == null ? "" : request.reason()));
        return toReportResponse(report);
    }

    public PageResponse<TestActivityItem> listActivities(Long id, String workspaceCode, Integer pageNo, Integer pageSize) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        return activityLogService.list(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, pageNo, pageSize);
    }

    TestPlanEntity requireReadable(Long id, String workspaceCode) {
        TestPlanEntity plan = planMapper.selectById(id);
        if (plan == null || plan.getDeletedAt() != null) throw TestManagementException.notFound("测试计划", id);
        workspaceSupport.requireReadableEntityWorkspace(workspaceCode, plan.getWorkspaceId());
        return plan;
    }

    TestPlanEntity requireWritable(Long id, String workspaceCode) {
        TestPlanEntity plan = requireReadable(id, workspaceCode);
        workspaceSupport.requireWritableEntityWorkspace(workspaceCode, plan.getWorkspaceId());
        return plan;
    }

    private TestPlanResponse transitionSimple(Long id, String workspaceCode, TestPlanActionRequest request, PlanStatus target, String actionCode, String actionName, boolean reasonRequired) {
        TestPlanEntity plan = requireWritable(id, workspaceCode);
        requireExpectedVersion(plan.getLockVersion(), request.expectedVersion(), "测试计划");
        TestManagementStateMachine.requirePlanTransition(plan.getStatus(), target);
        if (reasonRequired && blankToNull(request.reason()) == null) throw TestManagementException.validation("该操作必须填写原因");
        plan.setStatus(target);
        touch(plan, request.expectedVersion());
        activityLogService.record(plan.getWorkspaceId(), ActivityEntityType.PLAN, id, actionCode, actionName, request.reason() == null ? null : Map.of("reason", request.reason()));
        return get(id, workspaceCode);
    }

    private void validatePurpose(PlanPurpose purpose, Long versionId, Long workspaceId, List<Long> requirementIds, boolean draft) {
        if (purpose == PlanPurpose.VERSION) {
            if (versionId == null && !draft) throw TestManagementException.validation("版本测试计划必须选择版本");
            if (requirementIds != null && !requirementIds.isEmpty() && versionId != null) validateRequirements(versionId, workspaceId, requirementIds);
        } else if (purpose == PlanPurpose.TEMP && (versionId != null || (requirementIds != null && !requirementIds.isEmpty()))) {
            throw TestManagementException.validation("临时测试计划不能关联版本或需求");
        }
    }

    private void validateCompleteDefinition(PlanPurpose purpose, Long versionId, Long ownerId, LocalDate startDate, LocalDate endDate, List<Long> requirementIds, List<Long> manualCaseIds) {
        if (ownerId == null) throw TestManagementException.validation("正式测试计划必须设置负责人");
        if (startDate == null || endDate == null) throw TestManagementException.validation("正式测试计划必须设置计划周期");
        if (purpose == PlanPurpose.VERSION && (versionId == null || requirementIds == null || requirementIds.isEmpty())) throw TestManagementException.validation("版本测试计划至少选择一个需求");
        if (purpose == PlanPurpose.TEMP && (manualCaseIds == null || manualCaseIds.isEmpty())) throw TestManagementException.validation("临时测试计划至少选择一个用例");
    }

    private void validateStart(TestPlanEntity plan) {
        validateCompleteDefinition(plan.getPurpose(), plan.getVersionId(), plan.getOwnerId(), plan.getStartDate(), plan.getEndDate(), selectedRequirementIds(plan.getId()), manualCaseIds(plan.getId()));
        long caseCount = planCaseMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, plan.getId()));
        if (caseCount == 0) throw TestManagementException.reviewRequired("测试计划至少需要一个用例", Map.of("planId", plan.getId()));
        if (plan.getPurpose() == PlanPurpose.VERSION) {
            List<TestRequirementEntity> requirements = requirementsByIds(selectedRequirementIds(plan.getId()));
            if (requirements.stream().anyMatch(item -> aggregateReviewStatus(item.getId()) != RequirementReviewStatus.PASSED)) {
                throw TestManagementException.reviewRequired("自动带入用例的需求必须先完成评审", Map.of("planId", plan.getId()));
            }
        }
    }

    private List<Map<String, Object>> qualityChecks(TestPlanEntity plan) {
        List<TestPlanCaseEntity> cases = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, plan.getId()));
        long executed = cases.stream().filter(item -> item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING).count();
        long passed = cases.stream().filter(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PASSED).count();
        List<Map<String, Object>> failures = new ArrayList<>();
        if (cases.stream().anyMatch(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PENDING)) failures.add(check("PENDING_CASES", 0, cases.size() - executed));
        BigDecimal executeRate = rate(executed, cases.size());
        BigDecimal passRate = rate(passed, executed);
        if (executeRate.compareTo(plan.getMinExecuteRate()) < 0) failures.add(check("EXECUTION_RATE", plan.getMinExecuteRate(), executeRate));
        if (passRate.compareTo(plan.getMinPassRate()) < 0) failures.add(check("PASS_RATE", plan.getMinPassRate(), passRate));
        List<BugEntity> openBugs = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>().eq(BugEntity::getTestPlanId, plan.getId()).notIn(BugEntity::getStatus, "CLOSED", "REJECTED"));
        long p0 = openBugs.stream().filter(item -> "P0".equalsIgnoreCase(item.getPriority())).count();
        long p1 = openBugs.stream().filter(item -> "P1".equalsIgnoreCase(item.getPriority())).count();
        if (!Boolean.TRUE.equals(plan.getAllowP0()) && p0 > 0) failures.add(check("OPEN_P0_DEFECTS", 0, p0));
        if (p1 > plan.getMaxP1()) failures.add(check("OPEN_P1_DEFECTS", plan.getMaxP1(), p1));
        return failures;
    }

    private void rebuildScope(TestPlanEntity plan, List<Long> rawRequirementIds, List<Long> rawExcludedCaseIds, List<Long> rawManualCaseIds) {
        if (plan.getStatus() != PlanStatus.DRAFT && plan.getStatus() != PlanStatus.PENDING) throw TestManagementException.snapshotLocked("测试计划开始后不能重建用例范围");
        List<Long> requirementIds = distinct(rawRequirementIds);
        List<Long> excluded = distinct(rawExcludedCaseIds);
        List<Long> manualIds = distinct(rawManualCaseIds);
        if (plan.getPurpose() == PlanPurpose.VERSION) {
            validateRequirements(plan.getVersionId(), plan.getWorkspaceId(), requirementIds);
        } else if (!requirementIds.isEmpty()) {
            throw TestManagementException.validation("临时测试计划不能关联需求");
        }
        deleteScope(plan.getId());
        Map<Long, PlanCaseOriginType> selected = new LinkedHashMap<>();
        Map<Long, List<Long>> requirementsByCase = new LinkedHashMap<>();
        if (!requirementIds.isEmpty()) {
            for (TestRequirementCaseEntity relation : requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>().in(TestRequirementCaseEntity::getRequirementId, requirementIds))) {
                if (relation.getReviewStatus() == RequirementReviewStatus.PASSED && !excluded.contains(relation.getCaseId())) {
                    selected.putIfAbsent(relation.getCaseId(), PlanCaseOriginType.REQUIREMENT);
                    requirementsByCase.computeIfAbsent(relation.getCaseId(), ignored -> new ArrayList<>()).add(relation.getRequirementId());
                }
            }
        }
        for (Long caseId : manualIds) selected.putIfAbsent(caseId, PlanCaseOriginType.MANUAL);
        validateCases(selected.keySet(), plan.getWorkspaceId());
        for (Long requirementId : requirementIds) {
            TestPlanRequirementEntity link = new TestPlanRequirementEntity();
            link.setWorkspaceId(plan.getWorkspaceId()); link.setPlanId(plan.getId()); link.setRequirementId(requirementId); link.setCreatedBy(CurrentUserContext.get());
            link.setCreatedAt(LocalDateTime.now()); link.setUpdatedAt(LocalDateTime.now()); planRequirementMapper.insert(link);
        }
        Map<Long, CaseEntity> cases = loadCases(selected.keySet());
        int sort = 0;
        for (Map.Entry<Long, PlanCaseOriginType> entry : selected.entrySet()) {
            TestPlanCaseEntity planCase = snapshotCase(plan, cases.get(entry.getKey()), entry.getValue(), false, sort++);
            planCaseMapper.insert(planCase);
            for (Long requirementId : requirementsByCase.getOrDefault(entry.getKey(), List.of())) insertCaseRequirement(plan, planCase, requirementId);
        }
    }

    private void copyPlanScope(
            TestPlanEntity source,
            TestPlanEntity target,
            Long currentUserId,
            LocalDateTime now,
            boolean copyRequirements,
            boolean copyRequirementCases,
            boolean copyManualCases
    ) {
        List<TestPlanRequirementEntity> sourceRequirements = planRequirementMapper.selectList(
                new LambdaQueryWrapper<TestPlanRequirementEntity>()
                        .eq(TestPlanRequirementEntity::getPlanId, source.getId())
                        .orderByAsc(TestPlanRequirementEntity::getId));
        if (copyRequirements) {
            for (TestPlanRequirementEntity sourceRequirement : sourceRequirements) {
                TestPlanRequirementEntity targetRequirement = new TestPlanRequirementEntity();
                targetRequirement.setWorkspaceId(target.getWorkspaceId());
                targetRequirement.setPlanId(target.getId());
                targetRequirement.setRequirementId(sourceRequirement.getRequirementId());
                targetRequirement.setCreatedBy(currentUserId);
                targetRequirement.setCreatedAt(now);
                targetRequirement.setUpdatedAt(now);
                planRequirementMapper.insert(targetRequirement);
            }
        }

        List<TestPlanCaseEntity> sourceCases = planCaseMapper.selectList(
                new LambdaQueryWrapper<TestPlanCaseEntity>()
                        .eq(TestPlanCaseEntity::getPlanId, source.getId())
                        .orderByAsc(TestPlanCaseEntity::getSortOrder)
                        .orderByAsc(TestPlanCaseEntity::getId))
                .stream()
                .filter(item -> item.getOriginType() == PlanCaseOriginType.REQUIREMENT
                        ? copyRequirementCases
                        : copyManualCases)
                .toList();
        if (sourceCases.isEmpty()) return;
        List<Long> sourceCaseIds = sourceCases.stream().map(TestPlanCaseEntity::getId).toList();
        Map<Long, List<Long>> requirementIdsByCase = planCaseRequirementMapper.selectList(
                        new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                                .in(TestPlanCaseRequirementEntity::getPlanCaseId, sourceCaseIds))
                .stream()
                .collect(Collectors.groupingBy(
                        TestPlanCaseRequirementEntity::getPlanCaseId,
                        LinkedHashMap::new,
                        Collectors.mapping(TestPlanCaseRequirementEntity::getRequirementId, Collectors.toList())));

        for (TestPlanCaseEntity sourceCase : sourceCases) {
            TestPlanCaseEntity targetCase = new TestPlanCaseEntity();
            targetCase.setWorkspaceId(target.getWorkspaceId());
            targetCase.setPlanId(target.getId());
            targetCase.setSourceCaseId(sourceCase.getSourceCaseId());
            targetCase.setOriginType(sourceCase.getOriginType());
            targetCase.setSnapshotCaseNo(sourceCase.getSnapshotCaseNo());
            targetCase.setSnapshotTitle(sourceCase.getSnapshotTitle());
            targetCase.setSnapshotModule(sourceCase.getSnapshotModule());
            targetCase.setSnapshotPriority(sourceCase.getSnapshotPriority());
            targetCase.setSnapshotPrecondition(sourceCase.getSnapshotPrecondition());
            targetCase.setSnapshotSteps(sourceCase.getSnapshotSteps());
            targetCase.setSnapshotExpectedResult(sourceCase.getSnapshotExpectedResult());
            targetCase.setSourceCaseUpdatedAt(sourceCase.getSourceCaseUpdatedAt());
            targetCase.setAddedAfterStart(false);
            targetCase.setAssigneeId(null);
            targetCase.setExecutionStatus(PlanCaseExecutionStatus.PENDING);
            targetCase.setExecutionNote(null);
            targetCase.setExecutedBy(null);
            targetCase.setExecutedAt(null);
            targetCase.setSortOrder(sourceCase.getSortOrder());
            targetCase.setLockVersion(0);
            targetCase.setCreatedBy(currentUserId);
            targetCase.setCreatedAt(now);
            targetCase.setUpdatedAt(now);
            planCaseMapper.insert(targetCase);
            if (copyRequirements) {
                for (Long requirementId : requirementIdsByCase.getOrDefault(sourceCase.getId(), List.of())) {
                    insertCaseRequirement(target, targetCase, requirementId);
                }
            }
        }
    }

    private void replaceManualCases(TestPlanEntity plan, List<Long> rawCaseIds, boolean addedAfterStart) {
        List<Long> desired = distinct(rawCaseIds);
        validateCases(desired, plan.getWorkspaceId());
        List<TestPlanCaseEntity> existing = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, plan.getId()));
        Set<Long> autoIds = existing.stream().filter(item -> item.getOriginType() == PlanCaseOriginType.REQUIREMENT).map(TestPlanCaseEntity::getSourceCaseId).collect(Collectors.toSet());
        Set<Long> desiredSet = new LinkedHashSet<>(desired);
        for (TestPlanCaseEntity item : existing) {
            if (item.getOriginType() == PlanCaseOriginType.MANUAL && !desiredSet.contains(item.getSourceCaseId())) {
                if (item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING) throw TestManagementException.snapshotLocked("已执行的手动用例不能移除");
                planCaseMapper.deleteById(item.getId());
            }
        }
        Set<Long> existingIds = existing.stream().map(TestPlanCaseEntity::getSourceCaseId).collect(Collectors.toSet());
        Map<Long, CaseEntity> cases = loadCases(desired);
        int sort = existing.size();
        for (Long caseId : desired) {
            if (autoIds.contains(caseId) || existingIds.contains(caseId)) continue;
            TestPlanCaseEntity planCase = snapshotCase(plan, cases.get(caseId), PlanCaseOriginType.MANUAL, addedAfterStart, sort++);
            planCaseMapper.insert(planCase);
        }
    }

    private void refreshSnapshots(Long planId) {
        List<TestPlanCaseEntity> planCases = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, planId));
        Map<Long, CaseEntity> cases = loadCases(planCases.stream().map(TestPlanCaseEntity::getSourceCaseId).toList());
        for (TestPlanCaseEntity planCase : planCases) {
            CaseEntity source = cases.get(planCase.getSourceCaseId());
            if (source == null) throw TestManagementException.notFound("用例", planCase.getSourceCaseId());
            copySnapshot(planCase, source);
            if (planCaseMapper.updateById(planCase) == 0) {
                throw TestManagementException.conflict(
                        "测试用例快照已被其他用户修改，请重新加载",
                        Map.of("id", planCase.getId()));
            }
        }
    }

    private TestPlanCaseEntity snapshotCase(TestPlanEntity plan, CaseEntity source, PlanCaseOriginType origin, boolean addedAfterStart, int sort) {
        if (source == null) throw TestManagementException.notFound("用例", null);
        TestPlanCaseEntity item = new TestPlanCaseEntity();
        item.setWorkspaceId(plan.getWorkspaceId()); item.setPlanId(plan.getId()); item.setSourceCaseId(source.getId()); item.setOriginType(origin);
        item.setAddedAfterStart(addedAfterStart); item.setExecutionStatus(PlanCaseExecutionStatus.PENDING); item.setSortOrder(sort); item.setLockVersion(0); item.setCreatedBy(CurrentUserContext.get());
        item.setCreatedAt(LocalDateTime.now()); item.setUpdatedAt(LocalDateTime.now()); copySnapshot(item, source); return item;
    }

    private void copySnapshot(TestPlanCaseEntity target, CaseEntity source) {
        target.setSnapshotCaseNo(source.getCaseNo()); target.setSnapshotTitle(source.getTitle()); target.setSnapshotModule(null); target.setSnapshotPriority(source.getPriority());
        target.setSnapshotPrecondition(source.getPrecondition()); target.setSnapshotSteps(source.getSteps()); target.setSnapshotExpectedResult(source.getExpectedResult()); target.setSourceCaseUpdatedAt(source.getUpdatedAt());
    }

    private void insertCaseRequirement(TestPlanEntity plan, TestPlanCaseEntity planCase, Long requirementId) {
        TestPlanCaseRequirementEntity relation = new TestPlanCaseRequirementEntity(); relation.setWorkspaceId(plan.getWorkspaceId()); relation.setPlanCaseId(planCase.getId()); relation.setRequirementId(requirementId); relation.setCreatedAt(LocalDateTime.now()); relation.setUpdatedAt(LocalDateTime.now()); planCaseRequirementMapper.insert(relation);
    }

    private void deleteScope(Long planId) {
        List<Long> caseIds = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, planId)).stream().map(TestPlanCaseEntity::getId).toList();
        if (!caseIds.isEmpty()) planCaseRequirementMapper.delete(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>().in(TestPlanCaseRequirementEntity::getPlanCaseId, caseIds));
        planRequirementMapper.delete(new LambdaQueryWrapper<TestPlanRequirementEntity>().eq(TestPlanRequirementEntity::getPlanId, planId));
        planCaseMapper.delete(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, planId));
    }

    private List<Long> selectedRequirementIds(Long planId) {
        return planRequirementMapper.selectList(new LambdaQueryWrapper<TestPlanRequirementEntity>().eq(TestPlanRequirementEntity::getPlanId, planId)).stream().map(TestPlanRequirementEntity::getRequirementId).toList();
    }

    private List<Long> manualCaseIds(Long planId) {
        return planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, planId).eq(TestPlanCaseEntity::getOriginType, PlanCaseOriginType.MANUAL)).stream().map(TestPlanCaseEntity::getSourceCaseId).toList();
    }

    private void validateRequirements(Long versionId, Long workspaceId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        if (versionId == null) throw TestManagementException.validation("版本测试计划必须选择版本");
        List<TestRequirementEntity> requirements = requirementsByIds(ids);
        if (requirements.size() != new LinkedHashSet<>(ids).size() || requirements.stream().anyMatch(item -> !workspaceId.equals(item.getWorkspaceId()) || !versionId.equals(item.getVersionId()) || item.getDeletedAt() != null)) {
            throw TestManagementException.validation("只能选择当前版本内的需求");
        }
    }

    private List<TestRequirementEntity> requirementsByIds(Collection<Long> ids) {
        List<Long> distinct = distinct(ids);
        if (distinct.isEmpty()) return List.of();
        return requirementMapper.selectBatchIds(distinct);
    }

    private void validateCases(Collection<Long> ids, Long workspaceId) {
        List<Long> distinct = distinct(ids);
        if (distinct.isEmpty()) return;
        List<CaseEntity> cases = caseMapper.selectBatchIds(distinct);
        if (cases.size() != distinct.size() || cases.stream().anyMatch(item -> !workspaceId.equals(item.getWorkspaceId()))) throw TestManagementException.validation("只能选择当前工作区内的用例");
    }

    private Map<Long, CaseEntity> loadCases(Collection<Long> ids) {
        List<Long> distinct = distinct(ids); if (distinct.isEmpty()) return Map.of();
        return caseMapper.selectBatchIds(distinct).stream().collect(Collectors.toMap(CaseEntity::getId, Function.identity()));
    }

    private List<TestPlanResponse> assemble(List<TestPlanEntity> plans, Map<Long, WorkspaceEntity> workspaceMap) {
        if (plans.isEmpty()) return List.of();
        List<Long> planIds = plans.stream().map(TestPlanEntity::getId).toList();
        List<Long> versionIds = plans.stream().map(TestPlanEntity::getVersionId).filter(Objects::nonNull).distinct().toList();
        Map<Long, TestVersionEntity> versions = versionIds.isEmpty() ? Map.of() : versionMapper.selectBatchIds(versionIds).stream().collect(Collectors.toMap(TestVersionEntity::getId, Function.identity()));
        Map<Long, UserEntity> users = loadUsers(plans.stream().map(TestPlanEntity::getOwnerId).filter(Objects::nonNull).toList());
        List<TestPlanRequirementEntity> planRequirements = planRequirementMapper.selectList(new LambdaQueryWrapper<TestPlanRequirementEntity>().in(TestPlanRequirementEntity::getPlanId, planIds));
        Map<Long, List<TestPlanRequirementEntity>> requirementsByPlan = planRequirements.stream().collect(Collectors.groupingBy(TestPlanRequirementEntity::getPlanId));
        Map<Long, TestRequirementEntity> requirements = requirementsByIds(planRequirements.stream().map(TestPlanRequirementEntity::getRequirementId).toList()).stream().collect(Collectors.toMap(TestRequirementEntity::getId, Function.identity()));
        List<TestPlanCaseEntity> cases = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>().in(TestPlanCaseEntity::getPlanId, planIds));
        Map<Long, List<TestPlanCaseEntity>> casesByPlan = cases.stream().collect(Collectors.groupingBy(TestPlanCaseEntity::getPlanId));
        Map<Long, List<TestPlanCaseRequirementEntity>> caseRequirements = cases.isEmpty() ? Map.of() : planCaseRequirementMapper.selectList(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>().in(TestPlanCaseRequirementEntity::getPlanCaseId, cases.stream().map(TestPlanCaseEntity::getId).toList())).stream().collect(Collectors.groupingBy(TestPlanCaseRequirementEntity::getPlanCaseId));
        Map<Long, CaseEntity> sourceCases = loadCases(cases.stream().map(TestPlanCaseEntity::getSourceCaseId).toList());
        List<BugEntity> planDefects = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>().in(BugEntity::getTestPlanId, planIds));
        Map<Long, Long> defectCounts = planDefects.stream().filter(item -> item.getTestPlanCaseId() != null).collect(Collectors.groupingBy(BugEntity::getTestPlanCaseId, Collectors.counting()));
        Map<Long, Long> planDefectCounts = planDefects.stream().filter(item -> item.getTestPlanId() != null).collect(Collectors.groupingBy(BugEntity::getTestPlanId, Collectors.counting()));
        Map<Long, Long> p0DefectCounts = planDefects.stream().filter(item -> item.getTestPlanId() != null && "P0".equals(item.getPriority()) && !List.of("CLOSED", "REJECTED").contains(item.getStatus())).collect(Collectors.groupingBy(BugEntity::getTestPlanId, Collectors.counting()));
        Map<Long, Long> p1DefectCounts = planDefects.stream().filter(item -> item.getTestPlanId() != null && "P1".equals(item.getPriority()) && !List.of("CLOSED", "REJECTED").contains(item.getStatus())).collect(Collectors.groupingBy(BugEntity::getTestPlanId, Collectors.counting()));
        List<Long> caseUserIds = cases.stream().flatMap(item -> java.util.stream.Stream.of(item.getAssigneeId(), item.getExecutedBy())).filter(Objects::nonNull).toList();
        users.putAll(loadUsers(caseUserIds));
        Map<Long, TestPlanReportEntity> reports = reportMapper.selectList(new LambdaQueryWrapper<TestPlanReportEntity>().in(TestPlanReportEntity::getPlanId, planIds)).stream().collect(Collectors.toMap(TestPlanReportEntity::getPlanId, Function.identity()));
        return plans.stream().map(plan -> {
            List<TestPlanCaseEntity> planCases = casesByPlan.getOrDefault(plan.getId(), List.of());
            long executed = planCases.stream().filter(item -> item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING).count();
            long passed = planCases.stream().filter(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PASSED).count();
            WorkspaceEntity workspace = workspaceMap.get(plan.getWorkspaceId());
            UserEntity owner = users.get(plan.getOwnerId());
            List<TestPlanRequirementItem> reqItems = requirementsByPlan.getOrDefault(plan.getId(), List.of()).stream().map(link -> {
                TestRequirementEntity req = requirements.get(link.getRequirementId());
                long passedCases = caseRequirements.values().stream().flatMap(Collection::stream).filter(item -> item.getRequirementId().equals(link.getRequirementId())).map(TestPlanCaseRequirementEntity::getPlanCaseId).map(id -> cases.stream().filter(pc -> pc.getId().equals(id) && pc.getExecutionStatus() == PlanCaseExecutionStatus.PASSED).count()).reduce(0L, Long::sum);
                return new TestPlanRequirementItem(link.getRequirementId(), req == null ? null : req.getRequirementNo(), req == null ? null : req.getTitle(), req == null ? null : req.getPriority(), aggregateReviewStatus(link.getRequirementId()), passedCases);
            }).toList();
            List<TestPlanCaseItem> caseItems = planCases.stream().sorted(Comparator.comparing(TestPlanCaseEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo))).map(item -> {
                CaseEntity source = sourceCases.get(item.getSourceCaseId()); UserEntity assignee = users.get(item.getAssigneeId()); UserEntity executor = users.get(item.getExecutedBy());
                return new TestPlanCaseItem(item.getId(), item.getSourceCaseId(), item.getOriginType(), item.getSnapshotCaseNo(), item.getSnapshotTitle(), item.getSnapshotModule(), item.getSnapshotPriority(), item.getSnapshotPrecondition(), item.getSnapshotSteps(), item.getSnapshotExpectedResult(), Boolean.TRUE.equals(item.getAddedAfterStart()), item.getAssigneeId(), assignee == null ? null : assignee.getDisplayName(), item.getExecutionStatus(), item.getExecutionNote(), item.getExecutedBy(), executor == null ? null : executor.getDisplayName(), item.getExecutedAt(), caseRequirements.getOrDefault(item.getId(), List.of()).stream().map(TestPlanCaseRequirementEntity::getRequirementId).toList(), defectCounts.getOrDefault(item.getId(), 0L), item.getLockVersion());
            }).toList();
            return new TestPlanResponse(plan.getId(), plan.getPlanNo(), plan.getPurpose(), plan.getPlanType(), plan.getStatus(), plan.getVersionId(), plan.getVersionId() == null ? null : versions.get(plan.getVersionId()) == null ? null : versions.get(plan.getVersionId()).getName(), plan.getName(), plan.getOwnerId(), owner == null ? null : owner.getDisplayName(), plan.getStartDate(), plan.getEndDate(), plan.getGoal(), plan.getMinExecuteRate(), plan.getMinPassRate(), Boolean.TRUE.equals(plan.getAllowP0()), plan.getMaxP1(), Boolean.TRUE.equals(plan.getAutoReport()), Boolean.TRUE.equals(plan.getOwnerConfirmRequired()), requirementsByPlan.getOrDefault(plan.getId(), List.of()).size(), planCases.size(), executed, passed, rate(executed, planCases.size()), rate(passed, executed), planDefectCounts.getOrDefault(plan.getId(), 0L), p0DefectCounts.getOrDefault(plan.getId(), 0L), p1DefectCounts.getOrDefault(plan.getId(), 0L), plan.getLockVersion(), workspace == null ? null : workspace.getWorkspaceCode(), workspace == null ? null : workspace.getWorkspaceName(), plan.getSnapshotFrozenAt(), plan.getStartedAt(), plan.getCompletedAt(), plan.getCancelledAt(), plan.getCancelReason(), reqItems, caseItems, reports.containsKey(plan.getId()) ? toReportResponse(reports.get(plan.getId())) : null, plan.getCreatedAt(), plan.getUpdatedAt());
        }).toList();
    }

    private RequirementReviewStatus aggregateReviewStatus(Long requirementId) {
        List<TestRequirementCaseEntity> relations = requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>().eq(TestRequirementCaseEntity::getRequirementId, requirementId));
        if (relations.isEmpty()) return RequirementReviewStatus.PENDING;
        if (relations.stream().anyMatch(item -> item.getReviewStatus() == RequirementReviewStatus.REJECTED)) return RequirementReviewStatus.REJECTED;
        if (relations.stream().anyMatch(item -> item.getReviewStatus() != RequirementReviewStatus.PASSED)) return RequirementReviewStatus.REVIEWING;
        return RequirementReviewStatus.PASSED;
    }

    private TestPlanReportEntity generateReportInternal(TestPlanEntity plan) {
        TestPlanReportEntity existing = reportMapper.selectOne(new LambdaQueryWrapper<TestPlanReportEntity>().eq(TestPlanReportEntity::getPlanId, plan.getId()));
        if (existing != null && existing.getStatus() == PlanReportStatus.SIGNED) throw TestManagementException.snapshotLocked("已签署报告不能覆盖");
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("planId", plan.getId()); snapshot.put("planNo", plan.getPlanNo()); snapshot.put("name", plan.getName()); snapshot.put("generatedAt", LocalDateTime.now());
        snapshot.put("caseCount", planCaseMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseEntity>().eq(TestPlanCaseEntity::getPlanId, plan.getId())));
        snapshot.put("defectCount", bugMapper.selectCount(new LambdaQueryWrapper<BugEntity>().eq(BugEntity::getTestPlanId, plan.getId())));
        snapshot.put("qualityChecks", qualityChecks(plan));
        String content;
        try { content = objectMapper.writeValueAsString(snapshot); } catch (JsonProcessingException exception) { throw TestManagementException.validation("测试报告内容生成失败"); }
        LocalDateTime now = LocalDateTime.now();
        if (existing == null) { existing = new TestPlanReportEntity(); existing.setWorkspaceId(plan.getWorkspaceId()); existing.setPlanId(plan.getId()); existing.setLockVersion(0); existing.setCreatedAt(now); }
        existing.setStatus(PlanReportStatus.GENERATED); existing.setContentSnapshotJson(content); existing.setGeneratedAt(now); existing.setUpdatedAt(now);
        if (existing.getId() == null) reportMapper.insert(existing); else reportMapper.updateById(existing);
        return existing;
    }

    private TestPlanReportEntity requireReport(Long planId) {
        TestPlanReportEntity report = reportMapper.selectOne(new LambdaQueryWrapper<TestPlanReportEntity>().eq(TestPlanReportEntity::getPlanId, planId));
        if (report == null) throw TestManagementException.notFound("测试报告", planId);
        return report;
    }

    private TestPlanReportResponse toReportResponse(TestPlanReportEntity report) {
        UserEntity signer = report.getSignedBy() == null ? null : userMapper.selectById(report.getSignedBy());
        return new TestPlanReportResponse(report.getId(), report.getPlanId(), report.getStatus(), report.getContentSnapshotJson(), report.getGeneratedAt(), report.getSignedBy(), signer == null ? null : signer.getDisplayName(), report.getSignedAt(), report.getLockVersion());
    }

    private void requireEditable(TestPlanEntity plan) {
        if (plan.getStatus() != PlanStatus.DRAFT && plan.getStatus() != PlanStatus.PENDING) throw TestManagementException.snapshotLocked("当前状态不允许编辑测试计划");
    }

    private void requireNotTerminal(TestPlanEntity plan) {
        if (plan.getStatus() == PlanStatus.COMPLETED || plan.getStatus() == PlanStatus.CANCELLED) throw TestManagementException.snapshotLocked("已完成或已取消计划不可修改");
    }

    private TestPlanCaseEntity requirePlanCase(Long planCaseId, Long planId) {
        TestPlanCaseEntity item = planCaseMapper.selectById(planCaseId);
        if (item == null || !planId.equals(item.getPlanId())) throw TestManagementException.notFound("测试用例快照", planCaseId);
        return item;
    }

    private TestPlanCaseExecutionEntity latestExecution(Long planId, Long planCaseId) {
        return executionMapper.selectOne(new LambdaQueryWrapper<TestPlanCaseExecutionEntity>()
                .eq(TestPlanCaseExecutionEntity::getPlanId, planId)
                .eq(TestPlanCaseExecutionEntity::getPlanCaseId, planCaseId)
                .orderByDesc(TestPlanCaseExecutionEntity::getExecutedAt)
                .orderByDesc(TestPlanCaseExecutionEntity::getId)
                .last("limit 1"));
    }

    private TestPlanExecutionAttachmentResponse toExecutionAttachmentResponse(TestPlanExecutionAttachmentEntity attachment) {
        return new TestPlanExecutionAttachmentResponse(
                attachment.getId(), attachment.getFileName(), attachment.getContentType(), attachment.getFileSize(),
                "/api/test-management/plans/" + attachment.getPlanId() + "/cases/" + attachment.getPlanCaseId() + "/evidence/" + attachment.getId() + "/download",
                attachment.getCreatedAt());
    }

    private void requireActiveUser(Long userId) {
        if (userService.findActiveUser(userId) == null) throw TestManagementException.validation("负责人不存在或已停用", Map.of("userId", userId));
    }

    private void touch(TestPlanEntity plan, Integer expectedVersion) {
        plan.setUpdatedBy(CurrentUserContext.get()); plan.setUpdatedAt(LocalDateTime.now()); plan.setLockVersion(expectedVersion);
        if (planMapper.updateById(plan) == 0) throw TestManagementException.conflict("测试计划已被其他用户修改，请重新加载", Map.of("id", plan.getId()));
    }

    private void requireExpectedVersion(Integer actual, Integer expected, String resource) {
        if (!Objects.equals(actual, expected)) throw TestManagementException.conflict(resource + "已被其他用户修改，请重新加载", Map.of("expectedVersion", expected, "actualVersion", actual));
    }

    private String copyPlanName(String sourceName, String requestedName) {
        String name = blankToNull(requestedName);
        if (name == null) name = sourceName + " - 副本";
        return name.length() <= 255 ? name : name.substring(0, 255);
    }

    private Map<String, Object> check(String key, Object target, Object actual) { return Map.of("key", key, "target", target, "actual", actual); }
    private BigDecimal rate(long numerator, long denominator) { return denominator <= 0 ? BigDecimal.ZERO : BigDecimal.valueOf(numerator).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP); }
    private BigDecimal defaultValue(BigDecimal value, BigDecimal fallback) { return value == null ? fallback : value; }
    private void validateDates(LocalDate start, LocalDate end) { if (start != null && end != null && end.isBefore(start)) throw TestManagementException.validation("结束日期不能早于开始日期"); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private List<Long> distinct(Collection<Long> ids) { return ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList(); }
    private Map<Long, UserEntity> loadUsers(Collection<Long> ids) { List<Long> distinct = distinct(ids); if (distinct.isEmpty()) return new HashMap<>(); return userMapper.selectBatchIds(distinct).stream().collect(Collectors.toMap(UserEntity::getId, Function.identity())); }
    private <E extends Enum<E>> E parseEnum(String value, Class<E> type, String field) { String normalized = blankToNull(value); if (normalized == null || "ALL".equalsIgnoreCase(normalized)) return null; try { return Enum.valueOf(type, normalized.toUpperCase(Locale.ROOT).replace('-', '_')); } catch (IllegalArgumentException exception) { throw TestManagementException.validation(field + "不合法: " + value); } }
}
