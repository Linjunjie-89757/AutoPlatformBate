package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.settings.DbConnectionCrypto;
import com.company.autoplatform.settings.DbConnectionEntity;
import com.company.autoplatform.settings.DbConnectionMapper;
import com.company.autoplatform.settings.EnvConfigEntity;
import com.company.autoplatform.settings.EnvConfigMapper;
import com.jayway.jsonpath.JsonPath;
import org.jsoup.Jsoup;
import org.jsoup.helper.W3CDom;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.StringReader;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.defaultList;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.emptyAuthConfig;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.firstNonBlank;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.normalizeAuth;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Component
public class ApiProcessorExecutor {

    private static final String API_ENV_TYPE = "API";

    private final ApiAutomationScriptRunner scriptRunner;
    private final ApiVariableResolver variableResolver;
    private final EnvConfigMapper envConfigMapper;
    private final DbConnectionMapper dbConnectionMapper;
    private final DbConnectionCrypto dbConnectionCrypto;

    public ApiProcessorExecutor(
            ApiAutomationScriptRunner scriptRunner,
            ApiVariableResolver variableResolver,
            EnvConfigMapper envConfigMapper,
            DbConnectionMapper dbConnectionMapper,
            DbConnectionCrypto dbConnectionCrypto
    ) {
        this.scriptRunner = scriptRunner;
        this.variableResolver = variableResolver;
        this.envConfigMapper = envConfigMapper;
        this.dbConnectionMapper = dbConnectionMapper;
        this.dbConnectionCrypto = dbConnectionCrypto;
    }

    void executeProcessors(
            String stage,
            List<ApiProcessorInput> processors,
            Long workspaceId,
            ApiExecutionRuntimeModels.MutableRequestConfig requestConfig,
            ApiRequestSnapshot requestSnapshot,
            ApiResponseSnapshot response,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables,
            List<ApiProcessorResult> processorResults,
            List<ApiExtractionResult> extractionResults
    ) {
        for (ApiProcessorInput processor : processors) {
            if (Boolean.FALSE.equals(processor.enabled())) {
                continue;
            }
            long started = System.currentTimeMillis();
            Map<String, String> beforeVariables = new LinkedHashMap<>(variables);
            try {
                String type = Optional.ofNullable(processor.processorType()).orElse("").trim().toUpperCase();
                String message;
                List<String> logs = List.of();
                switch (type) {
                    case "SCRIPT" -> {
                        ApiAutomationScriptRunner.ScriptExecutionResult scriptResult = executeScriptProcessor(processor, requestConfig, response, variables);
                        variables.clear();
                        variables.putAll(scriptResult.variables());
                        applyScriptRequestChanges(requestConfig, scriptResult.request());
                        message = scriptResult.message();
                        logs = scriptResult.logs();
                    }
                    case "TIME_WAITING" -> {
                        int delayMs = normalizeDelayMs(processor.delayMs());
                        sleep(delayMs);
                        message = "Waited " + delayMs + " ms";
                    }
                    case "SQL" -> message = executeSqlProcessor(processor, workspaceId, variables);
                    case "EXTRACT" -> {
                        if (!"POST".equals(stage)) {
                            throw new BadRequestException("Extract processor is only supported in post-processors");
                        }
                        message = applyProcessorExtractors(defaultList(processor.extractors()), requestSnapshot, response, environment, variables, extractionResults);
                    }
                    default -> throw new BadRequestException("Unsupported processor type: " + type);
                }
                processorResults.add(new ApiProcessorResult(
                        stage,
                        type,
                        blankToFallback(processor.name(), defaultProcessorName(type, stage)),
                        true,
                        System.currentTimeMillis() - started,
                        message,
                        logs,
                        diffVariables(beforeVariables, variables)
                ));
            } catch (RuntimeException exception) {
                processorResults.add(new ApiProcessorResult(
                        stage,
                        Optional.ofNullable(processor.processorType()).orElse(""),
                        blankToFallback(processor.name(), defaultProcessorName(processor.processorType(), stage)),
                        false,
                        System.currentTimeMillis() - started,
                        blankToFallback(exception.getMessage(), "Processor failed"),
                        List.of(),
                        diffVariables(beforeVariables, variables)
                ));
                throw new BadRequestException(blankToFallback(processor.name(), defaultProcessorName(processor.processorType(), stage))
                        + " failed: " + blankToFallback(exception.getMessage(), "Processor failed"));
            }
        }
    }

