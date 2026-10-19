package com.company.autoplatform.bug;

import java.util.List;

public record BugStatisticsResponse(
        long total,
        long todo,
        long assigned,
        long inProgress,
        long pendingVerify,
        long closed,
        long rejected,
        long highPriority,
        List<DistributionItem> severityDistribution,
        List<AssigneeDistributionItem> assigneeDistribution,
        List<TrendItem> trend
) {

    public record DistributionItem(String severity, long count) {
    }

    public record AssigneeDistributionItem(String name, long open, long closed) {
    }

    public record TrendItem(String date, long created, long closed) {
    }
}
