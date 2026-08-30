package com.company.autoplatform.casecenter;

import jakarta.validation.constraints.NotBlank;

public record CreateCaseRequest(
        String workspaceCode,
        Long directoryId,
        @NotBlank(message = "用例标题不能为空") String title,
        @NotBlank(message = "用例类型不能为空") String caseType,
        @NotBlank(message = "优先级不能为空") String priority,
        @NotBlank(message = "来源不能为空") String sourceType,
        Long ownerId,
        String precondition,
        String steps,
        String expectedResult
) {
}
