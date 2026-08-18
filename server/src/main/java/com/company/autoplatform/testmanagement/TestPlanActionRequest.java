package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record TestPlanActionRequest(
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion,
        boolean force,
        @Size(max = 1000, message = "操作原因不能超过1000个字符") String reason
) {
}
