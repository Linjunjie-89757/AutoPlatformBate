package com.company.autoplatform.runner;

import com.company.autoplatform.common.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalRunnerReleaseServiceTests {

    private static final String FILE_NAME = "Auto-Platform-Local-Runner-v0.1.1-windows-x64.zip";

    @TempDir
    Path releaseRoot;

    @Test
    void reportsUnavailableReleaseWithoutPretendingDownloadExists() {
        LocalRunnerReleaseService service = new LocalRunnerReleaseService(
                releaseRoot.toString(),
                "0.1.1",
                FILE_NAME
        );

        var release = service.latestWindowsX64();

        assertThat(release.version()).isEqualTo("0.1.1");
        assertThat(release.platform()).isEqualTo("WINDOWS");
        assertThat(release.architecture()).isEqualTo("X64");
        assertThat(release.packageType()).isEqualTo("PORTABLE_ZIP");
        assertThat(release.fileName()).isEqualTo(FILE_NAME);
        assertThat(release.fileSize()).isZero();
        assertThat(release.updatedAt()).isNull();
        assertThat(release.available()).isFalse();
        assertThat(release.downloadPath()).isEqualTo(
                "/api/local-runner/releases/latest/windows-x64/download"
        );
        assertThatThrownBy(service::downloadLatestWindowsX64)
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Local Runner 安装包尚未发布");
    }

    @Test
    void exposesCompletePortableArchiveWhenReleaseExists() throws Exception {
        byte[] content = "portable-runner-archive".getBytes();
        Files.write(releaseRoot.resolve(FILE_NAME), content);
        LocalRunnerReleaseService service = new LocalRunnerReleaseService(
                releaseRoot.toString(),
                "0.1.1",
                FILE_NAME
        );

        var release = service.latestWindowsX64();
        var download = service.downloadLatestWindowsX64();

        assertThat(release.available()).isTrue();
        assertThat(release.fileSize()).isEqualTo(content.length);
        assertThat(release.updatedAt()).isNotNull();
        assertThat(download.fileName()).isEqualTo(FILE_NAME);
        assertThat(download.contentType()).isEqualTo("application/zip");
        assertThat(download.fileSize()).isEqualTo(content.length);
        assertThat(download.resource().getInputStream().readAllBytes()).isEqualTo(content);
    }
}
