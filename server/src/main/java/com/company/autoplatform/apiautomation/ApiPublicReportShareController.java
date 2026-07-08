package com.company.autoplatform.apiautomation;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/automation/api/report-shares")
public class ApiPublicReportShareController {

    private final ApiReportShareDomainService reportShareDomainService;

    public ApiPublicReportShareController(ApiReportShareDomainService reportShareDomainService) {
        this.reportShareDomainService = reportShareDomainService;
    }

    @GetMapping(value = "/{token}/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getSharedHtmlReport(@PathVariable String token) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(reportShareDomainService.renderSharedHtmlReport(token));
    }
}
