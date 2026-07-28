package com.company.autoplatform.casecenter;

public record CaseImportRowIssue(
        int rowNumber,
        String title,
        String type,
        String message
) {
}
