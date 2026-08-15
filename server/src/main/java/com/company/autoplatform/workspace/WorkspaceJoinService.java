package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class WorkspaceJoinService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceJoinApplicationMapper applicationMapper;
    private final WorkspaceInvitationMapper invitationMapper;
    private final WorkspaceDomainService workspaceDomainService;
    private final WorkspaceMemberDomainService workspaceMemberDomainService;
    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final UserService userService;
    private final SecureRandom secureRandom = new SecureRandom();

    public WorkspaceJoinService(
            WorkspaceMapper workspaceMapper,
            WorkspaceMemberMapper workspaceMemberMapper,
            WorkspaceJoinApplicationMapper applicationMapper,
            WorkspaceInvitationMapper invitationMapper,
            WorkspaceDomainService workspaceDomainService,
            WorkspaceMemberDomainService workspaceMemberDomainService,
            WorkspaceAccessSupport workspaceAccessSupport,
            UserService userService
    ) {
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.applicationMapper = applicationMapper;
        this.invitationMapper = invitationMapper;
        this.workspaceDomainService = workspaceDomainService;
        this.workspaceMemberDomainService = workspaceMemberDomainService;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.userService = userService;
    }

    public List<WorkspaceJoinCandidateItem> listCandidates(String query) {
        Long userId = CurrentUserContext.get();
        if (workspaceAccessSupport.isPlatformAdmin()) {
            return List.of();
        }
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return workspaceMapper.selectList(new LambdaQueryWrapper<WorkspaceEntity>()
                        .eq(WorkspaceEntity::getStatus, 1)
                        .orderByAsc(WorkspaceEntity::getId)
                        .last("limit 50"))
                .stream()
                .filter(workspace -> normalizedQuery.isBlank()
                        || containsIgnoreCase(workspace.getWorkspaceName(), normalizedQuery)
                        || containsIgnoreCase(workspace.getDescription(), normalizedQuery))
                .filter(workspace -> !hasActiveMembership(workspace.getId(), userId))
                .filter(workspace -> !hasPendingApplication(workspace.getId(), userId))
                .map(this::toCandidateItem)
                .toList();
    }

    public WorkspaceJoinApplicationItem getCurrentPendingApplication() {
        WorkspaceJoinApplicationEntity application = applicationMapper.selectOne(
                new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                        .eq(WorkspaceJoinApplicationEntity::getApplicantUserId, CurrentUserContext.get())
                        .eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING)
                        .orderByDesc(WorkspaceJoinApplicationEntity::getId)
                        .last("limit 1")
        );
        return application == null ? null : toApplicationItem(application);
    }

    @Transactional
    public WorkspaceJoinApplicationItem createApplication(String workspaceCode) {
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspace(workspaceCode);
        Long userId = CurrentUserContext.get();
        if (workspaceAccessSupport.isPlatformAdmin() || hasActiveMembership(workspace.getId(), userId)) {
            throw new BadRequestException("你已经是该工作区成员，无需重复申请");
        }
        WorkspaceJoinApplicationEntity existing = applicationMapper.selectOne(
                new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                        .eq(WorkspaceJoinApplicationEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceJoinApplicationEntity::getApplicantUserId, userId)
                        .eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING)
                        .last("limit 1")
        );
        if (existing != null) {
            return toApplicationItem(existing);
        }

        LocalDateTime now = LocalDateTime.now();
        WorkspaceJoinApplicationEntity application = new WorkspaceJoinApplicationEntity();
        application.setWorkspaceId(workspace.getId());
        application.setApplicantUserId(userId);
        application.setStatus(STATUS_PENDING);
        application.setCreatedAt(now);
        application.setUpdatedAt(now);
        applicationMapper.insert(application);
        return toApplicationItem(application);
    }

    @Transactional
    public void cancelApplication(Long applicationId) {
        WorkspaceJoinApplicationEntity application = requireApplication(applicationId);
        if (!CurrentUserContext.get().equals(application.getApplicantUserId())) {
            throw new BadRequestException("只能撤销自己的工作区申请");
        }
        if (!STATUS_PENDING.equals(application.getStatus())) {
            throw new BadRequestException("当前申请状态不可撤销");
        }
        updateApplicationStatus(application, STATUS_CANCELLED);
    }

    public List<WorkspaceJoinApplicationItem> listApplications(String workspaceCode, String status) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        LambdaQueryWrapper<WorkspaceJoinApplicationEntity> query = new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                .eq(WorkspaceJoinApplicationEntity::getWorkspaceId, workspace.getId())
                .orderByDesc(WorkspaceJoinApplicationEntity::getId);
        String normalizedStatus = normalizeApplicationStatus(status, true);
        if (normalizedStatus != null) {
            query.eq(WorkspaceJoinApplicationEntity::getStatus, normalizedStatus);
        }
        return applicationMapper.selectList(query).stream().map(this::toApplicationItem).toList();
    }

    @Transactional
    public WorkspaceJoinApplicationItem approveApplication(String workspaceCode, Long applicationId) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceJoinApplicationEntity application = requireWorkspaceApplication(workspace, applicationId);
        requirePending(application);
        workspaceMemberDomainService.addApprovedMember(workspace, application.getApplicantUserId());
        updateApplicationStatus(application, STATUS_APPROVED);
        return toApplicationItem(application);
    }

    @Transactional
    public WorkspaceJoinApplicationItem rejectApplication(String workspaceCode, Long applicationId) {
        return rejectApplication(workspaceCode, applicationId, null);
    }

    @Transactional
    public WorkspaceJoinApplicationItem rejectApplication(
            String workspaceCode,
            Long applicationId,
            String rejectReason
    ) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        WorkspaceJoinApplicationEntity application = requireWorkspaceApplication(workspace, applicationId);
        requirePending(application);
        application.setRejectReason(normalizeRejectReason(rejectReason));
        updateApplicationStatus(application, STATUS_REJECTED);
        return toApplicationItem(application);
    }

    @Transactional
    public WorkspaceInvitationItem createInvitation(
            String workspaceCode,
            CreateWorkspaceInvitationRequest request
    ) {
        WorkspaceEntity workspace = workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        int validDays = request.validDays() == null ? 7 : request.validDays();
        int maxUses = request.maxUses() == null ? 20 : request.maxUses();
        String invitationCode = generateInvitationCode();
        LocalDateTime now = LocalDateTime.now();

        WorkspaceInvitationEntity invitation = new WorkspaceInvitationEntity();
        invitation.setWorkspaceId(workspace.getId());
        invitation.setInviteCodeHash(hashInvitationCode(invitationCode));
        invitation.setCreatedBy(CurrentUserContext.get());
        invitation.setExpiresAt(now.plusDays(validDays));
        invitation.setMaxUses(maxUses);
        invitation.setUsedCount(0);
        invitation.setStatus(1);
        invitation.setCreatedAt(now);
        invitation.setUpdatedAt(now);
        invitationMapper.insert(invitation);

        return new WorkspaceInvitationItem(
                invitation.getId(),
                workspace.getWorkspaceCode(),
                invitationCode,
                invitation.getExpiresAt().toString(),
                invitation.getMaxUses()
        );
    }

    @Transactional
    public WorkspaceItem joinByInvitation(JoinWorkspaceByInvitationRequest request) {
        String normalizedCode = normalizeInvitationCode(request.invitationCode());
        WorkspaceInvitationEntity invitation = invitationMapper.selectOne(
                new LambdaQueryWrapper<WorkspaceInvitationEntity>()
                        .eq(WorkspaceInvitationEntity::getInviteCodeHash, hashInvitationCode(normalizedCode))
                        .eq(WorkspaceInvitationEntity::getStatus, 1)
                        .last("limit 1")
        );
        if (invitation == null || invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("邀请码无效或已过期");
        }
        if (invitation.getUsedCount() >= invitation.getMaxUses()) {
            throw new BadRequestException("邀请码使用次数已达上限");
        }

        WorkspaceEntity workspace = workspaceDomainService.requireWorkspaceById(invitation.getWorkspaceId());
        Long userId = CurrentUserContext.get();
        if (!workspaceAccessSupport.isPlatformAdmin()) {
            workspaceMemberDomainService.addApprovedMember(workspace, userId);
        }
        invitation.setUsedCount(invitation.getUsedCount() + 1);
        if (invitation.getUsedCount() >= invitation.getMaxUses()) {
            invitation.setStatus(0);
        }
        invitation.setUpdatedAt(LocalDateTime.now());
        invitationMapper.updateById(invitation);

        WorkspaceJoinApplicationEntity pending = applicationMapper.selectOne(
                new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                        .eq(WorkspaceJoinApplicationEntity::getWorkspaceId, workspace.getId())
                        .eq(WorkspaceJoinApplicationEntity::getApplicantUserId, userId)
                        .eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING)
                        .last("limit 1")
        );
        if (pending != null) {
            updateApplicationStatus(pending, STATUS_APPROVED);
        }
        return workspaceDomainService.toWorkspaceItem(workspace);
    }

    private WorkspaceJoinCandidateItem toCandidateItem(WorkspaceEntity workspace) {
        long memberCount = workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getStatus, 1));
        UserEntity owner = workspace.getOwnerUserId() == null
                ? null
                : userService.findActiveUser(workspace.getOwnerUserId());
        String ownerName = owner == null ? "工作区管理员" : firstNonBlank(owner.getDisplayName(), owner.getUsername());
        return new WorkspaceJoinCandidateItem(
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                workspace.getDescription(),
                memberCount,
                ownerName
        );
    }

    private WorkspaceJoinApplicationItem toApplicationItem(WorkspaceJoinApplicationEntity application) {
        WorkspaceEntity workspace = workspaceDomainService.requireWorkspaceById(application.getWorkspaceId());
        UserEntity applicant = userService.requireAnyUser(application.getApplicantUserId());
        return new WorkspaceJoinApplicationItem(
                application.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                workspace.getDescription(),
                applicant.getId(),
                firstNonBlank(applicant.getDisplayName(), applicant.getUsername()),
                application.getStatus(),
                application.getCreatedAt() == null ? null : application.getCreatedAt().toString()
        );
    }

    private WorkspaceJoinApplicationEntity requireApplication(Long applicationId) {
        WorkspaceJoinApplicationEntity application = applicationMapper.selectById(applicationId);
        if (application == null) {
            throw new NotFoundException("工作区申请不存在");
        }
        return application;
    }

    private WorkspaceJoinApplicationEntity requireWorkspaceApplication(
            WorkspaceEntity workspace,
            Long applicationId
    ) {
        WorkspaceJoinApplicationEntity application = requireApplication(applicationId);
        if (!workspace.getId().equals(application.getWorkspaceId())) {
            throw new NotFoundException("工作区申请不存在");
        }
        return application;
    }

    private void requirePending(WorkspaceJoinApplicationEntity application) {
        if (!STATUS_PENDING.equals(application.getStatus())) {
            throw new BadRequestException("当前申请已经处理");
        }
    }

    private void updateApplicationStatus(WorkspaceJoinApplicationEntity application, String status) {
        application.setStatus(status);
        application.setUpdatedAt(LocalDateTime.now());
        applicationMapper.updateById(application);
    }

    private boolean hasActiveMembership(Long workspaceId, Long userId) {
        return workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceMemberEntity::getUserId, userId)
                .eq(WorkspaceMemberEntity::getStatus, 1)) > 0;
    }

    private boolean hasPendingApplication(Long workspaceId, Long userId) {
        return applicationMapper.selectCount(new LambdaQueryWrapper<WorkspaceJoinApplicationEntity>()
                .eq(WorkspaceJoinApplicationEntity::getWorkspaceId, workspaceId)
                .eq(WorkspaceJoinApplicationEntity::getApplicantUserId, userId)
                .eq(WorkspaceJoinApplicationEntity::getStatus, STATUS_PENDING)) > 0;
    }

    private String normalizeApplicationStatus(String status, boolean allowBlank) {
        if (status == null || status.isBlank()) {
            return allowBlank ? null : STATUS_PENDING;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!List.of(STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_CANCELLED).contains(normalized)) {
            throw new BadRequestException("无效的申请状态");
        }
        return normalized;
    }

    private String normalizeRejectReason(String rejectReason) {
        if (rejectReason == null || rejectReason.isBlank()) {
            return "申请被管理员拒绝";
        }
        String normalized = rejectReason.trim();
        if (normalized.length() > 500) {
            throw new BadRequestException("拒绝原因不能超过500个字符");
        }
        return normalized;
    }

    private String generateInvitationCode() {
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder result = new StringBuilder(9);
            for (int index = 0; index < 8; index++) {
                if (index == 4) {
                    result.append('-');
                }
                result.append(INVITATION_ALPHABET.charAt(secureRandom.nextInt(INVITATION_ALPHABET.length())));
            }
            String code = result.toString();
            if (invitationMapper.selectCount(new LambdaQueryWrapper<WorkspaceInvitationEntity>()
                    .eq(WorkspaceInvitationEntity::getInviteCodeHash, hashInvitationCode(code))) == 0) {
                return code;
            }
        }
        throw new BadRequestException("邀请码生成失败，请稍后重试");
    }

    private String hashInvitationCode(String invitationCode) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(
                    normalizeInvitationCode(invitationCode).getBytes(StandardCharsets.UTF_8)
            ));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is unavailable", exception);
        }
    }

    private String normalizeInvitationCode(String invitationCode) {
        return invitationCode == null ? "" : invitationCode.trim().toUpperCase(Locale.ROOT);
    }

    private boolean containsIgnoreCase(String value, String normalizedQuery) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(normalizedQuery);
    }

    private String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }
}
