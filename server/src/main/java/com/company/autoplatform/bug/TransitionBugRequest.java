package com.company.autoplatform.bug;

import jakarta.validation.constraints.NotNull;

public record TransitionBugRequest(
        String workspaceCode,
        @NotNull(message = "目标状态不能为空") BugStatus toStatus,
        Long assigneeId,
        String actionComment
) {
}
