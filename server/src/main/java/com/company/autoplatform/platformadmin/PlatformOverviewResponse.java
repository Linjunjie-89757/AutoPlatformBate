package com.company.autoplatform.platformadmin;

import java.util.List;

public record PlatformOverviewResponse(
        long workspaceTotal,
        long registeredUserTotal,
        long todayActiveUserTotal,
        long pendingApprovalTotal,
        List<PlatformOverviewWorkspaceItem> workspaces,
        List<PlatformOverviewOperationItem> recentOperations
) {
}
