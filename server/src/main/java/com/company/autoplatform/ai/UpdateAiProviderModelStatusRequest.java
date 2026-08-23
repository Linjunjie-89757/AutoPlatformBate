package com.company.autoplatform.ai;

import jakarta.validation.constraints.NotNull;

public record UpdateAiProviderModelStatusRequest(
        @NotNull(message = "模型状态不能为空") Boolean selectable
) {
}
