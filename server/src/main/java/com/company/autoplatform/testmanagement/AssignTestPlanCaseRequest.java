package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record AssignTestPlanCaseRequest(
        Long assigneeId,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
