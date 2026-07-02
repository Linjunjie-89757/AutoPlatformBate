package com.company.autoplatform.casecenter;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CaseBatchDomainService {
    private final CaseMapper caseMapper;
    private final CaseDomainService caseDomainService;
    private final CaseDirectoryDomainService caseDirectoryDomainService;
    private final UserService userService;
    private final WorkspaceService workspaceService;

    CaseBatchDomainService(
            CaseMapper caseMapper,
            CaseDomainService caseDomainService,
            CaseDirectoryDomainService caseDirectoryDomainService,
            UserService userService,
            WorkspaceService workspaceService
    ) {
        this.caseMapper = caseMapper;
        this.caseDomainService = caseDomainService;
        this.caseDirectoryDomainService = caseDirectoryDomainService;
        this.userService = userService;
        this.workspaceService = workspaceService;
    }

    public PageResponse<CaseSummaryResponse> batchMoveCases(String workspaceCode, BatchMoveCasesRequest request) {
        List<CaseEntity> entities = requireWritableCases(request.caseIds(), workspaceCode);
        Long workspaceId = assertSingleWorkspace(entities);
        CaseDirectoryEntity targetDirectory = request.targetDirectoryId() == null ? null : caseDirectoryDomainService.requireDirectory(request.targetDirectoryId());
        if (targetDirectory != null && !targetDirectory.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("批量移动目标目录与用例不在同一空间");
        }

        LocalDateTime now = LocalDateTime.now();
        for (CaseEntity entity : entities) {
            entity.setCaseDirectoryId(targetDirectory == null ? null : targetDirectory.getId());
            entity.setUpdatedAt(now);
            entity.setUpdatedBy(CurrentUserContext.get());
            caseMapper.updateById(entity);
        }
        return toSummaryPage(entities);
    }

    public PageResponse<CaseSummaryResponse> batchUpdateCases(String workspaceCode, BatchUpdateCasesRequest request) {
        if (blankToNull(request.priority()) == null
                && blankToNull(request.reviewStatus()) == null
                && blankToNull(request.executionStatus()) == null) {
            throw new BadRequestException("批量编辑至少选择一个可修改字段");
        }
        List<CaseEntity> entities = requireWritableCases(request.caseIds(), workspaceCode);
        LocalDateTime now = LocalDateTime.now();
        for (CaseEntity entity : entities) {
            if (blankToNull(request.priority()) != null) {
                entity.setPriority(request.priority().trim());
            }
            if (blankToNull(request.reviewStatus()) != null) {
                entity.setReviewStatus(normalizeReviewStatus(request.reviewStatus()));
                entity.setReviewedBy(CurrentUserContext.require().userId());
                entity.setReviewedAt(now);
            }
            if (blankToNull(request.executionStatus()) != null) {
                entity.setExecutionStatus(normalizeExecutionStatus(request.executionStatus()));
                entity.setExecutorId(CurrentUserContext.require().userId());
                entity.setExecutedAt(now);
            }
            entity.setUpdatedAt(now);
            entity.setUpdatedBy(CurrentUserContext.get());
            caseMapper.updateById(entity);
        }
        return toSummaryPage(entities);
    }

    public void batchDeleteCases(String workspaceCode, BatchDeleteCasesRequest request) {
        List<CaseEntity> entities = requireWritableCases(request.caseIds(), workspaceCode);
        for (CaseEntity entity : entities) {
            caseMapper.deleteById(entity.getId());
        }
    }

    private List<CaseEntity> requireWritableCases(List<Long> caseIds, String workspaceCode) {
        List<Long> distinctIds = caseIds == null ? List.of() : caseIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            throw new BadRequestException("鐢ㄤ緥鍒楄〃涓嶈兘涓虹┖");
        }
        List<CaseEntity> entities = distinctIds.stream().map(caseDomainService::requireCase).toList();
        for (CaseEntity entity : entities) {
            caseDomainService.validateReadable(entity, workspaceCode);
            workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        }
        return entities;
    }

    private Long assertSingleWorkspace(List<CaseEntity> entities) {
        Set<Long> workspaceIds = entities.stream().map(CaseEntity::getWorkspaceId).collect(Collectors.toSet());
        if (workspaceIds.size() != 1) {
            throw new BadRequestException("批量操作暂不支持跨空间混合提交");
        }
        return entities.getFirst().getWorkspaceId();
    }

    private PageResponse<CaseSummaryResponse> toSummaryPage(List<CaseEntity> entities) {
        Map<Long, UserEntity> userMap = collectUserMap(entities);
        Map<Long, WorkspaceEntity> workspaceMap = collectWorkspaceMap(entities);
        Map<Long, CaseDirectoryEntity> directoryMap = collectDirectoryMap(entities);
        List<CaseSummaryResponse> items = entities.stream()
                .map(item -> toCaseSummary(item, userMap, workspaceMap, directoryMap))
                .toList();
        return PageResponse.of(items, items.size(), 1, items.size());
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
                item.getCaseStatus(),
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
        return directoryIds.stream()
                .map(caseDirectoryDomainService::requireDirectory)
                .collect(Collectors.toMap(CaseDirectoryEntity::getId, Function.identity()));
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
}
