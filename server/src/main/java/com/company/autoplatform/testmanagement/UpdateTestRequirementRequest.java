package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateTestRequirementRequest(
        @NotNull(message = "所属版本不能为空") Long versionId,
        @NotBlank(message = "需求标题不能为空") @Size(max = 255, message = "需求标题不能超过255个字符") String title,
        @NotNull(message = "需求优先级不能为空") RequirementPriority priority,
        @NotNull(message = "需求来源不能为空") RequirementSourceType sourceType,
        @Size(max = 255, message = "外部需求标识不能超过255个字符") String sourceRef,
        Long assigneeId,
        @Size(max = 10000, message = "需求描述不能超过10000个字符") String description,
        @NotNull(message = "expectedVersion不能为空") @PositiveOrZero(message = "expectedVersion不能小于0") Integer expectedVersion
) {
}
