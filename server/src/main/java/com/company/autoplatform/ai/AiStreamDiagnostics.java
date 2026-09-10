package com.company.autoplatform.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Task-scoped diagnostics. Never writes model credentials or changes business results. */
@Component
public class AiStreamDiagnostics {
    private static final Logger log = LoggerFactory.getLogger(AiStreamDiagnostics.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ThreadLocal<Session> CURRENT = new ThreadLocal<>();
    private final Path root;
    private final AiGenerationTaskEventService eventService;

    public AiStreamDiagnostics(@Value("${app.ai.stream-diagnostics-root:./data/ai-stream-diagnostics}") String root,
                               AiGenerationTaskEventService eventService) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        this.eventService = eventService;
    }

    Session open(String taskId, String stage) {
        if (!taskId.matches("[A-Za-z0-9_-]+") || !stage.matches("[A-Z_]+")) throw new IllegalArgumentException("Invalid diagnostic identity");
        Session session = new Session(root.resolve(taskId).resolve(stage + "-" + UUID.randomUUID()), taskId, stage);
        publish(session, "STREAM_DIAGNOSTICS_STARTED", "流式诊断记录已开始");
        return session;
    }

    void finish(Session session, String outcome, String error) {
        if (session == null) return;
        session.finish(outcome, error);
        publish(session, "STREAM_DIAGNOSTICS_SAVED", "流式诊断记录已保存");
    }

    private void publish(Session session, String type, String message) {
        try {
            eventService.append(session.taskId, type, session.stage, session.storageError == null ? "INFO" : "WARN",
                    session.storageError == null ? message : "流式诊断保存失败，请检查服务日志", null, null, null, null,
                    JSON.writeValueAsString(session.snapshot()));
        } catch (Exception exception) {
            log.warn("Unable to publish AI stream diagnostics for task {}", session.taskId, exception);
        }
    }

    static void attach(Session session) { if (session != null) CURRENT.set(session); }
    static void detach() { CURRENT.remove(); }
    static void content(String text) { Session s = CURRENT.get(); if (s != null) s.content(text); }
    static void pending(String text) { Session s = CURRENT.get(); if (s != null) s.pending(text); }
    static void parsed(String kind) { Session s = CURRENT.get(); if (s != null) s.parsed(kind); }
    static void invalid(String reason, String value) { Session s = CURRENT.get(); if (s != null) s.invalid(reason, value); }
    static void duplicate() { Session s = CURRENT.get(); if (s != null) s.duplicate(); }
    static void wire(int reasoningChars, String finishReason) { Session s = CURRENT.get(); if (s != null) s.wire(reasoningChars, finishReason); }
    static void attempt(String reason) { Session s = CURRENT.get(); if (s != null) s.attempt(reason); }

    static final class Session {
        private static final int MAX_CONTENT_CHARS = 1_000_000;
        private static final long FLUSH_NANOS = 1_000_000_000L;
        private final Path directory;
        private final String taskId;
        private final String stage;
        private final Instant startedAt = Instant.now();
        private BufferedWriter contentWriter;
        private BufferedWriter issueWriter;
        private String pending = "";
        private long chunks, receivedChars, savedChars, wireEvents, reasoningChars, parsedCases, parsedDecisions, supplements, invalidValues, duplicates;
        private Instant lastContentAt, lastParsedAt, lastWireAt;
        private long lastFlush;
        private int attempt = 1;
        private boolean closed;
        private String outcome = "RUNNING", error, finishReason, storageError;

