package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.notification.NotificationDomainService;
import com.company.autoplatform.notification.NotificationModels.NotificationEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WebUiExecutionNotificationPublisherTests {

    @Test
    void publishesRunCompletionWithRunDetails() {
        NotificationDomainService notificationDomainService = mock(NotificationDomainService.class);
        WebUiExecutionNotificationPublisher publisher = new WebUiExecutionNotificationPublisher(notificationDomainService);
        WebUiRunEntity run = new WebUiRunEntity();
        run.setId(12L);
        run.setWorkspaceId(3L);
        run.setCaseName("登录检查");
        run.setStatus("SUCCESS");
        run.setTotalSteps(4);
        run.setPassedSteps(4);
        run.setFailedSteps(0);
        run.setDurationMs(250L);

        publisher.publishRun(run);

        ArgumentCaptor<NotificationEvent> event = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(notificationDomainService).publishEvent(event.capture());
        assertEquals(3L, event.getValue().workspaceId());
        assertEquals(NotificationDomainService.EVENT_WEB_UI_FINISHED, event.getValue().eventType());
        assertEquals("WEB_UI_RUN", event.getValue().targetType());
        assertEquals(12L, event.getValue().targetId());
        assertEquals(4, event.getValue().totalCount());
        assertEquals("/automation/web?tab=runs&runId=12", event.getValue().linkUrl());
    }

    @Test
    void publishesFailedBatchAsFailureEvent() {
        NotificationDomainService notificationDomainService = mock(NotificationDomainService.class);
        WebUiExecutionNotificationPublisher publisher = new WebUiExecutionNotificationPublisher(notificationDomainService);
        WebUiRunBatchEntity batch = new WebUiRunBatchEntity();
        batch.setId(21L);
        batch.setWorkspaceId(5L);
        batch.setBatchName("回归批次");
        batch.setStatus("FAILED");
        batch.setTotalCases(3);
        batch.setSuccessCases(2);
        batch.setFailedCases(1);
        batch.setFailureSummary("1 个用例失败");

        publisher.publishBatch(batch);

        ArgumentCaptor<NotificationEvent> event = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(notificationDomainService).publishEvent(event.capture());
        assertEquals(NotificationDomainService.EVENT_WEB_UI_FAILED, event.getValue().eventType());
        assertEquals("WEB_UI_BATCH", event.getValue().targetType());
        assertEquals(21L, event.getValue().targetId());
        assertEquals(3, event.getValue().totalCount());
        assertEquals(2, event.getValue().successCount());
        assertEquals(1, event.getValue().failedCount());
        assertEquals("1 个用例失败", event.getValue().failureSummary());
        assertEquals("/automation/web?tab=batches&batchId=21", event.getValue().linkUrl());
    }
}
