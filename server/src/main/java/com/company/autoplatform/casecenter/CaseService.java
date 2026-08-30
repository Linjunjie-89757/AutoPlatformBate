package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CaseService {
    private final CaseDomainService caseDomainService;
    private final CaseDirectoryDomainService caseDirectoryDomainService;
    private final CaseBatchDomainService caseBatchDomainService;
    private final CaseExecutionAttachmentSupport caseExecutionAttachmentSupport;
    private final CaseMapper caseMapper;
    private final CaseExecutionAttachmentMapper caseExecutionAttachmentMapper;
    private final CaseExecutionHistoryMapper caseExecutionHistoryMapper;
    private final UserService userService;
    private final WorkspaceService workspaceService;

    public CaseService(
            CaseDomainService caseDomainService,
            CaseDirectoryDomainService caseDirectoryDomainService,
            CaseBatchDomainService caseBatchDomainService,
            CaseExecutionAttachmentSupport caseExecutionAttachmentSupport,
            CaseMapper caseMapper,
            CaseExecutionAttachmentMapper caseExecutionAttachmentMapper,
            CaseExecutionHistoryMapper caseExecutionHistoryMapper,
            UserService userService,
            WorkspaceService workspaceService
    ) {
        this.caseDomainService = caseDomainService;
        this.caseDirectoryDomainService = caseDirectoryDomainService;
        this.caseBatchDomainService = caseBatchDomainService;
        this.caseExecutionAttachmentSupport = caseExecutionAttachmentSupport;
        this.caseMapper = caseMapper;
        this.caseExecutionAttachmentMapper = caseExecutionAttachmentMapper;
        this.caseExecutionHistoryMapper = caseExecutionHistoryMapper;
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
        return caseDomainService.listCases(
                workspaceCode,
                pageNo,
                pageSize,
                directoryId,
                keyword,
                priority,
                reviewStatus,
                executionStatus,
                sourceType,
                createdByName);
    }

    public CaseDetailResponse getCase(Long id, String workspaceCode) {
        return caseDomainService.getCase(id, workspaceCode);
    }

    public CaseSummaryResponse createCase(String headerWorkspaceCode, CreateCaseRequest request) {
        return caseDomainService.createCase(headerWorkspaceCode, request);
    }

    public CaseSummaryResponse updateCase(Long id, String headerWorkspaceCode, CreateCaseRequest request) {
        return caseDomainService.updateCase(id, headerWorkspaceCode, request);
    }

    public CaseDetailResponse reviewCase(Long id, String workspaceCode, ReviewCaseRequest request) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());

        entity.setReviewStatus(normalizeReviewStatus(request.reviewStatus()));
        entity.setReviewComment(blankToNull(request.reviewComment()));
        entity.setReviewedBy(CurrentUserContext.require().userId());
        entity.setReviewedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(CurrentUserContext.get());
        caseMapper.updateById(entity);
        return toCaseDetail(entity);
    }

    @Transactional
    public CaseDetailResponse executeCase(Long id, String workspaceCode, ExecuteCaseRequest request) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        LocalDateTime now = LocalDateTime.now();
        var currentUser = CurrentUserContext.require();
        String normalizedStatus = normalizeExecutionStatus(request.executionStatus());
        String executionComment = blankToNull(request.executionComment());
        String executionNote = blankToNull(request.executionNote());

        entity.setExecutionStatus(normalizedStatus);
        entity.setExecutionComment(executionComment);
        entity.setExecutionNote(executionNote);
        entity.setExecutorId(currentUser.userId());
        entity.setExecutedAt(now);
        entity.setUpdatedAt(now);
        entity.setUpdatedBy(currentUser.userId());
        caseMapper.updateById(entity);

        CaseExecutionHistoryEntity history = new CaseExecutionHistoryEntity();
        history.setWorkspaceId(entity.getWorkspaceId());
        history.setCaseId(entity.getId());
        history.setExecutionStatus(normalizedStatus);
        history.setExecutionComment(executionComment);
        history.setExecutionNote(executionNote);
        history.setExecutorId(currentUser.userId());
        history.setExecutorName(currentUser.displayName());
        history.setExecutedAt(now);
        history.setCreatedAt(now);
        history.setUpdatedAt(now);
        caseExecutionHistoryMapper.insert(history);

        return toCaseDetail(entity);
    }

    public PageResponse<CaseExecutionHistoryResponse> listCaseExecutions(Long id, String workspaceCode) {
        CaseEntity entity = requireCase(id);
        validateReadable(entity, workspaceCode);
        List<CaseExecutionHistoryResponse> items = caseExecutionHistoryMapper.selectList(new LambdaQueryWrapper<CaseExecutionHistoryEntity>()
                        .eq(CaseExecutionHistoryEntity::getCaseId, id)
                        .orderByDesc(CaseExecutionHistoryEntity::getExecutedAt)
                        .orderByDesc(CaseExecutionHistoryEntity::getId))
                .stream()
                .map(this::toCaseExecutionHistory)
                .toList();
        return PageResponse.of(items, items.size(), 1, items.isEmpty() ? 1 : items.size());
    }

    public List<CaseExecutionAttachmentResponse> uploadExecutionAttachments(Long caseId, String workspaceCode, List<MultipartFile> files) {
        return caseExecutionAttachmentSupport.uploadExecutionAttachments(caseId, workspaceCode, files);
    }

    public void deleteExecutionAttachment(Long caseId, Long attachmentId, String workspaceCode) {
        caseExecutionAttachmentSupport.deleteExecutionAttachment(caseId, attachmentId, workspaceCode);
    }

    public CaseExecutionFileDownload downloadExecutionAttachment(Long caseId, Long attachmentId, String workspaceCode) {
        return caseExecutionAttachmentSupport.downloadExecutionAttachment(caseId, attachmentId, workspaceCode);
    }

    public PageResponse<CaseSummaryResponse> batchMoveCases(String workspaceCode, BatchMoveCasesRequest request) {
        return caseBatchDomainService.batchMoveCases(workspaceCode, request);
    }

    public PageResponse<CaseSummaryResponse> batchUpdateCases(String workspaceCode, BatchUpdateCasesRequest request) {
        return caseBatchDomainService.batchUpdateCases(workspaceCode, request);
    }

    public void batchDeleteCases(String workspaceCode, BatchDeleteCasesRequest request) {
        caseBatchDomainService.batchDeleteCases(workspaceCode, request);
    }

    public void deleteCase(Long id, String workspaceCode) {
        caseDomainService.deleteCase(id, workspaceCode);
    }

    public List<CaseDirectoryWorkspaceResponse> listDirectories(String workspaceCode) {
        return caseDirectoryDomainService.listDirectories(workspaceCode);
    }

    public CaseDirectoryNodeResponse createDirectory(String headerWorkspaceCode, CreateCaseDirectoryRequest request) {
        return caseDirectoryDomainService.createDirectory(headerWorkspaceCode, request);
    }

    public CaseDirectoryNodeResponse renameDirectory(Long id, String workspaceCode, RenameCaseDirectoryRequest request) {
        return caseDirectoryDomainService.renameDirectory(id, workspaceCode, request);
    }

    public CaseDirectoryNodeResponse moveDirectory(Long id, String workspaceCode, MoveCaseDirectoryRequest request) {
        return caseDirectoryDomainService.moveDirectory(id, workspaceCode, request);
    }

    public void deleteDirectory(Long id, String workspaceCode) {
        caseDirectoryDomainService.deleteDirectory(id, workspaceCode);
    }

    public CaseEntity requireCase(Long id) {
        return caseDomainService.requireCase(id);
    }

    private CaseExecutionAttachmentEntity requireExecutionAttachment(Long attachmentId) {
        return caseExecutionAttachmentSupport.requireExecutionAttachment(attachmentId);
    }

    public CaseDirectoryEntity requireDirectory(Long id) {
        return caseDirectoryDomainService.requireDirectory(id);
    }

    private void validateReadable(CaseEntity entity, String workspaceCode) {
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
                        .orderByDesc(CaseExecutionAttachmentEntity::getCreatedAt)
                        .orderByDesc(CaseExecutionAttachmentEntity::getId))
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

    private String normalizeReviewStatus(String reviewStatus) {
        String normalized = reviewStatus == null ? "" : reviewStatus.trim().toUpperCase();
        return switch (normalized) {
            case "PENDING", "PASSED", "REJECTED" -> normalized;
            default -> throw new BadRequestException("评审状态不合法");
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
            default -> throw new BadRequestException("执行状态不合法");
        };
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private CaseExecutionHistoryResponse toCaseExecutionHistory(CaseExecutionHistoryEntity item) {
        return new CaseExecutionHistoryResponse(
                item.getId(),
                item.getCaseId(),
                defaultExecutionStatus(item.getExecutionStatus()),
                item.getExecutionComment(),
                item.getExecutionNote(),
                item.getExecutorId(),
                blankToNull(item.getExecutorName()) == null ? "-" : item.getExecutorName(),
                item.getExecutedAt() == null ? null : item.getExecutedAt().toString()
        );
    }


}
