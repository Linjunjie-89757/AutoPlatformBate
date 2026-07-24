package com.company.autoplatform.runner;

import org.springframework.core.io.Resource;

import java.time.Instant;

record LocalRunnerReleaseInfoResponse(
        String version,
        String platform,
        String architecture,
        String packageType,
        String fileName,
        long fileSize,
        Instant updatedAt,
        boolean available,
        String downloadPath
) {
}

record LocalRunnerReleaseDownload(
        Resource resource,
        String fileName,
        String contentType,
        long fileSize
) {
}
