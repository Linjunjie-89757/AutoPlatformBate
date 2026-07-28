package com.company.autoplatform.execution;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@Service
public class ReportShareDomainService {

    private final ReportShareMapper reportShareMapper;
    private final ExecutionReportDomainService reportDomainService;
    private final ExecutionReportAttachmentSupport reportAttachmentSupport;
    private final ReportAttachmentStorageService reportAttachmentStorageService;
    private final WorkspaceService workspaceService;
    private final SecureRandom secureRandom = new SecureRandom();

    public ReportShareDomainService(
            ReportShareMapper reportShareMapper,
            ExecutionReportDomainService reportDomainService,
            ExecutionReportAttachmentSupport reportAttachmentSupport,
            ReportAttachmentStorageService reportAttachmentStorageService,
            WorkspaceService workspaceService
    ) {
        this.reportShareMapper = reportShareMapper;
        this.reportDomainService = reportDomainService;
        this.reportAttachmentSupport = reportAttachmentSupport;
        this.reportAttachmentStorageService = reportAttachmentStorageService;
        this.workspaceService = workspaceService;
    }

    @Transactional
    public ReportShareCreatedResponse createShare(Long reportId, String workspaceCode, CreateReportShareRequest request) {
        ReportEntity report = requireWritableReport(reportId, workspaceCode);
        String rawToken = generateRawToken();
        LocalDateTime now = LocalDateTime.now();
        ReportShareEntity entity = new ReportShareEntity();
        entity.setWorkspaceId(report.getWorkspaceId());
        entity.setReportId(report.getId());
        entity.setTokenHash(sha256(rawToken));
        entity.setStatus(1);
        entity.setExpiresAt(resolveExpiresAt(request == null ? null : request.expiresInDays(), now));
        entity.setCreatedBy(CurrentUserContext.require().displayName());
        entity.setAccessCount(0);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        reportShareMapper.insert(entity);
        return toCreated(entity, rawToken);
    }

