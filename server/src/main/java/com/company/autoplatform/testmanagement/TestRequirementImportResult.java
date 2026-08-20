package com.company.autoplatform.testmanagement;

import java.util.List;

public record TestRequirementImportResult(
        int totalRows,
        int importedCount,
        int skippedCount,
        int failedCount,
        List<Long> importedRequirementIds,
        List<TestRequirementImportIssue> issues
) {
}
