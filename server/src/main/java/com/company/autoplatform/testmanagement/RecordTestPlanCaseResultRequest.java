package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record RecordTestPlanCaseResultRequest(
        @NotNull(message = "执行结果不能为空") PlanCaseExecutionStatus status,
        @Size(max = 5000, message = "执行备注不能超过5000个字符") String note,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