    public List<ReportShareSummaryResponse> listShares(String workspaceCode, Long reportId) {
        LambdaQueryWrapper<ReportShareEntity> query = new LambdaQueryWrapper<>();
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (!WorkspaceScope.isAll(normalized)) {
            WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
            query.eq(ReportShareEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return List.of();
            }
            query.in(ReportShareEntity::getWorkspaceId, workspaceIds);
        }
        if (reportId != null) {
            query.eq(ReportShareEntity::getReportId, reportId);
        }
        return reportShareMapper.selectList(query
                        .orderByDesc(ReportShareEntity::getCreatedAt)
                        .orderByDesc(ReportShareEntity::getId))
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public ReportShareSummaryResponse revokeShare(Long shareId, String workspaceCode) {
        ReportShareEntity share = requireWritableShare(shareId, workspaceCode);
        share.setStatus(0);
        share.setUpdatedAt(LocalDateTime.now());
        reportShareMapper.updateById(share);
        return toSummary(share);
    }

    @Transactional
    public ReportShareCreatedResponse regenerateShare(Long shareId, String workspaceCode) {
        ReportShareEntity share = requireWritableShare(shareId, workspaceCode);
        String rawToken = generateRawToken();
        share.setTokenHash(sha256(rawToken));
        share.setStatus(1);
        share.setAccessCount(0);
        share.setLastAccessedAt(null);
        share.setUpdatedAt(LocalDateTime.now());
        reportShareMapper.updateById(share);
        return toCreated(share, rawToken);
    }

    @Transactional
    public SharedReportResponse getSharedReport(String rawToken) {
        ReportShareEntity share = requireActiveShare(rawToken);
        LocalDateTime now = LocalDateTime.now();
        share.setAccessCount((share.getAccessCount() == null ? 0 : share.getAccessCount()) + 1);
        share.setLastAccessedAt(now);
        share.setUpdatedAt(now);
        reportShareMapper.updateById(share);

        ReportDetailResponse detail = reportDomainService.toReportDetail(reportDomainService.requireReport(share.getReportId()));
        List<ReportAttachmentResponse> attachments = detail.attachments().stream()
                .map(attachment -> new ReportAttachmentResponse(
                        attachment.id(),
                        attachment.fileName(),
                        attachment.contentType(),
                        attachment.fileSize(),
                        attachment.id() != null && attachment.id() > 0
                                ? "/api/public/reports/" + rawToken + "/attachments/" + attachment.id() + "/download"
                                : null,
                        attachment.createdAt()
                ))
                .toList();
        ReportDetailResponse sharedDetail = new ReportDetailResponse(
                detail.id(),
                detail.taskId(),
                detail.taskName(),
                detail.reportName(),
                detail.result(),
                detail.logSource(),
                detail.workspaceCode(),
                detail.workspaceName(),
                detail.failureSummary(),
                detail.logText(),
                attachments,
                detail.createdAt(),
                detail.updatedAt()
        );
        return new SharedReportResponse(sharedDetail, share.getExpiresAt(), now);
    }

    public ReportFileDownload downloadSharedAttachment(String rawToken, Long attachmentId) {
        ReportShareEntity share = requireActiveShare(rawToken);
        ReportAttachmentEntity attachment = reportAttachmentSupport.requireAttachment(attachmentId);
        if (!share.getReportId().equals(attachment.getReportId())) {
            throw new NotFoundException("Shared report attachment not found");
        }
        return reportAttachmentStorageService.load(attachment);
    }

    private ReportEntity requireWritableReport(Long reportId, String workspaceCode) {
        ReportEntity report = reportDomainService.requireReport(reportId);
        reportDomainService.validateReadableReportWorkspace(report, workspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(report.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());
        return report;
    }

    private ReportShareEntity requireWritableShare(Long shareId, String workspaceCode) {
        ReportShareEntity share = reportShareMapper.selectById(shareId);
        if (share == null) {
            throw new NotFoundException("Report share not found");
        }
        requireWritableReport(share.getReportId(), workspaceCode);
        return share;
    }

    private ReportShareEntity requireActiveShare(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new NotFoundException("Report share not found");
        }
        ReportShareEntity share = reportShareMapper.selectOne(new LambdaQueryWrapper<ReportShareEntity>()
                .eq(ReportShareEntity::getTokenHash, sha256(rawToken.trim()))
                .last("limit 1"));
        LocalDateTime now = LocalDateTime.now();
        if (share == null || share.getStatus() == null || share.getStatus() != 1
                || (share.getExpiresAt() != null && share.getExpiresAt().isBefore(now))) {
            throw new NotFoundException("Report share not found");
        }
        return share;
    }

    private ReportShareSummaryResponse toSummary(ReportShareEntity share) {
        ReportEntity report = reportDomainService.requireReport(share.getReportId());
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(share.getWorkspaceId());
        return new ReportShareSummaryResponse(
                share.getId(),
                report.getId(),
                report.getReportName(),
                report.getResult(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                share.getStatus(),
                share.getExpiresAt(),
                share.getCreatedBy(),
                share.getLastAccessedAt(),
                share.getAccessCount(),
                share.getCreatedAt(),
                share.getUpdatedAt()
        );
    }

    private ReportShareCreatedResponse toCreated(ReportShareEntity share, String rawToken) {
        ReportShareSummaryResponse summary = toSummary(share);
        return new ReportShareCreatedResponse(
                summary.id(),
                summary.reportId(),
                summary.reportName(),
                summary.reportResult(),
                summary.workspaceCode(),
                summary.workspaceName(),
                summary.status(),
                summary.expiresAt(),
                summary.createdBy(),
                summary.lastAccessedAt(),
                summary.accessCount(),
                summary.createdAt(),
                summary.updatedAt(),
                rawToken,
                "/share/report?token=" + rawToken
        );
    }

    private LocalDateTime resolveExpiresAt(Integer expiresInDays, LocalDateTime now) {
        if (expiresInDays == null) {
            return now.plusDays(7);
        }
        if (expiresInDays <= 0) {
            return null;
        }
        return now.plusDays(Math.min(expiresInDays, 365));
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return "report_share_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
