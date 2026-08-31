package com.company.autoplatform.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Extracts complete top-level JSON values from model text without relying on line breaks. */
final class AiJsonBoundaryExtractor {

    private AiJsonBoundaryExtractor() {
    }

    static List<String> extractCompleteValues(String content) {
        List<String> values = new ArrayList<>();
        if (content == null || content.isBlank()) {
            return values;
        }
        StringBuilder buffer = new StringBuilder(content);
        drainCompleteValues(buffer, values::add);
        return values;
    }

    static void drainCompleteValues(StringBuilder buffer, Consumer<String> valueConsumer) {
        if (buffer == null || valueConsumer == null) {
            return;
        }
        while (true) {
            int start = findJsonStart(buffer);
            if (start < 0) {
                buffer.setLength(0);
                return;
            }
            if (start > 0) {
                buffer.delete(0, start);
            }
            int end = findJsonEnd(buffer);
            if (end < 0) {
                return;
            }
            valueConsumer.accept(buffer.substring(0, end + 1));
            buffer.delete(0, end + 1);
        }
    }

    private static int findJsonStart(CharSequence content) {
        for (int index = 0; index < content.length(); index += 1) {
            char current = content.charAt(index);
            if (current == '{' || current == '[') {
                return index;
            }
        }
        return -1;
    }

    private static int findJsonEnd(CharSequence content) {
        if (content.length() == 0 || (content.charAt(0) != '{' && content.charAt(0) != '[')) {
            return -1;
        }
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int index = 0; index < content.length(); index += 1) {
            char current = content.charAt(index);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (current == '\\') {
                    escaped = true;
                } else if (current == '"') {
                    inString = false;
                }
                continue;
            }
            if (current == '"') {
                inString = true;
                continue;
            }
            if (current == '{' || current == '[') {
                depth += 1;
            } else if (current == '}' || current == ']') {
                depth -= 1;
                if (depth == 0) {
                    return index;
                }
                if (depth < 0) {
                    return -1;
                }
            }
        }
        return -1;
    }
}
