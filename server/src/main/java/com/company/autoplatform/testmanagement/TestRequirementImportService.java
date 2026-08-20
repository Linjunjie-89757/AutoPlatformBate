package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BusinessException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TestRequirementImportService {

    private static final int MAX_IMPORT_ROWS = 500;
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final String TEMPLATE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final List<String> HEADERS = List.of(
            "需求标题*", "优先级*", "负责人*", "版本", "外部需求标识", "需求描述");

    private final TestRequirementService requirementService;
    private final TestRequirementMapper requirementMapper;
    private final TestVersionMapper versionMapper;
    private final UserMapper userMapper;
    private final TestManagementWorkspaceSupport workspaceSupport;

    public TestRequirementImportService(
            TestRequirementService requirementService,
            TestRequirementMapper requirementMapper,
            TestVersionMapper versionMapper,
            UserMapper userMapper,
            TestManagementWorkspaceSupport workspaceSupport
    ) {
        this.requirementService = requirementService;
        this.requirementMapper = requirementMapper;
        this.versionMapper = versionMapper;
        this.userMapper = userMapper;
        this.workspaceSupport = workspaceSupport;
    }

    public TestRequirementImportTemplate buildTemplate() {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet dataSheet = workbook.createSheet("需求导入");
            Row headerRow = dataSheet.createRow(0);
            CellStyle headerStyle = createHeaderStyle(workbook);
            for (int index = 0; index < HEADERS.size(); index++) {
                Cell cell = headerRow.createCell(index);
                cell.setCellValue(HEADERS.get(index));
                cell.setCellStyle(headerStyle);
            }
            dataSheet.createFreezePane(0, 1);
            dataSheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));
            int[] widths = {36, 12, 20, 24, 28, 56};
            for (int index = 0; index < widths.length; index++) {
                dataSheet.setColumnWidth(index, widths[index] * 256);
            }
            addPriorityValidation(dataSheet);

            Sheet instructionSheet = workbook.createSheet("填写说明");
            String[][] instructions = {
                    {"字段", "填写规则"},
                    {"需求标题", "必填，最多 255 个字符"},
                    {"优先级", "必填，仅支持 P0、P1、P2、P3"},
                    {"负责人", "必填，可填写用户 ID、用户名、邮箱或唯一显示名"},
                    {"版本", "选填，可填写版本 ID 或版本名称；留空使用上传时选择的默认版本"},
                    {"外部需求标识", "选填，最多 255 个字符；重复标识默认跳过"},
                    {"需求描述", "选填，最多 10000 个字符"},
                    {"重复判断", "同版本同标题，或外部需求标识相同，默认视为重复"}
            };
            for (int rowIndex = 0; rowIndex < instructions.length; rowIndex++) {
                Row row = instructionSheet.createRow(rowIndex);
                for (int columnIndex = 0; columnIndex < instructions[rowIndex].length; columnIndex++) {
                    Cell cell = row.createCell(columnIndex);
                    cell.setCellValue(instructions[rowIndex][columnIndex]);
                    if (rowIndex == 0) cell.setCellStyle(headerStyle);
                }
            }
            instructionSheet.setColumnWidth(0, 20 * 256);
            instructionSheet.setColumnWidth(1, 76 * 256);

            workbook.write(output);
            return new TestRequirementImportTemplate("需求导入模板.xlsx", TEMPLATE_CONTENT_TYPE, output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("生成需求导入模板失败", exception);
        }
    }

    public TestRequirementImportResult importRequirements(
            String workspaceCode,
            Long defaultVersionId,
            String duplicateStrategy,
            MultipartFile file
    ) {
        validateFile(file);
        WorkspaceEntity workspace = workspaceSupport.requireWritableWorkspace(workspaceCode);
        String normalizedStrategy = normalizeDuplicateStrategy(duplicateStrategy);
        ImportContext context = buildContext(workspace, defaultVersionId);
        ParsedWorkbook parsed = parseWorkbook(file);
        List<TestRequirementImportIssue> issues = new ArrayList<>(parsed.issues());
        Set<String> knownTitleKeys = existingTitleKeys(workspace.getId());
        Set<String> knownSourceRefs = existingSourceRefs(workspace.getId());
        Set<String> acceptedTitleKeys = new HashSet<>();
        Set<String> acceptedSourceRefs = new HashSet<>();
        List<Long> importedIds = new ArrayList<>();
        int skippedCount = 0;

        for (ImportRow row : parsed.rows()) {
            ResolvedImportRow resolved;
            try {
                resolved = resolveRow(row, context);
            } catch (IllegalArgumentException exception) {
                issues.add(new TestRequirementImportIssue(row.rowNumber(), fallbackTitle(row.title()), "FAILED", exception.getMessage()));
                continue;
            }

            String titleKey = resolved.versionId() + "|" + normalizeKey(resolved.title());
            String sourceRefKey = normalizeKey(resolved.sourceRef());
            boolean duplicate = knownTitleKeys.contains(titleKey) || acceptedTitleKeys.contains(titleKey)
                    || (!sourceRefKey.isEmpty() && (knownSourceRefs.contains(sourceRefKey) || acceptedSourceRefs.contains(sourceRefKey)));
            if (duplicate && "SKIP".equals(normalizedStrategy)) {
                skippedCount++;
                issues.add(new TestRequirementImportIssue(row.rowNumber(), resolved.title(), "SKIPPED", "已存在同版本同标题需求或相同外部需求标识"));
                continue;
            }
            acceptedTitleKeys.add(titleKey);
            if (!sourceRefKey.isEmpty()) acceptedSourceRefs.add(sourceRefKey);

            try {
                TestRequirementResponse created = requirementService.create(workspace.getWorkspaceCode(), new CreateTestRequirementRequest(
                        resolved.versionId(), resolved.title(), resolved.priority(), RequirementSourceType.EXCEL,
                        resolved.sourceRef(), resolved.assigneeId(), resolved.description()));
                importedIds.add(created.id());
                knownTitleKeys.add(titleKey);
                if (!sourceRefKey.isEmpty()) knownSourceRefs.add(sourceRefKey);
            } catch (BusinessException exception) {
                issues.add(new TestRequirementImportIssue(row.rowNumber(), resolved.title(), "FAILED", exception.getMessage()));
            }
        }

        int failedCount = (int) issues.stream().filter(issue -> "FAILED".equals(issue.status())).count();
        return new TestRequirementImportResult(
                parsed.totalRows(), importedIds.size(), skippedCount, failedCount,
                List.copyOf(importedIds), List.copyOf(issues));
    }

    private ImportContext buildContext(WorkspaceEntity workspace, Long defaultVersionId) {
        List<TestVersionEntity> versions = versionMapper.selectList(new LambdaQueryWrapper<TestVersionEntity>()
                .eq(TestVersionEntity::getWorkspaceId, workspace.getId()));
        Map<Long, TestVersionEntity> versionsById = versions.stream()
                .collect(Collectors.toMap(TestVersionEntity::getId, Function.identity()));
        TestVersionEntity defaultVersion = versionsById.get(defaultVersionId);
        if (!isEditableVersion(defaultVersion)) {
            throw TestManagementException.validation("默认所属版本不存在或不可编辑");
        }
        Map<String, TestVersionEntity> versionsByName = versions.stream()
                .collect(Collectors.toMap(item -> normalizeKey(item.getName()), Function.identity(), (first, second) -> first));

        List<UserEntity> activeUsers = userMapper.selectList(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getStatus, 1));
        Map<String, UserEntity> usersByIdentifier = new HashMap<>();
        Map<String, List<UserEntity>> usersByDisplayName = activeUsers.stream()
                .filter(user -> user.getDisplayName() != null && !user.getDisplayName().isBlank())
                .collect(Collectors.groupingBy(user -> normalizeKey(user.getDisplayName())));
        for (UserEntity user : activeUsers) {
            usersByIdentifier.put(String.valueOf(user.getId()), user);
            putIdentifier(usersByIdentifier, user.getUsername(), user);
            putIdentifier(usersByIdentifier, user.getEmail(), user);
        }
        usersByDisplayName.forEach((name, matches) -> {
            if (matches.size() == 1) usersByIdentifier.putIfAbsent(name, matches.getFirst());
        });
        return new ImportContext(defaultVersion, versionsById, versionsByName, usersByIdentifier, usersByDisplayName);
    }

    private ParsedWorkbook parseWorkbook(MultipartFile file) {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) throw TestManagementException.validation("Excel 中没有可读取的工作表");
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) throw TestManagementException.validation("Excel 表头不能为空");
            DataFormatter formatter = new DataFormatter(Locale.CHINA);
            Map<String, Integer> columns = readColumns(headerRow, formatter);
            Integer titleColumn = requiredColumn(columns, "需求标题", "标题", "title");
            Integer priorityColumn = requiredColumn(columns, "优先级", "priority");
            Integer ownerColumn = requiredColumn(columns, "负责人", "owner", "assignee");
            List<ImportRow> rows = new ArrayList<>();
            List<TestRequirementImportIssue> issues = new ArrayList<>();
            int totalRows = 0;
            for (int rowIndex = headerRow.getRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isBlankRow(row, formatter)) continue;
                totalRows++;
                if (totalRows > MAX_IMPORT_ROWS) throw TestManagementException.validation("单次最多导入 " + MAX_IMPORT_ROWS + " 条需求");
                int displayRow = rowIndex + 1;
                String title = cellValue(row, titleColumn, formatter);
                try {
                    rows.add(new ImportRow(
                            displayRow,
                            requireLength(title, "需求标题", 255, true),
                            normalizePriority(cellValue(row, priorityColumn, formatter)),
                            requireLength(cellValue(row, ownerColumn, formatter), "负责人", 255, true),
                            cellValue(row, findColumn(columns, "版本", "version"), formatter),
                            requireLength(cellValue(row, findColumn(columns, "外部需求标识", "外部需求链接", "sourceRef"), formatter), "外部需求标识", 255, false),
                            requireLength(cellValue(row, findColumn(columns, "需求描述", "描述", "description"), formatter), "需求描述", 10000, false)));
                } catch (IllegalArgumentException exception) {
                    issues.add(new TestRequirementImportIssue(displayRow, fallbackTitle(title), "FAILED", exception.getMessage()));
                }
            }
            if (totalRows == 0) throw TestManagementException.validation("Excel 中没有可导入的需求数据");
            return new ParsedWorkbook(totalRows, rows, issues);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw TestManagementException.validation("无法读取 Excel 文件，请使用平台提供的模板");
        }
    }

    private ResolvedImportRow resolveRow(ImportRow row, ImportContext context) {
        TestVersionEntity version = context.defaultVersion();
        if (row.version() != null && !row.version().isBlank()) {
            String normalized = row.version().trim();
            if (normalized.matches("\\d+")) version = context.versionsById().get(Long.parseLong(normalized));
            else version = context.versionsByName().get(normalizeKey(normalized));
            if (!isEditableVersion(version)) throw new IllegalArgumentException("版本不存在或不可编辑: " + normalized);
        }
        String ownerKey = normalizeKey(row.owner());
        List<UserEntity> displayNameMatches = context.usersByDisplayName().getOrDefault(ownerKey, List.of());
        if (displayNameMatches.size() > 1) throw new IllegalArgumentException("负责人显示名不唯一，请改用用户 ID、用户名或邮箱");
        UserEntity owner = context.usersByIdentifier().get(ownerKey);
        if (owner == null) throw new IllegalArgumentException("负责人不存在或已停用: " + row.owner());
        return new ResolvedImportRow(
                row.rowNumber(), row.title(), row.priority(), owner.getId(), version.getId(),
                blankToNull(row.sourceRef()), blankToNull(row.description()));
    }

    private Set<String> existingTitleKeys(Long workspaceId) {
        return requirementMapper.selectList(new LambdaQueryWrapper<TestRequirementEntity>()
                        .eq(TestRequirementEntity::getWorkspaceId, workspaceId)
                        .isNull(TestRequirementEntity::getDeletedAt))
                .stream()
                .map(item -> item.getVersionId() + "|" + normalizeKey(item.getTitle()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> existingSourceRefs(Long workspaceId) {
        return requirementMapper.selectList(new LambdaQueryWrapper<TestRequirementEntity>()
                        .select(TestRequirementEntity::getSourceRef)
                        .eq(TestRequirementEntity::getWorkspaceId, workspaceId)
                        .isNull(TestRequirementEntity::getDeletedAt)
                        .isNotNull(TestRequirementEntity::getSourceRef))
                .stream()
                .map(TestRequirementEntity::getSourceRef)
                .filter(Objects::nonNull)
                .map(this::normalizeKey)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw TestManagementException.validation("请选择 Excel 文件");
        if (file.getSize() > MAX_FILE_SIZE) throw TestManagementException.validation("Excel 文件不能超过 10 MB");
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
            throw TestManagementException.validation("仅支持 .xlsx 或 .xls 文件");
        }
    }

    private String normalizeDuplicateStrategy(String value) {
        String normalized = value == null || value.isBlank() ? "SKIP" : value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("SKIP", "ALLOW").contains(normalized)) {
            throw TestManagementException.validation("重复需求处理策略不合法");
        }
        return normalized;
    }

    private Map<String, Integer> readColumns(Row headerRow, DataFormatter formatter) {
        Map<String, Integer> columns = new LinkedHashMap<>();
        for (Cell cell : headerRow) {
            String header = formatter.formatCellValue(cell).trim().replace("*", "");
            if (!header.isEmpty()) columns.put(normalizeKey(header), cell.getColumnIndex());
        }
        return columns;
    }

    private Integer requiredColumn(Map<String, Integer> columns, String... aliases) {
        Integer column = findColumn(columns, aliases);
        if (column == null) throw TestManagementException.validation("Excel 缺少必填表头：" + aliases[0] + "*");
        return column;
    }

    private Integer findColumn(Map<String, Integer> columns, String... aliases) {
        for (String alias : aliases) {
            Integer column = columns.get(normalizeKey(alias));
            if (column != null) return column;
        }
        return null;
    }

    private boolean isBlankRow(Row row, DataFormatter formatter) {
        for (Cell cell : row) if (!formatter.formatCellValue(cell).trim().isEmpty()) return false;
        return true;
    }

    private String cellValue(Row row, Integer columnIndex, DataFormatter formatter) {
        if (columnIndex == null) return "";
        Cell cell = row.getCell(columnIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private String requireLength(String value, String fieldName, int maxLength, boolean required) {
        String normalized = value == null ? "" : value.trim();
        if (required && normalized.isEmpty()) throw new IllegalArgumentException(fieldName + "不能为空");
        if (normalized.length() > maxLength) throw new IllegalArgumentException(fieldName + "不能超过 " + maxLength + " 个字符");
        return normalized;
    }

    private RequirementPriority normalizePriority(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        try {
            return RequirementPriority.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("优先级仅支持 P0、P1、P2 或 P3");
        }
    }

    private boolean isEditableVersion(TestVersionEntity version) {
        return version != null && version.getStatus() != VersionStatus.RELEASED && version.getStatus() != VersionStatus.ARCHIVED;
    }

    private void putIdentifier(Map<String, UserEntity> target, String identifier, UserEntity user) {
        if (identifier != null && !identifier.isBlank()) target.putIfAbsent(normalizeKey(identifier), user);
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String fallbackTitle(String value) {
        return value == null || value.isBlank() ? "-" : value.trim();
    }

    private CellStyle createHeaderStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(new XSSFColor(new byte[]{22, 93, (byte) 255}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(org.apache.poi.ss.usermodel.IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private void addPriorityValidation(Sheet sheet) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(new String[]{"P0", "P1", "P2", "P3"});
        DataValidation validation = helper.createValidation(constraint, new CellRangeAddressList(1, MAX_IMPORT_ROWS, 1, 1));
        validation.setShowErrorBox(true);
        sheet.addValidationData(validation);
    }

    private record ImportContext(
            TestVersionEntity defaultVersion,
            Map<Long, TestVersionEntity> versionsById,
            Map<String, TestVersionEntity> versionsByName,
            Map<String, UserEntity> usersByIdentifier,
            Map<String, List<UserEntity>> usersByDisplayName
    ) {
    }

    private record ImportRow(
            int rowNumber,
            String title,
            RequirementPriority priority,
            String owner,
            String version,
            String sourceRef,
            String description
    ) {
    }

    private record ResolvedImportRow(
            int rowNumber,
            String title,
            RequirementPriority priority,
            Long assigneeId,
            Long versionId,
            String sourceRef,
            String description
    ) {
    }

    private record ParsedWorkbook(
            int totalRows,
            List<ImportRow> rows,
            List<TestRequirementImportIssue> issues
    ) {
    }
}
