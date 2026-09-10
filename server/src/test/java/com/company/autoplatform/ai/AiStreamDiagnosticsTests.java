package com.company.autoplatform.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

class AiStreamDiagnosticsTests {
    @TempDir Path root;
    private final AiResponseParsingSupport parsing = new AiResponseParsingSupport(new AiProviderClient(List.of()));
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void retainsTextAfterTwoCasesWhenThirdJsonNeverCloses() throws Exception {
        AiStreamDiagnostics diagnostics = diagnostics();
        var session = diagnostics.open("TASK_TEST", "GENERATING");
        String first = caseJson("第一条"), second = caseJson("第二条");
        String unfinished = "{\"title\":\"第三条未完成";
        StringBuilder raw = new StringBuilder(), buffer = new StringBuilder();
        List<GeneratedAiCaseItem> cases = new ArrayList<>();
        AiStreamDiagnostics.attach(session);
        try {
            for (String delta : List.of(first, "\n" + second, "\n" + unfinished)) {
                AiStreamDiagnostics.content(delta);
                raw.append(delta); buffer.append(delta);
                try { parsing.drainCompleteJsonValues(buffer, value -> parsing.emitGeneratedCaseValue(value, 20, cases,
                        new ArrayList<>(), new ArrayList<>(), raw, item -> {})); }
                finally { AiStreamDiagnostics.pending(buffer.toString()); }
            }
        } finally { AiStreamDiagnostics.detach(); diagnostics.finish(session, "TIMED_OUT", "timeout"); }
        Path directory = directory(session);
        assertThat(cases).hasSize(2);
        assertThat(Files.readString(directory.resolve("content-1.txt"))).isEqualTo(raw.toString());
        assertThat(Files.readString(directory.resolve("pending-1.txt"))).isEqualTo(unfinished);
        var summary = json.readTree(directory.resolve("summary.json").toFile());
        assertThat(summary.path("parsedCases").asInt()).isEqualTo(2);
        assertThat(summary.path("outcome").asText()).isEqualTo("TIMED_OUT");
        assertThat(summary.path("pendingChars").asInt()).isEqualTo(unfinished.length());
        session.content("late output"); session.pending("late pending"); session.parsed("CASE");
        assertThat(Files.readString(directory.resolve("content-1.txt"))).isEqualTo(raw.toString());
        assertThat(session.snapshot().get("parsedCases")).isEqualTo(2L);
    }

    @Test
    void distinguishesDuplicateGenerationFromInvalidJson() {
        var session = diagnostics().open("TASK_TEST", "GENERATING");
        List<GeneratedAiCaseItem> cases = new ArrayList<>();
        AiStreamDiagnostics.attach(session);
        try {
            for (String text : List.of(caseJson("有效用例"), caseJson("有效用例"), "{\"title\":}")) {
                AiStreamDiagnostics.content(text);
                parsing.emitGeneratedCaseValue(text, 20, cases, new ArrayList<>(), new ArrayList<>(), new StringBuilder(text), item -> {});
            }
        } finally { AiStreamDiagnostics.detach(); session.finish("SUCCEEDED", null); }
        assertThat(session.snapshot()).containsEntry("parsedCases", 1L).containsEntry("duplicates", 1L).containsEntry("invalidValues", 1L);
    }

    @Test
    void countsReviewDecisionsWithoutTreatingSummaryAsInvalid() {
        var session = diagnostics().open("TASK_TEST", "REVIEWING");
        var updates = new LinkedHashMap<Integer, AiCaseService.ReviewCaseStreamUpdate>();
        AiStreamDiagnostics.attach(session);
        try {
            for (String text : List.of("{\"caseIndex\":0,\"status\":\"APPROVED\"}",
                    "{\"caseIndex\":0,\"status\":\"APPROVED\"}", "{\"caseIndex\":99,\"status\":\"APPROVED\"}",
                    "{\"type\":\"SUMMARY\",\"reviewedCount\":1}")) {
                AiStreamDiagnostics.content(text);
                parsing.emitReviewValue(text, 1, new StringBuilder(text), updates, update -> {});
            }
        } finally { AiStreamDiagnostics.detach(); session.finish("FAILED", "missing decisions"); }
        assertThat(session.snapshot()).containsEntry("parsedDecisions", 1L).containsEntry("duplicates", 1L).containsEntry("invalidValues", 1L);
    }

    @Test
    void fallbackAndRetryKeepSeparateResponseFiles() throws Exception {
        var diagnostics = diagnostics();
        var first = diagnostics.open("TASK_TEST", "REVIEWING");
        first.content("original partial"); first.pending("partial");
        first.attempt("COMPLETE_OUTPUT_FALLBACK"); first.content("complete result"); first.finish("SUCCEEDED", null);
        var retry = diagnostics.open("TASK_TEST", "REVIEWING");
        retry.content("retry result"); retry.finish("SUCCEEDED", null);
        assertThat(directory(first)).isNotEqualTo(directory(retry));
        assertThat(Files.readString(directory(first).resolve("content-1.txt"))).isEqualTo("original partial");
        assertThat(Files.readString(directory(first).resolve("pending-1.txt"))).isEqualTo("partial");
        assertThat(Files.readString(directory(first).resolve("content-2.txt"))).isEqualTo("complete result");
        assertThat(Files.readString(directory(retry).resolve("content-1.txt"))).isEqualTo("retry result");
    }

    @Test
    void diagnosticStorageFailureDoesNotFailModelProcessing() throws Exception {
        Path file = Files.writeString(root.resolve("not-a-directory"), "existing");
        var diagnostics = new AiStreamDiagnostics(file.toString(), mock(AiGenerationTaskEventService.class));
        assertThatCode(() -> {
            var session = diagnostics.open("TASK_TEST", "GENERATING");
            session.content("正文"); session.pending("未解析"); session.parsed("CASE");
            diagnostics.finish(session, "SUCCEEDED", null);
            assertThat(session.snapshot().get("storageError")).isNotNull();
        }).doesNotThrowAnyException();
    }

    private AiStreamDiagnostics diagnostics() { return new AiStreamDiagnostics(root.toString(), mock(AiGenerationTaskEventService.class)); }
    private Path directory(AiStreamDiagnostics.Session session) { return Path.of(session.snapshot().get("directory").toString()); }
    private String caseJson(String title) {
        return "{\"title\":\"" + title + "\",\"caseType\":\"FUNCTION\",\"priority\":\"P1\",\"precondition\":\"已登录\",\"steps\":\"提交表单\",\"expectedResult\":\"提交成功\"}";
    }
}
