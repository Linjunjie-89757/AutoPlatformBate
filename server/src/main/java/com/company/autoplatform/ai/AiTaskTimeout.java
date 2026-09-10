package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

/** Task-scoped timeout shared by the watchdog and provider reader; independent of diagnostic storage. */
final class AiTaskTimeout {
    private static final ThreadLocal<AiTaskTimeout> CURRENT = new ThreadLocal<>();

    private final boolean streaming;
    private final boolean review;
    private final long seconds;
    private final long timeoutNanos;
    private final LongSupplier clock;
    private final Set<String> results = new HashSet<>();
    private long lastProgressAt;
    private boolean stopped;

    AiTaskTimeout(boolean streaming, boolean review, long seconds) {
        this(streaming, review, seconds, System::nanoTime);
    }

    AiTaskTimeout(boolean streaming, boolean review, long seconds, LongSupplier clock) {
        this.streaming = streaming;
        this.review = review;
        this.seconds = seconds;
        this.timeoutNanos = TimeUnit.SECONDS.toNanos(seconds);
        this.clock = clock;
        this.lastProgressAt = clock.getAsLong();
    }

    static AiTaskTimeout current() { return CURRENT.get(); }
    static void attach(AiTaskTimeout timeout) { CURRENT.set(timeout); }
    static void detach() { CURRENT.remove(); }

    static void recordProgress(String resultKey) {
        AiTaskTimeout timeout = current();
        if (timeout != null) timeout.progress(resultKey);
    }

    synchronized void progress(String resultKey) {
        // Repeated results and late callbacks must never revive an expired task.
        long now = clock.getAsLong();
        if (streaming && !stopped && now - lastProgressAt < timeoutNanos && results.add(resultKey)) {
            lastProgressAt = now;
        }
    }

    synchronized long remainingNanos() {
        return stopped ? 0 : timeoutNanos - (clock.getAsLong() - lastProgressAt);
    }

    synchronized void stop() { stopped = true; }

    RuntimeException failure() {
        if (review) return new AiReviewTimeoutException(seconds, streaming);
        return new BadRequestException(streaming
                ? "AI 生成连续 " + seconds + " 秒未新增有效用例，已停止并保留已生成内容"
                : "AI 完整输出生成超过 " + seconds + " 秒未完成，已停止");
    }
}
