package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateTestVersionRequest(
        @NotBlank(message = "版本名称不能为空") @Size(max = 128, message = "版本名称不能超过128个字符") String name,
        @NotNull(message = "版本类型不能为空") VersionType versionType,
        @NotNull(message = "版本负责人不能为空") Long ownerId,
        LocalDate startDate,
        LocalDate testDate,
        LocalDate releaseDate,
        @Size(max = 5000, message = "版本目标不能超过5000个字符") String goal
) {
}
