package com.company.autoplatform.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String INVALID_TOKEN_MESSAGE = "重置链接无效或已过期，请重新申请";

    private final UserMapper userMapper;
    private final PasswordResetTokenMapper tokenMapper;
    private final PasswordResetMailService mailService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedSessionService authenticatedSessionService;
    private final String frontendBaseUrl;
    private final long validMinutes;
    private final long resendCooldownSeconds;

    public PasswordResetService(
            UserMapper userMapper,
            PasswordResetTokenMapper tokenMapper,
            PasswordResetMailService mailService,
            PasswordEncoder passwordEncoder,
            AuthenticatedSessionService authenticatedSessionService,
            @Value("${app.password-reset.frontend-base-url:http://localhost:5173}") String frontendBaseUrl,
            @Value("${app.password-reset.token-valid-minutes:30}") long validMinutes,
            @Value("${app.password-reset.resend-cooldown-seconds:60}") long resendCooldownSeconds
    ) {
        this.userMapper = userMapper;
        this.tokenMapper = tokenMapper;
        this.mailService = mailService;
        this.passwordEncoder = passwordEncoder;
        this.authenticatedSessionService = authenticatedSessionService;
        this.frontendBaseUrl = frontendBaseUrl;
        this.validMinutes = validMinutes;
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    @Transactional
    public PasswordResetRequestResponse requestReset(String email) {
        String normalizedEmail = email.trim();
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .apply("LOWER(email) = LOWER({0})", normalizedEmail)
                .last("limit 1"));
        PasswordResetRequestResponse response = new PasswordResetRequestResponse(resendCooldownSeconds, validMinutes);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            return response;
        }

        LocalDateTime now = LocalDateTime.now();
        PasswordResetTokenEntity latest = tokenMapper.selectOne(new LambdaQueryWrapper<PasswordResetTokenEntity>()
                .eq(PasswordResetTokenEntity::getUserId, user.getId())
                .isNull(PasswordResetTokenEntity::getUsedAt)
                .orderByDesc(PasswordResetTokenEntity::getCreatedAt)
                .last("limit 1"));
        if (latest != null && latest.getCreatedAt() != null
                && latest.getCreatedAt().isAfter(now.minusSeconds(resendCooldownSeconds))) {
            return response;
        }

        markUnusedTokensAsUsed(user.getId(), now);

        String rawToken = generateToken();
        PasswordResetTokenEntity token = new PasswordResetTokenEntity();
        token.setUserId(user.getId());
        token.setTokenHash(hashToken(rawToken));
        token.setExpiresAt(now.plusMinutes(validMinutes));
        token.setCreatedAt(now);
        token.setUpdatedAt(now);
        tokenMapper.insert(token);

        String resetUrl = UriComponentsBuilder.fromUriString(frontendBaseUrl)
                .path("/reset-password")
                .queryParam("token", rawToken)
                .build()
                .toUriString();
        mailService.sendResetLink(normalizedEmail, user.getDisplayName(), resetUrl, validMinutes);
        return response;
    }

    @Transactional
    public void confirmReset(String rawToken, String newPassword) {
        validatePassword(newPassword);
        LocalDateTime now = LocalDateTime.now();
        PasswordResetTokenEntity token = tokenMapper.selectOne(new LambdaQueryWrapper<PasswordResetTokenEntity>()
                .eq(PasswordResetTokenEntity::getTokenHash, hashToken(rawToken.trim()))
                .isNull(PasswordResetTokenEntity::getUsedAt)
                .last("limit 1"));
        if (token == null || token.getExpiresAt() == null || !token.getExpiresAt().isAfter(now)) {
            throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }

        PasswordResetTokenEntity consumed = new PasswordResetTokenEntity();
        consumed.setUsedAt(now);
        consumed.setUpdatedAt(now);
        int consumedRows = tokenMapper.update(consumed, new LambdaUpdateWrapper<PasswordResetTokenEntity>()
                .eq(PasswordResetTokenEntity::getId, token.getId())
                .isNull(PasswordResetTokenEntity::getUsedAt)
                .gt(PasswordResetTokenEntity::getExpiresAt, now));
        if (consumedRows != 1) {
            throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }

        UserEntity user = userMapper.selectById(token.getUserId());
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(now);
        userMapper.updateById(user);
        markUnusedTokensAsUsed(user.getId(), now);
        authenticatedSessionService.expireUserSessions(user.getId());
    }

    private void markUnusedTokensAsUsed(Long userId, LocalDateTime now) {
        PasswordResetTokenEntity patch = new PasswordResetTokenEntity();
        patch.setUsedAt(now);
        patch.setUpdatedAt(now);
        tokenMapper.update(patch, new LambdaUpdateWrapper<PasswordResetTokenEntity>()
                .eq(PasswordResetTokenEntity::getUserId, userId)
                .isNull(PasswordResetTokenEntity::getUsedAt));
    }

    private void validatePassword(String password) {
        if (password.length() < 8 || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw new BadRequestException("新密码至少 8 个字符，并且必须包含字母和数字");
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
