package com.company.autoplatform.execution;

import com.company.autoplatform.common.PageResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class ExecutionService {

    private final ExecutionTaskDomainService taskDomainService;
    private final ExecutionReportDomainService reportDomainService;
    private final ExecutionReportAttachmentSupport reportAttachmentSupport;

    public ExecutionService(
            ExecutionTaskDomainService taskDomainService,
            ExecutionReportDomainService reportDomainService,
            ExecutionReportAttachmentSupport reportAttachmentSupport
    ) {
        this.taskDomainService = taskDomainService;
        this.reportDomainService = reportDomainService;
        this.reportAttachmentSupport = reportAttachmentSupport;
    }

    public PageResponse<TaskSummaryResponse> listTasks(
            String workspaceCode,
            String keyword,
            String status,
            String engineType,
            Long pageNo,
            Long pageSize
    ) {
        return taskDomainService.listTasks(workspaceCode, keyword, status, engineType, pageNo, pageSize);
    }

    public TaskDetailResponse getTask(Long id, String workspaceCode) {
        return taskDomainService.getTask(id, workspaceCode);
    }

    public TaskSummaryResponse createTask(String headerWorkspaceCode, CreateTaskRequest request) {
        return taskDomainService.createTask(headerWorkspaceCode, request);
    }

    public TaskSummaryResponse updateTask(Long id, String headerWorkspaceCode, CreateTaskRequest request) {
        return taskDomainService.updateTask(id, headerWorkspaceCode, request);
    }

    public void deleteTask(Long id, String workspaceCode) {
        taskDomainService.deleteTask(id, workspaceCode);
    }

    public TaskDetailResponse transitionTask(Long id, String workspaceCode, TaskTransitionRequest request) {
        return taskDomainService.transitionTask(id, workspaceCode, request);
    }

    public PageResponse<ReportSummaryResponse> listReports(
            String workspaceCode,
            String keyword,
            String result,
            String logSource,
            Long pageNo,
            Long pageSize
    ) {
        return reportDomainService.listReports(workspaceCode, keyword, result, logSource, pageNo, pageSize);
    }

    public ReportDetailResponse getReport(Long id, String workspaceCode) {
        return reportDomainService.getReport(id, workspaceCode);
    }

    public ReportSummaryResponse createReport(String headerWorkspaceCode, CreateReportRequest request) {
        return reportDomainService.createReport(headerWorkspaceCode, request);
    }

    public ReportSummaryResponse updateReport(Long id, String headerWorkspaceCode, CreateReportRequest request) {
        return reportDomainService.updateReport(id, headerWorkspaceCode, request);
    }

    public void deleteReport(Long id, String workspaceCode) {
        reportDomainService.deleteReport(id, workspaceCode);
    }

    public ReportDetailResponse updateReportContent(Long id, String workspaceCode, UpdateReportContentRequest request) {
        return reportDomainService.updateReportContent(id, workspaceCode, request);
    }

    public List<ReportAttachmentResponse> uploadReportAttachments(Long reportId, String workspaceCode, List<MultipartFile> files) {
        return reportAttachmentSupport.uploadReportAttachments(reportId, workspaceCode, files);
    }

    public void deleteReportAttachment(Long reportId, Long attachmentId, String workspaceCode) {
        reportAttachmentSupport.deleteReportAttachment(reportId, attachmentId, workspaceCode);
    }

    public ReportFileDownload downloadReportAttachment(Long reportId, Long attachmentId, String workspaceCode) {
        return reportAttachmentSupport.downloadReportAttachment(reportId, attachmentId, workspaceCode);
    }

    public ReportEntity requireReport(Long reportId) {
        return reportDomainService.requireReport(reportId);
    }

    public ReportAttachmentEntity requireAttachment(Long attachmentId) {
        return reportAttachmentSupport.requireAttachment(attachmentId);
    }
}
