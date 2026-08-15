package com.company.autoplatform.platformadmin;

import jakarta.validation.constraints.Size;

public record RejectPlatformJoinApplicationRequest(
        @Size(max = 500, message = "拒绝原因不能超过500个字符")
        String reason
) {
}
