package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class CaseDomainService {
    private static final int DEFAULT_PAGE_NO = 1;
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final Pattern CASE_NO_PATTERN = Pattern.compile("^CASE-(\\d+)$", Pattern.CASE_INSENSITIVE);

    private final CaseMapper caseMapper;
    private final CaseDirectoryMapper caseDirectoryMapper;
    private final CaseExecutionAttachmentMapper caseExecutionAttachmentMapper;
    private final CaseExecutionAttachmentSupport caseExecutionAttachmentSupport;
    private final UserMapper userMapper;
    private final UserService userService;
    private final WorkspaceService workspaceService;

    CaseDomainService(
            CaseMapper caseMapper,
            CaseDirectoryMapper caseDirectoryMapper,
            CaseExecutionAttachmentMapper caseExecutionAttachmentMapper,
            CaseExecutionAttachmentSupport caseExecutionAttachmentSupport,
            UserMapper userMapper,
            UserService userService,
            WorkspaceService workspaceService
    ) {
        this.caseMapper = caseMapper;
        this.caseDirectoryMapper = caseDirectoryMapper;
        this.caseExecutionAttachmentMapper = caseExecutionAttachmentMapper;
        this.caseExecutionAttachmentSupport = caseExecutionAttachmentSupport;
        this.userMapper = userMapper;
        this.userService = userService;
        this.workspaceService = workspaceService;
    }

    public PageResponse<CaseSummaryResponse> listCases(
            String workspaceCode,
            Integer pageNo,
            Integer pageSize,
            Long directoryId,
            String keyword,
            String priority,
            String reviewStatus,
            String executionStatus,
            String sourceType,
            String createdByName
    ) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        int safePageNo = pageNo == null || pageNo < 1 ? DEFAULT_PAGE_NO : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : pageSize;

        LambdaQueryWrapper<CaseEntity> query = new LambdaQueryWrapper<>();
        if (!WorkspaceScope.isAll(normalized)) {
            WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
            query.eq(CaseEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
            }
            query.in(CaseEntity::getWorkspaceId, workspaceIds);
        }

        if (directoryId != null) {
            CaseDirectoryEntity directory = requireDirectory(directoryId);
            validateDirectoryReadable(directory, workspaceCode);
            Set<Long> directoryIds = collectDescendantIds(directory.getWorkspaceId(), directory.getId());
            query.in(CaseEntity::getCaseDirectoryId, directoryIds);
        }

        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(CaseEntity::getCaseNo, normalizedKeyword)
                    .or()
                    .like(CaseEntity::getTitle, normalizedKeyword));
        }

        String normalizedPriority = blankToNull(priority);
        if (normalizedPriority != null) {
            query.eq(CaseEntity::getPriority, normalizedPriority.toUpperCase());
        }

        String normalizedReviewStatus = blankToNull(reviewStatus);
        if (normalizedReviewStatus != null) {
            query.eq(CaseEntity::getReviewStatus, normalizeReviewStatus(normalizedReviewStatus));
        }

        String normalizedSourceType = blankToNull(sourceType);
        if (normalizedSourceType != null) {
            query.eq(CaseEntity::getSourceType, normalizedSourceType.toUpperCase());
        }
        applyCreatedByFilter(query, createdByName);

        String normalizedExecutionStatus = blankToNull(executionStatus);
        if (normalizedExecutionStatus != null) {
            query.eq(CaseEntity::getExecutionStatus, normalizeExecutionStatus(normalizedExecutionStatus));
        }

        long total = caseMapper.selectCount(query);
        if (total == 0) {
            return PageResponse.of(List.of(), 0, safePageNo, safePageSize);
        }

        int offset = (safePageNo - 1) * safePageSize;
        List<CaseEntity> entities = caseMapper.selectList(query
                .orderByDesc(CaseEntity::getUpdatedAt)
                .orderByDesc(CaseEntity::getId)
                .last("limit " + safePageSize + " offset " + offset));

        Map<Long, UserEntity> userMap = collectUserMap(entities);
        Map<Long, WorkspaceEntity> workspaceMap = collectWorkspaceMap(entities);
        Map<Long, CaseDirectoryEntity> directoryMap = collectDirectoryMap(entities);

        List<CaseSummaryResponse> items = entities.stream()
                .map(item -> toCaseSummary(item, userMap, workspaceMap, directoryMap))
                .toList();
        return PageResponse.of(items, total, safePageNo, safePageSize);
    }

    private void applyCreatedByFilter(LambdaQueryWrapper<CaseEntity> query, String displayName) {
        String normalizedName = blankToNull(displayName);
        if (normalizedName == null) {
            return;
        }
        List<Long> userIds = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                        .eq(UserEntity::getDisplayName, normalizedName))
                .stream()
                .map(UserEntity::getId)
                .toList();
        if (userIds.isEmpty()) {
            query.eq(CaseEntity::getId, -1L);
        } else {
            query.in(CaseEntity::getCreatedBy, userIds);
        }
    }

    public CaseDetailResponse getCase(Long id, String workspaceCode) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, workspaceCode);
        return toCaseDetail(entity);
    }

    public CaseSummaryResponse createCase(String headerWorkspaceCode, CreateCaseRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (request.ownerId() != null) {
            userService.requireUser(request.ownerId());
        }
        CaseDirectoryEntity directory = requireDirectoryForWorkspace(workspace, request.directoryId());

        CaseEntity entity = new CaseEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setCaseNo(generateCaseNo());
        entity.setTitle(request.title());
        entity.setCaseType(request.caseType());
        entity.setPriority(request.priority());
        entity.setSourceType(request.sourceType());
        entity.setOwnerId(request.ownerId());
        entity.setExecutionStatus("NOT_RUN");
        entity.setExecutorId(null);
        entity.setExecutionComment(null);
        entity.setExecutedAt(null);
        entity.setCaseDirectoryId(directory == null ? null : directory.getId());
        entity.setReviewStatus("PENDING");
        entity.setReviewComment(null);
        entity.setReviewedBy(null);
        entity.setReviewedAt(null);
        entity.setPrecondition(request.precondition());
        entity.setSteps(request.steps());
        entity.setExpectedResult(request.expectedResult());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setCreatedBy(CurrentUserContext.get());
        entity.setUpdatedBy(CurrentUserContext.get());
        caseMapper.insert(entity);
        return getCaseSummary(entity.getId());
    }

    public CaseSummaryResponse updateCase(Long id, String headerWorkspaceCode, CreateCaseRequest request) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, headerWorkspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("涓嶅厑璁镐慨鏀圭敤渚嬪綊灞炵┖闂?");
        }
        if (request.ownerId() != null) {
            userService.requireUser(request.ownerId());
        }
        CaseDirectoryEntity directory = requireDirectoryForWorkspace(workspace, request.directoryId());

        entity.setTitle(request.title());
        entity.setCaseType(request.caseType());
        entity.setPriority(request.priority());
        entity.setSourceType(request.sourceType());
        entity.setOwnerId(request.ownerId());
        entity.setCaseDirectoryId(directory == null ? null : directory.getId());
        entity.setPrecondition(request.precondition());
        entity.setSteps(request.steps());
        entity.setExpectedResult(request.expectedResult());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(CurrentUserContext.get());
        caseMapper.updateById(entity);
        return getCaseSummary(id);
    }

    public void deleteCase(Long id, String workspaceCode) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        caseMapper.deleteById(id);
    }

    public CaseEntity requireCase(Long id) {
        CaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("鍏宠仈鐢ㄤ緥涓嶅瓨鍦?");
        }
        return entity;
    }

    private CaseDirectoryEntity requireDirectory(Long id) {
        CaseDirectoryEntity entity = caseDirectoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("目录不存在");
        }
        return entity;
    }

    void validateReadable(CaseEntity entity, String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            if (!workspaceService.isPlatformAdmin()
                    && !workspaceService.listReadableWorkspaceIds().contains(entity.getWorkspaceId())) {
                throw new BadRequestException("当前空间上下文不可访问该用例");
            }
            return;
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
        if (!workspace.getId().equals(entity.getWorkspaceId())) {
            throw new BadRequestException("当前空间上下文不可访问该用例");
        }
    }

    private void validateDirectoryReadable(CaseDirectoryEntity entity, String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            if (!workspaceService.isPlatformAdmin()
                    && !workspaceService.listReadableWorkspaceIds().contains(entity.getWorkspaceId())) {
                throw new BadRequestException("当前空间上下文不可访问该目录");
            }
            return;
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
        if (!workspace.getId().equals(entity.getWorkspaceId())) {
            throw new BadRequestException("当前空间上下文不可访问该目录");
        }
    }

    private CaseDirectoryEntity requireDirectoryForWorkspace(WorkspaceEntity workspace, Long directoryId) {
        if (directoryId == null) {
            return null;
        }
        CaseDirectoryEntity directory = requireDirectory(directoryId);
        if (!directory.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("目录不属于当前工作空间");
        }
        return directory;
    }

    private CaseSummaryResponse getCaseSummary(Long id) {
        CaseEntity item = requireCase(id);
        Map<Long, UserEntity> userMap = collectUserMap(List.of(item));
        Map<Long, WorkspaceEntity> workspaceMap = collectWorkspaceMap(List.of(item));
        Map<Long, CaseDirectoryEntity> directoryMap = collectDirectoryMap(List.of(item));
        return toCaseSummary(item, userMap, workspaceMap, directoryMap);
    }

    private CaseSummaryResponse toCaseSummary(
            CaseEntity item,
            Map<Long, UserEntity> userMap,
            Map<Long, WorkspaceEntity> workspaceMap,
            Map<Long, CaseDirectoryEntity> directoryMap
    ) {
        UserEntity owner = item.getOwnerId() == null ? null : userMap.get(item.getOwnerId());
        WorkspaceEntity workspace = workspaceMap.get(item.getWorkspaceId());
        CaseDirectoryEntity directory = item.getCaseDirectoryId() == null ? null : directoryMap.get(item.getCaseDirectoryId());
        UserEntity reviewer = item.getReviewedBy() == null ? null : userMap.get(item.getReviewedBy());
        UserEntity executor = item.getExecutorId() == null ? null : userMap.get(item.getExecutorId());
        UserEntity creator = item.getCreatedBy() == null ? null : userMap.get(item.getCreatedBy());
        UserEntity updater = item.getUpdatedBy() == null ? null : userMap.get(item.getUpdatedBy());
        return new CaseSummaryResponse(
                item.getId(),
                item.getCaseNo(),
                item.getTitle(),
                item.getCaseType(),
                item.getPriority(),
                item.getSourceType(),
                defaultExecutionStatus(item.getExecutionStatus()),
                owner == null ? "-" : owner.getDisplayName(),
                executor == null ? "-" : executor.getDisplayName(),
                item.getExecutionComment(),
                item.getExecutedAt() == null ? null : item.getExecutedAt().toString(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                directory == null ? null : directory.getId(),
                directory == null ? null : directory.getDirectoryName(),
                item.getCreatedBy(),
                creator == null ? null : creator.getDisplayName(),
                item.getCreatedAt() == null ? null : item.getCreatedAt().toString(),
                item.getUpdatedBy(),
                updater == null ? null : updater.getDisplayName(),
                item.getUpdatedAt() == null ? null : item.getUpdatedAt().toString(),
                defaultReviewStatus(item.getReviewStatus()),
                item.getReviewComment(),
                item.getReviewedBy(),
                reviewer == null ? null : reviewer.getDisplayName(),
                item.getReviewedAt() == null ? null : item.getReviewedAt().toString()
        );
    }

    private CaseDetailResponse toCaseDetail(CaseEntity item) {
        UserEntity owner = item.getOwnerId() == null ? null : userService.requireUser(item.getOwnerId());
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        CaseDirectoryEntity directory = item.getCaseDirectoryId() == null ? null : requireDirectory(item.getCaseDirectoryId());
        UserEntity reviewer = item.getReviewedBy() == null ? null : userService.requireUser(item.getReviewedBy());
        UserEntity executor = item.getExecutorId() == null ? null : userService.requireUser(item.getExecutorId());
        UserEntity creator = item.getCreatedBy() == null ? null : userService.requireUser(item.getCreatedBy());
        UserEntity updater = item.getUpdatedBy() == null ? null : userService.requireUser(item.getUpdatedBy());
        List<CaseExecutionAttachmentResponse> attachments = caseExecutionAttachmentMapper.selectList(new LambdaQueryWrapper<CaseExecutionAttachmentEntity>()
                        .eq(CaseExecutionAttachmentEntity::getCaseId, item.getId())
                .orderByAsc(CaseExecutionAttachmentEntity::getId))
                .stream()
                .map(attachment -> caseExecutionAttachmentSupport.toAttachmentResponse(item, attachment))
                .toList();
        return new CaseDetailResponse(
                item.getId(),
                item.getCaseNo(),
                item.getTitle(),
                item.getCaseType(),
                item.getPriority(),
                item.getSourceType(),
                item.getOwnerId(),
                owner == null ? "-" : owner.getDisplayName(),
                defaultExecutionStatus(item.getExecutionStatus()),
                item.getExecutorId(),
                executor == null ? "-" : executor.getDisplayName(),
                item.getExecutionComment(),
                item.getExecutionNote(),
                item.getExecutedAt() == null ? null : item.getExecutedAt().toString(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                directory == null ? null : directory.getId(),
                directory == null ? null : directory.getDirectoryName(),
                item.getCreatedBy(),
                creator == null ? null : creator.getDisplayName(),
                item.getCreatedAt() == null ? null : item.getCreatedAt().toString(),
                item.getUpdatedBy(),
                updater == null ? null : updater.getDisplayName(),
                item.getUpdatedAt() == null ? null : item.getUpdatedAt().toString(),
                defaultReviewStatus(item.getReviewStatus()),
                item.getReviewComment(),
                item.getReviewedBy(),
                reviewer == null ? null : reviewer.getDisplayName(),
                item.getReviewedAt() == null ? null : item.getReviewedAt().toString(),
                item.getPrecondition(),
                item.getSteps(),
                item.getExpectedResult(),
                attachments
        );
    }

    private Map<Long, UserEntity> collectUserMap(List<CaseEntity> entities) {
        List<Long> userIds = entities.stream()
                .flatMap(item -> java.util.stream.Stream.of(
                        item.getOwnerId(),
                        item.getExecutorId(),
                        item.getCreatedBy(),
                        item.getUpdatedBy(),
                        item.getReviewedBy()
                ))
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userIds.stream()
                .map(userService::requireUser)
                .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private Map<Long, WorkspaceEntity> collectWorkspaceMap(List<CaseEntity> entities) {
        List<Long> workspaceIds = entities.stream()
                .map(CaseEntity::getWorkspaceId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        return workspaceIds.stream()
                .map(workspaceService::requireWorkspaceById)
                .collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity()));
    }

    private Map<Long, CaseDirectoryEntity> collectDirectoryMap(List<CaseEntity> entities) {
        List<Long> directoryIds = entities.stream()
                .map(CaseEntity::getCaseDirectoryId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (directoryIds.isEmpty()) {
            return Map.of();
        }
        return caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                        .in(CaseDirectoryEntity::getId, directoryIds))
                .stream()
                .collect(Collectors.toMap(CaseDirectoryEntity::getId, Function.identity()));
    }

    private Set<Long> collectDescendantIds(Long workspaceId, Long rootId) {
        List<CaseDirectoryEntity> directories = caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .eq(CaseDirectoryEntity::getWorkspaceId, workspaceId)
                .orderByAsc(CaseDirectoryEntity::getId));
        Map<Long, List<CaseDirectoryEntity>> childrenByParent = directories.stream()
                .filter(item -> item.getParentId() != null)
                .collect(Collectors.groupingBy(CaseDirectoryEntity::getParentId, LinkedHashMap::new, Collectors.toList()));

        Set<Long> result = new HashSet<>();
        List<Long> stack = new ArrayList<>();
        stack.add(rootId);
        while (!stack.isEmpty()) {
            Long current = stack.remove(stack.size() - 1);
            result.add(current);
            for (CaseDirectoryEntity child : childrenByParent.getOrDefault(current, List.of())) {
                stack.add(child.getId());
            }
        }
        return result;
    }

    private String normalizeReviewStatus(String reviewStatus) {
        String normalized = reviewStatus == null ? "" : reviewStatus.trim().toUpperCase();
        return switch (normalized) {
            case "PENDING", "PASSED", "REJECTED" -> normalized;
            default -> throw new BadRequestException("璇勫鐘舵€佷笉鍚堟硶");
        };
    }

    private String defaultReviewStatus(String reviewStatus) {
        return blankToNull(reviewStatus) == null ? "PENDING" : reviewStatus;
    }

    private String defaultExecutionStatus(String executionStatus) {
        String normalized = blankToNull(executionStatus);
        if (normalized == null) {
            return "NOT_RUN";
        }
        if ("RUNNING".equalsIgnoreCase(normalized)) {
            return "BLOCKED";
        }
        return normalized.trim().toUpperCase();
    }

    private String normalizeExecutionStatus(String executionStatus) {
        String normalized = executionStatus == null ? "" : executionStatus.trim().toUpperCase();
        if ("RUNNING".equals(normalized)) {
            normalized = "BLOCKED";
        }
        return switch (normalized) {
            case "NOT_RUN", "PASSED", "BLOCKED", "FAILED" -> normalized;
            default -> throw new BadRequestException("鎵ц鐘舵€佷笉鍚堟硶");
        };
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String generateCaseNo() {
        List<CaseEntity> latestCases = caseMapper.selectList(new LambdaQueryWrapper<CaseEntity>()
                .select(CaseEntity::getCaseNo)
                .orderByDesc(CaseEntity::getId)
                .last("limit 1"));

        long nextSequence = 1;
        if (!latestCases.isEmpty()) {
            String latestCaseNo = latestCases.getFirst().getCaseNo();
            Matcher matcher = CASE_NO_PATTERN.matcher(latestCaseNo == null ? "" : latestCaseNo.trim());
            if (matcher.matches()) {
                nextSequence = Long.parseLong(matcher.group(1)) + 1;
            } else {
                nextSequence = caseMapper.selectCount(new LambdaQueryWrapper<>()) + 1;
            }
        }
        return "Case-" + String.format("%05d", nextSequence);
    }
}
