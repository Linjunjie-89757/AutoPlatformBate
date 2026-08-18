package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

public record ReplaceTestPlanRequirementsRequest(
        List<Long> requirementIds,
        List<Long> excludedAutoCaseIds,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
