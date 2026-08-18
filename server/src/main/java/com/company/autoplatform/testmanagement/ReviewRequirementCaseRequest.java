package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ReviewRequirementCaseRequest(
        @NotNull(message = "评审结论不能为空") RequirementReviewStatus decision,
        @Size(max = 2000, message = "评审意见不能超过2000个字符") String comment,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
