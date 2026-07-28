package com.company.autoplatform.casecenter;

public record CaseImportTemplate(
        String fileName,
        String contentType,
        byte[] content
) {
}
