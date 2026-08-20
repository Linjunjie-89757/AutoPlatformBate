package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateTestPlanCaseSnapshotRequest(
        @NotBlank(message = "用例标题不能为空") @Size(max = 255, message = "用例标题不能超过255个字符") String title,
        @Size(max = 255, message = "所属模块不能超过255个字符") String module,
        @NotBlank(message = "优先级不能为空") String priority,
        String precondition,
        String steps,
        String expectedResult,
        @NotNull(message = "expectedVersion不能为空") Integer expectedVersion
) {
}
