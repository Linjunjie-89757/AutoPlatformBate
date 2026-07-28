package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocalRunnerReleaseControllerTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsLatestWindowsReleaseMetadataForAuthenticatedUser() {
        authenticate();
        LocalRunnerReleaseService service = mock(LocalRunnerReleaseService.class);
        var release = new LocalRunnerReleaseInfoResponse(
                "0.1.1",
                "WINDOWS",
                "X64",
                "PORTABLE_ZIP",
                "runner.zip",
                1024L,
                Instant.parse("2026-07-23T00:00:00Z"),
                true,
                "/api/local-runner/releases/latest/windows-x64/download"
        );
        when(service.latestWindowsX64()).thenReturn(release);

        var response = new LocalRunnerReleaseController(service).latestWindowsX64();

        assertThat(response.data()).isEqualTo(release);
    }

    @Test
    void downloadsReleaseWithAttachmentHeaders() {
        authenticate();
        LocalRunnerReleaseService service = mock(LocalRunnerReleaseService.class);
        byte[] content = "runner-zip".getBytes();
        when(service.downloadLatestWindowsX64()).thenReturn(new LocalRunnerReleaseDownload(
                new ByteArrayResource(content),
                "Auto Platform Local Runner.zip",
                "application/zip",
                content.length
        ));

        var response = new LocalRunnerReleaseController(service).downloadLatestWindowsX64();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getHeaders().getContentType().toString()).isEqualTo("application/zip");
        assertThat(response.getHeaders().getContentLength()).isEqualTo(content.length);
        assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .contains("attachment")
                .contains("Auto%20Platform%20Local%20Runner.zip");
        assertThat(response.getBody()).isNotNull();
    }

    private void authenticate() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                1L,
                "superadmin",
                "Super Admin",
                "{noop}superadmin123",
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
