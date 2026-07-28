package com.company.autoplatform.execution;

import com.company.autoplatform.common.ApiResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/public/reports")
public class ReportPublicShareController {

    private final ReportShareDomainService reportShareDomainService;

    public ReportPublicShareController(ReportShareDomainService reportShareDomainService) {
        this.reportShareDomainService = reportShareDomainService;
    }

    @GetMapping("/{token}")
    public ApiResponse<SharedReportResponse> getSharedReport(@PathVariable String token) {
        return ApiResponse.ok(reportShareDomainService.getSharedReport(token));
    }

    @GetMapping("/{token}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadSharedAttachment(
            @PathVariable String token,
            @PathVariable Long attachmentId
    ) {
        ReportFileDownload download = reportShareDomainService.downloadSharedAttachment(token, attachmentId);
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
