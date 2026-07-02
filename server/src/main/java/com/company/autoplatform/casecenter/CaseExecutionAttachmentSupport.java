package com.company.autoplatform.casecenter;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class CaseExecutionAttachmentSupport {
    private final CaseMapper caseMapper;
    private final CaseExecutionAttachmentMapper caseExecutionAttachmentMapper;
    private final CaseExecutionAttachmentStorageService caseExecutionAttachmentStorageService;
    private final WorkspaceService workspaceService;

    CaseExecutionAttachmentSupport(
            CaseMapper caseMapper,
            CaseExecutionAttachmentMapper caseExecutionAttachmentMapper,
            CaseExecutionAttachmentStorageService caseExecutionAttachmentStorageService,
            WorkspaceService workspaceService
    ) {
        this.caseMapper = caseMapper;
        this.caseExecutionAttachmentMapper = caseExecutionAttachmentMapper;
        this.caseExecutionAttachmentStorageService = caseExecutionAttachmentStorageService;
        this.workspaceService = workspaceService;
    }

    public List<CaseExecutionAttachmentResponse> uploadExecutionAttachments(Long caseId, String workspaceCode, List<MultipartFile> files) {
        CaseEntity entity = requireCase(caseId);
        validateReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());

        List<StoredCaseExecutionFile> storedFiles = caseExecutionAttachmentStorageService.storeAll(entity.getWorkspaceId(), caseId, files);
        List<CaseExecutionAttachmentEntity> createdAttachments = new ArrayList<>();
        try {
            for (int i = 0; i < storedFiles.size(); i++) {
                MultipartFile file = files.get(i);
                StoredCaseExecutionFile storedFile = storedFiles.get(i);
                CaseExecutionAttachmentEntity attachment = new CaseExecutionAttachmentEntity();
                attachment.setCaseId(caseId);
                attachment.setWorkspaceId(entity.getWorkspaceId());
                attachment.setFileName(file.getOriginalFilename());
                attachment.setStoredPath(storedFile.storedPath());
                attachment.setContentType(storedFile.contentType());
                attachment.setFileSize(storedFile.fileSize());
                attachment.setCreatedAt(LocalDateTime.now());
                attachment.setUpdatedAt(LocalDateTime.now());
                caseExecutionAttachmentMapper.insert(attachment);
                createdAttachments.add(attachment);
            }
        } catch (RuntimeException exception) {
            for (CaseExecutionAttachmentEntity attachment : createdAttachments) {
                if (attachment.getId() != null) {
                    caseExecutionAttachmentMapper.deleteById(attachment.getId());
                }
                caseExecutionAttachmentStorageService.delete(attachment.getStoredPath());
            }
            for (StoredCaseExecutionFile storedFile : storedFiles) {
                caseExecutionAttachmentStorageService.delete(storedFile.storedPath());
            }
            throw exception;
        }

        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(CurrentUserContext.get());
        caseMapper.updateById(entity);
        return createdAttachments.stream().map(attachment -> toAttachmentResponse(entity, attachment)).toList();
    }

    public void deleteExecutionAttachment(Long caseId, Long attachmentId, String workspaceCode) {
        CaseEntity entity = requireCase(caseId);
        validateReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        CaseExecutionAttachmentEntity attachment = requireExecutionAttachment(attachmentId);
        if (!attachment.getCaseId().equals(caseId)) {
            throw new BadRequestException("鎵ц闄勪欢涓嶅睘浜庡綋鍓嶇敤渚?");
        }
        caseExecutionAttachmentMapper.deleteById(attachmentId);
        caseExecutionAttachmentStorageService.delete(attachment.getStoredPath());
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(CurrentUserContext.get());
        caseMapper.updateById(entity);
    }

    public CaseExecutionFileDownload downloadExecutionAttachment(Long caseId, Long attachmentId, String workspaceCode) {
        CaseEntity entity = requireCase(caseId);
        validateReadable(entity, workspaceCode);
        CaseExecutionAttachmentEntity attachment = requireExecutionAttachment(attachmentId);
        if (!attachment.getCaseId().equals(caseId)) {
            throw new BadRequestException("鎵ц闄勪欢涓嶅睘浜庡綋鍓嶇敤渚?");
        }
        return caseExecutionAttachmentStorageService.load(attachment);
    }

    public CaseExecutionAttachmentEntity requireExecutionAttachment(Long attachmentId) {
        CaseExecutionAttachmentEntity attachment = caseExecutionAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            throw new NotFoundException("鎵ц闄勪欢涓嶅瓨鍦?");
        }
        return attachment;
    }

    private CaseEntity requireCase(Long id) {
        CaseEntity entity = caseMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("鍏宠仈鐢ㄤ緥涓嶅瓨鍦?");
        }
        return entity;
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

    CaseExecutionAttachmentResponse toAttachmentResponse(CaseEntity item, CaseExecutionAttachmentEntity attachment) {
        return new CaseExecutionAttachmentResponse(
                attachment.getId(),
                attachment.getFileName(),
                attachment.getContentType(),
                attachment.getFileSize(),
                "/api/cases/" + item.getId() + "/attachments/" + attachment.getId() + "/download",
                attachment.getCreatedAt()
        );
    }
}
