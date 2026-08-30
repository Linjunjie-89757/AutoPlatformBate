package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CaseImportDomainService {
    private static final int MAX_IMPORT_ROWS = 500;
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final String TEMPLATE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final List<String> HEADERS = List.of(
            "用例标题*", "用例类型", "优先级", "前置条件", "测试步骤", "预期结果");

    private final CaseDomainService caseDomainService;
    private final CaseMapper caseMapper;
    private final CaseDirectoryMapper caseDirectoryMapper;
    private final WorkspaceService workspaceService;

    public CaseImportDomainService(
            CaseDomainService caseDomainService,
            CaseMapper caseMapper,
            CaseDirectoryMapper caseDirectoryMapper,
            WorkspaceService workspaceService
    ) {
        this.caseDomainService = caseDomainService;
        this.caseMapper = caseMapper;
        this.caseDirectoryMapper = caseDirectoryMapper;
        this.workspaceService = workspaceService;
    }

    public CaseImportTemplate buildTemplate() {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet dataSheet = workbook.createSheet("用例导入");
            Row headerRow = dataSheet.createRow(0);
            CellStyle headerStyle = createHeaderStyle(workbook);
            for (int index = 0; index < HEADERS.size(); index++) {
                Cell cell = headerRow.createCell(index);
                cell.setCellValue(HEADERS.get(index));
                cell.setCellStyle(headerStyle);
            }
            dataSheet.createFreezePane(0, 1);
            dataSheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));
            int[] widths = {32, 14, 12, 36, 48, 48};
            for (int index = 0; index < widths.length; index++) {
                dataSheet.setColumnWidth(index, widths[index] * 256);
            }
            addListValidation(dataSheet, 1, new String[]{"功能", "回归", "异常"});
            addListValidation(dataSheet, 2, new String[]{"P0", "P1", "P2", "P3"});

            Sheet instructionSheet = workbook.createSheet("填写说明");
            String[][] instructions = {
                    {"字段", "填写规则"},
                    {"用例标题", "必填，最多 255 个字符"},
                    {"用例类型", "功能、回归、异常；留空默认功能"},
                    {"优先级", "P0、P1、P2、P3；留空默认 P1"},
                    {"导入位置", "工作空间和用例路径在上传时选择，不在 Excel 中填写"}
            };
            for (int rowIndex = 0; rowIndex < instructions.length; rowIndex++) {
                Row row = instructionSheet.createRow(rowIndex);
                for (int columnIndex = 0; columnIndex < instructions[rowIndex].length; columnIndex++) {
                    Cell cell = row.createCell(columnIndex);
                    cell.setCellValue(instructions[rowIndex][columnIndex]);
                    if (rowIndex == 0) {
                        cell.setCellStyle(headerStyle);
                    }
                }
            }
            instructionSheet.setColumnWidth(0, 18 * 256);
            instructionSheet.setColumnWidth(1, 64 * 256);

            workbook.write(output);
            return new CaseImportTemplate("用例导入模板.xlsx", TEMPLATE_CONTENT_TYPE, output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("生成用例导入模板失败", exception);
        }
    }

    @Transactional
    public CaseImportResult importCases(
            String headerWorkspaceCode,
            Long directoryId,
            String duplicateStrategy,
            MultipartFile file
    ) {
        validateFile(file);
        String normalizedStrategy = normalizeDuplicateStrategy(duplicateStrategy);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(headerWorkspaceCode);
        if (directoryId != null) {
            CaseDirectoryEntity directory = caseDirectoryMapper.selectById(directoryId);
            if (directory == null) {
                throw new BadRequestException("用例路径不存在");
            }
            if (!workspace.getId().equals(directory.getWorkspaceId())) {
                throw new BadRequestException("目标用例路径不属于当前工作空间");
            }
        }
        ParsedWorkbook parsed = parseWorkbook(file);
        List<CaseImportRowIssue> issues = new ArrayList<>(parsed.issues());
        Set<String> knownTitles = existingTitles(workspace.getId(), directoryId);
        Set<String> acceptedTitles = new HashSet<>();
        List<ImportRow> acceptedRows = new ArrayList<>();
        int skippedCount = 0;

        for (ImportRow row : parsed.rows()) {
            String normalizedTitle = normalizeTitleKey(row.title());
            if ("SKIP".equals(normalizedStrategy)
                    && (knownTitles.contains(normalizedTitle) || !acceptedTitles.add(normalizedTitle))) {
                skippedCount++;
                issues.add(new CaseImportRowIssue(row.rowNumber(), row.title(), "SKIPPED", "当前路径已存在同名用例"));
                continue;
            }
            acceptedRows.add(row);
        }

        for (ImportRow row : acceptedRows) {
            caseDomainService.createCase(headerWorkspaceCode, new CreateCaseRequest(
                    workspace.getWorkspaceCode(),
                    directoryId,
                    row.title(),
                    row.caseType(),
                    row.priority(),
                    "IMPORTED",
                    null,
                    row.precondition(),
                    row.steps(),
                    row.expectedResult()));
        }

        return new CaseImportResult(
                parsed.totalRows(),
                acceptedRows.size(),
                skippedCount,
                parsed.issues().size(),
                List.copyOf(issues));
    }

    private ParsedWorkbook parseWorkbook(MultipartFile file) {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new BadRequestException("Excel 中没有可读取的工作表");
            }
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                throw new BadRequestException("Excel 表头不能为空");
            }
            DataFormatter formatter = new DataFormatter(Locale.CHINA);
            Map<String, Integer> columns = readColumns(headerRow, formatter);
            Integer titleColumn = findColumn(columns, "用例标题", "标题", "title");
            if (titleColumn == null) {
                throw new BadRequestException("Excel 缺少必填表头：用例标题*");
            }

            List<ImportRow> rows = new ArrayList<>();
            List<CaseImportRowIssue> issues = new ArrayList<>();
            int totalRows = 0;
            for (int rowIndex = headerRow.getRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isBlankRow(row, formatter)) {
                    continue;
                }
                totalRows++;
                if (totalRows > MAX_IMPORT_ROWS) {
                    throw new BadRequestException("单次最多导入 " + MAX_IMPORT_ROWS + " 条用例");
                }
                int displayRow = rowIndex + 1;
                String title = cellValue(row, titleColumn, formatter);
                try {
                    rows.add(new ImportRow(
                            displayRow,
                            requireTitle(title),
                            normalizeCaseType(cellValue(row, findColumn(columns, "用例类型", "类型", "caseType"), formatter)),
                            normalizePriority(cellValue(row, findColumn(columns, "优先级", "priority"), formatter)),
                            cellValue(row, findColumn(columns, "前置条件", "precondition"), formatter),
                            cellValue(row, findColumn(columns, "测试步骤", "步骤", "steps"), formatter),
                            cellValue(row, findColumn(columns, "预期结果", "expectedResult"), formatter)));
                } catch (IllegalArgumentException exception) {
                    issues.add(new CaseImportRowIssue(displayRow, blankToFallback(title, "-"), "FAILED", exception.getMessage()));
                }
            }
            if (totalRows == 0) {
                throw new BadRequestException("Excel 中没有可导入的用例数据");
            }
            return new ParsedWorkbook(totalRows, rows, issues);
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BadRequestException("无法读取 Excel 文件，请使用平台提供的模板");
        }
    }

    private Set<String> existingTitles(Long workspaceId, Long directoryId) {
        LambdaQueryWrapper<CaseEntity> query = new LambdaQueryWrapper<CaseEntity>()
                .select(CaseEntity::getTitle)
                .eq(CaseEntity::getWorkspaceId, workspaceId);
        if (directoryId == null) {
            query.isNull(CaseEntity::getCaseDirectoryId);
        } else {
            query.eq(CaseEntity::getCaseDirectoryId, directoryId);
        }
        Set<String> titles = new HashSet<>();
        for (CaseEntity entity : caseMapper.selectList(query)) {
            titles.add(normalizeTitleKey(entity.getTitle()));
        }
        return titles;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("请选择 Excel 文件");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Excel 文件不能超过 10 MB");
        }
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
            throw new BadRequestException("仅支持 .xlsx 或 .xls 文件");
        }
    }

    private String normalizeDuplicateStrategy(String value) {
        String normalized = blankToFallback(value, "SKIP").toUpperCase(Locale.ROOT);
        if (!Set.of("SKIP", "ALLOW").contains(normalized)) {
            throw new BadRequestException("重复用例处理策略不合法");
        }
        return normalized;
    }

    private Map<String, Integer> readColumns(Row headerRow, DataFormatter formatter) {
        Map<String, Integer> columns = new LinkedHashMap<>();
        for (Cell cell : headerRow) {
            String header = formatter.formatCellValue(cell).trim().replace("*", "");
            if (!header.isEmpty()) {
                columns.put(header.toLowerCase(Locale.ROOT), cell.getColumnIndex());
            }
        }
        return columns;
    }

    private Integer findColumn(Map<String, Integer> columns, String... aliases) {
        for (String alias : aliases) {
            Integer index = columns.get(alias.toLowerCase(Locale.ROOT));
            if (index != null) {
                return index;
            }
        }
        return null;
    }

    private boolean isBlankRow(Row row, DataFormatter formatter) {
        for (Cell cell : row) {
            if (!formatter.formatCellValue(cell).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private String cellValue(Row row, Integer columnIndex, DataFormatter formatter) {
        if (columnIndex == null) {
            return "";
        }
        Cell cell = row.getCell(columnIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private String requireTitle(String value) {
        String title = value == null ? "" : value.trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("用例标题不能为空");
        }
        if (title.length() > 255) {
            throw new IllegalArgumentException("用例标题不能超过 255 个字符");
        }
        return title;
    }

    private String normalizeCaseType(String value) {
        String normalized = blankToFallback(value, "FUNCTION").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "功能", "FUNCTION" -> "FUNCTION";
            case "回归", "REGRESSION" -> "REGRESSION";
            case "异常", "EXCEPTION" -> "EXCEPTION";
            default -> throw new IllegalArgumentException("用例类型仅支持功能、回归或异常");
        };
    }

    private String normalizePriority(String value) {
        String normalized = blankToFallback(value, "P1").toUpperCase(Locale.ROOT);
        if (!Set.of("P0", "P1", "P2", "P3").contains(normalized)) {
            throw new IllegalArgumentException("优先级仅支持 P0、P1、P2 或 P3");
        }
        return normalized;
    }

    private String normalizeTitleKey(String value) {
        return (value == null ? "" : value.trim()).toLowerCase(Locale.ROOT);
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
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

    private void addListValidation(Sheet sheet, int columnIndex, String[] values) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(values);
        CellRangeAddressList range = new CellRangeAddressList(1, MAX_IMPORT_ROWS, columnIndex, columnIndex);
        DataValidation validation = helper.createValidation(constraint, range);
        validation.setShowErrorBox(true);
        sheet.addValidationData(validation);
    }

    private record ImportRow(
            int rowNumber,
            String title,
            String caseType,
            String priority,
            String precondition,
            String steps,
            String expectedResult
    ) {
    }

    private record ParsedWorkbook(
            int totalRows,
            List<ImportRow> rows,
            List<CaseImportRowIssue> issues
    ) {
    }
}
