package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.runner.LocalRunnerModels.RunnerRegisterRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocalRunnerRegistrationCodeTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createsShortLivedRegistrationCode() {
        authenticate();
        LocalRunnerRegistrationCodeMapper codeMapper = mock(LocalRunnerRegistrationCodeMapper.class);
        when(codeMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        LocalDateTime before = LocalDateTime.now();

        var response = service(codeMapper).createRegistrationCode();

        assertThat(response.pairingCode()).matches("[A-Z2-9]{8}");
        assertThat(response.validSeconds()).isEqualTo(300);
        assertThat(Duration.between(before, response.expiresAt()).getSeconds()).isBetween(299L, 300L);
    }

    @Test
    void consumesRegistrationCodeWhenRegisteringRunner() {
        authenticate();
        LocalRunnerRegistrationCodeMapper codeMapper = mock(LocalRunnerRegistrationCodeMapper.class);
        when(codeMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(codeMapper.update(any(), any(LambdaUpdateWrapper.class))).thenReturn(1);
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        when(nodeMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        LocalRunnerService service = service(codeMapper, nodeMapper);
        String pairingCode = service.createRegistrationCode().pairingCode();
        var response = service.register(new RunnerRegisterRequest(
                "install-registration-test",
                pairingCode,
                "0.1.1",
                "1.0",
                Map.of("deviceName", "registration-test"),
                List.of("WEB_CASE_RUN")
        ));

        assertThat(response.accepted()).isTrue();
        assertThat(response.runnerId()).startsWith("runner_");
    }

    @Test
    void rejectsRegistrationCodeThatWasAlreadyConsumed() {
        authenticate();
        LocalRunnerRegistrationCodeMapper codeMapper = mock(LocalRunnerRegistrationCodeMapper.class);
        when(codeMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(codeMapper.update(any(), any(LambdaUpdateWrapper.class))).thenReturn(0);

        LocalRunnerService service = service(codeMapper);
        String pairingCode = service.createRegistrationCode().pairingCode();

        assertThatThrownBy(() -> service.register(new RunnerRegisterRequest(
                "install-registration-expired",
                pairingCode,
                "0.1.1",
                "1.0",
                Map.of(),
                List.of()
        )))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("注册码无效或已过期");
    }

    private LocalRunnerService service(LocalRunnerRegistrationCodeMapper codeMapper) {
        return service(codeMapper, mock(LocalRunnerNodeMapper.class));
    }

    private LocalRunnerService service(
            LocalRunnerRegistrationCodeMapper codeMapper,
            LocalRunnerNodeMapper nodeMapper
    ) {
        return new LocalRunnerService(
                nodeMapper,
                mock(LocalRunnerTaskMapper.class),
                mock(LocalRunnerTaskLogMapper.class),
                codeMapper,
                new ObjectMapper(),
                mock(org.springframework.context.ApplicationEventPublisher.class)
        );
    }

    private void authenticate() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "runner-admin",
                "Runner Admin",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));
    }
}
