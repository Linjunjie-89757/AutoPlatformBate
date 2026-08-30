package com.company.autoplatform.ai;

import org.springframework.stereotype.Component;

@Component
public class AiGenerationTaskEventMessageSupport {

    private String reviewStatusLabel(String status) {
        if ("APPROVED".equals(status)) {
            return "通过";
        }
        if ("OPTIMIZED".equals(status) || "CHANGE_SUGGESTED".equals(status)) {
            return "已优化";
        }
        if ("SUPPLEMENTED".equals(status)) {
            return "已补充";
        }
        if ("CONFIRM_REQUIRED".equals(status)) {
            return "建议确认";
        }
        if ("NOT_RECOMMENDED".equals(status)) {
            return "不推荐";
        }
        if ("REJECTED".equals(status)) {
            return "需重生成";
        }
        return "建议优化";
    }

    String buildGeneratedCaseEventMessage(Integer itemIndex, GeneratedAiCaseItem item) {
        StringBuilder message = new StringBuilder("生成用例 #")
                .append((itemIndex == null ? 0 : itemIndex) + 1);
        appendCaseTitle(message, item == null ? null : item.title());
        return message.toString();
    }

    String buildReviewedCaseEventMessage(Integer itemIndex, String itemTitle, String status, String summary, String coverageComment, String evidenceComment) {
        StringBuilder message = new StringBuilder("评审用例 #")
                .append((itemIndex == null ? 0 : itemIndex) + 1);
        appendCaseTitle(message, itemTitle);
        message.append(" ").append(reviewStatusLabel(status));
        return message.toString();
    }

    String buildSupplementedCaseEventMessage(Integer itemIndex, GeneratedAiCaseItem item) {
        StringBuilder message = new StringBuilder("评审补充用例 #")
                .append((itemIndex == null ? 0 : itemIndex) + 1);
        appendCaseTitle(message, item == null ? null : item.title());
        return message.toString();
    }

    private void appendCaseTitle(StringBuilder message, String title) {
        String normalized = blankToNull(title);
        if (normalized != null) {
            message.append("：").append(normalized);
        } else {
            message.append("：用例");
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
