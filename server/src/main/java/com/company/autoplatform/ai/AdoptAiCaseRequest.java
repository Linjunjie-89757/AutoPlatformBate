package com.company.autoplatform.ai;

import jakarta.validation.constraints.NotNull;

public record AdoptAiCaseRequest(
        @NotNull(message = "保存目录不能为空") Long directoryId
) {
}
