package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;

public record TestPlanCaseExecutionHistoryResponse(
        Long id,
        PlanCaseExecutionStatus previousStatus,
        PlanCaseExecutionStatus executionStatus,
        String executionNote,
        Long executorId,
        String executorName,
        LocalDateTime executedAt
) {
}
