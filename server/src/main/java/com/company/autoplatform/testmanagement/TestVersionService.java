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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TestVersionService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final TestVersionMapper versionMapper;
    private final TestRequirementMapper requirementMapper;
    private final TestPlanMapper planMapper;
    private final TestPlanCaseMapper planCaseMapper;
    private final TestPlanReportMapper planReportMapper;
    private final BugMapper bugMapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final TestManagementWorkspaceSupport workspaceSupport;
    private final TestActivityLogService activityLogService;

    public TestVersionService(
            TestVersionMapper versionMapper,
            TestRequirementMapper requirementMapper,
            TestPlanMapper planMapper,
            TestPlanCaseMapper planCaseMapper,
            TestPlanReportMapper planReportMapper,
            BugMapper bugMapper,
            UserMapper userMapper,
            UserService userService,
            TestManagementWorkspaceSupport workspaceSupport,
            TestActivityLogService activityLogService
    ) {
        this.versionMapper = versionMapper;
        this.requirementMapper = requirementMapper;
        this.planMapper = planMapper;
        this.planCaseMapper = planCaseMapper;
        this.planReportMapper = planReportMapper;
        this.bugMapper = bugMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.workspaceSupport = workspaceSupport;
        this.activityLogService = activityLogService;
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

        List<Map<String, Object>> failedChecks = qualityChecks(entity, request.targetStatus());
        if (!failedChecks.isEmpty() && !request.force()) {
            throw TestManagementException.qualityGate("版本未达到状态推进条件", failedChecks);
        }
        if (!failedChecks.isEmpty() && blankToNull(request.reason()) == null) {
            throw TestManagementException.validation("强制推进必须填写原因");
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
        Map<Long, Long> requirementCounts = requirementMapper.selectList(
                        new LambdaQueryWrapper<TestRequirementEntity>()
                                .in(TestRequirementEntity::getVersionId, versionIds)
                                .isNull(TestRequirementEntity::getDeletedAt))
                .stream().collect(Collectors.groupingBy(TestRequirementEntity::getVersionId, Collectors.counting()));
        Map<Long, Long> planCounts = planMapper.selectList(
                        new LambdaQueryWrapper<TestPlanEntity>()
                                .in(TestPlanEntity::getVersionId, versionIds)
                                .isNull(TestPlanEntity::getDeletedAt))
                .stream().collect(Collectors.groupingBy(TestPlanEntity::getVersionId, Collectors.counting()));

        return entities.stream().map(entity -> {
            WorkspaceEntity workspace = workspaceMap.get(entity.getWorkspaceId());
            if (workspace == null) workspace = workspaceSupport.requireReadableEntityWorkspace(null, entity.getWorkspaceId());
            UserEntity owner = users.get(entity.getOwnerId());
            return new TestVersionResponse(
                    entity.getId(), entity.getVersionNo(), entity.getName(), entity.getVersionType(), entity.getStatus(),
                    entity.getOwnerId(), owner == null ? null : owner.getDisplayName(),
                    entity.getStartDate(), entity.getTestDate(), entity.getReleaseDate(), entity.getGoal(),
                    requirementCounts.getOrDefault(entity.getId(), 0L), planCounts.getOrDefault(entity.getId(), 0L),
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
        if (target != VersionStatus.PENDING_RELEASE) return failures;

        List<TestPlanEntity> plans = planMapper.selectList(new LambdaQueryWrapper<TestPlanEntity>()
                .eq(TestPlanEntity::getVersionId, version.getId())
                .isNull(TestPlanEntity::getDeletedAt)
                .ne(TestPlanEntity::getStatus, PlanStatus.CANCELLED));
        if (plans.isEmpty()) {
            failures.add(failedCheck("COMPLETED_PLAN_COUNT", 1, 0));
            return failures;
        }
        long completedPlans = plans.stream().filter(plan -> plan.getStatus() == PlanStatus.COMPLETED).count();
        if (completedPlans != plans.size()) failures.add(failedCheck("ALL_PLANS_COMPLETED", plans.size(), completedPlans));

        for (TestPlanEntity plan : plans) {
            List<TestPlanCaseEntity> cases = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>()
                    .eq(TestPlanCaseEntity::getPlanId, plan.getId()));
            long executed = cases.stream().filter(item -> item.getExecutionStatus() != PlanCaseExecutionStatus.PENDING).count();
            long passed = cases.stream().filter(item -> item.getExecutionStatus() == PlanCaseExecutionStatus.PASSED).count();
            BigDecimal executeRate = rate(executed, cases.size());
            BigDecimal passRate = rate(passed, executed);
            if (executeRate.compareTo(plan.getMinExecuteRate()) < 0) {
                failures.add(failedCheck("PLAN_EXECUTION_RATE:" + plan.getId(), plan.getMinExecuteRate(), executeRate));
            }
            if (passRate.compareTo(plan.getMinPassRate()) < 0) {
                failures.add(failedCheck("PLAN_PASS_RATE:" + plan.getId(), plan.getMinPassRate(), passRate));
            }
            if (Boolean.TRUE.equals(plan.getOwnerConfirmRequired())) {
                long signed = planReportMapper.selectCount(new LambdaQueryWrapper<TestPlanReportEntity>()
                        .eq(TestPlanReportEntity::getPlanId, plan.getId())
                        .eq(TestPlanReportEntity::getStatus, PlanReportStatus.SIGNED));
                if (signed == 0) failures.add(failedCheck("PLAN_REPORT_SIGNED:" + plan.getId(), 1, 0));
            }
        }

        List<BugEntity> openBugs = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestVersionId, version.getId())
                .notIn(BugEntity::getStatus, "CLOSED", "REJECTED"));
        long p0 = openBugs.stream().filter(item -> "P0".equalsIgnoreCase(item.getPriority())).count();
        long p1 = openBugs.stream().filter(item -> "P1".equalsIgnoreCase(item.getPriority())).count();
        if (p0 > 0) failures.add(failedCheck("OPEN_P0_DEFECTS", 0, p0));
        int maxP1 = plans.stream().map(TestPlanEntity::getMaxP1).filter(Objects::nonNull).min(Integer::compareTo).orElse(0);
        if (p1 > maxP1) failures.add(failedCheck("OPEN_P1_DEFECTS", maxP1, p1));
        return failures;
    }

    private void requireTransitionReason(VersionStatus current, VersionStatus target, boolean force, String reason) {
        boolean backward = (current == VersionStatus.TESTING && target == VersionStatus.DEVELOPING)
                || (current == VersionStatus.PENDING_RELEASE && target == VersionStatus.TESTING);
        if ((backward || target == VersionStatus.RELEASED || target == VersionStatus.ARCHIVED || force)
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
