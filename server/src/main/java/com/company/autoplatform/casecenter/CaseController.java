package com.company.autoplatform.casecenter;

import com.company.autoplatform.ai.AiReviewResult;
import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ByteArrayResource;
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
@RequestMapping("/api/cases")
public class CaseController {
    private final CaseService caseService;
    private final CaseReviewDomainService caseReviewDomainService;
    private final CaseImportDomainService caseImportDomainService;

    public CaseController(
            CaseService caseService,
            CaseReviewDomainService caseReviewDomainService,
            CaseImportDomainService caseImportDomainService
    ) {
        this.caseService = caseService;
        this.caseReviewDomainService = caseReviewDomainService;
        this.caseImportDomainService = caseImportDomainService;
    }

    @GetMapping
    public ApiResponse<PageResponse<CaseSummaryResponse>> listCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize,
            @RequestParam(value = "directoryId", required = false) Long directoryId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "reviewStatus", required = false) String reviewStatus,
            @RequestParam(value = "executionStatus", required = false) String executionStatus
    ) {
        return ApiResponse.ok(caseService.listCases(
                workspaceCode,
                pageNo,
                pageSize,
                directoryId,
                keyword,
                priority,
                reviewStatus,
                executionStatus));
    }

    @GetMapping("/directories")
    public ApiResponse<List<CaseDirectoryWorkspaceResponse>> listDirectories(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(caseService.listDirectories(workspaceCode));
    }

    @GetMapping("/{id}")
    public ApiResponse<CaseDetailResponse> getCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(caseService.getCase(id, workspaceCode));
    }

    @GetMapping("/{id}/executions")
    public ApiResponse<PageResponse<CaseExecutionHistoryResponse>> listCaseExecutions(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(caseService.listCaseExecutions(id, workspaceCode));
    }

    @PostMapping
    public ApiResponse<CaseSummaryResponse> createCase(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateCaseRequest request
    ) {
        return ApiResponse.ok(caseService.createCase(workspaceCode, request), "用例创建成功");
    }

    @GetMapping("/import/template")
    public ResponseEntity<Resource> downloadImportTemplate() {
        CaseImportTemplate template = caseImportDomainService.buildTemplate();
        ByteArrayResource resource = new ByteArrayResource(template.content());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(template.contentType()))
                .contentLength(template.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(template.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(resource);
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CaseImportResult> importCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "directoryId", required = false) Long directoryId,
            @RequestParam(value = "duplicateStrategy", defaultValue = "SKIP") String duplicateStrategy,
            @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(
                caseImportDomainService.importCases(workspaceCode, directoryId, duplicateStrategy, file),
                "用例导入完成");
    }

    @PostMapping("/directories")
    public ApiResponse<CaseDirectoryNodeResponse> createDirectory(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateCaseDirectoryRequest request
    ) {
        return ApiResponse.ok(caseService.createDirectory(workspaceCode, request), "目录创建成功");
    }

    @PutMapping("/{id}")
    public ApiResponse<CaseSummaryResponse> updateCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateCaseRequest request
    ) {
        return ApiResponse.ok(caseService.updateCase(id, workspaceCode, request), "用例更新成功");
    }

    @PutMapping("/directories/{id}")
    public ApiResponse<CaseDirectoryNodeResponse> renameDirectory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody RenameCaseDirectoryRequest request
    ) {
        return ApiResponse.ok(caseService.renameDirectory(id, workspaceCode, request), "目录更新成功");
    }

    @PostMapping("/directories/{id}/move")
    public ApiResponse<CaseDirectoryNodeResponse> moveDirectory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody MoveCaseDirectoryRequest request
    ) {
        return ApiResponse.ok(caseService.moveDirectory(id, workspaceCode, request), "目录移动成功");
    }

    @PostMapping("/{id}/review")
    public ApiResponse<CaseDetailResponse> reviewCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ReviewCaseRequest request
    ) {
        return ApiResponse.ok(caseService.reviewCase(id, workspaceCode, request), "用例评审已更新");
    }

    @PostMapping("/{id}/ai-review")
    public ApiResponse<AiReviewResult> aiReviewCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(caseReviewDomainService.aiReviewCase(id, workspaceCode), "AI ???????");
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<CaseDetailResponse> executeCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody ExecuteCaseRequest request
    ) {
        return ApiResponse.ok(caseService.executeCase(id, workspaceCode, request), "用例执行结果已更新");
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<CaseExecutionAttachmentResponse>> uploadExecutionAttachment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @ModelAttribute("files") List<MultipartFile> files
    ) {
        return ApiResponse.ok(caseService.uploadExecutionAttachments(id, workspaceCode, files), "执行附件上传成功");
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ApiResponse<Void> deleteExecutionAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        caseService.deleteExecutionAttachment(id, attachmentId, workspaceCode);
        return ApiResponse.ok(null, "执行附件删除成功");
    }

    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadExecutionAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        CaseExecutionFileDownload download = caseService.downloadExecutionAttachment(id, attachmentId, workspaceCode);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.fileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }

    @PostMapping("/batch/move")
    public ApiResponse<PageResponse<CaseSummaryResponse>> batchMoveCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody BatchMoveCasesRequest request
    ) {
        return ApiResponse.ok(caseService.batchMoveCases(workspaceCode, request), "批量移动成功");
    }

    @PostMapping("/batch/update")
    public ApiResponse<PageResponse<CaseSummaryResponse>> batchUpdateCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody BatchUpdateCasesRequest request
    ) {
        return ApiResponse.ok(caseService.batchUpdateCases(workspaceCode, request), "批量更新成功");
    }

    @PostMapping("/batch/delete")
    public ApiResponse<Void> batchDeleteCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody BatchDeleteCasesRequest request
    ) {
        caseService.batchDeleteCases(workspaceCode, request);
        return ApiResponse.ok(null, "批量删除成功");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        caseService.deleteCase(id, workspaceCode);
        return ApiResponse.ok(null, "用例删除成功");
    }

    @DeleteMapping("/directories/{id}")
    public ApiResponse<Void> deleteDirectory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        caseService.deleteDirectory(id, workspaceCode);
        return ApiResponse.ok(null, "目录删除成功");
    }
}
