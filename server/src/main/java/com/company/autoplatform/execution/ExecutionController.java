package com.company.autoplatform.execution;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ExecutionController {

    private final ExecutionService executionService;
    private final ReportShareDomainService reportShareDomainService;

    public ExecutionController(ExecutionService executionService, ReportShareDomainService reportShareDomainService) {
        this.executionService = executionService;
        this.reportShareDomainService = reportShareDomainService;
    }

    @GetMapping("/tasks")
    public ApiResponse<PageResponse<TaskSummaryResponse>> listTasks(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "engineType", required = false) String engineType,
            @RequestParam(value = "pageNo", required = false) Long pageNo,
            @RequestParam(value = "pageSize", required = false) Long pageSize
    ) {
        return ApiResponse.ok(executionService.listTasks(workspaceCode, keyword, status, engineType, pageNo, pageSize));
    }

    @GetMapping("/tasks/{id}")
    public ApiResponse<TaskDetailResponse> getTask(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(executionService.getTask(id, workspaceCode));
    }

    @PostMapping("/tasks")
    public ApiResponse<TaskSummaryResponse> createTask(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return ApiResponse.ok(executionService.createTask(workspaceCode, request), "任务创建成功");
    }

    @PutMapping("/tasks/{id}")
    public ApiResponse<TaskSummaryResponse> updateTask(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return ApiResponse.ok(executionService.updateTask(id, workspaceCode, request), "任务更新成功");
    }

    @DeleteMapping("/tasks/{id}")
    public ApiResponse<Void> deleteTask(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        executionService.deleteTask(id, workspaceCode);
        return ApiResponse.ok(null, "任务删除成功");
    }

    @PostMapping("/tasks/{id}/transition")
    public ApiResponse<TaskDetailResponse> transitionTask(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TaskTransitionRequest request
    ) {
        return ApiResponse.ok(executionService.transitionTask(id, workspaceCode, request), "任务状态已更新");
    }

    @GetMapping("/reports")
    public ApiResponse<PageResponse<ReportSummaryResponse>> listReports(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "result", required = false) String result,
            @RequestParam(value = "logSource", required = false) String logSource,
            @RequestParam(value = "pageNo", required = false) Long pageNo,
            @RequestParam(value = "pageSize", required = false) Long pageSize
    ) {
        return ApiResponse.ok(executionService.listReports(workspaceCode, keyword, result, logSource, pageNo, pageSize));
    }

    @GetMapping("/reports/{id}")
    public ApiResponse<ReportDetailResponse> getReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(executionService.getReport(id, workspaceCode));
    }

    @GetMapping("/report-shares")
    public ApiResponse<List<ReportShareSummaryResponse>> listReportShares(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "reportId", required = false) Long reportId
    ) {
        return ApiResponse.ok(reportShareDomainService.listShares(workspaceCode, reportId));
    }

    @PostMapping("/reports/{id}/shares")
    public ApiResponse<ReportShareCreatedResponse> createReportShare(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) CreateReportShareRequest request
    ) {
        return ApiResponse.ok(reportShareDomainService.createShare(id, workspaceCode, request), "报告分享链接已生成");
    }

    @DeleteMapping("/report-shares/{shareId}")
    public ApiResponse<ReportShareSummaryResponse> revokeReportShare(
            @PathVariable Long shareId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(reportShareDomainService.revokeShare(shareId, workspaceCode), "报告分享已撤销");
    }

    @PostMapping("/report-shares/{shareId}/regenerate")
    public ApiResponse<ReportShareCreatedResponse> regenerateReportShare(
            @PathVariable Long shareId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(reportShareDomainService.regenerateShare(shareId, workspaceCode), "报告分享链接已重新生成");
    }

    @PostMapping("/reports")
    public ApiResponse<ReportSummaryResponse> createReport(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateReportRequest request
    ) {
        return ApiResponse.ok(executionService.createReport(workspaceCode, request), "报告创建成功");
    }

    @PutMapping("/reports/{id}")
    public ApiResponse<ReportSummaryResponse> updateReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateReportRequest request
    ) {
        return ApiResponse.ok(executionService.updateReport(id, workspaceCode, request), "报告更新成功");
    }

    @DeleteMapping("/reports/{id}")
    public ApiResponse<Void> deleteReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        executionService.deleteReport(id, workspaceCode);
        return ApiResponse.ok(null, "报告删除成功");
    }

    @PutMapping("/reports/{id}/content")
    public ApiResponse<ReportDetailResponse> updateReportContent(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody UpdateReportContentRequest request
    ) {
        return ApiResponse.ok(executionService.updateReportContent(id, workspaceCode, request), "报告内容已更新");
    }

    @PostMapping(value = "/reports/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<ReportAttachmentResponse>> uploadReportAttachment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @ModelAttribute("files") List<MultipartFile> files
    ) {
        return ApiResponse.ok(executionService.uploadReportAttachments(id, workspaceCode, files), "附件上传成功");
    }

    @DeleteMapping("/reports/{id}/attachments/{attachmentId}")
    public ApiResponse<Void> deleteReportAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        executionService.deleteReportAttachment(id, attachmentId, workspaceCode);
        return ApiResponse.ok(null, "附件删除成功");
    }

    @GetMapping("/reports/{id}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadReportAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        ReportFileDownload download = executionService.downloadReportAttachment(id, attachmentId, workspaceCode);
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
