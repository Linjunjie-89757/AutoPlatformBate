package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class WebUiExecutionContextSupport {

    static final String WEB_UI_ENV_TYPE = "WEB_UI";
    static final String WEB_UI_VARIABLE_SET_TYPE = "WEB_UI_VARIABLE_SET";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("(?<!\\\\)\\{\\{\\s*([\\w.-]+)\\s*}}");
    private static final Pattern ESCAPED_VARIABLE_PREFIX = Pattern.compile("\\\\(?=\\{\\{\\s*[\\w.-]+\\s*}})");
    private static final String MASKED_VALUE = "******";

    String toJson(Object value, String message) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException(message);
        }
    }

    WebUiEnvironmentConfig readEnvironmentConfig(String json) {
        if (json == null || json.isBlank()) {
            return WebUiEnvironmentConfig.defaults();
        }
        try {
            WebUiEnvironmentConfig config = OBJECT_MAPPER.readValue(json, WebUiEnvironmentConfig.class);
            return config == null ? WebUiEnvironmentConfig.defaults() : config;
        } catch (JsonProcessingException exception) {
            return WebUiEnvironmentConfig.defaults();
        }
    }

    List<VariableItem> readVariables(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<VariableItem> variables = OBJECT_MAPPER.readValue(json, new TypeReference<>() {
            });
            return variables == null ? List.of() : variables;
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    Map<String, RuntimeVariable> builtInVariables() {
        LinkedHashMap<String, RuntimeVariable> variables = new LinkedHashMap<>();
        LocalDateTime now = LocalDateTime.now();
        variables.put("TIMESTAMP", new RuntimeVariable(now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")), false));
        variables.put("TODAY", new RuntimeVariable(LocalDate.now().toString(), false));
        variables.put("RANDOM_STRING", new RuntimeVariable(UUID.randomUUID().toString().replace("-", "").substring(0, 8), false));
        return variables;
    }

    Map<String, RuntimeVariable> mergeVariables(
            Map<String, RuntimeVariable> builtInVariables,
            List<VariableItem> environmentVariables,
            List<VariableItem> variableSetVariables,
            Map<String, String> runtimeVariables
    ) {
        LinkedHashMap<String, RuntimeVariable> merged = new LinkedHashMap<>();
        if (builtInVariables != null) {
            merged.putAll(builtInVariables);
        }
        putVariableItems(merged, environmentVariables);
        putVariableItems(merged, variableSetVariables);
        if (runtimeVariables != null) {
            runtimeVariables.forEach((name, value) -> {
                String key = normalizeVariableName(name);
                if (key != null) {
                    merged.put(key, new RuntimeVariable(Optional.ofNullable(value).orElse(""), false));
                }
            });
        }
        return merged;
    }

    String replaceVariables(String text, Map<String, RuntimeVariable> variables) {
        if (text == null || text.isBlank()) {
            return text;
        }
        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1);
            if (variables == null || !variables.containsKey(key)) {
                throw new BadRequestException("Missing Web UI variable: " + key);
            }
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(Optional.ofNullable(variables.get(key).value()).orElse("")));
        }
        matcher.appendTail(buffer);
        return ESCAPED_VARIABLE_PREFIX.matcher(buffer.toString()).replaceAll("");
    }

    Map<String, String> maskVariables(Map<String, RuntimeVariable> variables) {
        LinkedHashMap<String, String> masked = new LinkedHashMap<>();
        if (variables == null) {
            return masked;
        }
        variables.forEach((name, variable) -> masked.put(
                name,
                variable != null && variable.sensitive() ? MASKED_VALUE : Optional.ofNullable(variable == null ? null : variable.value()).orElse("")
        ));
        return masked;
    }

    ExecutionContextSnapshot readExecutionContextSnapshot(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(json, ExecutionContextSnapshot.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    void putVariableItems(Map<String, RuntimeVariable> target, List<VariableItem> variables) {
        if (variables == null) {
            return;
        }
        for (VariableItem variable : variables) {
            if (variable == null) {
                continue;
            }
            String key = normalizeVariableName(variable.name());
            if (key == null) {
                continue;
            }
            target.put(key, new RuntimeVariable(Optional.ofNullable(variable.value()).orElse(""), Boolean.TRUE.equals(variable.sensitive())));
        }
    }

    private String normalizeVariableName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WebUiEnvironmentConfig(
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Viewport viewport,
            Boolean ignoreHttpsErrors,
            Long defaultVariableSetId,
            Long mockApplicationId,
            List<VariableItem> variables,
            String defaultServiceKey,
            List<ServiceEndpoint> services
    ) {
        static WebUiEnvironmentConfig defaults() {
            return new WebUiEnvironmentConfig(null, null, null, null, null, null, null, List.of(), null, List.of());
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ServiceEndpoint(
            String key,
            String name,
            String baseUrl
    ) {
    }

    public record Viewport(
            Integer width,
            Integer height
    ) {
    }

    public record VariableItem(
            String name,
            String value,
            Boolean sensitive,
            String description
    ) {
    }

    public record RuntimeVariable(
            String value,
            boolean sensitive
    ) {
    }

    public record ExecutionContextSnapshot(
            EnvironmentSnapshot environment,
            Long variableSetId,
            String variableSetName,
            List<VariableSetSnapshot> variableSets,
            MockSnapshot mock,
            Map<String, String> variables,
            String executionLocation,
            String localRunnerRunId
    ) {
    }

    public record VariableSetSnapshot(
            Long id,
            String name
    ) {
    }

    public record EnvironmentSnapshot(
            Long id,
            String name,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String defaultServiceKey,
            List<ServiceEndpoint> services
    ) {
    }

    public record MockSnapshot(
            Long id,
            String appName,
            String appCode,
            String baseUrl,
            Long releaseId,
            Integer releaseVersion
    ) {
    }
}
