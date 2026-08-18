package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AddTestPlanCasesRequest(
        @NotEmpty(message = "请选择要添加的用例") List<Long> caseIds,
        @Size(max = 1000, message = "添加原因不能超过1000个字符") String reason,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
