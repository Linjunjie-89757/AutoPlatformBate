package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.bug.BugEntity;
import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseMapper;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
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
public class TestRequirementService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final TestRequirementMapper requirementMapper;
    private final TestRequirementCaseMapper requirementCaseMapper;
    private final TestVersionMapper versionMapper;
    private final TestPlanMapper planMapper;
    private final TestPlanCaseRequirementMapper planCaseRequirementMapper;
    private final TestPlanCaseMapper planCaseMapper;
    private final CaseMapper caseMapper;
    private final BugMapper bugMapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final TestManagementWorkspaceSupport workspaceSupport;
    private final TestActivityLogService activityLogService;

    public TestRequirementService(
            TestRequirementMapper requirementMapper,
            TestRequirementCaseMapper requirementCaseMapper,
            TestVersionMapper versionMapper,
            TestPlanMapper planMapper,
            TestPlanCaseRequirementMapper planCaseRequirementMapper,
            TestPlanCaseMapper planCaseMapper,
            CaseMapper caseMapper,
            BugMapper bugMapper,
            UserMapper userMapper,
            UserService userService,
            TestManagementWorkspaceSupport workspaceSupport,
            TestActivityLogService activityLogService
    ) {
        this.requirementMapper = requirementMapper;
        this.requirementCaseMapper = requirementCaseMapper;
        this.versionMapper = versionMapper;
        this.planMapper = planMapper;
        this.planCaseRequirementMapper = planCaseRequirementMapper;
        this.planCaseMapper = planCaseMapper;
        this.caseMapper = caseMapper;
        this.bugMapper = bugMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.workspaceSupport = workspaceSupport;
        this.activityLogService = activityLogService;
    }

    public PageResponse<TestRequirementResponse> list(
            String workspaceCode,
            Long versionId,
            String keyword,
            String qualityStatus,
            String priority,
            String sourceType,
            String reviewStatus,
            Long assigneeId,
            Integer pageNo,
            Integer pageSize
    ) {
        TestManagementWorkspaceScope scope = workspaceSupport.requireReadScope(workspaceCode);
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        if (scope.workspaceIds().isEmpty()) return PageResponse.of(List.of(), 0, safePageNo, safePageSize);

        LambdaQueryWrapper<TestRequirementEntity> query = new LambdaQueryWrapper<TestRequirementEntity>()
                .in(TestRequirementEntity::getWorkspaceId, scope.workspaceIds())
                .isNull(TestRequirementEntity::getDeletedAt);
        if (versionId != null) query.eq(TestRequirementEntity::getVersionId, versionId);
        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(item -> item.like(TestRequirementEntity::getTitle, normalizedKeyword)
                    .or().like(TestRequirementEntity::getRequirementNo, normalizedKeyword));
        }
        RequirementPriority normalizedPriority = parseEnum(priority, RequirementPriority.class, "需求优先级");
        if (normalizedPriority != null) query.eq(TestRequirementEntity::getPriority, normalizedPriority);
        RequirementSourceType normalizedSource = parseEnum(sourceType, RequirementSourceType.class, "需求来源");
        if (normalizedSource != null) query.eq(TestRequirementEntity::getSourceType, normalizedSource);
        if (assigneeId != null) query.eq(TestRequirementEntity::getAssigneeId, assigneeId);
        applyReviewStatusFilter(query, reviewStatus);
        applyQualityStatusFilter(query, qualityStatus);

        Page<TestRequirementEntity> page = requirementMapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByDesc(TestRequirementEntity::getUpdatedAt).orderByDesc(TestRequirementEntity::getId)
        );
        return PageResponse.of(
                assemble(page.getRecords(), scope.workspaces()),
                page.getTotal(), page.getCurrent(), page.getSize()
        );
    }

    public TestRequirementResponse get(Long id, String workspaceCode) {
        TestRequirementEntity entity = requireReadable(id, workspaceCode);
        WorkspaceEntity workspace = workspaceSupport.requireReadableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return assemble(List.of(entity), Map.of(workspace.getId(), workspace)).getFirst();
    }

    @Transactional
    public TestRequirementResponse create(String workspaceCode, CreateTestRequirementRequest request) {
        WorkspaceEntity workspace = workspaceSupport.requireWritableWorkspace(workspaceCode);
        TestVersionEntity version = requireEditableVersion(request.versionId(), workspace.getId());
        requireActiveUser(request.assigneeId());

        Long currentUserId = CurrentUserContext.get();
        LocalDateTime now = LocalDateTime.now();
        TestRequirementEntity entity = new TestRequirementEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setRequirementNo("REQ-TMP-" + java.util.UUID.randomUUID().toString().substring(0, 8));
        entity.setVersionId(version.getId());
        entity.setTitle(request.title().trim());
        entity.setPriority(request.priority());
        entity.setSourceType(request.sourceType());
        entity.setSourceRef(blankToNull(request.sourceRef()));
        entity.setAssigneeId(request.assigneeId());
        entity.setDescription(blankToNull(request.description()));
        entity.setLockVersion(0);
        entity.setCreatedBy(currentUserId);
        entity.setUpdatedBy(currentUserId);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        try {
            requirementMapper.insert(entity);
            String requirementNo = "REQ-" + String.format("%06d", entity.getId());
            requirementMapper.update(null, new LambdaUpdateWrapper<TestRequirementEntity>()
                    .eq(TestRequirementEntity::getId, entity.getId())
                    .set(TestRequirementEntity::getRequirementNo, requirementNo));
            entity.setRequirementNo(requirementNo);
        } catch (DuplicateKeyException exception) {
            throw TestManagementException.validation("需求编号生成冲突，请重试");
        }
        activityLogService.record(
                workspace.getId(), ActivityEntityType.REQUIREMENT, entity.getId(),
                "REQUIREMENT_CREATED", "创建需求", Map.of("requirementNo", entity.getRequirementNo(), "title", entity.getTitle())
        );
        return get(entity.getId(), workspace.getWorkspaceCode());
    }

    @Transactional
    public TestRequirementResponse update(Long id, String workspaceCode, UpdateTestRequirementRequest request) {
        TestRequirementEntity entity = requireWritable(id, workspaceCode);
        requireExpectedVersion(entity.getLockVersion(), request.expectedVersion());
        requireEditableVersion(entity.getVersionId(), entity.getWorkspaceId());
        if (!Objects.equals(entity.getVersionId(), request.versionId())) {
            requireEditableVersion(request.versionId(), entity.getWorkspaceId());
            requireMovableRequirement(id);
        }
        requireActiveUser(request.assigneeId());
        String beforeTitle = entity.getTitle();

        entity.setVersionId(request.versionId());
        entity.setTitle(request.title().trim());
        entity.setPriority(request.priority());
        entity.setSourceType(request.sourceType());
        entity.setSourceRef(blankToNull(request.sourceRef()));
        entity.setAssigneeId(request.assigneeId());
        entity.setDescription(blankToNull(request.description()));
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setLockVersion(request.expectedVersion());
        updateWithOptimisticLock(entity);
        activityLogService.record(
                entity.getWorkspaceId(), ActivityEntityType.REQUIREMENT, entity.getId(),
                "REQUIREMENT_UPDATED", "更新需求", Map.of("beforeTitle", beforeTitle, "afterTitle", entity.getTitle())
        );
        return get(id, workspaceCode);
    }

    @Transactional
    public void delete(Long id, String workspaceCode, Integer expectedVersion) {
        TestRequirementEntity entity = requireWritable(id, workspaceCode);
        requireExpectedVersion(entity.getLockVersion(), expectedVersion);
        requireEditableVersion(entity.getVersionId(), entity.getWorkspaceId());
        if (planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getRequirementId, id)) > 0) {
            throw TestManagementException.snapshotLocked("需求已进入测试计划快照，不允许删除");
        }
        if (bugMapper.selectCount(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestRequirementId, id)) > 0) {
            throw TestManagementException.snapshotLocked("需求已有缺陷追溯记录，不允许删除");
        }
        entity.setDeletedAt(LocalDateTime.now());
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setLockVersion(expectedVersion);
        updateWithOptimisticLock(entity);
        activityLogService.record(
                entity.getWorkspaceId(), ActivityEntityType.REQUIREMENT, entity.getId(),
                "REQUIREMENT_DELETED", "删除需求", Map.of("requirementNo", entity.getRequirementNo())
        );
    }

    @Transactional
    public TestRequirementResponse replaceCases(Long id, String workspaceCode, ReplaceRequirementCasesRequest request) {
        TestRequirementEntity requirement = requireWritable(id, workspaceCode);
        requireExpectedVersion(requirement.getLockVersion(), request.expectedVersion());
        requireEditableVersion(requirement.getVersionId(), requirement.getWorkspaceId());
        List<Long> requestedIds = distinctIds(request.caseIds());
        List<CaseEntity> cases = requestedIds.isEmpty() ? List.of() : caseMapper.selectBatchIds(requestedIds);
        if (cases.size() != requestedIds.size() || cases.stream().anyMatch(item -> !requirement.getWorkspaceId().equals(item.getWorkspaceId()))) {
            throw TestManagementException.validation("只能关联当前工作区内的用例");
        }

        List<TestRequirementCaseEntity> existing = requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                .eq(TestRequirementCaseEntity::getRequirementId, id));
        Set<Long> existingCaseIds = existing.stream().map(TestRequirementCaseEntity::getCaseId).collect(Collectors.toSet());
        Set<Long> requestedSet = new LinkedHashSet<>(requestedIds);
        Set<Long> removed = existingCaseIds.stream().filter(caseId -> !requestedSet.contains(caseId)).collect(Collectors.toSet());
        if (!removed.isEmpty() && planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getRequirementId, id)) > 0) {
            throw TestManagementException.snapshotLocked("需求用例已进入测试计划快照，不允许解除关联");
        }
        LocalDateTime now = LocalDateTime.now();
        Long currentUserId = CurrentUserContext.get();
        Map<Long, TestRequirementCaseEntity> existingByCase = existing.stream()
                .collect(Collectors.toMap(TestRequirementCaseEntity::getCaseId, Function.identity()));
        for (Long caseId : requestedIds) {
            if (existingByCase.containsKey(caseId)) continue;
            TestRequirementCaseEntity relation = new TestRequirementCaseEntity();
            relation.setWorkspaceId(requirement.getWorkspaceId());
            relation.setRequirementId(id);
            relation.setCaseId(caseId);
            relation.setReviewStatus(RequirementReviewStatus.PENDING);
            relation.setCreatedBy(currentUserId);
            relation.setCreatedAt(now);
            relation.setUpdatedAt(now);
            requirementCaseMapper.insert(relation);
        }
        if (!removed.isEmpty()) {
            requirementCaseMapper.delete(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                    .eq(TestRequirementCaseEntity::getRequirementId, id)
                    .in(TestRequirementCaseEntity::getCaseId, removed));
        }
        touchRequirement(requirement, request.expectedVersion());
        activityLogService.record(
                requirement.getWorkspaceId(), ActivityEntityType.REQUIREMENT, id,
                "REQUIREMENT_CASES_REPLACED", "调整关联用例", Map.of("caseIds", requestedIds)
        );
        return get(id, workspaceCode);
    }

    @Transactional
    public TestRequirementResponse startReview(Long id, String workspaceCode, StartRequirementReviewRequest request) {
        TestRequirementEntity requirement = requireWritable(id, workspaceCode);
        requireExpectedVersion(requirement.getLockVersion(), request.expectedVersion());
        requireEditableVersion(requirement.getVersionId(), requirement.getWorkspaceId());
        List<TestRequirementCaseEntity> relations = relations(id);
        if (relations.isEmpty()) throw TestManagementException.reviewRequired("请先关联至少一个用例", Map.of("requirementId", id));
        Map<Long, CaseEntity> cases = loadCases(relations.stream().map(TestRequirementCaseEntity::getCaseId).toList());
        LocalDateTime now = LocalDateTime.now();
        boolean changed = false;
        for (TestRequirementCaseEntity relation : relations) {
            CaseEntity testCase = cases.get(relation.getCaseId());
            boolean outdated = relation.getReviewStatus() == RequirementReviewStatus.PASSED
                    && testCase != null && testCase.getUpdatedAt() != null
                    && (relation.getCaseUpdatedAtWhenReviewed() == null || testCase.getUpdatedAt().isAfter(relation.getCaseUpdatedAtWhenReviewed()));
            if (relation.getReviewStatus() != RequirementReviewStatus.PASSED || outdated) {
                relation.setReviewStatus(RequirementReviewStatus.REVIEWING);
                relation.setUpdatedAt(now);
                requirementCaseMapper.updateById(relation);
                changed = true;
            }
        }
        if (!changed) {
            throw TestManagementException.reviewRequired("没有需要重新评审的用例", Map.of("requirementId", id));
        }
        touchRequirement(requirement, request.expectedVersion());
        activityLogService.record(
                requirement.getWorkspaceId(), ActivityEntityType.REQUIREMENT, id,
                "REQUIREMENT_REVIEW_STARTED", "发起需求用例评审", null
        );
        return get(id, workspaceCode);
    }

    @Transactional
    public TestRequirementResponse reviewCase(
            Long id,
            Long caseId,
            String workspaceCode,
            ReviewRequirementCaseRequest request
    ) {
        TestRequirementEntity requirement = requireWritable(id, workspaceCode);
        requireExpectedVersion(requirement.getLockVersion(), request.expectedVersion());
        requireEditableVersion(requirement.getVersionId(), requirement.getWorkspaceId());
        if (request.decision() != RequirementReviewStatus.PASSED && request.decision() != RequirementReviewStatus.REJECTED) {
            throw TestManagementException.validation("评审结论只能是通过或驳回");
        }
        if (request.decision() == RequirementReviewStatus.REJECTED && blankToNull(request.comment()) == null) {
            throw TestManagementException.validation("驳回评审必须填写原因");
        }
        TestRequirementCaseEntity relation = requirementCaseMapper.selectOne(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                .eq(TestRequirementCaseEntity::getRequirementId, id)
                .eq(TestRequirementCaseEntity::getCaseId, caseId));
        if (relation == null) throw TestManagementException.notFound("需求关联用例", caseId);
        if (relation.getReviewStatus() != RequirementReviewStatus.REVIEWING) {
            throw TestManagementException.invalidTransition("需求用例评审", relation.getReviewStatus(), request.decision());
        }
        CaseEntity testCase = caseMapper.selectById(caseId);
        if (testCase == null || !requirement.getWorkspaceId().equals(testCase.getWorkspaceId())) {
            throw TestManagementException.notFound("用例", caseId);
        }
        relation.setReviewStatus(request.decision());
        relation.setReviewNote(blankToNull(request.comment()));
        relation.setReviewerId(CurrentUserContext.get());
        relation.setReviewedAt(LocalDateTime.now());
        relation.setCaseUpdatedAtWhenReviewed(testCase.getUpdatedAt());
        relation.setUpdatedAt(LocalDateTime.now());
        requirementCaseMapper.updateById(relation);
        touchRequirement(requirement, request.expectedVersion());
        activityLogService.record(
                requirement.getWorkspaceId(), ActivityEntityType.REQUIREMENT, id,
                "REQUIREMENT_CASE_REVIEWED", "评审需求用例", Map.of("caseId", caseId, "decision", request.decision())
        );
        return get(id, workspaceCode);
    }

    public PageResponse<TestActivityItem> listActivities(Long id, String workspaceCode, Integer pageNo, Integer pageSize) {
        TestRequirementEntity entity = requireReadable(id, workspaceCode);
        return activityLogService.list(entity.getWorkspaceId(), ActivityEntityType.REQUIREMENT, id, pageNo, pageSize);
    }

    TestRequirementEntity requireReadable(Long id, String workspaceCode) {
        TestRequirementEntity entity = requirementMapper.selectById(id);
        if (entity == null || entity.getDeletedAt() != null) throw TestManagementException.notFound("需求", id);
        workspaceSupport.requireReadableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return entity;
    }

    TestRequirementEntity requireWritable(Long id, String workspaceCode) {
        TestRequirementEntity entity = requireReadable(id, workspaceCode);
        workspaceSupport.requireWritableEntityWorkspace(workspaceCode, entity.getWorkspaceId());
        return entity;
    }

    private List<TestRequirementResponse> assemble(List<TestRequirementEntity> entities, Map<Long, WorkspaceEntity> workspaceMap) {
        if (entities.isEmpty()) return List.of();
        List<Long> requirementIds = entities.stream().map(TestRequirementEntity::getId).toList();
        List<TestRequirementCaseEntity> relations = requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                .in(TestRequirementCaseEntity::getRequirementId, requirementIds));
        Map<Long, List<TestRequirementCaseEntity>> relationsByRequirement = relations.stream()
                .collect(Collectors.groupingBy(TestRequirementCaseEntity::getRequirementId, LinkedHashMap::new, Collectors.toList()));
        Map<Long, CaseEntity> cases = loadCases(relations.stream().map(TestRequirementCaseEntity::getCaseId).toList());
        List<Long> userIds = java.util.stream.Stream.concat(
                        entities.stream().map(TestRequirementEntity::getAssigneeId),
                        relations.stream().map(TestRequirementCaseEntity::getReviewerId))
                .filter(Objects::nonNull)
                .toList();
        Map<Long, UserEntity> users = loadUsers(userIds);
        Map<Long, TestVersionEntity> versions = versionMapper.selectBatchIds(entities.stream().map(TestRequirementEntity::getVersionId).distinct().toList())
                .stream().collect(Collectors.toMap(TestVersionEntity::getId, Function.identity()));
        Map<Long, Long> defectCounts = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()
                        .in(BugEntity::getTestRequirementId, requirementIds))
                .stream().collect(Collectors.groupingBy(BugEntity::getTestRequirementId, Collectors.counting()));
        Map<Long, Set<Long>> passedPlanCases = loadPassedPlanCases(requirementIds);

        return entities.stream().map(entity -> {
            List<TestRequirementCaseEntity> requirementRelations = relationsByRequirement.getOrDefault(entity.getId(), List.of());
            List<RequirementCaseResponse> relationResponses = requirementRelations.stream().map(relation -> {
                CaseEntity testCase = cases.get(relation.getCaseId());
                UserEntity reviewer = relation.getReviewerId() == null ? null : users.get(relation.getReviewerId());
                boolean outdated = relation.getReviewStatus() == RequirementReviewStatus.PASSED
                        && testCase != null && testCase.getUpdatedAt() != null
                        && (relation.getCaseUpdatedAtWhenReviewed() == null || testCase.getUpdatedAt().isAfter(relation.getCaseUpdatedAtWhenReviewed()));
                return new RequirementCaseResponse(
                        relation.getId(), relation.getCaseId(), testCase == null ? null : testCase.getCaseNo(),
                        testCase == null ? null : testCase.getTitle(), testCase == null ? null : testCase.getPriority(),
                        relation.getReviewStatus(), relation.getReviewNote(), relation.getReviewerId(),
                        reviewer == null ? null : reviewer.getDisplayName(), relation.getReviewedAt(), outdated
                );
            }).toList();
            UserEntity assignee = entity.getAssigneeId() == null ? null : users.get(entity.getAssigneeId());
            TestVersionEntity version = versions.get(entity.getVersionId());
            WorkspaceEntity workspace = workspaceMap.get(entity.getWorkspaceId());
            String reviewStatus = aggregateReviewStatus(requirementRelations);
            String qualityStatus = qualityStatus(requirementRelations, passedPlanCases.getOrDefault(entity.getId(), Set.of()));
            int reviewed = (int) requirementRelations.stream().filter(item -> item.getReviewStatus() == RequirementReviewStatus.PASSED || item.getReviewStatus() == RequirementReviewStatus.REJECTED).count();
            int passed = (int) requirementRelations.stream().filter(item -> item.getReviewStatus() == RequirementReviewStatus.PASSED).count();
            return new TestRequirementResponse(
                    entity.getId(), entity.getRequirementNo(), entity.getVersionId(), version == null ? null : version.getName(),
                    entity.getTitle(), entity.getPriority(), entity.getSourceType(), entity.getSourceRef(),
                    entity.getAssigneeId(), assignee == null ? null : assignee.getDisplayName(), entity.getDescription(),
                    qualityStatus, RequirementReviewStatus.valueOf(reviewStatus), requirementRelations.size(), reviewed, passed,
                    defectCounts.getOrDefault(entity.getId(), 0L), entity.getLockVersion(),
                    workspace == null ? null : workspace.getWorkspaceCode(), workspace == null ? null : workspace.getWorkspaceName(),
                    entity.getCreatedBy(), entity.getCreatedAt(), entity.getUpdatedBy(), entity.getUpdatedAt(), relationResponses
            );
        }).toList();
    }

    private void applyReviewStatusFilter(LambdaQueryWrapper<TestRequirementEntity> query, String reviewStatus) {
        RequirementReviewStatus normalized = parseEnum(reviewStatus, RequirementReviewStatus.class, "评审状态");
        if (normalized == null) return;
        String table = "tb_test_requirement.id";
        switch (normalized) {
            case PENDING -> query.apply("NOT EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = " + table + ")");
            case REJECTED -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = " + table + " AND rc.review_status = 'REJECTED')");
            case REVIEWING -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = " + table + " AND rc.review_status IN ('PENDING','REVIEWING'))");
            case PASSED -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = " + table + ") AND NOT EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = " + table + " AND rc.review_status <> 'PASSED')");
        }
    }

    private void applyQualityStatusFilter(LambdaQueryWrapper<TestRequirementEntity> query, String qualityStatus) {
        String normalized = blankToNull(qualityStatus);
        if (normalized == null || "ALL".equalsIgnoreCase(normalized)) return;
        switch (normalized.toUpperCase(Locale.ROOT)) {
            case "UNCOVERED" -> query.apply("NOT EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id)");
            case "PARTIAL" -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id AND rc.review_status <> 'PASSED')");
            case "COVERED" -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id) AND NOT EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id AND rc.review_status <> 'PASSED') AND EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id AND NOT " + latestExecutionPassedSql() + ")");
            case "PASSED" -> query.apply("EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id) AND NOT EXISTS (SELECT 1 FROM tb_test_requirement_case rc WHERE rc.requirement_id = tb_test_requirement.id AND (rc.review_status <> 'PASSED' OR NOT " + latestExecutionPassedSql() + "))");
            default -> throw TestManagementException.validation("需求状态不合法: " + qualityStatus);
        }
    }

    private String latestExecutionPassedSql() {
        return "EXISTS (SELECT 1 FROM tb_test_plan_case_requirement pcr "
                + "JOIN tb_test_plan_case pc ON pc.id = pcr.plan_case_id "
                + "JOIN tb_test_plan p ON p.id = pc.plan_id "
                + "WHERE pcr.requirement_id = tb_test_requirement.id "
                + "AND pc.source_case_id = rc.case_id "
                + "AND p.status <> 'CANCELLED' "
                + "AND pc.execution_status = 'PASSED' "
                + "AND NOT EXISTS (SELECT 1 FROM tb_test_plan_case_requirement latest_pcr "
                + "JOIN tb_test_plan_case latest_pc ON latest_pc.id = latest_pcr.plan_case_id "
                + "JOIN tb_test_plan latest_p ON latest_p.id = latest_pc.plan_id "
                + "WHERE latest_pcr.requirement_id = tb_test_requirement.id "
                + "AND latest_pc.source_case_id = rc.case_id "
                + "AND latest_p.status <> 'CANCELLED' "
                + "AND latest_pc.execution_status <> 'PENDING' "
                + "AND (COALESCE(latest_pc.executed_at, latest_pc.updated_at, latest_pc.created_at) "
                + "> COALESCE(pc.executed_at, pc.updated_at, pc.created_at) "
                + "OR (COALESCE(latest_pc.executed_at, latest_pc.updated_at, latest_pc.created_at) "
                + "= COALESCE(pc.executed_at, pc.updated_at, pc.created_at) AND latest_pc.id > pc.id))))";
    }

    private Map<Long, Set<Long>> loadPassedPlanCases(List<Long> requirementIds) {
        if (requirementIds.isEmpty()) return Map.of();
        List<TestPlanCaseRequirementEntity> links = planCaseRequirementMapper.selectList(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .in(TestPlanCaseRequirementEntity::getRequirementId, requirementIds));
        if (links.isEmpty()) return Map.of();
        Set<Long> planCaseIds = links.stream().map(TestPlanCaseRequirementEntity::getPlanCaseId).collect(Collectors.toSet());
        List<TestPlanCaseEntity> executedPlanCases = planCaseMapper.selectList(new LambdaQueryWrapper<TestPlanCaseEntity>()
                        .in(TestPlanCaseEntity::getId, planCaseIds)
                        .ne(TestPlanCaseEntity::getExecutionStatus, PlanCaseExecutionStatus.PENDING));
        if (executedPlanCases.isEmpty()) return Map.of();
        Set<Long> activePlanIds = planMapper.selectList(new LambdaQueryWrapper<TestPlanEntity>()
                        .in(TestPlanEntity::getId, executedPlanCases.stream().map(TestPlanCaseEntity::getPlanId).distinct().toList())
                        .ne(TestPlanEntity::getStatus, PlanStatus.CANCELLED))
                .stream().map(TestPlanEntity::getId).collect(Collectors.toSet());
        Map<Long, TestPlanCaseEntity> activeExecutionById = executedPlanCases.stream()
                .filter(planCase -> activePlanIds.contains(planCase.getPlanId()))
                .collect(Collectors.toMap(TestPlanCaseEntity::getId, Function.identity()));
        Map<RequirementSourceCaseKey, TestPlanCaseEntity> latestExecutions = new HashMap<>();
        for (TestPlanCaseRequirementEntity link : links) {
            TestPlanCaseEntity execution = activeExecutionById.get(link.getPlanCaseId());
            if (execution == null) continue;
            RequirementSourceCaseKey key = new RequirementSourceCaseKey(link.getRequirementId(), execution.getSourceCaseId());
            latestExecutions.merge(key, execution, this::laterExecution);
        }
        Map<Long, Set<Long>> passedCases = new HashMap<>();
        latestExecutions.forEach((key, execution) -> {
            if (execution.getExecutionStatus() == PlanCaseExecutionStatus.PASSED) {
                passedCases.computeIfAbsent(key.requirementId(), ignored -> new LinkedHashSet<>()).add(key.sourceCaseId());
            }
        });
        return passedCases;
    }

    private TestPlanCaseEntity laterExecution(TestPlanCaseEntity left, TestPlanCaseEntity right) {
        LocalDateTime leftTime = executionTime(left);
        LocalDateTime rightTime = executionTime(right);
        int timeComparison = leftTime.compareTo(rightTime);
        if (timeComparison != 0) return timeComparison > 0 ? left : right;
        return left.getId() >= right.getId() ? left : right;
    }

    private LocalDateTime executionTime(TestPlanCaseEntity entity) {
        if (entity.getExecutedAt() != null) return entity.getExecutedAt();
        if (entity.getUpdatedAt() != null) return entity.getUpdatedAt();
        return entity.getCreatedAt();
    }

    private record RequirementSourceCaseKey(Long requirementId, Long sourceCaseId) {
    }

    private String qualityStatus(List<TestRequirementCaseEntity> relations, Set<Long> passedPlanCaseIds) {
        if (relations.isEmpty()) return "UNCOVERED";
        if (relations.stream().anyMatch(item -> item.getReviewStatus() != RequirementReviewStatus.PASSED)) return "PARTIAL";
        if (passedPlanCaseIds.size() < relations.size()) return "COVERED";
        return "PASSED";
    }

    private String aggregateReviewStatus(List<TestRequirementCaseEntity> relations) {
        if (relations.isEmpty()) return RequirementReviewStatus.PENDING.name();
        if (relations.stream().anyMatch(item -> item.getReviewStatus() == RequirementReviewStatus.REJECTED)) return RequirementReviewStatus.REJECTED.name();
        if (relations.stream().anyMatch(item -> item.getReviewStatus() == RequirementReviewStatus.PENDING || item.getReviewStatus() == RequirementReviewStatus.REVIEWING)) return RequirementReviewStatus.REVIEWING.name();
        return RequirementReviewStatus.PASSED.name();
    }

    private List<TestRequirementCaseEntity> relations(Long requirementId) {
        return requirementCaseMapper.selectList(new LambdaQueryWrapper<TestRequirementCaseEntity>()
                .eq(TestRequirementCaseEntity::getRequirementId, requirementId)
                .orderByAsc(TestRequirementCaseEntity::getId));
    }

    private Map<Long, CaseEntity> loadCases(Collection<Long> ids) {
        List<Long> distinct = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        return caseMapper.selectBatchIds(distinct).stream().collect(Collectors.toMap(CaseEntity::getId, Function.identity()));
    }

    private Map<Long, UserEntity> loadUsers(Collection<Long> ids) {
        List<Long> distinct = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(distinct).stream().collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private TestVersionEntity requireEditableVersion(Long versionId, Long workspaceId) {
        TestVersionEntity version = versionMapper.selectById(versionId);
        if (version == null || !workspaceId.equals(version.getWorkspaceId())) throw TestManagementException.notFound("版本", versionId);
        if (version.getStatus() == VersionStatus.RELEASED || version.getStatus() == VersionStatus.ARCHIVED) {
            throw TestManagementException.snapshotLocked("已发布或已归档版本不可修改需求");
        }
        return version;
    }

    private void requireMovableRequirement(Long requirementId) {
        if (planCaseRequirementMapper.selectCount(new LambdaQueryWrapper<TestPlanCaseRequirementEntity>()
                .eq(TestPlanCaseRequirementEntity::getRequirementId, requirementId)) > 0) {
            throw TestManagementException.snapshotLocked("需求已进入测试计划快照，不允许更换版本");
        }
        if (bugMapper.selectCount(new LambdaQueryWrapper<BugEntity>()
                .eq(BugEntity::getTestRequirementId, requirementId)) > 0) {
            throw TestManagementException.snapshotLocked("需求已有缺陷追溯记录，不允许更换版本");
        }
    }

    private void requireActiveUser(Long userId) {
        if (userId != null && userService.findActiveUser(userId) == null) {
            throw TestManagementException.validation("负责人不存在或已停用", Map.of("userId", userId));
        }
    }

    private void touchRequirement(TestRequirementEntity entity, Integer expectedVersion) {
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setLockVersion(expectedVersion);
        updateWithOptimisticLock(entity);
    }

    private void updateWithOptimisticLock(TestRequirementEntity entity) {
        if (requirementMapper.updateById(entity) == 0) {
            throw TestManagementException.conflict("需求已被其他用户修改，请重新加载", Map.of("id", entity.getId()));
        }
    }

    private void requireExpectedVersion(Integer actual, Integer expected) {
        if (!Objects.equals(actual, expected)) {
            throw TestManagementException.conflict("需求已被其他用户修改，请重新加载", Map.of("expectedVersion", expected, "actualVersion", actual));
        }
    }

    private List<Long> distinctIds(List<Long> ids) {
        if (ids == null) return List.of();
        return new ArrayList<>(new LinkedHashSet<>(ids));
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
