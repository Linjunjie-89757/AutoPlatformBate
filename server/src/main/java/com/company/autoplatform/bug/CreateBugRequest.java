package com.company.autoplatform.bug;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateBugRequest(
        String workspaceCode,
        @NotBlank(message = "标题不能为空") String title,
        @NotBlank(message = "描述不能为空") String description,
        String reproductionSteps,
        String expectedResult,
        String actualResult,
        String moduleName,
        String versionName,
        @NotNull(message = "优先级不能为空") BugPriority priority,
        @NotNull(message = "严重程度不能为空") BugSeverity severity,
        BugSourceType sourceType,
        @NotNull(message = "处理人不能为空") Long assigneeId,
        Long relatedCaseId,
        Long relatedReportId,
        Long relatedTaskId,
        List<String> tags
) {
}
