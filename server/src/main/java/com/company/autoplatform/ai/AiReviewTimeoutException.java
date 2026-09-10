package com.company.autoplatform.ai;

final class AiReviewTimeoutException extends RuntimeException {

    AiReviewTimeoutException(long timeoutSeconds) {
        super("AI 评审任务超过 " + timeoutSeconds + " 秒未完成");
    }

    AiReviewTimeoutException(long timeoutSeconds, boolean streaming) {
        super(streaming
                ? "AI 评审连续 " + timeoutSeconds + " 秒未新增有效评审结果，已停止并保留已评审内容"
                : "AI 完整输出评审超过 " + timeoutSeconds + " 秒未完成，已停止");
    }
}
