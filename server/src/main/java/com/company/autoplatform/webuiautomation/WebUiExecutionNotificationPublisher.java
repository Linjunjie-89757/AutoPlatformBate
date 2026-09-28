package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.notification.NotificationDomainService;
import com.company.autoplatform.notification.NotificationModels.NotificationEvent;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class WebUiExecutionNotificationPublisher {

    private static final String SUCCESS = "SUCCESS";

    private final NotificationDomainService notificationDomainService;

    public WebUiExecutionNotificationPublisher(NotificationDomainService notificationDomainService) {
        this.notificationDomainService = notificationDomainService;
    }

    public void publishRun(WebUiRunEntity run) {
        notificationDomainService.publishEvent(new NotificationEvent(
                run.getWorkspaceId(),
                eventType(run.getStatus()),
                eventTitle(run.getStatus()),
                "WEB_UI_RUN",
                run.getId(),
                run.getCaseName(),
                run.getStatus(),
                run.getTotalSteps(),
                run.getPassedSteps(),
                run.getFailedSteps(),
                run.getDurationMs(),
                run.getFailureSummary(),
                "/automation/web?tab=runs&runId=" + run.getId(),
                Map.of()
        ));
    }

    public void publishBatch(WebUiRunBatchEntity batch) {
        notificationDomainService.publishEvent(new NotificationEvent(
                batch.getWorkspaceId(),
                eventType(batch.getStatus()),
                eventTitle(batch.getStatus()),
                "WEB_UI_BATCH",
                batch.getId(),
                batch.getBatchName(),
                batch.getStatus(),
                batch.getTotalCases(),
                batch.getSuccessCases(),
                batch.getFailedCases(),
                batch.getDurationMs(),
                batch.getFailureSummary(),
                "/automation/web?tab=batches&batchId=" + batch.getId(),
                Map.of()
        ));
    }

    private String eventType(String status) {
        return SUCCESS.equals(status)
                ? NotificationDomainService.EVENT_WEB_UI_FINISHED
                : NotificationDomainService.EVENT_WEB_UI_FAILED;
    }

    private String eventTitle(String status) {
        return SUCCESS.equals(status) ? "Web UI 执行完成" : "Web UI 执行失败";
    }
}
