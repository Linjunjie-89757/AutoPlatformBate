package com.company.autoplatform.ai;

import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class AiTaskTimeoutTests {
    @Test
    void streamingWaitsForFirstResultThenResetsOnlyForNewResultsWithoutTotalLimit() {
        AtomicLong clock = new AtomicLong();
        AiTaskTimeout timeout = new AiTaskTimeout(true, false, 600, clock::get);
        for (int index = 0; index < 20; index++) {
            clock.addAndGet(TimeUnit.SECONDS.toNanos(590));
            assertThat(timeout.remainingNanos()).isEqualTo(TimeUnit.SECONDS.toNanos(10));
            timeout.progress("CASE:" + index);
            assertThat(timeout.remainingNanos()).isEqualTo(TimeUnit.SECONDS.toNanos(600));
        }
        clock.addAndGet(TimeUnit.SECONDS.toNanos(599));
        timeout.progress("CASE:19");
        assertThat(timeout.remainingNanos()).isEqualTo(TimeUnit.SECONDS.toNanos(1));
        clock.addAndGet(TimeUnit.SECONDS.toNanos(1));
        timeout.progress("late case");
        assertThat(timeout.remainingNanos()).isZero();
        assertThat(timeout.failure()).hasMessageContaining("连续 600 秒未新增有效用例");
    }

    @Test
    void noFirstReviewResultExpiresAndNewStageHasItsOwnClock() {
        AtomicLong clock = new AtomicLong();
        AiTaskTimeout generation = new AiTaskTimeout(true, false, 600, clock::get);
        clock.set(TimeUnit.SECONDS.toNanos(600));
        assertThat(generation.remainingNanos()).isZero();
        AiTaskTimeout review = new AiTaskTimeout(true, true, 600, clock::get);
        assertThat(review.remainingNanos()).isEqualTo(TimeUnit.SECONDS.toNanos(600));
        clock.addAndGet(TimeUnit.SECONDS.toNanos(600));
        assertThat(review.remainingNanos()).isZero();
        assertThat(review.failure()).isInstanceOf(AiReviewTimeoutException.class)
                .hasMessageContaining("连续 600 秒未新增有效评审结果");
    }

    @Test
    void completeModeKeepsAn1800SecondTotalDeadlineEvenIfProgressIsReported() {
        AtomicLong clock = new AtomicLong();
        AiTaskTimeout timeout = new AiTaskTimeout(false, true, 1800, clock::get);
        clock.set(TimeUnit.SECONDS.toNanos(1700));
        timeout.progress("REVIEW:0");
        assertThat(timeout.remainingNanos()).isEqualTo(TimeUnit.SECONDS.toNanos(100));
        clock.set(TimeUnit.SECONDS.toNanos(1800));
        assertThat(timeout.remainingNanos()).isZero();
        assertThat(timeout.failure()).hasMessageContaining("完整输出评审超过 1800 秒");
    }

    @Test
    void stoppedTaskCannotBeRevivedAndThreadContextIsRemoved() {
        AiTaskTimeout timeout = new AiTaskTimeout(true, false, 600);
        AiTaskTimeout.attach(timeout);
        try {
            assertThat(AiTaskTimeout.current()).isSameAs(timeout);
            timeout.stop();
            AiTaskTimeout.recordProgress("late callback");
            assertThat(timeout.remainingNanos()).isZero();
        } finally { AiTaskTimeout.detach(); }
        assertThat(AiTaskTimeout.current()).isNull();
    }
}
