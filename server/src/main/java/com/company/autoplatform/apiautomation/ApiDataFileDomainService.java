package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToFallback;
import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

@Service
public class ApiDataFileDomainService {

    private static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    private static final int PREVIEW_LIMIT = 20;

    private final ApiDataFileMapper dataFileMapper;
    private final WorkspaceService workspaceService;
    private final ApiWorkspaceScopeSupport workspaceScopeSupport;

    public ApiDataFileDomainService(
            ApiDataFileMapper dataFileMapper,
            WorkspaceService workspaceService,
            ApiWorkspaceScopeSupport workspaceScopeSupport
    ) {
        this.dataFileMapper = dataFileMapper;
        this.workspaceService = workspaceService;
        this.workspaceScopeSupport = workspaceScopeSupport;
    }

    public PageResponse<ApiDataFileItem> listDataFiles(String workspaceCode, String keyword, Integer pageNo, Integer pageSize) {
        LambdaQueryWrapper<ApiDataFileEntity> query = new LambdaQueryWrapper<>();
        workspaceScopeSupport.applyWorkspaceScope(query, ApiDataFileEntity::getWorkspaceId, workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper.like(ApiDataFileEntity::getFileName, trimmedKeyword)
                    .or()
                    .like(ApiDataFileEntity::getOriginalFileName, trimmedKeyword));
        }
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : pageSize;
        Page<ApiDataFileEntity> page = dataFileMapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByDesc(ApiDataFileEntity::getUpdatedAt));
        List<ApiDataFileItem> items = page.getRecords().stream()
                .map(this::toItem)
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public ApiDataFileDetail getDataFile(Long id, String workspaceCode) {
        ApiDataFileEntity entity = requireDataFile(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the data file");
        return toDetail(entity);
    }

    ApiDataFileEntity requireDataFileInWorkspace(Long id, Long workspaceId) {
        ApiDataFileEntity entity = requireDataFile(id);
        if (!entity.getWorkspaceId().equals(workspaceId)) {
            throw new BadRequestException("Data file must belong to the same workspace");
        }
        return entity;
    }

    public ApiDataFileDetail uploadDataFile(
            String headerWorkspaceCode,
            String bodyWorkspaceCode,
            MultipartFile file,
            String fileName,
            String caseDescColumn,
            Boolean ignoreFirstLine
    ) {
        if (WorkspaceScope.isAll(WorkspaceScope.normalize(headerWorkspaceCode)) && blankToNull(bodyWorkspaceCode) == null) {
            throw new BadRequestException("Please switch to a concrete workspace before uploading data file");
        }
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, bodyWorkspaceCode));
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Data file cannot be empty");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("Data file cannot exceed 5MB in V1");
        }
        String originalName = blankToFallback(file.getOriginalFilename(), "data.csv");
        ensureCsvFile(originalName);
        String content = readUtf8(file);
        ParsedCsv parsed = parseCsv(content, ",", Boolean.TRUE.equals(ignoreFirstLine), blankToNull(caseDescColumn));
        ApiDataFileEntity entity = new ApiDataFileEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setFileName(blankToFallback(fileName, originalName).trim());
        entity.setOriginalFileName(originalName);
        entity.setFileType("CSV");
        entity.setEncoding(StandardCharsets.UTF_8.name());
        entity.setDelimiterChar(",");
        entity.setIgnoreFirstLine(Boolean.TRUE.equals(ignoreFirstLine));
        entity.setCaseDescColumn(parsed.caseDescColumn());
        entity.setRowCount(parsed.rows().size());
        entity.setColumnJson(ApiAutomationJsonSupport.toJson(parsed.columns(), "Failed to serialize data file columns"));
        entity.setContentText(content);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        dataFileMapper.insert(entity);
        return toDetail(entity);
    }

    ApiDataFileParsedContent parseCsvUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("CSV data file cannot be empty");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("CSV data file cannot exceed 5MB in V1");
        }
        String originalName = blankToFallback(file.getOriginalFilename(), "data.csv");
        ensureCsvFile(originalName);
        ParsedCsv parsed = parseCsv(readUtf8(file), ",", false, null);
        return new ApiDataFileParsedContent(originalName, parsed.columns(), toPreviewRows(parsed));
    }

    public ApiDataFileDetail updateDataFile(Long id, String headerWorkspaceCode, ApiDataFileUpdateRequest request) {
        ApiDataFileEntity entity = requireDataFile(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "Current workspace cannot edit the data file");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Cannot move a data file to another workspace");
        }
        ParsedCsv parsed = parseCsv(entity.getContentText(), entity.getDelimiterChar(), Boolean.TRUE.equals(request.ignoreFirstLine()), blankToNull(request.caseDescColumn()));
        entity.setFileName(request.fileName().trim());
        entity.setIgnoreFirstLine(Boolean.TRUE.equals(request.ignoreFirstLine()));
        entity.setCaseDescColumn(parsed.caseDescColumn());
        entity.setRowCount(parsed.rows().size());
        entity.setColumnJson(ApiAutomationJsonSupport.toJson(parsed.columns(), "Failed to serialize data file columns"));
        entity.setUpdatedAt(LocalDateTime.now());
        dataFileMapper.updateById(entity);
        return toDetail(entity);
    }

    public void deleteDataFile(Long id, String workspaceCode) {
        ApiDataFileEntity entity = requireDataFile(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot delete the data file");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        dataFileMapper.deleteById(id);
    }

    public ApiDataFilePreview previewDataFile(Long id, String workspaceCode) {
        ApiDataFileEntity entity = requireDataFile(id);
        workspaceScopeSupport.validateReadable(entity.getWorkspaceId(), workspaceCode, "Current workspace cannot access the data file");
        ParsedCsv parsed = parseCsv(entity.getContentText(), entity.getDelimiterChar(), Boolean.TRUE.equals(entity.getIgnoreFirstLine()), entity.getCaseDescColumn());
        return new ApiDataFilePreview(
                entity.getId(),
                parsed.columns(),
                toPreviewRows(parsed).stream().limit(PREVIEW_LIMIT).toList(),
                parsed.rows().size()
        );
    }

    List<ApiDataFileRuntimeRow> readDataRows(Long id, Long workspaceId) {
        ApiDataFileEntity entity = requireDataFileInWorkspace(id, workspaceId);
        ParsedCsv parsed = parseCsv(entity.getContentText(), entity.getDelimiterChar(), Boolean.TRUE.equals(entity.getIgnoreFirstLine()), entity.getCaseDescColumn());
        return parsed.rows().stream()
                .map(row -> new ApiDataFileRuntimeRow(entity.getId(), entity.getFileName(), row.rowIndex(), row.caseDesc(), row.values()))
                .toList();
    }

    private ApiDataFileEntity requireDataFile(Long id) {
        ApiDataFileEntity entity = id == null ? null : dataFileMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Data file not found");
        }
        return entity;
    }

    private ApiDataFileItem toItem(ApiDataFileEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new ApiDataFileItem(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getFileName(),
                entity.getOriginalFileName(),
                entity.getFileType(),
                entity.getEncoding(),
                entity.getDelimiterChar(),
                entity.getIgnoreFirstLine(),
                entity.getCaseDescColumn(),
                entity.getRowCount(),
                readColumns(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ApiDataFileDetail toDetail(ApiDataFileEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        ParsedCsv parsed = parseCsv(entity.getContentText(), entity.getDelimiterChar(), Boolean.TRUE.equals(entity.getIgnoreFirstLine()), entity.getCaseDescColumn());
        return new ApiDataFileDetail(
                entity.getId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getFileName(),
                entity.getOriginalFileName(),
                entity.getFileType(),
                entity.getEncoding(),
                entity.getDelimiterChar(),
                entity.getIgnoreFirstLine(),
                entity.getCaseDescColumn(),
                entity.getRowCount(),
                parsed.columns(),
                toPreviewRows(parsed).stream().limit(PREVIEW_LIMIT).toList(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<String> readColumns(ApiDataFileEntity entity) {
        return ApiAutomationJsonSupport.readList(
                entity.getColumnJson(),
                new TypeReference<>() {
                },
                List.of()
        );
    }

    private List<ApiDataFileRowPreview> toPreviewRows(ParsedCsv parsed) {
        return parsed.rows().stream()
                .map(row -> new ApiDataFileRowPreview(row.rowIndex(), row.caseDesc(), row.values()))
                .toList();
    }

    private void ensureCsvFile(String originalName) {
        String lowerName = originalName.toLowerCase(Locale.ROOT);
        if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".txt")) {
            throw new BadRequestException("V1 only supports CSV data files");
        }
    }

    private String readUtf8(MultipartFile file) {
        try {
            String content = new String(file.getBytes(), Charset.forName(StandardCharsets.UTF_8.name()));
            if (content.startsWith("\uFEFF")) {
                return content.substring(1);
            }
            return content;
        } catch (IOException exception) {
            throw new BadRequestException("Failed to read data file");
        }
    }

    private ParsedCsv parseCsv(String content, String delimiter, boolean ignoreFirstLine, String requestedCaseDescColumn) {
        List<List<String>> records = parseCsvRecords(content, delimiter);
        if (records.isEmpty()) {
            throw new BadRequestException("CSV data file cannot be empty");
        }
        int headerIndex = ignoreFirstLine && records.size() > 1 ? 1 : 0;
        List<String> columns = sanitizeColumns(records.get(headerIndex));
        if (columns.isEmpty()) {
            throw new BadRequestException("CSV data file must contain header columns");
        }
        String caseDescColumn = resolveCaseDescColumn(columns, requestedCaseDescColumn);
        List<ParsedCsvRow> rows = new ArrayList<>();
        for (int index = headerIndex + 1; index < records.size(); index++) {
            List<String> record = records.get(index);
            if (record.stream().allMatch(value -> value == null || value.isBlank())) {
                continue;
            }
            Map<String, String> values = new LinkedHashMap<>();
            for (int columnIndex = 0; columnIndex < columns.size(); columnIndex++) {
                String value = columnIndex < record.size() ? record.get(columnIndex) : "";
                values.put(columns.get(columnIndex), value);
            }
            rows.add(new ParsedCsvRow(index - headerIndex, values.get(caseDescColumn), values));
        }
        return new ParsedCsv(columns, rows, caseDescColumn);
    }

    private List<List<String>> parseCsvRecords(String content, String delimiter) {
        char delimiterChar = blankToFallback(delimiter, ",").charAt(0);
        List<List<String>> records = new ArrayList<>();
        List<String> currentRecord = new ArrayList<>();
        StringBuilder currentValue = new StringBuilder();
        boolean inQuotes = false;
        for (int index = 0; index < content.length(); index++) {
            char ch = content.charAt(index);
            if (ch == '"') {
                if (inQuotes && index + 1 < content.length() && content.charAt(index + 1) == '"') {
                    currentValue.append('"');
                    index++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (!inQuotes && ch == delimiterChar) {
                currentRecord.add(currentValue.toString());
                currentValue.setLength(0);
                continue;
            }
            if (!inQuotes && (ch == '\n' || ch == '\r')) {
                currentRecord.add(currentValue.toString());
                currentValue.setLength(0);
                records.add(currentRecord);
                currentRecord = new ArrayList<>();
                if (ch == '\r' && index + 1 < content.length() && content.charAt(index + 1) == '\n') {
                    index++;
                }
                continue;
            }
            currentValue.append(ch);
        }
        if (inQuotes) {
            throw new BadRequestException("CSV data file contains an unclosed quote");
        }
        if (!currentRecord.isEmpty() || currentValue.length() > 0) {
            currentRecord.add(currentValue.toString());
            records.add(currentRecord);
        }
        return records;
    }

    private List<String> sanitizeColumns(List<String> rawColumns) {
        List<String> columns = new ArrayList<>();
        for (String rawColumn : rawColumns) {
            String column = blankToNull(rawColumn);
            if (column == null) {
                continue;
            }
            if (columns.contains(column)) {
                throw new BadRequestException("CSV header contains duplicated column: " + column);
            }
            columns.add(column);
        }
        return columns;
    }

    private String resolveCaseDescColumn(List<String> columns, String requestedCaseDescColumn) {
        if (requestedCaseDescColumn != null) {
            if (!columns.contains(requestedCaseDescColumn)) {
                throw new BadRequestException("Case description column does not exist in CSV header");
            }
            return requestedCaseDescColumn;
        }
        return columns.contains("caseDesc") ? "caseDesc" : null;
    }

    record ApiDataFileRuntimeRow(
            Long dataFileId,
            String dataFileName,
            Integer rowIndex,
            String caseDesc,
            Map<String, String> values
    ) {
    }

    record ApiDataFileParsedContent(
            String originalName,
            List<String> columns,
            List<ApiDataFileRowPreview> rows
    ) {
    }

    private record ParsedCsv(
            List<String> columns,
            List<ParsedCsvRow> rows,
            String caseDescColumn
    ) {
    }

    private record ParsedCsvRow(
            Integer rowIndex,
            String caseDesc,
            Map<String, String> values
    ) {
    }
}