        Session(Path directory, String taskId, String stage) {
            this.directory = directory;
            this.taskId = taskId;
            this.stage = stage;
            try {
                Files.createDirectories(directory);
                contentWriter = Files.newBufferedWriter(directory.resolve("content-1.txt"), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                issueWriter = Files.newBufferedWriter(directory.resolve("issues.jsonl"), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                flush(true);
            } catch (IOException exception) { storageFailure(exception); }
        }

        synchronized void content(String text) {
            if (closed || text == null || text.isEmpty()) return;
            chunks++;
            receivedChars += text.length();
            lastContentAt = Instant.now();
            int length = (int) Math.min(text.length(), Math.max(0, MAX_CONTENT_CHARS - savedChars));
            try {
                if (contentWriter != null && length > 0) { contentWriter.write(text, 0, length); savedChars += length; }
            } catch (IOException exception) { storageFailure(exception); }
            flush(false);
        }

        synchronized void pending(String text) {
            if (closed) return;
            pending = text.length() > MAX_CONTENT_CHARS ? text.substring(0, MAX_CONTENT_CHARS) : text;
            flush(false);
        }

        synchronized void parsed(String kind) {
            if (closed) return;
            if ("CASE".equals(kind)) parsedCases++;
            else if ("SUPPLEMENT".equals(kind)) supplements++;
            else parsedDecisions++;
            lastParsedAt = Instant.now();
        }

        synchronized void invalid(String reason, String value) {
            if (closed) return;
            invalidValues++;
            // Full text is retained in content files; issue excerpts are bounded.
            if (invalidValues > 200 || issueWriter == null) return;
            try {
                String excerpt = value == null ? "" : value.substring(0, Math.min(2000, value.length()));
                issueWriter.write(JSON.writeValueAsString(Map.of("at", Instant.now().toString(), "attempt", attempt,
                        "reason", reason, "excerpt", excerpt)));
                issueWriter.newLine();
            } catch (IOException exception) { storageFailure(exception); }
        }

        synchronized void duplicate() { if (!closed) duplicates++; }

        synchronized void wire(int reasoningLength, String reason) {
            if (closed) return;
            wireEvents++;
            reasoningChars += reasoningLength;
            lastWireAt = Instant.now();
            if (reason != null && !reason.isBlank()) finishReason = reason;
            flush(false);
        }

        synchronized void attempt(String reason) {
            if (closed) return;
            flush(true);
            try {
                if (contentWriter != null) contentWriter.close();
                Files.writeString(directory.resolve("pending-" + attempt + ".txt"), pending, StandardCharsets.UTF_8);
                attempt++;
                contentWriter = Files.newBufferedWriter(directory.resolve("content-" + attempt + ".txt"), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                if (issueWriter != null) {
                    issueWriter.write(JSON.writeValueAsString(Map.of("at",Instant.now().toString(),"attempt",attempt,"fallback",reason)));
                    issueWriter.newLine();
                }
                pending = "";
            } catch (IOException exception) { storageFailure(exception); }
        }

        synchronized void finish(String outcome, String error) {
            if (closed) return;
            closed = true;
            this.outcome = outcome;
            this.error = error;
            flush(true);
            try { if (contentWriter != null) contentWriter.close(); } catch (IOException e) { storageFailure(e); }
            try { if (issueWriter != null) issueWriter.close(); } catch (IOException e) { storageFailure(e); }
        }

        synchronized Map<String, Object> snapshot() {
            Map<String,Object> data = new LinkedHashMap<>();
            data.put("taskId",taskId); data.put("stage",stage); data.put("directory",directory.toString());
            data.put("startedAt",startedAt.toString()); data.put("snapshotAt",Instant.now().toString());
            data.put("outcome",outcome); data.put("error",error); data.put("attempts",attempt);
            data.put("counterScope","ALL_ATTEMPTS");
            data.put("receivedChunks",chunks); data.put("receivedChars",receivedChars); data.put("savedChars",savedChars);
            data.put("truncated",receivedChars > savedChars); data.put("pendingChars",pending.length());
            data.put("wireEvents",wireEvents); data.put("reasoningChars",reasoningChars); data.put("finishReason",finishReason);
            data.put("parsedCases",parsedCases); data.put("parsedDecisions",parsedDecisions); data.put("supplements",supplements);
            data.put("invalidValues",invalidValues); data.put("duplicates",duplicates);
            data.put("lastContentAt",lastContentAt == null ? null : lastContentAt.toString());
            data.put("lastParsedAt",lastParsedAt == null ? null : lastParsedAt.toString());
            data.put("lastWireAt",lastWireAt == null ? null : lastWireAt.toString());
            data.put("storageError",storageError);
            return data;
        }

        private void flush(boolean force) {
            long now = System.nanoTime();
            if (!force && now - lastFlush < FLUSH_NANOS) return;
            lastFlush = now;
            try {
                if (contentWriter != null) contentWriter.flush();
                if (issueWriter != null) issueWriter.flush();
                Files.writeString(directory.resolve("pending-" + attempt + ".txt"), pending, StandardCharsets.UTF_8);
                Files.writeString(directory.resolve("summary.json"), JSON.writerWithDefaultPrettyPrinter().writeValueAsString(snapshot()), StandardCharsets.UTF_8);
            } catch (IOException exception) { storageFailure(exception); }
        }

        private void storageFailure(IOException exception) {
            if (storageError == null) log.warn("Unable to save AI stream diagnostics for task {}", taskId, exception);
            storageError = exception.getClass().getSimpleName();
        }
    }
}
