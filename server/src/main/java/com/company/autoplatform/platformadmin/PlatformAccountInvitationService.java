package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.auth.AccountActivationInfo;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserRoleSupport;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PlatformAccountInvitationService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String INVALID_TOKEN_MESSAGE = "激活链接无效或已过期，请联系管理员重新邀请";

    private final PlatformAccountInvitationMapper invitationMapper;
    private final UserMapper userMapper;
    private final UserRoleSupport userRoleSupport;
    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final PlatformNotificationSettingsService notificationService;
    private final PasswordEncoder passwordEncoder;
    private final String frontendBaseUrl;
    private final long validHours;

    public PlatformAccountInvitationService(
            PlatformAccountInvitationMapper invitationMapper,
            UserMapper userMapper,
            UserRoleSupport userRoleSupport,
            WorkspaceAccessSupport workspaceAccessSupport,
            PlatformNotificationSettingsService notificationService,
            PasswordEncoder passwordEncoder,
            @Value("${app.account-invitation.frontend-base-url:${app.password-reset.frontend-base-url:http://localhost:5173}}") String frontendBaseUrl,
            @Value("${app.account-invitation.token-valid-hours:48}") long validHours
    ) {
        this.invitationMapper = invitationMapper;
        this.userMapper = userMapper;
        this.userRoleSupport = userRoleSupport;
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.notificationService = notificationService;
        this.passwordEncoder = passwordEncoder;
        this.frontendBaseUrl = frontendBaseUrl;
        this.validHours = validHours;
    }

    @Transactional
    public PlatformAccountInvitationItem createInvitation(CreatePlatformAccountInvitationRequest request) {
        requireSuperAdmin();
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String storedRole = userRoleSupport.normalizeStoredRole(request.roleCode());
        userRoleSupport.requireAssignableRole(storedRole);

        UserEntity user = findUserByEmail(email);
        if (user != null && user.getPassword() != null && !user.getPassword().isBlank()) {
            throw new BadRequestException("该邮箱已注册为平台账号");
        }
        LocalDateTime now = LocalDateTime.now();
        if (user == null) {
            user = new UserEntity();
            user.setUsername(generateUsername(email));
            user.setEmail(email);
            user.setDisplayName(request.displayName().trim());
            user.setRoleCode(storedRole);
            user.setCreationSource("INVITATION");
            user.setPassword(null);
            user.setStatus(1);
            user.setCreatedAt(now);
            user.setUpdatedAt(now);
            userMapper.insert(user);
        } else {
            user.setDisplayName(request.displayName().trim());
            user.setRoleCode(storedRole);
            user.setCreationSource("INVITATION");
            user.setStatus(1);
            user.setUpdatedAt(now);
            userMapper.updateById(user);
        }

        revokeUnusedInvitations(user.getId(), now);
        String rawToken = generateToken();
        PlatformAccountInvitationEntity invitation = new PlatformAccountInvitationEntity();
        invitation.setUserId(user.getId());
        invitation.setTokenHash(hashToken(rawToken));
        invitation.setExpiresAt(now.plusHours(validHours));
        invitation.setCreatedBy(CurrentUserContext.get());
        invitation.setSendStatus("SENDING");
        invitation.setSendAttempts(1);
        invitation.setLastSendAt(now);
        invitation.setCreatedAt(now);
        invitation.setUpdatedAt(now);
        invitationMapper.insert(invitation);

        String activationUrl = UriComponentsBuilder.fromUriString(frontendBaseUrl)
                .path("/activate-account")
                .queryParam("token", rawToken)
                .build()
                .toUriString();
        try {
            notificationService.sendRequired(
                    "invite",
                    email,
                    "AutoTest 平台账号邀请",
                    "您好，%s：\n\n管理员邀请你加入 AutoTest 平台。请在 %d 小时内打开以下链接设置密码并激活账号：\n\n%s\n\n如果你没有申请加入，请忽略此邮件。"
                            .formatted(user.getDisplayName(), validHours, activationUrl)
            );
            invitation.setSendStatus("SENT");
            invitation.setSentAt(LocalDateTime.now());
            invitation.setSendError(null);
        } catch (RuntimeException exception) {
            invitation.setSendStatus("FAILED");
            invitation.setSendError(normalizeSendError(exception));
        }
        invitation.setUpdatedAt(LocalDateTime.now());
        invitationMapper.updateById(invitation);
        return toItem(invitation, user, invitation.getSendStatus(), "当前管理员", "MANUAL");
    }

    public List<PlatformAccountInvitationItem> listInvitations() {
        requireSuperAdmin();
        LocalDateTime now = LocalDateTime.now();
        List<PlatformAccountInvitationItem> records = new ArrayList<>(invitationMapper.selectList(new LambdaQueryWrapper<PlatformAccountInvitationEntity>()
                        .orderByDesc(PlatformAccountInvitationEntity::getCreatedAt))
                .stream()
                .map(invitation -> {
                    UserEntity user = userMapper.selectById(invitation.getUserId());
                    if (user == null) return null;
                    UserEntity operator = invitation.getCreatedBy() == null ? null : userMapper.selectById(invitation.getCreatedBy());
                    return toItem(invitation, user, invitationStatus(invitation, now),
                            operator == null ? "系统" : operator.getDisplayName(), "MANUAL");
                })
                .filter(java.util.Objects::nonNull)
                .toList());

        userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                        .eq(UserEntity::getCreationSource, "BATCH")
                        .orderByDesc(UserEntity::getCreatedAt))
                .stream()
                .map(user -> toBatchItem(user))
                .forEach(records::add);

        return records.stream()
                .sorted(Comparator.comparing(PlatformAccountInvitationItem::invitedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional
    public PlatformAccountInvitationItem resendInvitation(Long invitationId) {
        requireSuperAdmin();
        PlatformAccountInvitationEntity invitation = invitationMapper.selectById(invitationId);
        if (invitation == null) throw new BadRequestException("邀请记录不存在");
        if (invitation.getAcceptedAt() != null) throw new BadRequestException("该账号已经激活，不能重新发送邀请");
        if (invitation.getRevokedAt() != null) throw new BadRequestException("该邀请已撤销，请从账号管理重新发起邀请");
        String status = invitationStatus(invitation, LocalDateTime.now());
        if (!"FAILED".equals(status) && !"EXPIRED".equals(status)) {
            throw new BadRequestException("当前邀请仍有效，无需重复发送");
        }
        UserEntity user = userMapper.selectById(invitation.getUserId());
        if (user == null) throw new BadRequestException("被邀请账号不存在");
        return createInvitation(new CreatePlatformAccountInvitationRequest(
                user.getDisplayName(), user.getEmail(), null, user.getRoleCode()));
    }

    @Transactional
    public PlatformAccountInvitationItem revokeInvitation(Long invitationId) {
        requireSuperAdmin();
        PlatformAccountInvitationEntity invitation = invitationMapper.selectById(invitationId);
        if (invitation == null) throw new BadRequestException("邀请记录不存在");
        if (invitation.getAcceptedAt() != null) throw new BadRequestException("该账号已经激活，不能撤销邀请");
        if (invitation.getRevokedAt() == null) {
            LocalDateTime now = LocalDateTime.now();
            PlatformAccountInvitationEntity patch = new PlatformAccountInvitationEntity();
            patch.setRevokedAt(now);
            patch.setUpdatedAt(now);
            invitationMapper.update(patch, new LambdaUpdateWrapper<PlatformAccountInvitationEntity>()
                    .eq(PlatformAccountInvitationEntity::getId, invitationId)
                    .isNull(PlatformAccountInvitationEntity::getAcceptedAt)
                    .isNull(PlatformAccountInvitationEntity::getRevokedAt));
            invitation.setRevokedAt(now);
        }
        UserEntity user = userMapper.selectById(invitation.getUserId());
        if (user == null) throw new BadRequestException("被邀请账号不存在");
        UserEntity operator = invitation.getCreatedBy() == null ? null : userMapper.selectById(invitation.getCreatedBy());
        return toItem(invitation, user, "REVOKED", operator == null ? "系统" : operator.getDisplayName(), "MANUAL");
    }

    public AccountActivationInfo validateInvitation(String rawToken) {
        PlatformAccountInvitationEntity invitation = requireValidInvitation(rawToken);
        UserEntity user = requirePendingUser(invitation.getUserId());
        return new AccountActivationInfo(user.getEmail(), user.getDisplayName(), invitation.getExpiresAt());
    }

    @Transactional
    public void activate(String rawToken, String password) {
        validatePassword(password);
        PlatformAccountInvitationEntity invitation = requireValidInvitation(rawToken);
        UserEntity user = requirePendingUser(invitation.getUserId());
        LocalDateTime now = LocalDateTime.now();

        PlatformAccountInvitationEntity consumed = new PlatformAccountInvitationEntity();
        consumed.setAcceptedAt(now);
        consumed.setUpdatedAt(now);
        int rows = invitationMapper.update(consumed, new LambdaUpdateWrapper<PlatformAccountInvitationEntity>()
                .eq(PlatformAccountInvitationEntity::getId, invitation.getId())
                .isNull(PlatformAccountInvitationEntity::getAcceptedAt)
                .isNull(PlatformAccountInvitationEntity::getRevokedAt)
                .gt(PlatformAccountInvitationEntity::getExpiresAt, now));
        if (rows != 1) throw new BadRequestException(INVALID_TOKEN_MESSAGE);

        user.setPassword(passwordEncoder.encode(password));
        user.setStatus(1);
        user.setUpdatedAt(now);
        userMapper.updateById(user);
        revokeUnusedInvitations(user.getId(), now);
        notificationService.sendOptional(
                "welcome",
                user.getEmail(),
                "AutoTest 账号已激活",
                "您好，%s：\n\n你的 AutoTest 平台账号已经激活，现在可以使用邮箱和刚设置的密码登录。"
                        .formatted(user.getDisplayName())
        );
    }

    private PlatformAccountInvitationEntity requireValidInvitation(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        LocalDateTime now = LocalDateTime.now();
        PlatformAccountInvitationEntity invitation = invitationMapper.selectOne(
                new LambdaQueryWrapper<PlatformAccountInvitationEntity>()
                        .eq(PlatformAccountInvitationEntity::getTokenHash, hashToken(rawToken.trim()))
                        .isNull(PlatformAccountInvitationEntity::getAcceptedAt)
                        .isNull(PlatformAccountInvitationEntity::getRevokedAt)
                        .gt(PlatformAccountInvitationEntity::getExpiresAt, now)
                        .last("limit 1"));
        if (invitation == null) throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        return invitation;
    }

    private UserEntity requirePendingUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || (user.getPassword() != null && !user.getPassword().isBlank())) {
            throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }
        return user;
    }

    private UserEntity findUserByEmail(String email) {
        return userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .apply("LOWER(email) = LOWER({0})", email)
                .last("limit 1"));
    }

    private String generateUsername(String email) {
        String base = email.substring(0, email.indexOf('@'))
                .replaceAll("[^A-Za-z0-9_]", "_");
        if (base.isBlank()) base = "user";
        if (base.length() > 48) base = base.substring(0, 48);
        String candidate = base;
        while (userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, candidate)
                .last("limit 1")) != null) {
            candidate = base + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        }
        return candidate;
    }

    private void revokeUnusedInvitations(Long userId, LocalDateTime now) {
        PlatformAccountInvitationEntity patch = new PlatformAccountInvitationEntity();
        patch.setRevokedAt(now);
        patch.setUpdatedAt(now);
        invitationMapper.update(patch, new LambdaUpdateWrapper<PlatformAccountInvitationEntity>()
                .eq(PlatformAccountInvitationEntity::getUserId, userId)
                .isNull(PlatformAccountInvitationEntity::getAcceptedAt)
                .isNull(PlatformAccountInvitationEntity::getRevokedAt));
    }

    private PlatformAccountInvitationItem toItem(
            PlatformAccountInvitationEntity invitation,
            UserEntity user,
            String status,
            String operatorName,
            String source
    ) {
        return new PlatformAccountInvitationItem(
                invitation.getId(), user.getId(), user.getEmail(), user.getDisplayName(),
                user.getRoleCode(), status, invitation.getCreatedAt(), invitation.getExpiresAt(),
                operatorName, source, invitation.getSendError()
        );
    }

    private PlatformAccountInvitationItem toBatchItem(UserEntity user) {
        return new PlatformAccountInvitationItem(
                -user.getId(), user.getId(), user.getEmail(), user.getDisplayName(),
                user.getRoleCode(), "ACTIVATED", user.getCreatedAt(), null,
                "平台管理员", "BATCH", null
        );
    }

    private String invitationStatus(PlatformAccountInvitationEntity invitation, LocalDateTime now) {
        if (invitation.getAcceptedAt() != null) return "ACTIVATED";
        if (invitation.getRevokedAt() != null) return "REVOKED";
        if (invitation.getSendStatus() != null && !invitation.getSendStatus().isBlank()) {
            if ("SENT".equals(invitation.getSendStatus())
                    && invitation.getExpiresAt() != null
                    && !invitation.getExpiresAt().isAfter(now)) {
                return "EXPIRED";
            }
            return invitation.getSendStatus();
        }
        if (invitation.getExpiresAt() != null && !invitation.getExpiresAt().isAfter(now)) return "EXPIRED";
        return "SENT";
    }

    private String normalizeSendError(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return "邮件发送失败，请检查 SMTP 配置后重试";
        return message.length() > 500 ? message.substring(0, 500) : message;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw new BadRequestException("密码至少 8 个字符，并且必须包含字母和数字");
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private void requireSuperAdmin() {
        if (!workspaceAccessSupport.isSuperAdmin()) {
            throw new org.springframework.security.access.AccessDeniedException("仅超级管理员可邀请平台账号");
        }
    }
}
