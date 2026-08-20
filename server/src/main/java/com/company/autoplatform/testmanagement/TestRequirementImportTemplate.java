package com.company.autoplatform.testmanagement;

public record TestRequirementImportTemplate(
        String fileName,
        String contentType,
        byte[] content
) {
}
