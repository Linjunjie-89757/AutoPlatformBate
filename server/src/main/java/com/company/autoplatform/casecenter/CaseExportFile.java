package com.company.autoplatform.casecenter;

public record CaseExportFile(
        String fileName,
        String contentType,
        byte[] content
) {
}
