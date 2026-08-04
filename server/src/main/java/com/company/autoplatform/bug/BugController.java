package com.company.autoplatform.bug;

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
public class BugController {

    private final BugService bugService;

    public BugController(BugService bugService) {
        this.bugService = bugService;
    }

    @GetMapping("/bugs")
    public ApiResponse<PageResponse<BugSummaryResponse>> listBugs(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "severity", required = false) String severity,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize
    ) {
        return ApiResponse.ok(bugService.listBugs(workspaceCode, keyword, status, severity, priority, pageNo, pageSize));
    }

    @PostMapping("/bugs")
    public ApiResponse<BugDetailResponse> createBug(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateBugRequest request
    ) {
        BugSourceType sourceType = request.sourceType() == null ? BugSourceType.MANUAL : request.sourceType();
        return ApiResponse.ok(bugService.createBug(workspaceCode, request, sourceType), "缺陷创建成功");
    }

    @GetMapping("/bugs/{id}")
    public ApiResponse<BugDetailResponse> getBug(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(bugService.getBug(id, workspaceCode));
    }

    @PutMapping("/bugs/{id}")
    public ApiResponse<BugDetailResponse> updateBug(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateBugRequest request
    ) {
        return ApiResponse.ok(bugService.updateBug(id, workspaceCode, request), "缺陷更新成功");
    }

    @DeleteMapping("/bugs/{id}")
    public ApiResponse<Void> deleteBug(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        bugService.deleteBug(id, workspaceCode);
        return ApiResponse.ok(null, "缺陷删除成功");
    }

    @PostMapping("/bugs/{id}/assign")
    public ApiResponse<BugDetailResponse> assignBug(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody AssignBugRequest request
    ) {
        return ApiResponse.ok(bugService.assignBug(id, workspaceCode, request), "处理人更新成功");
    }

    @PostMapping("/bugs/{id}/transition")
    public ApiResponse<BugDetailResponse> transitionBug(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody TransitionBugRequest request
    ) {
        return ApiResponse.ok(bugService.transitionBug(id, workspaceCode, request), "缺陷状态流转成功");
    }

    @GetMapping("/bugs/{id}/comments")
    public ApiResponse<List<BugCommentResponse>> listComments(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(bugService.listComments(id, workspaceCode));
    }

    @PostMapping("/bugs/{id}/comments")
    public ApiResponse<BugCommentResponse> addComment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateBugCommentRequest request
    ) {
        return ApiResponse.ok(bugService.addComment(id, workspaceCode, request), "评论添加成功");
    }

    @GetMapping("/bugs/{id}/cases")
    public ApiResponse<List<BugCaseSummaryResponse>> listBugCases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(bugService.listBugCases(id, workspaceCode));
    }

    @PutMapping("/bugs/{id}/cases")
    public ApiResponse<BugDetailResponse> replaceBugCases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReplaceBugCasesRequest request
    ) {
        return ApiResponse.ok(bugService.replaceBugCases(id, workspaceCode, request), "关联用例已更新");
    }

    @DeleteMapping("/bugs/{id}/cases/{caseId}")
    public ApiResponse<BugDetailResponse> deleteBugCase(
            @PathVariable Long id,
            @PathVariable Long caseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(bugService.deleteBugCase(id, workspaceCode, caseId), "已取消关联用例");
    }

    @PostMapping(value = "/bugs/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<BugAttachmentResponse>> uploadBugAttachment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @ModelAttribute("files") List<MultipartFile> files
    ) {
        return ApiResponse.ok(bugService.uploadBugAttachments(id, workspaceCode, files), "附件上传成功");
    }

    @DeleteMapping("/bugs/{id}/attachments/{attachmentId}")
    public ApiResponse<Void> deleteBugAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        bugService.deleteBugAttachment(id, attachmentId, workspaceCode);
        return ApiResponse.ok(null, "附件删除成功");
    }

    @GetMapping("/bugs/{id}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadBugAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        BugFileDownload download = bugService.downloadBugAttachment(id, attachmentId, workspaceCode);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }

    @GetMapping("/bugs/statistics")
    public ApiResponse<BugStatisticsResponse> statistics(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(bugService.statistics(workspaceCode));
    }

    @PostMapping("/cases/{id}/bugs")
    public ApiResponse<BugDetailResponse> createBugFromCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateBugRequest request
    ) {
        return ApiResponse.ok(bugService.createBugFromCase(id, workspaceCode, request), "已从用例创建缺陷");
    }

    @PostMapping("/reports/{id}/bugs")
    public ApiResponse<BugDetailResponse> createBugFromReport(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateBugRequest request
    ) {
        return ApiResponse.ok(bugService.createBugFromReport(id, workspaceCode, request), "已从报告创建缺陷");
    }
}
