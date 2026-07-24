package com.company.autoplatform.runner;

import com.company.autoplatform.common.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class LocalRunnerReleaseService {

    static final String WINDOWS_X64_DOWNLOAD_PATH =
            "/api/local-runner/releases/latest/windows-x64/download";
    private static final String WINDOWS_PLATFORM = "WINDOWS";
    private static final String X64_ARCHITECTURE = "X64";
    private static final String PORTABLE_ZIP_PACKAGE_TYPE = "PORTABLE_ZIP";
    private static final String ZIP_CONTENT_TYPE = "application/zip";

    private final Path releaseRoot;
    private final String version;
    private final String windowsX64FileName;

    public LocalRunnerReleaseService(
            @Value("${app.local-runner.release-root:../release/local-runner}") String releaseRoot,
            @Value("${app.local-runner.release-version:0.1.0}") String version,
            @Value("${app.local-runner.windows-x64-file:Auto-Platform-Local-Runner-v0.1.0-windows-x64.zip}")
            String windowsX64FileName
    ) {
        this.releaseRoot = Path.of(releaseRoot).toAbsolutePath().normalize();
        this.version = requireText(version, "Local Runner release version");
        this.windowsX64FileName = requireText(windowsX64FileName, "Local Runner release file name");
        resolveWindowsX64Archive();
    }

    public LocalRunnerReleaseInfoResponse latestWindowsX64() {
        Path archive = resolveWindowsX64Archive();
        if (!Files.isRegularFile(archive) || !Files.isReadable(archive)) {
            return new LocalRunnerReleaseInfoResponse(
                    version,
                    WINDOWS_PLATFORM,
                    X64_ARCHITECTURE,
                    PORTABLE_ZIP_PACKAGE_TYPE,
                    windowsX64FileName,
                    0L,
                    null,
                    false,
                    WINDOWS_X64_DOWNLOAD_PATH
            );
        }
        try {
            return new LocalRunnerReleaseInfoResponse(
                    version,
                    WINDOWS_PLATFORM,
                    X64_ARCHITECTURE,
                    PORTABLE_ZIP_PACKAGE_TYPE,
                    windowsX64FileName,
                    Files.size(archive),
                    Files.getLastModifiedTime(archive).toInstant(),
                    true,
                    WINDOWS_X64_DOWNLOAD_PATH
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read Local Runner release metadata", exception);
        }
    }

    public LocalRunnerReleaseDownload downloadLatestWindowsX64() {
        LocalRunnerReleaseInfoResponse release = latestWindowsX64();
        if (!release.available()) {
            throw new NotFoundException("Local Runner 安装包尚未发布");
        }
        Path archive = resolveWindowsX64Archive();
        return new LocalRunnerReleaseDownload(
                new FileSystemResource(archive),
                release.fileName(),
                ZIP_CONTENT_TYPE,
                release.fileSize()
        );
    }

    private Path resolveWindowsX64Archive() {
        Path archive = releaseRoot.resolve(windowsX64FileName).normalize();
        if (!archive.startsWith(releaseRoot)) {
            throw new IllegalArgumentException("Local Runner release file must stay within release root");
        }
        return archive;
    }

    private static String requireText(String value, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return normalized;
    }
}
