package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.PageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class BugService {
    private final BugDomainService bugDomainService;
    private final BugAttachmentSupport bugAttachmentSupport;
    private final BugWorkflowDomainService bugWorkflowDomainService;
    private final BugCommentDomainService bugCommentDomainService;
    private final BugSourceContextSupport bugSourceContextSupport;
    private final BugResponseAssembler bugResponseAssembler;
    private final BugAttachmentMapper bugAttachmentMapper;
    private final BugCommentMapper bugCommentMapper;
    private final BugFlowMapper bugFlowMapper;
    private final BugCaseRelationMapper bugCaseRelationMapper;
    private final BugMapper bugMapper;

    public BugService(BugDomainService bugDomainService, BugAttachmentSupport bugAttachmentSupport,
                      BugWorkflowDomainService bugWorkflowDomainService,
                      BugCommentDomainService bugCommentDomainService,
                      BugSourceContextSupport bugSourceContextSupport,
                      BugResponseAssembler bugResponseAssembler,
                      BugAttachmentMapper bugAttachmentMapper,
                      BugCommentMapper bugCommentMapper,
                      BugFlowMapper bugFlowMapper,
                      BugCaseRelationMapper bugCaseRelationMapper,
                      BugMapper bugMapper) {
        this.bugDomainService = bugDomainService;
        this.bugAttachmentSupport = bugAttachmentSupport;
        this.bugWorkflowDomainService = bugWorkflowDomainService;
        this.bugCommentDomainService = bugCommentDomainService;
        this.bugSourceContextSupport = bugSourceContextSupport;
        this.bugResponseAssembler = bugResponseAssembler;
        this.bugAttachmentMapper = bugAttachmentMapper;
        this.bugCommentMapper = bugCommentMapper;
        this.bugFlowMapper = bugFlowMapper;
        this.bugCaseRelationMapper = bugCaseRelationMapper;
        this.bugMapper = bugMapper;
    }

    public PageResponse<BugSummaryResponse> listBugs(
            String workspaceCode,
            String keyword,
            String status,
            String severity,
            String priority,
            Integer pageNo,
            Integer pageSize
    ) {
        PageResponse<BugEntity> page = bugDomainService.listBugs(workspaceCode, keyword, status, severity, priority, pageNo, pageSize);
        return new PageResponse<>(
                page.items().stream().map(bugResponseAssembler::toSummary).toList(),
                page.total(),
                page.pageNo(),
                page.pageSize(),
                page.totalPages()
        );
    }

    public BugDetailResponse getBug(Long id, String workspaceCode) {
        return bugResponseAssembler.toDetail(bugDomainService.getBug(id, workspaceCode));
    }

    public BugDetailResponse createBug(String headerWorkspaceCode, CreateBugRequest request, BugSourceType sourceType) {
        return bugResponseAssembler.toDetail(bugDomainService.createBug(headerWorkspaceCode, request, sourceType));
    }

    public BugDetailResponse updateBug(Long id, String headerWorkspaceCode, UpdateBugRequest request) {
        return bugResponseAssembler.toDetail(bugDomainService.updateBug(id, headerWorkspaceCode, request));
    }

    @Transactional
    public void deleteBug(Long id, String workspaceCode) {
        BugEntity bug = bugDomainService.getBug(id, workspaceCode);
        bugDomainService.requireWritableBug(bug);

        List<BugAttachmentEntity> attachments = bugAttachmentMapper.selectList(new LambdaQueryWrapper<BugAttachmentEntity>()
                .eq(BugAttachmentEntity::getBugId, id));

        bugAttachmentMapper.delete(new LambdaQueryWrapper<BugAttachmentEntity>()
                .eq(BugAttachmentEntity::getBugId, id));
        bugCommentMapper.delete(new LambdaQueryWrapper<BugCommentEntity>()
                .eq(BugCommentEntity::getBugId, id));
        bugFlowMapper.delete(new LambdaQueryWrapper<BugFlowEntity>()
                .eq(BugFlowEntity::getBugId, id));
        bugCaseRelationMapper.delete(new LambdaQueryWrapper<BugCaseRelationEntity>()
                .eq(BugCaseRelationEntity::getBugId, id));
        bugMapper.deleteById(id);

        attachments.forEach(attachment -> bugAttachmentSupport.deleteStoredFile(attachment.getStoredPath()));
        bugAttachmentSupport.deleteStoredBugDirectory(bug.getWorkspaceId(), id);
    }

    public BugDetailResponse assignBug(Long id, String headerWorkspaceCode, AssignBugRequest request) {
        return bugResponseAssembler.toDetail(bugWorkflowDomainService.assignBug(id, headerWorkspaceCode, request));
    }

    public BugDetailResponse transitionBug(Long id, String headerWorkspaceCode, TransitionBugRequest request) {
        return bugResponseAssembler.toDetail(bugWorkflowDomainService.transitionBug(id, headerWorkspaceCode, request));
    }

    public List<BugCommentResponse> listComments(Long id, String workspaceCode) {
        return bugCommentDomainService.listComments(id, workspaceCode).stream().map(bugResponseAssembler::toComment).toList();
    }

    public BugCommentResponse addComment(Long id, String workspaceCode, CreateBugCommentRequest request) {
        return bugResponseAssembler.toComment(bugCommentDomainService.addComment(id, workspaceCode, request));
    }

    public List<BugAttachmentResponse> uploadBugAttachments(Long bugId, String workspaceCode, List<MultipartFile> files) {
        return bugAttachmentSupport.uploadBugAttachments(bugId, workspaceCode, files);
    }

    public void deleteBugAttachment(Long bugId, Long attachmentId, String workspaceCode) {
        bugAttachmentSupport.deleteBugAttachment(bugId, attachmentId, workspaceCode);
    }

    public BugFileDownload downloadBugAttachment(Long bugId, Long attachmentId, String workspaceCode) {
        return bugAttachmentSupport.downloadBugAttachment(bugId, attachmentId, workspaceCode);
    }

    public BugStatisticsResponse statistics(String workspaceCode) {
        return bugDomainService.statistics(workspaceCode);
    }

    public List<BugCaseSummaryResponse> listBugCases(Long id, String workspaceCode) {
        return bugResponseAssembler.toDetail(bugDomainService.getBug(id, workspaceCode)).relatedCases();
    }

    public BugDetailResponse replaceBugCases(Long id, String workspaceCode, ReplaceBugCasesRequest request) {
        return bugResponseAssembler.toDetail(bugDomainService.replaceBugCases(id, workspaceCode, request.caseIds()));
    }

    public BugDetailResponse deleteBugCase(Long id, String workspaceCode, Long caseId) {
        return bugResponseAssembler.toDetail(bugDomainService.deleteBugCase(id, workspaceCode, caseId));
    }

    public BugDetailResponse createBugFromCase(Long caseId, String workspaceCode, CreateBugRequest request) {
        return createBug(workspaceCode, bugSourceContextSupport.mergeCaseSource(caseId, request), BugSourceType.CASE);
    }

    public BugDetailResponse createBugFromReport(Long reportId, String workspaceCode, CreateBugRequest request) {
        return createBug(workspaceCode, bugSourceContextSupport.mergeReportSource(reportId, request), BugSourceType.REPORT);
    }

    public BugEntity requireBug(Long id) {
        return bugDomainService.requireBug(id);
    }

}
