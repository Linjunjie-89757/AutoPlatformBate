package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerDebugTaskRequest;
import static com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import static com.company.autoplatform.runner.LocalRunnerModels.Progress;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskAckResponse;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskEnvelope;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerTaskDebugControllerTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createDebugTaskAcceptsApiScenarioRunAndProvidesScriptProtocolDefaults() {
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);
        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(7L);
        workspace.setWorkspaceCode("risk-ops");
        AtomicReference<CreateRunnerTaskCommand> capturedCommand = new AtomicReference<>();

        when(workspaceService.requireWritableWorkspace(eq("risk-ops"))).thenReturn(workspace);
        when(localRunnerService.createDebugTask(org.mockito.ArgumentMatchers.any(CreateRunnerTaskCommand.class)))
                .thenAnswer(invocation -> {
                    capturedCommand.set(invocation.getArgument(0));
                    return null;
                });
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));

        LocalRunnerTaskDebugController controller = new LocalRunnerTaskDebugController(localRunnerService, workspaceService);
        controller.createDebugTask("risk-ops", new CreateRunnerDebugTaskRequest(
                null,
                "API_SCENARIO_RUN",
                "runner_local",
                null,
                null,
                null,
                null,
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                null,
                null,
                null,
                null
        ));

        CreateRunnerTaskCommand command = capturedCommand.get();
        assertThat(command.taskType()).isEqualTo("API_SCENARIO_RUN");
        assertThat(command.resourceCost()).isEqualTo(1);
        assertThat(command.timeoutPolicy()).containsEntry("scriptTimeoutMs", 1000);
        assertThat(command.payload()).containsKey("scenarioSnapshot");
        assertThat(command.payload()).containsEntry("runOptions", Map.of(
                "stopOnFirstFailure", true,
                "debugMode", true
        ));
    }

    @Test
    void triggerOfflineScanRequiresUserAndUsesDefaultThreshold() {
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);
        when(localRunnerService.markOfflineRunners(java.time.Duration.ofMinutes(2))).thenReturn(3);
        when(localRunnerService.markTimedOutTasks()).thenReturn(2);
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));

        LocalRunnerTaskDebugController controller = new LocalRunnerTaskDebugController(localRunnerService, workspaceService);
        var response = controller.triggerOfflineScan(null);

        assertThat(response.data().changedTasks()).isEqualTo(5);
        assertThat(response.data().offlineTasks()).isEqualTo(3);
        assertThat(response.data().timedOutTasks()).isEqualTo(2);
        verify(localRunnerService).markOfflineRunners(java.time.Duration.ofMinutes(2));
        verify(localRunnerService).markTimedOutTasks();
    }

    @Test
    void cancelTaskRequiresWritableWorkspaceAndCancelsTask() {
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));
        when(localRunnerService.getTaskDetail("run-cancel")).thenReturn(taskDetail("risk-ops"));
        when(localRunnerService.cancelTask("run-cancel")).thenReturn(new RunnerTaskAckResponse(
                "run-cancel",
                "CANCELED",
                true,
                "Task canceled"
        ));

        LocalRunnerTaskDebugController controller = new LocalRunnerTaskDebugController(localRunnerService, workspaceService);
        var response = controller.cancelTask("run-cancel");

        assertThat(response.data().status()).isEqualTo("CANCELED");
        assertThat(response.data().accepted()).isTrue();
        verify(workspaceService).requireWritableWorkspace("risk-ops");
        verify(localRunnerService).cancelTask("run-cancel");
    }

    private RunnerTaskDetailResponse taskDetail(String workspaceCode) {
        return new RunnerTaskDetailResponse(
                "run-cancel",
                "API_CASE_RUN",
                "runner-a",
                "RUNNING",
                "EXECUTING",
                new Progress(0, 0, 0),
                null,
                null,
                null,
                null,
                null,
                null,
                new RunnerTaskEnvelope(
                        "run-cancel",
                        "API_CASE_RUN",
                        "LOCAL_RUNNER",
                        "exec-run-cancel",
                        "runner-a",
                        workspaceCode,
                        "11",
                        "1.0",
                        "MANUAL",
                        1,
                        null,
                        null,
                        Map.of(),
                        Map.of(),
                        Map.of(),
                        Map.of(),
                        java.util.List.of(),
                        java.util.List.of(),
                        Map.of(),
                        Map.of()
                ),
                Map.of(),
                List.of()
        );
    }

}
