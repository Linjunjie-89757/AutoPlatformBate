package com.company.autoplatform.testmanagement;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreateTestPlanRequest(
        @NotNull(message = "计划用途不能为空") PlanPurpose purpose,
        PlanType planType,
        Long versionId,
        @NotBlank(message = "计划名称不能为空") @Size(max = 255, message = "计划名称不能超过255个字符") String name,
        Long ownerId,
        LocalDate startDate,
        LocalDate endDate,
        @Size(max = 5000, message = "计划目标不能超过5000个字符") String goal,
        @DecimalMin(value = "0", message = "最低执行率不能小于0") @DecimalMax(value = "100", message = "最低执行率不能大于100") BigDecimal minExecuteRate,
        @DecimalMin(value = "0", message = "最低通过率不能小于0") @DecimalMax(value = "100", message = "最低通过率不能大于100") BigDecimal minPassRate,
        Boolean allowP0,
        @PositiveOrZero(message = "允许的P1缺陷数不能小于0") Integer maxP1,
        Boolean autoReport,
        Boolean ownerConfirmRequired,
        List<Long> requirementIds,
        List<Long> excludedAutoCaseIds,
        List<Long> manualCaseIds,
        boolean draft
) {
}
