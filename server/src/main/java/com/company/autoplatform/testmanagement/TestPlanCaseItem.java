package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;
import java.util.List;

public record TestPlanCaseItem(
        Long id,
        Long sourceCaseId,
        PlanCaseOriginType originType,
        String caseNo,
        String title,
        String module,
        String priority,
        String precondition,
        String steps,
        String expectedResult,
        boolean addedAfterStart,
        Long assigneeId,
        String assigneeName,
        PlanCaseExecutionStatus executionStatus,
        String executionNote,
        Long executedBy,
        String executorName,
        LocalDateTime executedAt,
        List<Long> requirementIds,
        long defectCount,
        Integer lockVersion
) {
}
