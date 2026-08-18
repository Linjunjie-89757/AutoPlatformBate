package com.company.autoplatform.testmanagement;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TestVersionResponse(
        Long id,
        String versionNo,
        String name,
        VersionType versionType,
        VersionStatus status,
        Long ownerId,
        String ownerName,
        LocalDate startDate,
        LocalDate testDate,
        LocalDate releaseDate,
        String goal,
        long requirementCount,
        long planCount,
        long caseCount,
        long executedCount,
        long passedCount,
        long openP0Count,
        long openP1Count,
        Integer lockVersion,
        String workspaceCode,
        String workspaceName,
        Long createdBy,
        LocalDateTime createdAt,
        Long updatedBy,
        LocalDateTime updatedAt,
        LocalDateTime archivedAt
) {
}
