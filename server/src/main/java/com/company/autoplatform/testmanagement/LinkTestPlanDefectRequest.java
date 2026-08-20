package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;

public record LinkTestPlanDefectRequest(
        @NotNull(message = "缺陷不能为空") Long defectId,
        @NotNull(message = "expectedVersion不能为空") Integer expectedVersion
) {
}
