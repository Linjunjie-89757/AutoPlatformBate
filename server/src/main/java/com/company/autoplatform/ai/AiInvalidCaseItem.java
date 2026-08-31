package com.company.autoplatform.ai;

public record AiInvalidCaseItem(
        Integer index,
        String title,
        String reason,
        String rawContent
) {
    public AiInvalidCaseItem(Integer index, String title, String reason) {
        this(index, title, reason, null);
    }
}
