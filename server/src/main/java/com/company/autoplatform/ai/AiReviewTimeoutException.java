package com.company.autoplatform.ai;

final class AiReviewTimeoutException extends RuntimeException {

    AiReviewTimeoutException(long timeoutSeconds) {
        super("AI 评审任务超过 " + timeoutSeconds + " 秒未完成");
    }
}
