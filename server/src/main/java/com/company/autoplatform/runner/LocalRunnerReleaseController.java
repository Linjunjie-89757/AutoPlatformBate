package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.ApiResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/local-runner/releases")
public class LocalRunnerReleaseController {

    private final LocalRunnerReleaseService releaseService;

    public LocalRunnerReleaseController(LocalRunnerReleaseService releaseService) {
        this.releaseService = releaseService;
    }

    @GetMapping("/latest/windows-x64")
    public ApiResponse<LocalRunnerReleaseInfoResponse> latestWindowsX64() {
        CurrentUserContext.require();
        return ApiResponse.ok(releaseService.latestWindowsX64());
    }

    @GetMapping("/latest/windows-x64/download")
    public ResponseEntity<Resource> downloadLatestWindowsX64() {
        CurrentUserContext.require();
        LocalRunnerReleaseDownload download = releaseService.downloadLatestWindowsX64();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }
}
