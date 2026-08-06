package com.company.autoplatform.bug;

import com.company.autoplatform.casecenter.CaseDetailResponse;
import com.company.autoplatform.casecenter.CaseEntity;
import com.company.autoplatform.casecenter.CaseService;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.execution.ExecutionService;
import com.company.autoplatform.execution.ReportDetailResponse;
import com.company.autoplatform.execution.ReportEntity;
import com.company.autoplatform.execution.TaskDetailResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import org.springframework.stereotype.Service;

@Service
public class BugSourceContextSupport {

    private final CaseService caseService;
    private final ExecutionService executionService;

    public BugSourceContextSupport(CaseService caseService, ExecutionService executionService) {
        this.caseService = caseService;
        this.executionService = executionService;
    }

    public CreateBugRequest mergeCaseSource(Long caseId, CreateBugRequest request) {
        CaseEntity caseEntity = caseService.requireCase(caseId);
        return new CreateBugRequest(
                request.workspaceCode(),
                request.title(),
                request.description(),
                request.reproductionSteps(),
                request.expectedResult(),
                request.actualResult(),
                request.moduleName(),
                request.versionName(),
                request.priority(),
                request.severity(),
                request.sourceType(),
                request.assigneeId(),
                caseEntity.getId(),
                null,
                null,
                request.tags()
        );
    }

    public CreateBugRequest mergeReportSource(Long reportId, CreateBugRequest request) {
        ReportEntity report = executionService.requireReport(reportId);
        return new CreateBugRequest(
                request.workspaceCode(),
                request.title(),
                request.description(),
                request.reproductionSteps(),
                request.expectedResult(),
                request.actualResult(),
                request.moduleName(),
                request.versionName(),
                request.priority(),
                request.severity(),
                request.sourceType(),
                request.assigneeId(),
                null,
                report.getId(),
                report.getTaskId(),
                request.tags()
        );
    }

    public BugSourceContextResponse buildSourceContext(BugEntity entity, WorkspaceEntity workspace) {
        String workspaceCode = workspace.getWorkspaceCode();
        BugCaseSummaryResponse caseSummary = entity.getRelatedCaseId() == null
                ? null
                : safeCaseSummary(entity.getRelatedCaseId(), workspaceCode);
        BugReportSummaryResponse reportSummary = entity.getRelatedReportId() == null
                ? null
                : safeReportSummary(entity.getRelatedReportId(), workspaceCode);

        Long taskId = entity.getRelatedTaskId();
        if (taskId == null && reportSummary != null) {
            taskId = reportSummary.taskId();
        }
        BugTaskSummaryResponse taskSummary = taskId == null
                ? null
                : safeTaskSummary(taskId, workspaceCode);

        return new BugSourceContextResponse(
                BugSourceType.valueOf(entity.getSourceType()),
                caseSummary,
                reportSummary,
                taskSummary
        );
    }

    public BugCaseSummaryResponse safeCaseSummary(Long caseId, String workspaceCode) {
        try {
            return toCaseSummary(caseService.getCase(caseId, workspaceCode));
        } catch (NotFoundException exception) {
            return null;
        }
    }

    private BugReportSummaryResponse safeReportSummary(Long reportId, String workspaceCode) {
        try {
            return toReportSummary(executionService.getReport(reportId, workspaceCode));
        } catch (NotFoundException exception) {
            return null;
        }
    }

    private BugTaskSummaryResponse safeTaskSummary(Long taskId, String workspaceCode) {
        try {
            return toTaskSummary(executionService.getTask(taskId, workspaceCode));
        } catch (NotFoundException exception) {
            return null;
        }
    }

    private BugCaseSummaryResponse toCaseSummary(CaseDetailResponse response) {
        String modulePath = response.directoryName() == null || response.directoryName().isBlank()
                ? response.workspaceName()
                : response.workspaceName() + " / " + response.directoryName();
        return new BugCaseSummaryResponse(
                response.id(),
                response.caseNo(),
                response.title(),
                response.workspaceCode(),
                response.workspaceName(),
                response.directoryId(),
                response.directoryName(),
                modulePath,
                response.executionStatus(),
                response.executionComment() == null || response.executionComment().isBlank() ? response.executionNote() : response.executionComment(),
                response.executedAt()
        );
    }

    private BugReportSummaryResponse toReportSummary(ReportDetailResponse response) {
        return new BugReportSummaryResponse(
                response.id(),
                response.reportName(),
                response.result(),
                response.failureSummary(),
                response.taskId(),
                response.taskName(),
                response.workspaceCode(),
                response.workspaceName()
        );
    }

    private BugTaskSummaryResponse toTaskSummary(TaskDetailResponse response) {
        return new BugTaskSummaryResponse(
                response.id(),
                response.taskName(),
                response.engineType(),
                response.status(),
                response.workspaceCode(),
                response.workspaceName()
        );
    }
}
