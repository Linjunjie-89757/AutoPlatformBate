package com.company.autoplatform.testmanagement;

import java.time.LocalDateTime;

public record TestPlanExecutionAttachmentResponse(
        Long id,
        String fileName,
        String contentType,
        Long fileSize,
        String downloadUrl,
        LocalDateTime createdAt
) {
}
