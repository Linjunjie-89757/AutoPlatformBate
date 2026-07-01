package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.runner.LocalRunnerModels.RunnerFinalResultReport;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskStatusReport;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerTaskLifecycleTests {

    @Test
    void reportFinalResultDoesNotOverwriteTerminalTask() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        LocalRunnerTaskEntity task = task("run-timeout", "TIMEOUT");
        LocalDateTime completedAt = LocalDateTime.now().minusSeconds(5);
        task.setCompletedAt(completedAt);
        when(taskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        LocalRunnerService service = service(taskMapper, eventPublisher);

        var ack = service.reportFinalResult("run-timeout", new RunnerFinalResultReport(
                "runner-a",
                "exec-run-timeout",
                "SUCCESS",
                LocalDateTime.now().minusSeconds(10),
                LocalDateTime.now(),
                100L,
                Map.of("passed", 1),
                null,
                Map.of()
        ));

        assertThat(ack.accepted()).isFalse();
        assertThat(ack.status()).isEqualTo("TIMEOUT");
        assertThat(task.getStatus()).isEqualTo("TIMEOUT");
        assertThat(task.getCompletedAt()).isEqualTo(completedAt);
        assertThat(task.getResultJson()).isNull();
        verify(taskMapper, never()).updateById(any(LocalRunnerTaskEntity.class));
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void reportStatusReturnsCanceledAckWithoutReopeningTask() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerTaskEntity task = task("run-canceled", "CANCELED");
        LocalDateTime completedAt = LocalDateTime.now().minusSeconds(3);
        task.setCompletedAt(completedAt);
        when(taskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        LocalRunnerService service = service(taskMapper, mock(ApplicationEventPublisher.class));

        var ack = service.reportStatus("run-canceled", new RunnerTaskStatusReport(
                "runner-a",
                "exec-run-canceled",
                "RUNNING",
                "EXECUTING",
                null,
                "still running",
                LocalDateTime.now()
        ));

        assertThat(ack.accepted()).isFalse();
        assertThat(ack.status()).isEqualTo("CANCELED");
        assertThat(task.getStatus()).isEqualTo("CANCELED");
        assertThat(task.getCompletedAt()).isEqualTo(completedAt);
        verify(taskMapper, never()).updateById(any(LocalRunnerTaskEntity.class));
    }

    @Test
    void cancelTaskMarksActiveTaskCanceled() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        LocalRunnerTaskEntity task = task("run-active", "RUNNING");
        when(taskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        LocalRunnerService service = service(taskMapper, eventPublisher);

        var ack = service.cancelTask("run-active");

        assertThat(ack.accepted()).isTrue();
        assertThat(ack.status()).isEqualTo("CANCELED");
        assertThat(task.getStatus()).isEqualTo("CANCELED");
        assertThat(task.getErrorMessage()).contains("canceled");
        assertThat(task.getCompletedAt()).isNotNull();
        verify(taskMapper).updateById(task);
        ArgumentCaptor<LocalRunnerTaskFinalResultEvent> eventCaptor = ArgumentCaptor.forClass(LocalRunnerTaskFinalResultEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo("CANCELED");
        assertThat(eventCaptor.getValue().result()).containsEntry("errorMessage", "Runner task canceled by platform");
    }

    @Test
    void markTimedOutTasksPublishesForcedFinalResultEvent() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        LocalRunnerTaskEntity task = task("run-timeout-event", "RUNNING");
        task.setDeadlineAt(LocalDateTime.now().minusSeconds(1));
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(java.util.List.of(task));
        LocalRunnerService service = service(taskMapper, eventPublisher);

        int changed = service.markTimedOutTasks();

        assertThat(changed).isEqualTo(1);
        assertThat(task.getStatus()).isEqualTo("TIMEOUT");
        verify(taskMapper).updateById(task);
        ArgumentCaptor<LocalRunnerTaskFinalResultEvent> eventCaptor = ArgumentCaptor.forClass(LocalRunnerTaskFinalResultEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        LocalRunnerTaskFinalResultEvent event = eventCaptor.getValue();
        assertThat(event.runId()).isEqualTo("run-timeout-event");
        assertThat(event.status()).isEqualTo("TIMEOUT");
        assertThat(event.result()).containsKey("reportData");
    }

    @Test
    void getTaskDetailIncludesRecentRunnerLogs() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerTaskLogMapper taskLogMapper = mock(LocalRunnerTaskLogMapper.class);
        LocalRunnerTaskEntity task = task("run-logs", "FAILED");
        task.setResultJson("{\"summary\":{\"failedSteps\":1}}");
        LocalRunnerTaskLogEntity firstLog = log("run-logs", 1L, "INFO", "Start API request", "step-1", "{\"url\":\"/orders\"}");
        LocalRunnerTaskLogEntity secondLog = log("run-logs", 2L, "ERROR", "Assertion failed", "step-1", "{\"status\":500}");
        when(taskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        when(taskLogMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(firstLog, secondLog));
        LocalRunnerService service = service(taskMapper, taskLogMapper, mock(ApplicationEventPublisher.class));

        var detail = service.getTaskDetail("run-logs");

        assertThat(detail.result()).containsKey("summary");
        assertThat(detail.logs()).hasSize(2);
        assertThat(detail.logs().get(0).sequenceNo()).isEqualTo(1L);
        assertThat(detail.logs().get(0).level()).isEqualTo("INFO");
        assertThat(detail.logs().get(0).data()).containsEntry("url", "/orders");
        assertThat(detail.logs().get(1).level()).isEqualTo("ERROR");
        assertThat(detail.logs().get(1).message()).isEqualTo("Assertion failed");
        assertThat(detail.logs().get(1).data()).containsEntry("status", 500);
    }

    private LocalRunnerService service(LocalRunnerTaskMapper taskMapper, ApplicationEventPublisher eventPublisher) {
        return service(taskMapper, mock(LocalRunnerTaskLogMapper.class), eventPublisher);
    }

    private LocalRunnerService service(
            LocalRunnerTaskMapper taskMapper,
            LocalRunnerTaskLogMapper taskLogMapper,
            ApplicationEventPublisher eventPublisher
    ) {
        return new LocalRunnerService(
                mock(LocalRunnerNodeMapper.class),
                taskMapper,
                taskLogMapper,
                new ObjectMapper(),
                eventPublisher
        );
    }

    private LocalRunnerTaskLogEntity log(
            String runId,
            Long sequenceNo,
            String level,
            String message,
            String stepId,
            String dataJson
    ) {
        LocalRunnerTaskLogEntity entity = new LocalRunnerTaskLogEntity();
        entity.setRunId(runId);
        entity.setRunnerId("runner-a");
        entity.setSequenceNo(sequenceNo);
        entity.setLevel(level);
        entity.setMessage(message);
        entity.setStepId(stepId);
        entity.setDataJson(dataJson);
        entity.setLoggedAt(LocalDateTime.now().minusSeconds(10 - sequenceNo));
        return entity;
    }

    private LocalRunnerTaskEntity task(String runId, String status) {
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        entity.setRunId(runId);
        entity.setTaskType("API_CASE_RUN");
        entity.setExecutionToken("exec-" + runId);
        entity.setRunnerId("runner-a");
        entity.setWorkspaceId(7L);
        entity.setWorkspaceCode("risk-ops");
        entity.setStatus(status);
        entity.setPayloadJson("{}");
        entity.setCreatedAt(LocalDateTime.now().minusSeconds(10));
        return entity;
    }
}
