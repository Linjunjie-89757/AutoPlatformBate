package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Service
public class PlatformLoginFailureNotificationService {

    private static final int ALERT_THRESHOLD = 5;
    private static final int ACCOUNT_LOCK_THRESHOLD = 5;
    private static final int ADDRESS_LOCK_THRESHOLD = 20;
    private static final long WINDOW_MINUTES = 15;
    private static final long LOCK_MINUTES = 15;

    private final PlatformLoginFailureStateMapper stateMapper;
    private final UserMapper userMapper;
    private final PlatformNotificationSettingsService notificationService;

    public PlatformLoginFailureNotificationService(
            PlatformLoginFailureStateMapper stateMapper,
            UserMapper userMapper,
            PlatformNotificationSettingsService notificationService
    ) {
        this.stateMapper = stateMapper;
        this.userMapper = userMapper;
        this.notificationService = notificationService;
    }

    public void assertAllowed(String account, String clientAddress) {
        LocalDateTime now = LocalDateTime.now();
        LoginRestriction addressRestriction = activeRestriction(addressKey(clientAddress), false, now);
        if (addressRestriction != null) {
            throw addressRestriction.toException();
        }

        AccountReference accountReference = resolveAccount(account);
        LoginRestriction accountRestriction = activeRestriction(accountReference.key(), accountReference.user() != null, now);
        if (accountRestriction != null) {
            throw accountRestriction.toException();
        }
    }

    @Transactional
    public LoginRestriction recordFailure(String account, String clientAddress) {
        AccountReference accountReference = resolveAccount(account);
        if (accountReference.key() == null) return null;

        LocalDateTime now = LocalDateTime.now();
        PlatformLoginFailureStateEntity accountState = recordFailure(
                accountReference.key(), ACCOUNT_LOCK_THRESHOLD, now);
        PlatformLoginFailureStateEntity addressState = recordFailure(
                addressKey(clientAddress), ADDRESS_LOCK_THRESHOLD, now);

        if (accountState.getFailureCount() >= ALERT_THRESHOLD && accountState.getAlertedAt() == null) {
            accountState.setAlertedAt(now);
            accountState.setUpdatedAt(now);
            stateMapper.updateById(accountState);
            sendAlert(accountReference.user(), account, accountState.getFailureCount(), now);
        }

        LoginRestriction addressRestriction = restriction(addressState, false, now);
        if (addressRestriction != null) return addressRestriction;
        return restriction(accountState, accountReference.user() != null, now);
    }

    @Transactional
    public void clear(String account) {
        String accountKey = resolveAccount(account).key();
        if (accountKey == null) return;
        stateMapper.delete(new LambdaQueryWrapper<PlatformLoginFailureStateEntity>()
                .eq(PlatformLoginFailureStateEntity::getAccountKey, accountKey));
    }

    private PlatformLoginFailureStateEntity recordFailure(String key, int lockThreshold, LocalDateTime now) {
        PlatformLoginFailureStateEntity state = find(key);
        if (state == null) {
            state = new PlatformLoginFailureStateEntity();
            state.setAccountKey(key);
            state.setFailureCount(1);
            state.setWindowStartedAt(now);
            state.setLastFailedAt(now);
            state.setCreatedAt(now);
            state.setUpdatedAt(now);
            if (lockThreshold <= 1) state.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
            stateMapper.insert(state);
            return state;
        }

        if (state.getWindowStartedAt().isBefore(now.minusMinutes(WINDOW_MINUTES))) {
            state.setFailureCount(1);
            state.setWindowStartedAt(now);
            state.setAlertedAt(null);
            state.setLockedUntil(null);
        } else {
            state.setFailureCount(state.getFailureCount() + 1);
        }
        state.setLastFailedAt(now);
        state.setUpdatedAt(now);
        if (state.getFailureCount() >= lockThreshold) {
            state.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
        }
        stateMapper.updateById(state);
        return state;
    }

    private LoginRestriction activeRestriction(String key, boolean knownAccount, LocalDateTime now) {
        if (key == null) return null;
        return restriction(find(key), knownAccount, now);
    }

    private LoginRestriction restriction(
            PlatformLoginFailureStateEntity state,
            boolean knownAccount,
            LocalDateTime now
    ) {
        if (state == null || state.getLockedUntil() == null || !state.getLockedUntil().isAfter(now)) return null;
        long retryAfterSeconds = Math.max(1L, Duration.between(now, state.getLockedUntil()).toSeconds());
        long retryAfterMinutes = Math.max(1L, (retryAfterSeconds + 59L) / 60L);
        String message = knownAccount
                ? "操作过于频繁，该账户已被临时锁定，请于 %d 分钟后重试".formatted(retryAfterMinutes)
                : "操作过于频繁，请于 %d 分钟后重试".formatted(retryAfterMinutes);
        return new LoginRestriction(message, retryAfterSeconds);
    }

    private void sendAlert(UserEntity account, String attemptedAccount, int failureCount, LocalDateTime failedAt) {
        Set<String> recipients = new LinkedHashSet<>();
        if (account != null && account.getEmail() != null && !account.getEmail().isBlank()) {
            recipients.add(account.getEmail());
        }
        userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                        .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                        .eq(UserEntity::getStatus, 1))
                .stream()
                .map(UserEntity::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .forEach(recipients::add);

        String content = "账号“%s”在 15 分钟内连续登录失败 %d 次，最近失败时间：%s。若非本人操作，请及时检查账号安全。"
                .formatted(attemptedAccount, failureCount, failedAt);
        recipients.forEach(recipient -> notificationService.sendOptional(
                "login-fail", recipient, "AutoTest 连续登录失败告警", content));
    }

    private PlatformLoginFailureStateEntity find(String accountKey) {
        return stateMapper.selectOne(new LambdaQueryWrapper<PlatformLoginFailureStateEntity>()
                .eq(PlatformLoginFailureStateEntity::getAccountKey, accountKey)
                .last("limit 1"));
    }

    private AccountReference resolveAccount(String account) {
        String normalized = normalize(account);
        if (normalized == null) return new AccountReference(null, null);
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .and(query -> query.apply("LOWER(username) = {0}", normalized)
                        .or()
                        .apply("LOWER(email) = {0}", normalized))
                .last("limit 1"));
        return user == null
                ? new AccountReference("account:input:" + normalized, null)
                : new AccountReference("account:user:" + user.getId(), user);
    }

    private String addressKey(String clientAddress) {
        String normalized = normalize(clientAddress);
        return "address:" + (normalized == null ? "unknown" : normalized);
    }

    private String normalize(String account) {
        if (account == null || account.isBlank()) return null;
        return account.trim().toLowerCase(Locale.ROOT);
    }

    private record AccountReference(String key, UserEntity user) {
    }

    public record LoginRestriction(String message, long retryAfterSeconds) {
        public com.company.autoplatform.auth.LoginRateLimitException toException() {
            return new com.company.autoplatform.auth.LoginRateLimitException(message, retryAfterSeconds);
        }
    }
}
