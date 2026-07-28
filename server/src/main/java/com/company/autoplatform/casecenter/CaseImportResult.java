package com.company.autoplatform.casecenter;

import java.util.List;

public record CaseImportResult(
        int totalRows,
        int createdCount,
        int skippedCount,
        int failedCount,
        List<CaseImportRowIssue> issues
) {
}
