package com.company.autoplatform.ai;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Iterator;
import java.util.Spliterators;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

class AiStreamingLifecycleTests {
    private final OpenAiCompatibleChatAdapter adapter = new OpenAiCompatibleChatAdapter(5) {
        @Override
        protected long resolveRequestTimeoutSeconds(Integer seconds) { return 1; }
    };

    @Test
    void chatDoneClosesBodyWithoutWaitingForSocketEof() throws Exception {
        AtomicBoolean closed = new AtomicBoolean();
        String result = adapter.consumeChatStreamingLines(terminalThenBlocking("data: [DONE]").onClose(() -> closed.set(true)), s -> {}, 1);
        assertThat(result).isEmpty();
        assertThat(closed).isTrue();
    }

    @Test
    void responsesCompletedClosesBodyWithoutWaitingForSocketEof() throws Exception {
        assertThat(adapter.consumeResponsesStreamingLines(
                terminalThenBlocking("data: {\"type\":\"response.completed\"}"), s -> {}, 1)).isEmpty();
    }

    @Test
    void heartbeatDoesNotResetEffectiveOutputDeadline() {
        Iterator<String> heartbeat = new Iterator<>() {
            public boolean hasNext() {
                try { Thread.sleep(50); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return true;
            }
            public String next() { return ": heartbeat"; }
        };
        assertTimeoutPreemptively(Duration.ofSeconds(3), () ->
                assertThatThrownBy(() -> adapter.consumeChatStreamingLines(stream(heartbeat), s -> {}, 1))
                        .hasMessageContaining("有效输出空闲超时"));
    }

    @Test
    void timeoutClosesBodyEvenWhenReadIgnoresThreadInterruption() {
        CountDownLatch closed = new CountDownLatch(1);
        Iterator<String> socketRead = new Iterator<>() {
            public boolean hasNext() {
                boolean interrupted = false;
                while (closed.getCount() > 0) {
                    try { closed.await(); }
                    catch (InterruptedException e) { interrupted = true; }
                }
                if (interrupted) Thread.currentThread().interrupt();
                return false;
            }
            public String next() { throw new AssertionError("no content"); }
        };
        assertTimeoutPreemptively(Duration.ofSeconds(3), () ->
                assertThatThrownBy(() -> adapter.consumeChatStreamingLines(stream(socketRead).onClose(closed::countDown), s -> {}, 1))
                        .hasMessageContaining("超时"));
        assertThat(closed.getCount()).isZero();
    }

    @Test
    void providerTruncationCannotBecomeSuccessfulCompletion() {
        assertThatThrownBy(() -> adapter.consumeChatStreamingLines(
                Stream.of("data: {\"choices\":[{\"finish_reason\":\"length\"}]}"), s -> {}, 1))
                .hasMessageContaining("未正常完成");
        assertThatThrownBy(() -> adapter.consumeResponsesStreamingLines(
                Stream.of("data: {\"type\":\"response.incomplete\"}"), s -> {}, 1))
                .hasMessageContaining("未正常完成");
    }

    @Test
    void taskProgressAllowsLongerGapsThanProviderSettingAndLongerTotalDuration() {
        assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
            AiTaskTimeout timeout = new AiTaskTimeout(true, false, 2);
            AiTaskTimeout.attach(timeout);
            try {
                Iterator<String> output = new Iterator<>() {
                    int index;
                    public boolean hasNext() {
                        if (index < 2) {
                            try { Thread.sleep(1200); }
                            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                        }
                        return true;
                    }
                    public String next() {
                        return index++ < 2
                                ? "data: {\"choices\":[{\"delta\":{\"content\":\"case " + index + "\"}}]}"
                                : "data: [DONE]";
                    }
                };
                assertThat(adapter.consumeChatStreamingLines(stream(output), AiTaskTimeout::recordProgress, 1))
                        .isEqualTo("case 1case 2");
                assertThat(timeout.remainingNanos()).isPositive();
            } finally { AiTaskTimeout.detach(); }
        });
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {": heartbeat", "data: {\"choices\":[{\"delta\":{\"content\":\"unfinished text\"}}]}"})
    void taskReaderStopsWhenWireOutputNeverProducesValidResults(String line) {
        assertTimeoutPreemptively(Duration.ofSeconds(3), () -> {
            AiTaskTimeout.attach(new AiTaskTimeout(true, true, 1));
            AtomicBoolean closed = new AtomicBoolean();
            try {
                Iterator<String> output = new Iterator<>() {
                    public boolean hasNext() {
                        try { Thread.sleep(50); }
                        catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                        return true;
                    }
                    public String next() { return line; }
                };
                assertThatThrownBy(() -> adapter.consumeChatStreamingLines(
                        stream(output).onClose(() -> closed.set(true)), text -> {}, 30))
                        .isInstanceOf(AiReviewTimeoutException.class)
                        .hasMessageContaining("连续 1 秒未新增有效评审结果");
                assertThat(closed).isTrue();
            } finally { AiTaskTimeout.detach(); }
        });
    }

    @Test
    void completeTaskKeepsNonStreamingRequestAndDoesNotUseShorterProviderTimeout() throws Exception {
        var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        var body = new java.util.concurrent.atomic.AtomicReference<String>();
        server.createContext("/complete", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            try { Thread.sleep(1200); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            byte[] response = "complete result".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.start();
        AiTaskTimeout.attach(new AiTaskTimeout(false, false, 3));
        try {
            var response = adapter.sendRequest("POST", "http://127.0.0.1:" + server.getAddress().getPort() + "/complete",
                    "test-only", "{\"stream\":false}", 1);
            assertThat(response.body()).isEqualTo("complete result");
            assertThat(body.get()).isEqualTo("{\"stream\":false}");
        } finally {
            AiTaskTimeout.detach();
            server.stop(0);
        }
    }

    private Stream<String> terminalThenBlocking(String terminal) {
        return stream(new Iterator<>() {
            boolean consumed;
            public boolean hasNext() {
                if (consumed) throw new AssertionError("read attempted after terminal event");
                return true;
            }
            public String next() { consumed = true; return terminal; }
        });
    }

    private Stream<String> stream(Iterator<String> iterator) {
        return StreamSupport.stream(Spliterators.spliteratorUnknownSize(iterator, 0), false);
    }
}
