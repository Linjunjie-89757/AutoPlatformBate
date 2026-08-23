package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.bug.BugEntity;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TestVersionService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final TestVersionMapper versionMapper;
    private final TestRequirementMapper requirementMapper;
    private final TestRequirementCaseMapper requirementCaseMapper;
    private final TestPlanMapper planMapper;
    private final TestPlanCaseMapper planCaseMapper;
    private final TestPlanReportMapper planReportMapper;
    private final BugMapper bugMapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final TestManagementWorkspaceSupport workspaceSupport;
    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final TestActivityLogService activityLogService;
    private final TestRequirementService requirementService;
    private final TestPlanService planService;
    private final TestPlanPdfReportService pdfReportService;

    public TestVersionService(
            TestVersionMapper versionMapper,
            TestRequirementMapper requirementMapper,
            TestRequirementCaseMapper requirementCaseMapper,
            TestPlanMapper planMapper,
            TestPlanCaseMapper planCaseMapper,
            TestPlanReportMapper planReportMapper,
            BugMapper bugMapper,
            UserMapper userMapper,
            UserService userService,
            TestManagementWorkspaceSupport workspaceSupport,
            WorkspaceAccessSupport workspaceAccessSupport,
            TestActivityLogService activityLogService,
            TestRequirementService requirementService,
            TestPlanService planService,
            TestPlanPdfReportService pdfReportService
    ) {
        this.versionMapper = versionMapper;
        this.requirementMapper = requirementMapper;
        this.requirementCaseMapper = requirementCaseMapper;
        this.planMapper = planMapper;
        this.planCaseMapper = planCaseMapper;
        this.planReportMapper = planReportMapper;
        this.bugMapper = bugMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.workspaceSupport = workspaceSupport;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.activityLogService = activityLogService;
        this.requirementService = requirementService;
        this.planService = planService;
        this.pdfReportService = pdfReportService;
    }

    public PageResponse<TestVersionResponse> list(
            String workspaceCode,
            String keyword,
            String versionType,
            String status,
            Long ownerId,
            Integer pageNo,
            Integer pageSize
    ) {
        TestManagementWorkspaceScope scope = workspaceSupport.requireReadScope(workspaceCode);
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        if (scope.workspaceIds().isEmpty()) {
            return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
        }

        LambdaQueryWrapper<TestVersionEntity> query = new LambdaQueryWrapper<TestVersionEntity>()
                .in(TestVersionEntity::getWorkspaceId, scope.workspaceIds());
        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(item -> item.like(TestVersionEntity::getName, normalizedKeyword)
                    .or().like(TestVersionEntity::getVersionNo, normalizedKeyword));
        }
        VersionType normalizedType = parseEnum(versionType, VersionType.class, "版本类型");
        if (normalizedType != null) query.eq(TestVersionEntity::getVersionType, normalizedType);
        VersionStatus normalizedStatus = parseEnum(status, VersionStatus.class, "版本状态");
        if (normalizedStatus != null) query.eq(TestVersionEntity::getStatus, normalizedStatus);
        if (ownerId != null) query.eq(TestVersionEntity::getOwnerId, ownerId);

        Page<TestVersionEntity> page = versionMapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByDesc(TestVersionEntity::getUpdatedAt).orderByDesc(TestVersionEntity::getId)
        );
        return PageResponse.of(
                assemble(page.getRecords(), scope.workspaces()),
                page.getTotal(),
                page.getCurrent(),
                page.getSize()
        );
    }

    public TestVersionResponse get(Long id, String workspaceCode) {
        TestVersionEntity entity = requireReadable(id, workspaceCode);
        WorkspaceEntity workspace = workspaceSupport.requireReadableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return assemble(List.of(entity), Map.of(workspace.getId(), workspace)).getFirst();
    }

    public GeneratedTestPlanPdf exportReportPdf(Long id, String workspaceCode) {
        TestVersionResponse version = get(id, workspaceCode);
        List<TestPlanResponse> plans = planService.list(workspaceCode, null, null, null, id, null, 1, MAX_PAGE_SIZE).items();
        List<TestRequirementResponse> requirements = requirementService.list(
                workspaceCode, id, null, null, null, null, null, null, 1, MAX_PAGE_SIZE).items();
        List<BugEntity> defects = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestVersionId, id));

        long caseCount = plans.stream().mapToLong(TestPlanResponse::caseCount).sum();
        long executedCount = plans.stream().mapToLong(TestPlanResponse::executedCount).sum();
        long passedCount = plans.stream().mapToLong(TestPlanResponse::passedCount).sum();
        long coveredRequirements = requirements.stream()
                .filter(item -> "COVERED".equals(item.qualityStatus()) || "PASSED".equals(item.qualityStatus()))
                .count();
        long openP0 = defects.stream().filter(item -> isOpenPriority(item, "P0")).count();
        long openP1 = defects.stream().filter(item -> isOpenPriority(item, "P1")).count();
        boolean allPlansCompleted = !plans.isEmpty() && plans.stream().allMatch(item -> item.status() == PlanStatus.COMPLETED);
        boolean ownerConfirmed = !plans.isEmpty() && plans.stream().allMatch(item -> !item.ownerConfirmRequired()
                || item.report() != null && item.report().status() == PlanReportStatus.SIGNED);
        BigDecimal executeRate = rate(executedCount, caseCount);
        BigDecimal passRate = rate(passedCount, executedCount);
        BigDecimal requirementCoverRate = rate(coveredRequirements, requirements.size());
        int qualityPassedCount = (executeRate.compareTo(BigDecimal.valueOf(90)) >= 0 ? 1 : 0)
                + (passRate.compareTo(BigDecimal.valueOf(85)) >= 0 ? 1 : 0)
                + (requirementCoverRate.compareTo(BigDecimal.valueOf(100)) >= 0 ? 1 : 0)
                + (openP0 == 0 ? 1 : 0)
                + (openP1 <= 3 ? 1 : 0)
                + (allPlansCompleted ? 1 : 0)
                + (ownerConfirmed ? 1 : 0);

        List<TestVersionReportData.PlanItem> planItems = plans.stream().map(item -> new TestVersionReportData.PlanItem(
                item.planNo(), item.name(), item.planType(), item.status(), item.ownerName(), item.caseCount(),
                item.executedCount(), item.passedCount(), item.executeRate(), item.passRate(), item.defectCount()
        )).toList();
        List<TestVersionReportData.RequirementItem> requirementItems = requirements.stream().map(item -> new TestVersionReportData.RequirementItem(
                item.requirementNo(), item.title(), item.priority(), item.qualityStatus(), item.caseTotal(), item.caseReviewed()
        )).toList();
        TestVersionReportData report = new TestVersionReportData(
                version, LocalDateTime.now(), caseCount, executedCount, passedCount, executeRate, passRate,
                coveredRequirements, requirementCoverRate, openP0, openP1, allPlansCompleted, ownerConfirmed,
                qualityPassedCount, planItems, requirementItems, defects
        );
        return pdfReportService.renderVersion(report);
    }

    @Transactional
    public TestVersionResponse create(String workspaceCode, CreateTestVersionRequest request) {
        WorkspaceEntity workspace = workspaceSupport.requireWritableWorkspace(workspaceCode);
        validateDates(request.startDate(), request.testDate(), request.releaseDate());
        requireActiveUser(request.ownerId());
        ensureUniqueName(workspace.getId(), request.name(), null);

        Long currentUserId = CurrentUserContext.get();
        LocalDateTime now = LocalDateTime.now();
        TestVersionEntity entity = new TestVersionEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setVersionNo("VER-TMP-" + java.util.UUID.randomUUID().toString().substring(0, 8));
        entity.setName(request.name().trim());
        entity.setVersionType(request.versionType());
        entity.setStatus(VersionStatus.PLANNING);
        entity.setOwnerId(request.ownerId());
        entity.setStartDate(request.startDate());
        entity.setTestDate(request.testDate());
        entity.setReleaseDate(request.releaseDate());
        entity.setGoal(blankToNull(request.goal()));
        entity.setLockVersion(0);
        entity.setCreatedBy(currentUserId);
        entity.setUpdatedBy(currentUserId);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        try {
            versionMapper.insert(entity);
            String versionNo = "VER-" + String.format("%06d", entity.getId());
            versionMapper.update(null, new LambdaUpdateWrapper<TestVersionEntity>()
                    .eq(TestVersionEntity::getId, entity.getId())
                    .set(TestVersionEntity::getVersionNo, versionNo));
            entity.setVersionNo(versionNo);
        } catch (DuplicateKeyException exception) {
            throw TestManagementException.validation("版本名称已存在");
        }
        activityLogService.record(
                workspace.getId(), ActivityEntityType.VERSION, entity.getId(),
                "VERSION_CREATED", "创建版本", Map.of("versionNo", entity.getVersionNo(), "name", entity.getName())
        );
        return get(entity.getId(), workspace.getWorkspaceCode());
    }

    @Transactional
    public TestVersionResponse update(Long id, String workspaceCode, UpdateTestVersionRequest request) {
        TestVersionEntity entity = requireWritable(id, workspaceCode);
        requireEditable(entity);
        requireExpectedVersion(entity.getLockVersion(), request.expectedVersion());
        validateDates(request.startDate(), request.testDate(), request.releaseDate());
        requireActiveUser(request.ownerId());
        ensureUniqueName(entity.getWorkspaceId(), request.name(), entity.getId());

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("beforeName", entity.getName());
        detail.put("afterName", request.name().trim());
        entity.setName(request.name().trim());
        entity.setVersionType(request.versionType());
        entity.setOwnerId(request.ownerId());
        entity.setStartDate(request.startDate());
        entity.setTestDate(request.testDate());
        entity.setReleaseDate(request.releaseDate());
        entity.setGoal(blankToNull(request.goal()));
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setLockVersion(request.expectedVersion());
        try {
            updateWithOptimisticLock(entity);
        } catch (DuplicateKeyException exception) {
            throw TestManagementException.validation("版本名称已存在");
        }
        activityLogService.record(
                entity.getWorkspaceId(), ActivityEntityType.VERSION, entity.getId(),
                "VERSION_UPDATED", "更新版本", detail
        );
        return get(id, workspaceCode);
    }

    @Transactional
    public TestVersionResponse transition(Long id, String workspaceCode, TransitionTestVersionRequest request) {
        TestVersionEntity entity = requireWritable(id, workspaceCode);
        requireExpectedVersion(entity.getLockVersion(), request.expectedVersion());
        VersionStatus current = entity.getStatus();
        TestManagementStateMachine.requireVersionTransition(current, request.targetStatus());
        requireTransitionReason(current, request.targetStatus(), request.force(), request.reason());

        List<TestQualityGateCheck> qualityGateSnapshot = request.targetStatus() == VersionStatus.PENDING_RELEASE
                || request.targetStatus() == VersionStatus.RELEASED
                ? qualityGateChecks(entity)
                : List.of();
        List<Map<String, Object>> failedChecks = request.targetStatus() == VersionStatus.PENDING_RELEASE
                || request.targetStatus() == VersionStatus.RELEASED
                ? qualityGateSnapshot.stream().filter(item -> !item.passed()).map(item -> failedCheck(item.key(), item.target(), item.actual())).toList()
                : qualityChecks(entity, request.targetStatus());
        if (!failedChecks.isEmpty() && !request.force()) {
            throw TestManagementException.qualityGate("版本未达到状态推进条件", failedChecks);
        }
        if (!failedChecks.isEmpty() && blankToNull(request.reason()) == null) {
            throw TestManagementException.validation("强制推进必须填写原因");
        }
        if (request.force()) {
            workspaceAccessSupport.requirePermission(workspaceCode, "test_management.force_release");
        }

        entity.setStatus(request.targetStatus());
        entity.setArchivedAt(request.targetStatus() == VersionStatus.ARCHIVED ? LocalDateTime.now() : entity.getArchivedAt());
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setLockVersion(request.expectedVersion());
        updateWithOptimisticLock(entity);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("from", current);
        detail.put("to", request.targetStatus());
        detail.put("force", request.force());
        detail.put("reason", blankToNull(request.reason()));
        if (!failedChecks.isEmpty()) detail.put("bypassedChecks", failedChecks);
        if (request.targetStatus() == VersionStatus.RELEASED) detail.put("qualityGateSnapshot", qualityGateSnapshot);
        activityLogService.record(
                entity.getWorkspaceId(), ActivityEntityType.VERSION, entity.getId(),
                "VERSION_STATUS_CHANGED", "变更版本状态", detail
        );
        return get(id, workspaceCode);
    }

    public PageResponse<TestActivityItem> listActivities(
            Long id,
            String workspaceCode,
            Integer pageNo,
            Integer pageSize
    ) {
        TestVersionEntity entity = requireReadable(id, workspaceCode);
        return activityLogService.list(entity.getWorkspaceId(), ActivityEntityType.VERSION, id, pageNo, pageSize);
    }

    TestVersionEntity requireReadable(Long id, String workspaceCode) {
        TestVersionEntity entity = versionMapper.selectById(id);
        if (entity == null) throw TestManagementException.notFound("版本", id);
        workspaceSupport.requireReadableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return entity;
    }

    TestVersionEntity requireWritable(Long id, String workspaceCode) {
        TestVersionEntity entity = versionMapper.selectById(id);
        if (entity == null) throw TestManagementException.notFound("版本", id);
        workspaceSupport.requireWritableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return entity;
    }

    private List<TestVersionResponse> assemble(
            List<TestVersionEntity> entities,
            Map<Long, WorkspaceEntity> workspaceMap
    ) {
        if (entities.isEmpty()) return List.of();
        Map<Long, UserEntity> users = loadUsers(entities.stream().map(TestVersionEntity::getOwnerId).toList());
        List<Long> versionIds = entities.stream().map(TestVersionEntity::getId).toList();
        List<TestRequirementEntity> requirements = requirementMapper.selectList(
                new LambdaQueryWrapper<TestRequirementEntity>()
                        .in(TestRequirementEntity::getVersionId, versionIds)
                        .isNull(TestRequirementEntity::getDeletedAt));
        Map<Long, Long> requirementCounts = requirements.stream()
                .collect(Collectors.groupingBy(TestRequirementEntity::getVersionId, Collectors.counting()));
        List<Long> requirementIds = requirements.stream().map(TestRequirementEntity::getId).toList();
        Map<Long, List<TestRequirementCaseEntity>> requirementCases = requirementIds.isEmpty()
                ? Map.of()
                : requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                        .in(TestRequirementCaseEntity::getRequirementId, requirementIds))
                .stream().collect(Collectors.groupingBy(TestRequirementCaseEntity::getRequirementId));
        List<TestPlanEntity> plans = planMapper.selectList(
                new LambdaQueryWrapper<TestPlanEntity>()
                        .in(TestPlanEntity::getVersionId, versionIds)
                        .isNull(TestPlanEntity::getDeletedAt));
        Map<Long, List<TestPlanEntity>> plansByVersion = plans.stream()
                .collect(Collectors.groupingBy(TestPlanEntity::getVersionId));
        Map<Long, Long> planCounts = plans.stream()
                .collect(Collectors.groupingBy(TestPlanEntity::getVersionId, Collectors.counting()));
        List<Long> planIds = plans.stream().map(TestPlanEntity::getId).toList();
        Map<Long, List<TestPlanCaseEntity>> casesByPlan = planIds.isEmpty()
                ? Map.of()
                : planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>()
                        .in(TestPlanCaseEntity::getPlanId, planIds))
                .stream().collect(Collectors.groupingBy(TestPlanCaseEntity::getPlanId));
        Set<Long> signedPlanIds = planIds.isEmpty()
                ? Set.of()
                : planReportMapper.selectList(new LambdaQueryWrapper<TestPlanReportEntity>()
                        .in(TestPlanReportEntity::getPlanId, planIds)
                        .eq(TestPlanReportEntity::getStatus, PlanReportStatus.SIGNED))
                .stream().map(TestPlanReportEntity::getPlanId).collect(Collectors.toSet());
        Map<Long, List<BugEntity>> bugsByVersion = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                        .in(BugEntity::getTestVersionId, versionIds))
                .stream().collect(Collectors.groupingBy(BugEntity::getTestVersionId));

        return entities.stream().map(entity -> {
            WorkspaceEntity workspace = workspaceMap.get(entity.getWorkspaceId());
            if (workspace == null) workspace = workspaceSupport.requireReadableEntityWorkspace(null, entity.getWorkspaceId());
            UserEntity owner = users.get(entity.getOwnerId());
            List<TestPlanEntity> versionPlans = plansByVersion.getOrDefault(entity.getId(), List.of());
            List<TestPlanCaseEntity> versionCases = versionPlans.stream()
                    .flatMap(plan -> casesByPlan.getOrDefault(plan.getId(), List.of()).stream())
                    .toList();
            List<BugEntity> versionBugs = bugsByVersion.getOrDefault(entity.getId(), List.of());
            long executedCount = versionCases.stream()
                    .filter(item -> item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING)
                    .count();
            long passedCount = versionCases.stream()
                    .filter(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PASSED)
                    .count();
            List<TestQualityGateCheck> qualityGateChecks = buildQualityGateChecks(
                    requirements.stream().filter(item -> entity.getId().equals(item.getVersionId())).toList(),
                    versionPlans,
                    casesByPlan,
                    versionBugs,
                    requirementCases,
                    signedPlanIds
            );
            return new TestVersionResponse(
                    entity.getId(), entity.getVersionNo(), entity.getName(), entity.getVersionType(), entity.getStatus(),
                    entity.getOwnerId(), owner == null ? null : owner.getDisplayName(),
                    entity.getStartDate(), entity.getTestDate(), entity.getReleaseDate(), entity.getGoal(),
                    requirementCounts.getOrDefault(entity.getId(), 0L), planCounts.getOrDefault(entity.getId(), 0L),
                    versionCases.size(), executedCount, passedCount,
                    versionBugs.stream().filter(item -> isOpenPriority(item, "P0")).count(),
                    versionBugs.stream().filter(item -> isOpenPriority(item, "P1")).count(),
                    qualityGateChecks,
                    entity.getLockVersion(),
                    workspace == null ? null : workspace.getWorkspaceCode(),
                    workspace == null ? null : workspace.getWorkspaceName(),
                    entity.getCreatedBy(), entity.getCreatedAt(), entity.getUpdatedBy(), entity.getUpdatedAt(), entity.getArchivedAt()
            );
        }).toList();
    }

    private List<Map<String, Object>> qualityChecks(TestVersionEntity version, VersionStatus target) {
        List<Map<String, Object>> failures = new ArrayList<>();
        if (target == VersionStatus.TESTING) {
            long requirementCount = requirementMapper.selectCount(new LambdaQueryWrapper<TestRequirementEntity>()
                    .eq(TestRequirementEntity::getVersionId, version.getId())
                    .isNull(TestRequirementEntity::getDeletedAt));
            if (requirementCount == 0) failures.add(failedCheck("REQUIREMENT_COUNT", 1, 0));
        }
        return failures;
    }

    private List<TestQualityGateCheck> qualityGateChecks(TestVersionEntity version) {
        List<TestRequirementEntity> requirements = requirementMapper.selectList(new LambdaQueryWrapper<TestRequirementEntity>()
                .eq(TestRequirementEntity::getVersionId, version.getId())
                .isNull(TestRequirementEntity::getDeletedAt));
        List<Long> requirementIds = requirements.stream().map(TestRequirementEntity::getId).toList();
        Map<Long, List<TestRequirementCaseEntity>> requirementCases = requirementIds.isEmpty()
                ? Map.of()
                : requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                        .in(TestRequirementCaseEntity::getRequirementId, requirementIds))
                .stream().collect(Collectors.groupingBy(TestRequirementCaseEntity::getRequirementId));
        List<TestPlanEntity> plans = planMapper.selectList(new LambdaQueryWrapper<TestPlanEntity>()
                .eq(TestPlanEntity::getVersionId, version.getId())
                .isNull(TestPlanEntity::getDeletedAt));
        List<Long> planIds = plans.stream().map(TestPlanEntity::getId).toList();
        Map<Long, List<TestPlanCaseEntity>> casesByPlan = planIds.isEmpty()
                ? Map.of()
                : planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>()
                        .in(TestPlanCaseEntity::getPlanId, planIds))
                .stream().collect(Collectors.groupingBy(TestPlanCaseEntity::getPlanId));
        Set<Long> signedPlanIds = planIds.isEmpty()
                ? Set.of()
                : planReportMapper.selectList(new LambdaQueryWrapper<TestPlanReportEntity>()
                        .in(TestPlanReportEntity::getPlanId, planIds)
                        .eq(TestPlanReportEntity::getStatus, PlanReportStatus.SIGNED))
                .stream().map(TestPlanReportEntity::getPlanId).collect(Collectors.toSet());
        List<BugEntity> bugs = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestVersionId, version.getId()));
        return buildQualityGateChecks(requirements, plans, casesByPlan, bugs, requirementCases, signedPlanIds);
    }

    private List<TestQualityGateCheck> buildQualityGateChecks(
            List<TestRequirementEntity> requirements,
            List<TestPlanEntity> plans,
            Map<Long, List<TestPlanCaseEntity>> casesByPlan,
            List<BugEntity> bugs,
            Map<Long, List<TestRequirementCaseEntity>> requirementCases,
            Set<Long> signedPlanIds
    ) {
        List<TestPlanEntity> activePlans = plans.stream()
                .filter(plan -> plan.getStatus() != PlanStatus.CANCELLED)
                .toList();
        long completedPlans = activePlans.stream().filter(plan -> plan.getStatus() == PlanStatus.COMPLETED).count();
        long signedReports = activePlans.stream().filter(plan -> signedPlanIds.contains(plan.getId())).count();
        long coveredRequirements = requirements.stream().filter(requirement -> {
            List<TestRequirementCaseEntity> relations = requirementCases.getOrDefault(requirement.getId(), List.of());
            return !relations.isEmpty() && relations.stream().allMatch(item -> item.getReviewStatus() == RequirementReviewStatus.PASSED);
        }).count();
        BigDecimal requirementCoverRate = rate(coveredRequirements, requirements.size());
        List<TestPlanCaseEntity> cases = activePlans.stream()
                .flatMap(plan -> casesByPlan.getOrDefault(plan.getId(), List.of()).stream())
                .toList();
        long executed = cases.stream().filter(item -> item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING).count();
        long passed = cases.stream().filter(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PASSED).count();
        BigDecimal executeRate = rate(executed, cases.size());
        BigDecimal passRate = rate(passed, executed);
        long p0 = bugs.stream().filter(item -> isOpenPriority(item, "P0")).count();
        long p1 = bugs.stream().filter(item -> isOpenPriority(item, "P1")).count();
        int expectedPlanCount = Math.max(1, activePlans.size());
        return List.of(
                qualityCheck(activePlans.isEmpty() ? "COMPLETED_PLAN_COUNT" : "ALL_PLANS_COMPLETED", "计划完成情况", expectedPlanCount, completedPlans,
                        !activePlans.isEmpty() && completedPlans == activePlans.size()),
                qualityCheck("REPORT_SIGNED", "报告签署", expectedPlanCount, signedReports,
                        !activePlans.isEmpty() && signedReports == activePlans.size()),
                qualityCheck("REQUIREMENT_COVER_RATE", "需求覆盖率", BigDecimal.valueOf(100), requirementCoverRate,
                        !requirements.isEmpty() && requirementCoverRate.compareTo(BigDecimal.valueOf(100)) >= 0),
                qualityCheck("VERSION_EXECUTION_RATE", "用例执行率", BigDecimal.valueOf(90), executeRate,
                        executeRate.compareTo(BigDecimal.valueOf(90)) >= 0),
                qualityCheck("VERSION_PASS_RATE", "用例通过率", BigDecimal.valueOf(85), passRate,
                        passRate.compareTo(BigDecimal.valueOf(85)) >= 0),
                qualityCheck("OPEN_P0_DEFECTS", "P0 缺陷", 0, p0, p0 == 0),
                qualityCheck("OPEN_P1_DEFECTS", "P1 缺陷", 3, p1, p1 <= 3)
        );
    }

    private TestQualityGateCheck qualityCheck(String key, String label, Object target, Object actual, boolean passed) {
        return new TestQualityGateCheck(key, label, target, actual, passed);
    }

    private void requireTransitionReason(VersionStatus current, VersionStatus target, boolean force, String reason) {
        boolean backward = (current == VersionStatus.TESTING && target == VersionStatus.DEVELOPING)
                || (current == VersionStatus.PENDING_RELEASE && target == VersionStatus.TESTING);
        if ((backward || target == VersionStatus.ARCHIVED || force)
                && blankToNull(reason) == null) {
            throw TestManagementException.validation("当前状态变更必须填写原因");
        }
    }

    private void validateDates(LocalDate startDate, LocalDate testDate, LocalDate releaseDate) {
        if (startDate != null && testDate != null && testDate.isBefore(startDate)) {
            throw TestManagementException.validation("提测日期不能早于开始日期");
        }
        if (testDate != null && releaseDate != null && releaseDate.isBefore(testDate)) {
            throw TestManagementException.validation("发布日期不能早于提测日期");
        }
        if (startDate != null && releaseDate != null && releaseDate.isBefore(startDate)) {
            throw TestManagementException.validation("发布日期不能早于开始日期");
        }
    }

    private void ensureUniqueName(Long workspaceId, String name, Long excludedId) {
        LambdaQueryWrapper<TestVersionEntity> query = new LambdaQueryWrapper<TestVersionEntity>()
                .eq(TestVersionEntity::getWorkspaceId, workspaceId)
                .eq(TestVersionEntity::getName, name.trim());
        if (excludedId != null) query.ne(TestVersionEntity::getId, excludedId);
        if (versionMapper.selectCount(query) > 0) throw TestManagementException.validation("版本名称已存在");
    }

    private void requireEditable(TestVersionEntity entity) {
        if (entity.getStatus() == VersionStatus.RELEASED || entity.getStatus() == VersionStatus.ARCHIVED) {
            throw TestManagementException.snapshotLocked("已发布或已归档版本不可编辑");
        }
    }

    private void requireActiveUser(Long userId) {
        if (userService.findActiveUser(userId) == null) {
            throw TestManagementException.validation("负责人不存在或已停用", Map.of("userId", userId));
        }
    }

    private void updateWithOptimisticLock(TestVersionEntity entity) {
        if (versionMapper.updateById(entity) == 0) {
            throw TestManagementException.conflict("版本已被其他用户修改，请重新加载", Map.of("id", entity.getId()));
        }
    }

    private void requireExpectedVersion(Integer actual, Integer expected) {
        if (!Objects.equals(actual, expected)) {
            throw TestManagementException.conflict(
                    "版本已被其他用户修改，请重新加载",
                    Map.of("expectedVersion", expected, "actualVersion", actual)
            );
        }
    }

    private Map<Long, UserEntity> loadUsers(List<Long> userIds) {
        List<Long> ids = userIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private Map<String, Object> failedCheck(String key, Object target, Object actual) {
        return Map.of("key", key, "target", target, "actual", actual);
    }

    private BigDecimal rate(long numerator, long denominator) {
        if (denominator <= 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    private boolean isOpenPriority(BugEntity defect, String priority) {
        return priority.equalsIgnoreCase(defect.getPriority())
                && !"CLOSED".equalsIgnoreCase(defect.getStatus())
                && !"REJECTED".equalsIgnoreCase(defect.getStatus());
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> type, String fieldName) {
        String normalized = blankToNull(value);
        if (normalized == null || "ALL".equalsIgnoreCase(normalized)) return null;
        try {
            return Enum.valueOf(type, normalized.replace('-', '_').toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw TestManagementException.validation(fieldName + "不合法: " + value);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