    ApiAutomationScriptRunner.ScriptExecutionResult executeScriptProcessor(
            ApiProcessorInput processor,
            ApiExecutionRuntimeModels.MutableRequestConfig requestConfig,
            ApiResponseSnapshot response,
            Map<String, String> variables
    ) {
        String script = Optional.ofNullable(processor.script()).orElse("");
        if (script.isBlank()) {
            throw new BadRequestException("Script processor content cannot be blank");
        }
        return scriptRunner.execute(script, new LinkedHashMap<>(variables), requestConfig.toScriptMap(), toResponseContext(response));
    }

    private Map<String, Object> toResponseContext(ApiResponseSnapshot response) {
        if (response == null) {
            return Map.of();
        }
        LinkedHashMap<String, Object> context = new LinkedHashMap<>();
        context.put("statusCode", response.statusCode());
        context.put("headers", response.headers() == null ? Map.of() : response.headers());
        context.put("body", response.body());
        context.put("contentType", response.contentType());
        return context;
    }

    private void applyScriptRequestChanges(ApiExecutionRuntimeModels.MutableRequestConfig requestConfig, Map<String, Object> requestValues) {
        if (requestValues == null || requestValues.isEmpty()) {
            return;
        }
        requestConfig.applyScriptMap(requestValues);
    }

