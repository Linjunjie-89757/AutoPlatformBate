package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Service
public class PlatformLoginFailureNotificationService {

    private static final int ALERT_THRESHOLD = 5;
    private static final long WINDOW_MINUTES = 15;

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

    @Transactional
    public void recordFailure(String account) {
        String accountKey = normalize(account);
        if (accountKey == null) return;

        LocalDateTime now = LocalDateTime.now();
        PlatformLoginFailureStateEntity state = find(accountKey);
        if (state == null) {
            state = new PlatformLoginFailureStateEntity();
            state.setAccountKey(accountKey);
            state.setFailureCount(1);
            state.setWindowStartedAt(now);
            state.setLastFailedAt(now);
            state.setCreatedAt(now);
            state.setUpdatedAt(now);
            stateMapper.insert(state);
            return;
        }

        if (state.getWindowStartedAt().isBefore(now.minusMinutes(WINDOW_MINUTES))) {
            state.setFailureCount(1);
            state.setWindowStartedAt(now);
            state.setAlertedAt(null);
        } else {
            state.setFailureCount(state.getFailureCount() + 1);
        }
        state.setLastFailedAt(now);
        state.setUpdatedAt(now);

        boolean shouldAlert = state.getFailureCount() >= ALERT_THRESHOLD && state.getAlertedAt() == null;
        if (shouldAlert) state.setAlertedAt(now);
        stateMapper.updateById(state);
        if (shouldAlert) sendAlert(accountKey, state.getFailureCount(), now);
    }

    @Transactional
    public void clear(String account) {
        String accountKey = normalize(account);
        if (accountKey == null) return;
        stateMapper.delete(new LambdaQueryWrapper<PlatformLoginFailureStateEntity>()
                .eq(PlatformLoginFailureStateEntity::getAccountKey, accountKey));
    }

    private void sendAlert(String accountKey, int failureCount, LocalDateTime failedAt) {
        UserEntity account = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .and(query -> query.eq(UserEntity::getUsername, accountKey).or().eq(UserEntity::getEmail, accountKey))
                .last("limit 1"));
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
                .formatted(accountKey, failureCount, failedAt);
        recipients.forEach(recipient -> notificationService.sendOptional(
                "login-fail", recipient, "AutoTest 连续登录失败告警", content));
    }

    private PlatformLoginFailureStateEntity find(String accountKey) {
        return stateMapper.selectOne(new LambdaQueryWrapper<PlatformLoginFailureStateEntity>()
                .eq(PlatformLoginFailureStateEntity::getAccountKey, accountKey)
                .last("limit 1"));
    }

    private String normalize(String account) {
        if (account == null || account.isBlank()) return null;
        return account.trim().toLowerCase(Locale.ROOT);
    }
}
