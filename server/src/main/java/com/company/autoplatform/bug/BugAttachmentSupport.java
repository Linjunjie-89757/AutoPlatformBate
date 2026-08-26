package com.company.autoplatform.bug;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class BugAttachmentSupport {

    private final BugDomainService bugDomainService;
    private final BugMapper bugMapper;
    private final BugAttachmentMapper bugAttachmentMapper;
    private final BugAttachmentStorageService bugAttachmentStorageService;
    private final UserService userService;
    private final WorkspaceService workspaceService;

    public BugAttachmentSupport(
            BugDomainService bugDomainService,
            BugMapper bugMapper,
            BugAttachmentMapper bugAttachmentMapper,
            BugAttachmentStorageService bugAttachmentStorageService,
            UserService userService,
            WorkspaceService workspaceService
    ) {
        this.bugDomainService = bugDomainService;
        this.bugMapper = bugMapper;
        this.bugAttachmentMapper = bugAttachmentMapper;
        this.bugAttachmentStorageService = bugAttachmentStorageService;
        this.userService = userService;
        this.workspaceService = workspaceService;
    }

    public List<BugAttachmentResponse> uploadBugAttachments(Long bugId, String workspaceCode, List<MultipartFile> files) {
        BugEntity bug = bugDomainService.requireBug(bugId);
        bugDomainService.validateReadable(bug, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(bug.getWorkspaceId()).getWorkspaceCode());

        List<StoredBugFile> storedFiles = bugAttachmentStorageService.storeAll(bug.getWorkspaceId(), bugId, files);
        List<BugAttachmentEntity> createdAttachments = new ArrayList<>();
        try {
            for (int i = 0; i < storedFiles.size(); i++) {
                MultipartFile file = files.get(i);
                StoredBugFile storedFile = storedFiles.get(i);
                BugAttachmentEntity attachment = new BugAttachmentEntity();
                attachment.setBugId(bugId);
                attachment.setCreatedBy(CurrentUserContext.get());
                attachment.setWorkspaceId(bug.getWorkspaceId());
                attachment.setFileName(file.getOriginalFilename());
                attachment.setStoredPath(storedFile.storedPath());
                attachment.setContentType(storedFile.contentType());
                attachment.setFileSize(storedFile.fileSize());
                attachment.setCreatedAt(LocalDateTime.now());
                attachment.setUpdatedAt(LocalDateTime.now());
                bugAttachmentMapper.insert(attachment);
                createdAttachments.add(attachment);
            }
        } catch (RuntimeException exception) {
            for (BugAttachmentEntity attachment : createdAttachments) {
                if (attachment.getId() != null) {
                    bugAttachmentMapper.deleteById(attachment.getId());
                }
                bugAttachmentStorageService.delete(attachment.getStoredPath());
            }
            for (StoredBugFile storedFile : storedFiles) {
                bugAttachmentStorageService.delete(storedFile.storedPath());
            }
            throw exception;
        }

        bug.setUpdatedAt(LocalDateTime.now());
        bugMapper.updateById(bug);
        return createdAttachments.stream().map(attachment -> toAttachmentResponse(bug, attachment)).toList();
    }

    public void deleteBugAttachment(Long bugId, Long attachmentId, String workspaceCode) {
        BugEntity bug = bugDomainService.requireBug(bugId);
        bugDomainService.validateReadable(bug, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(bug.getWorkspaceId()).getWorkspaceCode());
        BugAttachmentEntity attachment = requireAttachment(attachmentId);
        if (!attachment.getBugId().equals(bugId)) {
            throw new BadRequestException("附件不属于当前缺陷");
        }
        bugAttachmentMapper.deleteById(attachmentId);
        bugAttachmentStorageService.delete(attachment.getStoredPath());
        bug.setUpdatedAt(LocalDateTime.now());
        bugMapper.updateById(bug);
    }

    public BugFileDownload downloadBugAttachment(Long bugId, Long attachmentId, String workspaceCode) {
        BugEntity bug = bugDomainService.requireBug(bugId);
        bugDomainService.validateReadable(bug, workspaceCode);
        BugAttachmentEntity attachment = requireAttachment(attachmentId);
        if (!attachment.getBugId().equals(bugId)) {
            throw new BadRequestException("附件不属于当前缺陷");
        }
        return bugAttachmentStorageService.load(attachment);
    }

    public BugAttachmentEntity requireAttachment(Long attachmentId) {
        BugAttachmentEntity attachment = bugAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            throw new NotFoundException("附件不存在");
        }
        return attachment;
    }

    public void deleteStoredFile(String storedPath) {
        bugAttachmentStorageService.delete(storedPath);
    }

    public void deleteStoredBugDirectory(Long workspaceId, Long bugId) {
        bugAttachmentStorageService.deleteBugDirectory(workspaceId, bugId);
    }

    public BugAttachmentResponse toAttachmentResponse(BugEntity bug, BugAttachmentEntity attachment) {
        UserEntity uploader = attachment.getCreatedBy() == null ? null : userService.findActiveUser(attachment.getCreatedBy());
        return new BugAttachmentResponse(
                attachment.getId(),
                attachment.getFileName(),
                attachment.getContentType(),
                attachment.getFileSize(),
                "/api/bugs/" + bug.getId() + "/attachments/" + attachment.getId() + "/download",
                uploader == null ? null : uploader.getDisplayName(),
                attachment.getCreatedAt()
        );
    }
}