    private void sleep(int delayMs) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Wait processor was interrupted");
        }
    }

    String executeSqlProcessor(ApiProcessorInput processor, Long workspaceId, Map<String, String> variables) {
        if (processor.dataSourceId() == null) {
            throw new BadRequestException("SQL processor requires a database connection");
        }
        String sql = variableResolver.replaceVariables(Optional.ofNullable(processor.script()).orElse(""), variables);
        if (sql.isBlank()) {
            throw new BadRequestException("SQL processor content cannot be blank");
        }
        DbConnectionEntity connection = requireActiveDbConnection(processor.dataSourceId(), workspaceId);
        String driverClassName = connection.getDriverClassName();
        if (driverClassName != null && !driverClassName.isBlank()) {
            try {
                Class.forName(driverClassName.trim());
            } catch (ClassNotFoundException exception) {
                throw new BadRequestException("JDBC driver is not available: " + driverClassName);
            }
        }
        String password = dbConnectionCrypto.decrypt(connection.getPasswordEncrypted());
        try (Connection jdbcConnection = DriverManager.getConnection(
                connection.getJdbcUrl(),
                connection.getUsername() == null ? "" : connection.getUsername(),
                password
        );
             Statement statement = jdbcConnection.createStatement()) {
            int timeoutSeconds = Math.max(1, (processor.queryTimeout() == null ? 30000 : processor.queryTimeout()) / 1000);
            statement.setQueryTimeout(timeoutSeconds);
            boolean hasResultSet = statement.execute(sql);
            if (hasResultSet) {
                try (ResultSet resultSet = statement.getResultSet()) {
                    List<Map<String, Object>> rows = readSqlRows(resultSet);
                    writeSqlVariables(processor, rows, variables);
                    return "SQL returned " + rows.size() + " row(s)";
                }
            }
            int affectedRows = statement.getUpdateCount();
            if (processor.resultVariable() != null && !processor.resultVariable().isBlank()) {
                variables.put(processor.resultVariable(), String.valueOf(affectedRows));
            }
            return "SQL affected " + affectedRows + " row(s)";
        } catch (SQLException exception) {
            throw new BadRequestException("SQL execution failed: " + exception.getMessage());
        }
    }

    private DbConnectionEntity requireActiveDbConnection(Long id, Long workspaceId) {
        DbConnectionEntity entity = dbConnectionMapper.selectById(id);
        if (entity == null) {
            throw new BadRequestException("Database connection not found");
        }
        if (!entity.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Database connection must belong to the same workspace");
        }
        if (!Integer.valueOf(1).equals(entity.getStatus())) {
            throw new BadRequestException("Database connection is disabled");
        }
        return entity;
    }

    private List<Map<String, Object>> readSqlRows(ResultSet resultSet) throws SQLException {
        ResultSetMetaData metaData = resultSet.getMetaData();
        int columnCount = metaData.getColumnCount();
        List<Map<String, Object>> rows = new ArrayList<>();
        while (resultSet.next()) {
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            for (int index = 1; index <= columnCount; index++) {
                String label = metaData.getColumnLabel(index);
                if (label == null || label.isBlank()) {
                    label = metaData.getColumnName(index);
                }
                row.put(label, resultSet.getObject(index));
            }
            rows.add(row);
        }
        return rows;
    }

    private void writeSqlVariables(ApiProcessorInput processor, List<Map<String, Object>> rows, Map<String, String> variables) {
        List<String> variableNames = splitCsv(processor.variableNames());
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Map<String, Object> row = rows.get(rowIndex);
            for (String variableName : variableNames) {
                Object value = findSqlColumnValue(row, variableName);
                variables.put(variableName + "_" + (rowIndex + 1), stringifySqlValue(value));
            }
        }
        if (!rows.isEmpty()) {
            Map<String, Object> firstRow = rows.get(0);
            for (ApiKeyValueInput param : defaultList(processor.extractParams())) {
                if (param == null || param.key() == null || param.key().isBlank()) {
                    continue;
                }
                String columnName = Optional.ofNullable(param.value()).orElse("").trim();
                variables.put(param.key().trim(), stringifySqlValue(findSqlColumnValue(firstRow, columnName)));
            }
        }
        if (processor.resultVariable() != null && !processor.resultVariable().isBlank()) {
            variables.put(processor.resultVariable(), ApiAutomationJsonSupport.toJson(rows, "Failed to serialize SQL result"));
        }
    }

    private Object findSqlColumnValue(Map<String, Object> row, String columnName) {
        if (row == null || columnName == null || columnName.isBlank()) {
            return null;
        }
        if (row.containsKey(columnName)) {
            return row.get(columnName);
        }
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(columnName)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String stringifySqlValue(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return String.valueOf(value);
        }
        return ApiAutomationJsonSupport.toJson(value, "Failed to serialize SQL value");
    }

    private List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String item : value.split(",")) {
            String normalized = item.trim();
            if (!normalized.isBlank()) {
                result.add(normalized);
            }
        }
        return result;
    }

    String applyProcessorExtractors(
            List<ApiProcessorExtractItemInput> extractors,
            ApiRequestSnapshot request,
            ApiResponseSnapshot response,
            ApiExecutionRuntimeModels.ResolvedEnvironment environment,
            Map<String, String> variables,
            List<ApiExtractionResult> extractionResults
    ) {
        if (extractors.isEmpty()) {
            throw new BadRequestException("Extract processor requires at least one extractor");
        }
        int successCount = 0;
        for (ApiProcessorExtractItemInput extractor : extractors) {
            if (Boolean.FALSE.equals(extractor.enabled())) {
                continue;
            }
            String variableName = blankToFallback(firstNonBlank(extractor.variableName(), extractor.name()), "");
            try {
                if (variableName.isBlank()) {
                    throw new BadRequestException("Extractor variable name cannot be blank");
                }
                String value = extractProcessorValue(extractor, request, response);
                variables.put(variableName, value);
                if ("ENVIRONMENT".equalsIgnoreCase(extractor.variableType())) {
                    persistEnvironmentVariable(environment, variableName, value);
                }
                extractionResults.add(new ApiExtractionResult(variableName, true, value, "Extracted"));
                successCount++;
            } catch (Exception exception) {
                extractionResults.add(new ApiExtractionResult(variableName, false, null, exception.getMessage()));
                throw new BadRequestException(exception.getMessage());
            }
        }
        return "Extracted " + successCount + " variable(s)";
    }

    private String extractProcessorValue(ApiProcessorExtractItemInput extractor, ApiRequestSnapshot request, ApiResponseSnapshot response) throws Exception {
        String scope = blankToFallback(firstNonBlank(extractor.extractScope(), legacyExtractScope(extractor.sourceType())), "BODY").toUpperCase(Locale.ROOT);
        String type = blankToFallback(firstNonBlank(extractor.extractType(), legacyExtractType(extractor.sourceType())), "JSON_PATH").toUpperCase(Locale.ROOT);
        String expression = Optional.ofNullable(extractor.expression()).orElse("");
        String source = resolveExtractSource(scope, expression, request, response);
        String legacySourceType = Optional.ofNullable(extractor.sourceType()).orElse("").trim().toUpperCase(Locale.ROOT);
        if ("HEADER".equals(legacySourceType) || "STATUS_CODE".equals(legacySourceType)) {
            return source;
        }
        List<String> matches = switch (type) {
            case "JSON_PATH" -> extractByJsonPath(source, expression);
            case "X_PATH" -> extractByXPath(source, expression, extractor.responseFormat());
            case "REGEX" -> extractByRegex(source, expression, extractor.expressionMatchingRule());
            default -> throw new BadRequestException("Unsupported extract type: " + type);
        };
        if (matches.isEmpty()) {
            throw new BadRequestException("No match found for extractor expression");
        }
        String rule = blankToFallback(extractor.resultMatchingRule(), "RANDOM").toUpperCase(Locale.ROOT);
        if ("ALL".equals(rule)) {
            return ApiAutomationJsonSupport.toJson(matches, "Failed to serialize extractor matches");
        }
        if ("SPECIFIC".equals(rule)) {
            int index = Math.max(1, extractor.resultMatchingRuleNum() == null ? 1 : extractor.resultMatchingRuleNum()) - 1;
            if (index >= matches.size()) {
                throw new BadRequestException("Specific match index is out of range");
            }
            return matches.get(index);
        }
        return matches.get(ThreadLocalRandom.current().nextInt(matches.size()));
    }

    private String resolveExtractSource(String scope, String expression, ApiRequestSnapshot request, ApiResponseSnapshot response) {
        return switch (scope) {
            case "BODY" -> response == null || response.body() == null ? "" : response.body();
            case "UNESCAPED_BODY" -> HtmlUtils.htmlUnescape(response == null || response.body() == null ? "" : response.body());
            case "BODY_AS_DOCUMENT" -> response == null || response.body() == null ? "" : response.body();
            case "URL" -> request == null || request.url() == null ? "" : request.url();
            case "REQUEST_HEADERS" -> resolveHeaderSource(request == null ? null : request.headers(), expression);
            case "RESPONSE_HEADERS" -> resolveHeaderSource(response == null ? null : response.headers(), expression);
            case "RESPONSE_CODE" -> response == null || response.statusCode() == null ? "" : String.valueOf(response.statusCode());
            case "RESPONSE_MESSAGE" -> responseMessage(response == null ? null : response.statusCode());
            default -> throw new BadRequestException("Unsupported extract scope: " + scope);
        };
    }

    private String resolveHeaderSource(Map<String, String> headers, String expression) {
        if (headers == null || headers.isEmpty()) {
            return "";
        }
        if (expression != null && !expression.isBlank()) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                if (entry.getKey().equalsIgnoreCase(expression.trim())) {
                    return Optional.ofNullable(entry.getValue()).orElse("");
                }
            }
        }
        return ApiAutomationJsonSupport.toJson(headers, "Failed to serialize headers");
    }

    private List<String> extractByJsonPath(String source, String expression) {
        if (source == null || source.isBlank()) {
            return List.of();
        }
        Object value = JsonPath.read(source, expression == null || expression.isBlank() ? "$" : expression);
        return flattenExtractedValue(value);
    }

    private List<String> extractByXPath(String source, String expression, String responseFormat) throws Exception {
        if (source == null || source.isBlank() || expression == null || expression.isBlank()) {
            return List.of();
        }
        Document document;
        if ("HTML".equalsIgnoreCase(responseFormat)) {
            document = new W3CDom().fromJsoup(Jsoup.parse(source));
        } else {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(source)));
        }
        Object nodeSet = XPathFactory.newInstance().newXPath().evaluate(expression, document, XPathConstants.NODESET);
        if (nodeSet instanceof NodeList nodes && nodes.getLength() > 0) {
            List<String> values = new ArrayList<>();
            for (int index = 0; index < nodes.getLength(); index++) {
                values.add(Optional.ofNullable(nodes.item(index).getTextContent()).orElse(""));
            }
            return values;
        }
        Object result = XPathFactory.newInstance().newXPath().evaluate(expression, document, XPathConstants.STRING);
        return result == null || String.valueOf(result).isBlank() ? List.of() : List.of(String.valueOf(result));
    }

    private List<String> extractByRegex(String source, String expression, String matchingRule) {
        if (source == null || expression == null || expression.isBlank()) {
            return List.of();
        }
        List<String> matches = new ArrayList<>();
        Matcher matcher = Pattern.compile(expression, Pattern.DOTALL).matcher(source);
        boolean useGroup = "GROUP".equalsIgnoreCase(matchingRule);
        while (matcher.find()) {
            if (useGroup && matcher.groupCount() > 0) {
                matches.add(matcher.group(1));
            } else {
                matches.add(matcher.group());
            }
        }
        return matches;
    }

    private List<String> flattenExtractedValue(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::stringifyExtractedValue).toList();
        }
        return List.of(stringifyExtractedValue(value));
    }

    private String stringifyExtractedValue(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return String.valueOf(value);
        }
        return ApiAutomationJsonSupport.toJson(value, "Failed to serialize extracted value");
    }

    private void persistEnvironmentVariable(ApiExecutionRuntimeModels.ResolvedEnvironment environment, String name, String value) {
        if (environment == null || environment.environmentId() == null) {
            throw new BadRequestException("Environment variable extraction requires a selected environment");
        }
        EnvConfigEntity entity = requireEnvironment(environment.environmentId());
        ApiExecutionRuntimeModels.EnvironmentConfigPayload config = ApiAutomationJsonSupport.read(entity.getConfigJson(),
                ApiExecutionRuntimeModels.EnvironmentConfigPayload.class,
                new ApiExecutionRuntimeModels.EnvironmentConfigPayload(List.of(), emptyAuthConfig(), 10000, List.of(), null, null, null, null, null, List.of()));
        List<ApiVariableItem> nextVariables = new ArrayList<>();
        boolean updated = false;
        for (ApiVariableItem item : defaultList(config.variables())) {
            if (item.name() != null && item.name().equals(name)) {
                nextVariables.add(new ApiVariableItem(name, value, item.sensitive()));
                updated = true;
            } else {
                nextVariables.add(item);
            }
        }
        if (!updated) {
            nextVariables.add(new ApiVariableItem(name, value, false));
        }
        entity.setConfigJson(ApiAutomationJsonSupport.toJson(new ApiExecutionRuntimeModels.EnvironmentConfigPayload(
                defaultList(config.headers()),
                normalizeAuth(config.authConfig()),
                config.timeoutMs() == null ? 10000 : config.timeoutMs(),
                nextVariables,
                config.defaultVariableSetId(),
                config.mockEnabled(),
                config.mockApplicationId(),
                config.mockReleaseId(),
                config.defaultServiceKey(),
                config.services()
        ), "Failed to serialize environment config"));
        entity.setUpdatedAt(LocalDateTime.now());
        envConfigMapper.updateById(entity);
    }

    private EnvConfigEntity requireEnvironment(Long id) {
        EnvConfigEntity entity = envConfigMapper.selectById(id);
        if (entity == null || !ApiEnvironmentTypeSupport.isApiUsable(entity.getEnvType())) {
            throw new NotFoundException("API environment not found");
        }
        return entity;
    }

    private String responseMessage(Integer statusCode) {
        if (statusCode == null) {
            return "";
        }
        if (statusCode >= 200 && statusCode < 300) {
            return "OK";
        }
        if (statusCode >= 300 && statusCode < 400) {
            return "Redirect";
        }
        if (statusCode >= 400 && statusCode < 500) {
            return "Client Error";
        }
        if (statusCode >= 500) {
            return "Server Error";
        }
        return "";
    }

    private String legacyExtractType(String sourceType) {
        String normalized = Optional.ofNullable(sourceType).orElse("").trim().toUpperCase();
        return switch (normalized) {
            case "BODY_JSONPATH" -> "JSON_PATH";
            case "HEADER", "STATUS_CODE" -> "REGEX";
            default -> "JSON_PATH";
        };
    }

    private String legacyExtractScope(String sourceType) {
        String normalized = Optional.ofNullable(sourceType).orElse("").trim().toUpperCase();
        return switch (normalized) {
            case "HEADER" -> "RESPONSE_HEADERS";
            case "STATUS_CODE" -> "RESPONSE_CODE";
            default -> "BODY";
        };
    }

    private String defaultProcessorName(String type, String stage) {
        String normalized = Optional.ofNullable(type).orElse("").trim().toUpperCase();
        return switch (normalized) {
            case "SCRIPT" -> "PRE".equals(stage) ? "Pre Script" : "Post Script";
            case "SQL" -> "SQL";
            case "TIME_WAITING" -> "Wait";
            case "EXTRACT" -> "Extract";
            default -> "Processor";
        };
    }

    private Map<String, String> diffVariables(Map<String, String> before, Map<String, String> after) {
        LinkedHashMap<String, String> changed = new LinkedHashMap<>();
        after.forEach((key, value) -> {
            String beforeValue = before.get(key);
            if (!before.containsKey(key) || !Optional.ofNullable(beforeValue).orElse("").equals(Optional.ofNullable(value).orElse(""))) {
                changed.put(key, value);
            }
        });
        return changed;
    }

    private int normalizeDelayMs(Integer delayMs) {
        if (delayMs == null) {
            return 1000;
        }
        return Math.max(1, Math.min(600000, delayMs));
    }
}
