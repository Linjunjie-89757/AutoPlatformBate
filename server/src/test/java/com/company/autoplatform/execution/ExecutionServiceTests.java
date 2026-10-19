package com.company.autoplatform.execution;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExecutionServiceTests {

    private final TaskMapper taskMapper = mock(TaskMapper.class);
    private final ReportMapper reportMapper = mock(ReportMapper.class);
    private final ReportAttachmentMapper reportAttachmentMapper = mock(ReportAttachmentMapper.class);
    private final WorkspaceMapper workspaceMapper = mock(WorkspaceMapper.class);
    private final WorkspaceService workspaceService = mock(WorkspaceService.class);
    private final ReportAttachmentStorageService reportAttachmentStorageService = mock(ReportAttachmentStorageService.class);
    private final ExecutionTaskDomainService taskDomainService = new ExecutionTaskDomainService(
            taskMapper,
            reportMapper,
            workspaceMapper,
            workspaceService
    );
    private final ExecutionReportDomainService reportDomainService = new ExecutionReportDomainService(
            taskDomainService,
            reportMapper,
            reportAttachmentMapper,
            workspaceMapper,
            workspaceService,
            reportAttachmentStorageService
    );
    private final ExecutionReportAttachmentSupport reportAttachmentSupport = new ExecutionReportAttachmentSupport(
            reportDomainService,
            reportMapper,
            reportAttachmentMapper,
            workspaceService,
            reportAttachmentStorageService
    );
    private final ExecutionService executionService = new ExecutionService(
            taskDomainService,
            reportDomainService,
            reportAttachmentSupport
    );

    @Test
    void listTasksWithoutPaginationUsesDefaultDatabasePageQuery() {
        WorkspaceEntity workspace = workspace();
        when(workspaceService.requireReadableWorkspace("risk-ops")).thenReturn(workspace);
        when(workspaceService.requireWorkspaceById(1L)).thenReturn(workspace);
        when(workspaceMapper.selectBatchIds(anyCollection())).thenReturn(List.of(workspace));
        when(taskMapper.selectPage(any(Page.class), any(Wrapper.class))).thenAnswer(invocation -> {
            Page<TaskEntity> page = invocation.getArgument(0);
            assertThat(page.getCurrent()).isEqualTo(1);
            assertThat(page.getSize()).isEqualTo(20);
            page.setTotal(2);
            page.setRecords(List.of(task(1L, "task-a"), task(2L, "task-b")));
            return page;
        });

        PageResponse<TaskSummaryResponse> response = executionService.listTasks(
                "risk-ops",
                null,
                null,
                null,
                null,
                null
        );

        assertThat(response.total()).isEqualTo(2);
        assertThat(response.items()).extracting(TaskSummaryResponse::taskName)
                .containsExactly("task-a", "task-b");
        assertThat(response.pageNo()).isEqualTo(1);
        assertThat(response.pageSize()).isEqualTo(20);
        verify(taskMapper).selectPage(any(Page.class), any(Wrapper.class));
        verify(workspaceMapper).selectBatchIds(anyCollection());
        verify(workspaceService, never()).requireWorkspaceById(1L);
        verify(taskMapper, never()).selectList(any());
    }

    @Test
    void listTasksWithPaginationUsesDatabasePageQuery() {
        WorkspaceEntity workspace = workspace();
        when(workspaceService.requireReadableWorkspace("risk-ops")).thenReturn(workspace);
        when(workspaceService.requireWorkspaceById(1L)).thenReturn(workspace);
        when(workspaceMapper.selectBatchIds(anyCollection())).thenReturn(List.of(workspace));
        when(taskMapper.selectPage(any(Page.class), any(Wrapper.class))).thenAnswer(invocation -> {
            Page<TaskEntity> page = invocation.getArgument(0);
            assertThat(page.getCurrent()).isEqualTo(2);
            assertThat(page.getSize()).isEqualTo(10);
            page.setTotal(21);
            page.setRecords(List.of(task(11L, "task-11")));
            return page;
        });

        PageResponse<TaskSummaryResponse> response = executionService.listTasks(
                "risk-ops",
                "task",
                "success",
                "api",
                2L,
                10L
        );

        assertThat(response.total()).isEqualTo(21);
        assertThat(response.pageNo()).isEqualTo(2);
        assertThat(response.pageSize()).isEqualTo(10);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.items()).singleElement()
                .extracting(TaskSummaryResponse::taskName)
                .isEqualTo("task-11");
        verify(taskMapper).selectPage(any(Page.class), any(Wrapper.class));
        verify(workspaceMapper).selectBatchIds(anyCollection());
        verify(workspaceService, never()).requireWorkspaceById(1L);
        verify(taskMapper, never()).selectList(any());
    }

    @Test
    void listTasksWithInvalidStatusKeepsValidationFailure() {
        when(workspaceService.requireReadableWorkspace("risk-ops")).thenReturn(workspace());

        assertThatThrownBy(() -> executionService.listTasks(
                "risk-ops",
                null,
                "unknown",
                null,
                1L,
                10L
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("unknown");

        verify(taskMapper, never()).selectPage(any(), any());
        verify(taskMapper, never()).selectList(any());
    }

    @Test
    void listTasksDefaultsInvalidPaginationParamsBeforeDatabasePageQuery() {
        WorkspaceEntity workspace = workspace();
        when(workspaceService.requireReadableWorkspace("risk-ops")).thenReturn(workspace);
        when(workspaceService.requireWorkspaceById(1L)).thenReturn(workspace);
        when(workspaceMapper.selectBatchIds(anyCollection())).thenReturn(List.of(workspace));
        when(taskMapper.selectPage(any(Page.class), any(Wrapper.class))).thenAnswer(invocation -> {
            Page<TaskEntity> page = invocation.getArgument(0);
            assertThat(page.getCurrent()).isEqualTo(1);
            assertThat(page.getSize()).isEqualTo(20);
            page.setTotal(0);
            page.setRecords(List.of());
            return page;
        });

        PageResponse<TaskSummaryResponse> response = executionService.listTasks(
                "risk-ops",
                null,
                null,
                null,
                0L,
                0L
        );

        assertThat(response.items()).isEmpty();
        assertThat(response.pageNo()).isEqualTo(1);
        assertThat(response.pageSize()).isEqualTo(20);
        verify(taskMapper).selectPage(any(Page.class), any(Wrapper.class));
    }

    @Test
    void listReportsLoadsWorkspaceSummariesInOneBatch() {
        WorkspaceEntity workspace = workspace();
        when(workspaceService.requireReadableWorkspace("risk-ops")).thenReturn(workspace);
        when(reportMapper.selectPage(any(Page.class), any(Wrapper.class))).thenAnswer(invocation -> {
            Page<ReportEntity> page = invocation.getArgument(0);
            page.setTotal(2);
            page.setRecords(List.of(report(1L), report(2L)));
            return page;
        });
        when(workspaceMapper.selectBatchIds(anyCollection())).thenReturn(List.of(workspace));

        PageResponse<ReportSummaryResponse> response = executionService.listReports(
                "risk-ops",
                null,
                null,
                null,
                1L,
                10L
        );

        assertThat(response.total()).isEqualTo(2);
        assertThat(response.items()).extracting(ReportSummaryResponse::workspaceName)
                .containsExactly("Risk Ops", "Risk Ops");
        verify(reportMapper).selectPage(any(Page.class), any(Wrapper.class));
        verify(workspaceMapper).selectBatchIds(anyCollection());
        verify(workspaceService, never()).requireWorkspaceById(1L);
    }

    private WorkspaceEntity workspace() {
        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(1L);
        workspace.setWorkspaceCode("risk-ops");
        workspace.setWorkspaceName("Risk Ops");
        workspace.setStatus(1);
        return workspace;
    }

    private TaskEntity task(Long id, String taskName) {
        TaskEntity task = new TaskEntity();
        task.setId(id);
        task.setWorkspaceId(1L);
        task.setTaskName(taskName);
        task.setEngineType("API");
        task.setTaskStatus("SUCCESS");
        task.setSummary("summary");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        return task;
    }

    private ReportEntity report(Long id) {
        ReportEntity report = new ReportEntity();
        report.setId(id);
        report.setWorkspaceId(1L);
        report.setTaskId(1L);
        report.setReportName("report-" + id);
        report.setResult("SUCCESS");
        report.setLogSource("API");
        return report;
    }
}
