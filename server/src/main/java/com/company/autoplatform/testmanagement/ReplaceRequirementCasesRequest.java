package com.company.autoplatform.testmanagement;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

public record ReplaceRequirementCasesRequest(
        @NotNull(message = "关联用例不能为空") List<@Valid @NotNull(message = "用例ID不能为空") Long> caseIds,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
