package com.company.autoplatform.testmanagement;

public record TestRequirementImportIssue(
        int rowNumber,
        String title,
        String status,
        String message
) {
}
