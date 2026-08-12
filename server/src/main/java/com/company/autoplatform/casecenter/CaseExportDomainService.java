package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CaseExportDomainService {
    private static final String CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final int MAX_EXPORT_ROWS = 10_000;
    private static final int MAX_CELL_TEXT_LENGTH = 32_767;
    private static final List<String> HEADERS = List.of(
            "用例 ID", "工作空间", "目录路径", "用例标题", "用例类型", "优先级", "来源",
            "用例状态", "前置条件", "测试步骤", "预期结果", "评审状态", "执行状态",
            "负责人", "执行人", "创建人", "更新时间");

    private final CaseMapper caseMapper;
    private final CaseDirectoryMapper caseDirectoryMapper;
    private final UserMapper userMapper;
    private final WorkspaceService workspaceService;

    public CaseExportDomainService(
            CaseMapper caseMapper,
            CaseDirectoryMapper caseDirectoryMapper,
            UserMapper userMapper,
            WorkspaceService workspaceService
    ) {
        this.caseMapper = caseMapper;
        this.caseDirectoryMapper = caseDirectoryMapper;
        this.userMapper = userMapper;
        this.workspaceService = workspaceService;
    }

    public CaseExportFile exportCases(
            String workspaceCode,
            String scope,
            String caseIds,
            Long directoryId,
            String keyword,
            String priority,
            String reviewStatus,
            String executionStatus,
            String executorName,
            String createdByName
    ) {
        String normalizedWorkspaceCode = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalizedWorkspaceCode)) {
            throw new BadRequestException("请先选择具体工作空间再导出用例");
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalizedWorkspaceCode);
        ExportScope exportScope = ExportScope.parse(scope);
        LambdaQueryWrapper<CaseEntity> query = new LambdaQueryWrapper<CaseEntity>()
                .eq(CaseEntity::getWorkspaceId, workspace.getId());

        if (exportScope == ExportScope.SELECTED) {
            List<Long> selectedIds = parseCaseIds(caseIds);
            if (selectedIds.isEmpty()) {
                throw new BadRequestException("请先选择需要导出的用例");
            }
            query.in(CaseEntity::getId, selectedIds);
        } else {
            applyDirectoryFilter(query, workspace.getId(), directoryId);
            if (exportScope == ExportScope.FILTERED) {
                applyListFilters(query, keyword, priority, reviewStatus, executionStatus, executorName, createdByName);
            }
        }

        List<CaseEntity> cases = caseMapper.selectList(query
                .orderByDesc(CaseEntity::getUpdatedAt)
                .orderByDesc(CaseEntity::getId)
                .last("limit " + (MAX_EXPORT_ROWS + 1)));
        if (cases.size() > MAX_EXPORT_ROWS) {
            throw new BadRequestException("单次最多导出 " + MAX_EXPORT_ROWS + " 条用例，请缩小筛选范围后重试");
        }

        return buildWorkbook(workspace, cases);
    }

    private void applyDirectoryFilter(LambdaQueryWrapper<CaseEntity> query, Long workspaceId, Long directoryId) {
        if (directoryId == null) {
            return;
        }
        CaseDirectoryEntity directory = caseDirectoryMapper.selectById(directoryId);
        if (directory == null || !workspaceId.equals(directory.getWorkspaceId())) {
            throw new BadRequestException("当前用例目录不存在或不属于当前工作空间");
        }
        query.in(CaseEntity::getCaseDirectoryId, collectDescendantIds(workspaceId, directoryId));
    }

    private void applyListFilters(
            LambdaQueryWrapper<CaseEntity> query,
            String keyword,
            String priority,
            String reviewStatus,
            String executionStatus,
            String executorName,
            String createdByName
    ) {
        String normalizedKeyword = blankToNull(keyword);
        if (normalizedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(CaseEntity::getCaseNo, normalizedKeyword)
                    .or()
                    .like(CaseEntity::getTitle, normalizedKeyword));
        }
        String normalizedPriority = normalizeChoice(priority, Set.of("P0", "P1", "P2", "P3"), "优先级");
        if (normalizedPriority != null) {
            query.eq(CaseEntity::getPriority, normalizedPriority);
        }
        String normalizedReviewStatus = normalizeChoice(reviewStatus, Set.of("PENDING", "PASSED", "REJECTED"), "评审状态");
        if (normalizedReviewStatus != null) {
            query.eq(CaseEntity::getReviewStatus, normalizedReviewStatus);
        }
        String normalizedExecutionStatus = normalizeChoice(executionStatus, Set.of("NOT_RUN", "PASSED", "FAILED", "BLOCKED", "SKIPPED", "RUNNING"), "执行状态");
        if (normalizedExecutionStatus != null) {
            query.eq(CaseEntity::getExecutionStatus, "RUNNING".equals(normalizedExecutionStatus) ? "BLOCKED" : normalizedExecutionStatus);
        }
        applyUserNameFilter(query, executorName, true);
        applyUserNameFilter(query, createdByName, false);
    }

    private void applyUserNameFilter(LambdaQueryWrapper<CaseEntity> query, String displayName, boolean executor) {
        String normalizedName = blankToNull(displayName);
        if (normalizedName == null) {
            return;
        }
        List<Long> userIds = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                        .eq(UserEntity::getDisplayName, normalizedName))
                .stream()
                .map(UserEntity::getId)
                .toList();
        if (userIds.isEmpty()) {
            query.eq(CaseEntity::getId, -1L);
        } else if (executor) {
            query.in(CaseEntity::getExecutorId, userIds);
        } else {
            query.in(CaseEntity::getCreatedBy, userIds);
        }
    }

    private CaseExportFile buildWorkbook(WorkspaceEntity workspace, List<CaseEntity> cases) {
        List<CaseDirectoryEntity> directories = caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .eq(CaseDirectoryEntity::getWorkspaceId, workspace.getId())
                .orderByAsc(CaseDirectoryEntity::getId));
        Map<Long, CaseDirectoryEntity> directoryMap = directories.stream()
                .collect(Collectors.toMap(CaseDirectoryEntity::getId, Function.identity()));
        Map<Long, UserEntity> userMap = loadUsers(cases);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("测试用例");
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle bodyStyle = createBodyStyle(workbook);
            Row headerRow = sheet.createRow(0);
            for (int index = 0; index < HEADERS.size(); index++) {
                Cell cell = headerRow.createCell(index);
                cell.setCellValue(HEADERS.get(index));
                cell.setCellStyle(headerStyle);
            }

            for (int rowIndex = 0; rowIndex < cases.size(); rowIndex++) {
                CaseEntity item = cases.get(rowIndex);
                Row row = sheet.createRow(rowIndex + 1);
                row.setHeightInPoints(36);
                List<String> values = List.of(
                        text(item.getCaseNo()),
                        text(workspace.getWorkspaceName()),
                        directoryPath(item.getCaseDirectoryId(), directoryMap),
                        text(item.getTitle()),
                        caseTypeLabel(item.getCaseType()),
                        text(item.getPriority()),
                        sourceTypeLabel(item.getSourceType()),
                        caseStatusLabel(item.getCaseStatus()),
                        text(item.getPrecondition()),
                        text(item.getSteps()),
                        text(item.getExpectedResult()),
                        reviewStatusLabel(item.getReviewStatus()),
                        executionStatusLabel(item.getExecutionStatus()),
                        userName(item.getOwnerId(), userMap),
                        userName(item.getExecutorId(), userMap),
                        userName(item.getCreatedBy(), userMap),
                        dateTime(item.getUpdatedAt()));
                for (int columnIndex = 0; columnIndex < values.size(); columnIndex++) {
                    Cell cell = row.createCell(columnIndex);
                    cell.setCellValue(limitCellText(values.get(columnIndex)));
                    cell.setCellStyle(bodyStyle);
                }
            }

            int[] widths = {16, 18, 28, 36, 12, 10, 12, 12, 36, 48, 48, 12, 12, 14, 14, 14, 20};
            for (int index = 0; index < widths.length; index++) {
                sheet.setColumnWidth(index, widths[index] * 256);
            }
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));
            workbook.write(output);
            String fileName = "测试用例_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".xlsx";
            return new CaseExportFile(fileName, CONTENT_TYPE, output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("生成用例导出文件失败", exception);
        }
    }

    private Map<Long, UserEntity> loadUsers(List<CaseEntity> cases) {
        Set<Long> userIds = new HashSet<>();
        cases.forEach(item -> {
            addIfPresent(userIds, item.getOwnerId());
            addIfPresent(userIds, item.getExecutorId());
            addIfPresent(userIds, item.getCreatedBy());
        });
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private Set<Long> collectDescendantIds(Long workspaceId, Long rootId) {
        List<CaseDirectoryEntity> directories = caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .eq(CaseDirectoryEntity::getWorkspaceId, workspaceId)
                .orderByAsc(CaseDirectoryEntity::getId));
        Map<Long, List<CaseDirectoryEntity>> childrenByParent = directories.stream()
                .filter(item -> item.getParentId() != null)
                .collect(Collectors.groupingBy(CaseDirectoryEntity::getParentId, LinkedHashMap::new, Collectors.toList()));
        Set<Long> result = new HashSet<>();
        List<Long> stack = new ArrayList<>();
        stack.add(rootId);
        while (!stack.isEmpty()) {
            Long current = stack.remove(stack.size() - 1);
            result.add(current);
            childrenByParent.getOrDefault(current, List.of()).forEach(item -> stack.add(item.getId()));
        }
        return result;
    }

    private String directoryPath(Long directoryId, Map<Long, CaseDirectoryEntity> directoryMap) {
        if (directoryId == null) {
            return "空间根目录";
        }
        List<String> segments = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        CaseDirectoryEntity cursor = directoryMap.get(directoryId);
        while (cursor != null && visited.add(cursor.getId())) {
            segments.add(0, cursor.getDirectoryName());
            cursor = cursor.getParentId() == null ? null : directoryMap.get(cursor.getParentId());
        }
        return segments.isEmpty() ? "空间根目录" : String.join(" / ", segments);
    }

    private CellStyle createHeaderStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 242, (byte) 243, (byte) 245}));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    private CellStyle createBodyStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.TOP);
        style.setWrapText(true);
        style.setBorderBottom(BorderStyle.HAIR);
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    private List<Long> parseCaseIds(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return List.of();
        }
        try {
            return Arrays.stream(normalized.split(","))
                    .map(String::trim)
                    .filter(item -> !item.isEmpty())
                    .map(Long::valueOf)
                    .filter(id -> id > 0)
                    .distinct()
                    .toList();
        } catch (NumberFormatException exception) {
            throw new BadRequestException("导出用例 ID 格式不正确");
        }
    }

    private String normalizeChoice(String value, Set<String> allowed, String label) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BadRequestException(label + "不合法");
        }
        return normalized;
    }

    private void addIfPresent(Set<Long> target, Long value) {
        if (value != null) {
            target.add(value);
        }
    }

    private String userName(Long userId, Map<Long, UserEntity> userMap) {
        UserEntity user = userId == null ? null : userMap.get(userId);
        return user == null ? "-" : text(user.getDisplayName());
    }

    private String caseTypeLabel(String value) {
        return switch (text(value).toUpperCase(Locale.ROOT)) {
            case "FUNCTION" -> "功能";
            case "REGRESSION" -> "回归";
            case "EXCEPTION" -> "异常";
            default -> text(value);
        };
    }

    private String sourceTypeLabel(String value) {
        return switch (text(value).toUpperCase(Locale.ROOT)) {
            case "MANUAL" -> "手工创建";
            case "IMPORTED" -> "导入";
            case "AI_GENERATED" -> "AI 生成";
            default -> text(value);
        };
    }

    private String caseStatusLabel(String value) {
        return switch (text(value).toUpperCase(Locale.ROOT)) {
            case "CONFIRMED", "ENABLED" -> "启用";
            case "DRAFT" -> "草稿";
            case "ARCHIVED" -> "归档";
            default -> text(value);
        };
    }

    private String reviewStatusLabel(String value) {
        return switch (text(value).toUpperCase(Locale.ROOT)) {
            case "PENDING" -> "待评审";
            case "PASSED" -> "已通过";
            case "REJECTED" -> "未通过";
            default -> text(value);
        };
    }

    private String executionStatusLabel(String value) {
        return switch (text(value).toUpperCase(Locale.ROOT)) {
            case "NOT_RUN" -> "未执行";
            case "PASSED" -> "通过";
            case "FAILED" -> "失败";
            case "BLOCKED", "RUNNING" -> "阻塞";
            case "SKIPPED" -> "跳过";
            default -> text(value);
        };
    }

    private String dateTime(LocalDateTime value) {
        return value == null ? "" : value.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private String text(String value) {
        return value == null ? "" : value;
    }

    private String limitCellText(String value) {
        return value.length() <= MAX_CELL_TEXT_LENGTH ? value : value.substring(0, MAX_CELL_TEXT_LENGTH);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private enum ExportScope {
        SELECTED,
        FILTERED,
        DIRECTORY;

        private static ExportScope parse(String value) {
            try {
                return ExportScope.valueOf(Objects.requireNonNullElse(value, "FILTERED").trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException exception) {
                throw new BadRequestException("导出范围不合法");
            }
        }
    }
}
