package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CopyTestPlanRequest(
        @Size(max = 255, message = "计划名称不能超过255个字符") String name,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
