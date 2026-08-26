package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.casecenter.CaseService;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.JsonUtils;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.execution.ExecutionService;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BugDomainService {

    private static final int DEFAULT_PAGE_NO = 1;
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final BugMapper bugMapper;
    private final BugFlowMapper bugFlowMapper;
    private final BugCaseRelationMapper bugCaseRelationMapper;
    private final UserService userService;
    private final WorkspaceService workspaceService;
    private final CaseService caseService;
    private final ExecutionService executionService;

    public BugDomainService(
            BugMapper bugMapper,
            BugFlowMapper bugFlowMapper,
            BugCaseRelationMapper bugCaseRelationMapper,
            UserService userService,
            WorkspaceService workspaceService,
            CaseService caseService,
            ExecutionService executionService
    ) {
        this.bugMapper = bugMapper;
        this.bugFlowMapper = bugFlowMapper;
        this.bugCaseRelationMapper = bugCaseRelationMapper;
        this.userService = userService;
        this.workspaceService = workspaceService;
        this.caseService = caseService;
        this.executionService = executionService;
    }

    public PageResponse<BugEntity> listBugs(
            String workspaceCode,
            String keyword,
            String status,
            String severity,
            String priority,
            Integer pageNo,
            Integer pageSize
    ) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        int safePageNo = pageNo == null || pageNo < 1 ? DEFAULT_PAGE_NO : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : pageSize;

        LambdaQueryWrapper<BugEntity> query = new LambdaQueryWrapper<>();
        if (workspace != null) {
            query.eq(BugEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
            }
            query.in(BugEntity::getWorkspaceId, workspaceIds);
        }

        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(BugEntity::getBugNo, normalizedKeyword)
                    .or()
                    .like(BugEntity::getTitle, normalizedKeyword));
        }

        String normalizedStatus = blankToNull(status);
        if (normalizedStatus != null) {
            query.eq(BugEntity::getStatus, normalizeBugStatus(normalizedStatus));
        }

        String normalizedSeverity = blankToNull(severity);
        if (normalizedSeverity != null) {
            query.eq(BugEntity::getSeverity, normalizeBugSeverity(normalizedSeverity));
        }

        String normalizedPriority = blankToNull(priority);
        if (normalizedPriority != null) {
            query.eq(BugEntity::getPriority, normalizeBugPriority(normalizedPriority));
        }

        long total = bugMapper.selectCount(query);
        if (total == 0) {
            return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
        }

        int offset = (safePageNo - 1) * safePageSize;
        List<BugEntity> items = bugMapper.selectList(query
                .orderByDesc(BugEntity::getUpdatedAt)
                .orderByDesc(BugEntity::getId)
                .last("limit " + safePageSize + " offset " + offset));
        return PageResponse.of(items, total, safePageNo, safePageSize);
    }

    public BugEntity getBug(Long id, String workspaceCode) {
        BugEntity entity = requireBug(id);
        validateReadable(entity, workspaceCode);
        return entity;
    }

    public BugEntity createBug(String headerWorkspaceCode, CreateBugRequest request, BugSourceType sourceType) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (request.assigneeId() != null) {
            userService.requireUser(request.assigneeId());
        }
        if (request.relatedCaseId() != null) {
            caseService.requireCase(request.relatedCaseId());
        }
        if (request.relatedReportId() != null) {
            executionService.requireReport(request.relatedReportId());
        }

        BugEntity entity = new BugEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setBugNo(generateBugNo());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setReproductionSteps(request.reproductionSteps());
        entity.setExpectedResult(request.expectedResult());
        entity.setActualResult(request.actualResult());
        entity.setModuleName(request.moduleName());
        entity.setVersionName(request.versionName());
        entity.setPriority(request.priority().name());
        entity.setSeverity(request.severity().name());
        entity.setStatus(request.assigneeId() == null ? BugStatus.TODO.name() : BugStatus.ASSIGNED.name());
        entity.setSourceType(sourceType.name());
        entity.setAssigneeId(request.assigneeId());
        entity.setReporterId(CurrentUserContext.get());
        entity.setRelatedCaseId(request.relatedCaseId());
        entity.setRelatedReportId(request.relatedReportId());
        entity.setRelatedTaskId(request.relatedTaskId());
        entity.setTagsJson(JsonUtils.toJson(request.tags()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        bugMapper.insert(entity);
        replaceBugCaseRelations(entity, request.relatedCaseId() == null ? List.of() : List.of(request.relatedCaseId()));

        if (request.assigneeId() != null) {
            appendInitialFlow(entity.getId());
        }
        return requireBug(entity.getId());
    }

    public BugEntity updateBug(Long id, String headerWorkspaceCode, UpdateBugRequest request) {
        BugEntity entity = requireBug(id);
        validateReadable(entity, headerWorkspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("不允许修改缺陷所属空间");
        }
        if (request.assigneeId() != null) {
            userService.requireUser(request.assigneeId());
        }
        BugStatus currentStatus = BugStatus.valueOf(entity.getStatus());
        if ((currentStatus == BugStatus.ASSIGNED || currentStatus == BugStatus.IN_PROGRESS)
                && request.assigneeId() == null) {
            throw new BadRequestException("当前状态必须保留处理人");
        }
        if (request.relatedCaseId() != null) {
            caseService.requireCase(request.relatedCaseId());
        }
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setReproductionSteps(request.reproductionSteps());
        entity.setExpectedResult(request.expectedResult());
        entity.setActualResult(request.actualResult());
        entity.setModuleName(request.moduleName());
        entity.setVersionName(request.versionName());
        entity.setPriority(request.priority().name());
        entity.setSeverity(request.severity().name());
        entity.setSourceType(request.sourceType() == null ? entity.getSourceType() : request.sourceType().name());
        entity.setAssigneeId(request.assigneeId());
        entity.setRelatedCaseId(request.relatedCaseId());
        entity.setTagsJson(JsonUtils.toJson(request.tags()));
        entity.setUpdatedAt(LocalDateTime.now());
        bugMapper.update(
                null,
                new LambdaUpdateWrapper<BugEntity>()
                        .eq(BugEntity::getId, entity.getId())
                        .set(BugEntity::getTitle, entity.getTitle())
                        .set(BugEntity::getDescription, entity.getDescription())
                        .set(BugEntity::getReproductionSteps, entity.getReproductionSteps())
                        .set(BugEntity::getExpectedResult, entity.getExpectedResult())
                        .set(BugEntity::getActualResult, entity.getActualResult())
                        .set(BugEntity::getModuleName, entity.getModuleName())
                        .set(BugEntity::getVersionName, entity.getVersionName())
                        .set(BugEntity::getPriority, entity.getPriority())
                        .set(BugEntity::getSeverity, entity.getSeverity())
                        .set(BugEntity::getSourceType, entity.getSourceType())
                        .set(BugEntity::getAssigneeId, entity.getAssigneeId())
                        .set(BugEntity::getRelatedCaseId, entity.getRelatedCaseId())
                        .set(BugEntity::getTagsJson, entity.getTagsJson())
                        .set(BugEntity::getUpdatedAt, entity.getUpdatedAt())
        );
        replaceBugCaseRelations(entity, request.relatedCaseId() == null ? List.of() : List.of(request.relatedCaseId()));
        return entity;
    }

    public BugEntity replaceBugCases(Long id, String headerWorkspaceCode, List<Long> caseIds) {
        BugEntity entity = getBug(id, headerWorkspaceCode);
        requireWritableBug(entity);
        replaceBugCaseRelations(entity, caseIds);
        return requireBug(id);
    }

    public BugEntity deleteBugCase(Long id, String headerWorkspaceCode, Long caseId) {
        BugEntity entity = getBug(id, headerWorkspaceCode);
        requireWritableBug(entity);
        bugCaseRelationMapper.delete(new LambdaQueryWrapper<BugCaseRelationEntity>()
                .eq(BugCaseRelationEntity::getBugId, id)
                .eq(BugCaseRelationEntity::getCaseId, caseId));
        List<Long> remainingCaseIds = listBugCaseIds(id);
        syncPrimaryRelatedCaseId(entity, remainingCaseIds);
        return requireBug(id);
    }

    public BugStatisticsResponse statistics(String workspaceCode) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        LambdaQueryWrapper<BugEntity> query = new LambdaQueryWrapper<>();
        if (workspace != null) {
            query.eq(BugEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return new BugStatisticsResponse(0, 0, 0, 0, 0, 0, 0);
            }
            query.in(BugEntity::getWorkspaceId, workspaceIds);
        }
        List<BugEntity> scoped = bugMapper.selectList(query);
        return new BugStatisticsResponse(
                scoped.size(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.TODO).count(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.ASSIGNED).count(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.IN_PROGRESS).count(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.PENDING_VERIFY).count(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.CLOSED).count(),
                scoped.stream().filter(item -> BugStatus.valueOf(item.getStatus()) == BugStatus.REJECTED).count()
        );
    }

    public BugEntity requireBug(Long id) {
        BugEntity entity = bugMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("缺陷不存在");
        }
        return entity;
    }

    public void requireWritableBug(BugEntity entity) {
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
    }

    WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }

    void validateReadable(BugEntity entity, String workspaceCode) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null && !workspace.getId().equals(entity.getWorkspaceId())) {
            throw new BadRequestException("当前空间上下文不可访问该缺陷");
        }
        if (workspace == null && !workspaceService.isPlatformAdmin()
                && !workspaceService.listReadableWorkspaceIds().contains(entity.getWorkspaceId())) {
            throw new BadRequestException("当前空间上下文不可访问该缺陷");
        }
    }

    private void appendInitialFlow(Long bugId) {
        BugFlowEntity flow = new BugFlowEntity();
        flow.setBugId(bugId);
        flow.setFromStatus(BugStatus.TODO.name());
        flow.setToStatus(BugStatus.ASSIGNED.name());
        flow.setOperatorId(CurrentUserContext.get());
        flow.setActionComment("创建缺陷并分配处理人");
        flow.setCreatedAt(LocalDateTime.now());
        flow.setUpdatedAt(LocalDateTime.now());
        bugFlowMapper.insert(flow);
    }

    private void replaceBugCaseRelations(BugEntity entity, List<Long> rawCaseIds) {
        List<Long> caseIds = rawCaseIds == null ? List.of() : rawCaseIds.stream()
                .filter(item -> item != null)
                .distinct()
                .toList();

        for (Long caseId : caseIds) {
            caseService.requireCase(caseId);
        }

        bugCaseRelationMapper.delete(new LambdaQueryWrapper<BugCaseRelationEntity>()
                .eq(BugCaseRelationEntity::getBugId, entity.getId()));

        LocalDateTime now = LocalDateTime.now();
        Long currentUserId = CurrentUserContext.get();
        for (Long caseId : caseIds) {
            BugCaseRelationEntity relation = new BugCaseRelationEntity();
            relation.setBugId(entity.getId());
            relation.setCaseId(caseId);
            relation.setCreatedBy(currentUserId);
            relation.setCreatedAt(now);
            relation.setUpdatedAt(now);
            bugCaseRelationMapper.insert(relation);
        }

        syncPrimaryRelatedCaseId(entity, caseIds);
    }

    private void syncPrimaryRelatedCaseId(BugEntity entity, List<Long> caseIds) {
        Long primaryCaseId = caseIds.isEmpty() ? null : caseIds.getFirst();
        entity.setRelatedCaseId(primaryCaseId);
        entity.setUpdatedAt(LocalDateTime.now());
        bugMapper.update(
                null,
                new LambdaUpdateWrapper<BugEntity>()
                        .eq(BugEntity::getId, entity.getId())
                        .set(BugEntity::getRelatedCaseId, primaryCaseId)
                        .set(BugEntity::getUpdatedAt, entity.getUpdatedAt())
        );
    }

    private List<Long> listBugCaseIds(Long bugId) {
        return bugCaseRelationMapper.selectList(new LambdaQueryWrapper<BugCaseRelationEntity>()
                        .eq(BugCaseRelationEntity::getBugId, bugId)
                        .orderByAsc(BugCaseRelationEntity::getId))
                .stream()
                .map(BugCaseRelationEntity::getCaseId)
                .toList();
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeBugStatus(String status) {
        try {
            return BugStatus.valueOf(status.trim().toUpperCase()).name();
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("缺陷状态不合法");
        }
    }

    private String normalizeBugSeverity(String severity) {
        try {
            return BugSeverity.valueOf(severity.trim().toUpperCase()).name();
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("严重级别不合法");
        }
    }

    private String normalizeBugPriority(String priority) {
        try {
            return BugPriority.valueOf(priority.trim().toUpperCase()).name();
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("优先级不合法");
        }
    }

    private String generateBugNo() {
        int nextNumber = bugMapper.selectList(new LambdaQueryWrapper<BugEntity>()).stream()
                .map(BugEntity::getBugNo)
                .map(this::parseBugSequence)
                .max(Integer::compareTo)
                .orElse(0) + 1;
        return "BUG-" + String.format("%03d", nextNumber);
    }

    private int parseBugSequence(String bugNo) {
        if (bugNo == null || !bugNo.startsWith("BUG-")) {
            return 0;
        }
        String suffix = bugNo.substring(4);
        for (int i = 0; i < suffix.length(); i++) {
            if (!Character.isDigit(suffix.charAt(i))) {
                return 0;
            }
        }
        try {
            return Integer.parseInt(suffix);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}
