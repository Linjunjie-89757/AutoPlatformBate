package com.company.autoplatform.testmanagement;

import com.company.autoplatform.bug.BugEntity;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.awt.Color;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class TestPlanPdfReportService {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final float PAGE_MARGIN = 42f;
    private static final float CONTENT_WIDTH = PDRectangle.A4.getWidth() - PAGE_MARGIN * 2;

    private final String configuredFontPath;

    public TestPlanPdfReportService(@Value("${autoplatform.pdf.font-path:}") String configuredFontPath) {
        this.configuredFontPath = configuredFontPath;
    }

    public GeneratedTestPlanPdf render(
            TestPlanResponse plan,
            TestPlanReportResponse report,
            List<BugEntity> defects
    ) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDFont font = PDType0Font.load(document, resolveFont().toFile());
            try (ReportCanvas canvas = new ReportCanvas(document, font)) {
                drawHeader(canvas, plan, report);
                drawSummary(canvas, plan, defects);
                drawQualityConclusion(canvas, plan, report, defects);
                drawRequirements(canvas, plan.requirements());
                drawCases(canvas, plan.cases());
                drawDefects(canvas, defects);
                drawSignature(canvas, plan, report);
            }
            document.save(output);
            return new GeneratedTestPlanPdf(output.toByteArray(), safeFileName(plan));
        } catch (IOException exception) {
            throw TestManagementException.reportExportFailed("测试报告 PDF 生成失败，请稍后重试");
        }
    }

    public GeneratedTestPlanPdf renderVersion(TestVersionReportData report) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDFont font = PDType0Font.load(document, resolveFont().toFile());
            try (ReportCanvas canvas = new ReportCanvas(document, font)) {
                drawVersionHeader(canvas, report);
                drawVersionSummary(canvas, report);
                drawVersionQuality(canvas, report);
                drawVersionPlans(canvas, report.plans());
                drawVersionRequirements(canvas, report.requirements());
                drawDefects(canvas, report.defects());
            }
            document.save(output);
            return new GeneratedTestPlanPdf(output.toByteArray(), safeFileName(report.version()));
        } catch (IOException exception) {
            throw TestManagementException.reportExportFailed("版本汇总报告 PDF 生成失败，请稍后重试");
        }
    }

    private void drawVersionHeader(ReportCanvas canvas, TestVersionReportData report) throws IOException {
        TestVersionResponse version = report.version();
        canvas.text("版本测试汇总报告", 22, 0x1D2129, 0, 28);
        canvas.text(version.name(), 14, 0x1D2129, 0, 24);
        canvas.text("版本编号：" + display(version.versionNo()) + "    报告生成：" + format(report.generatedAt()), 9, 0x86909C, 0, 15);
        canvas.rule(0xE5E6EB, 14);
        canvas.keyValueGrid(List.of(
                new String[]{"工作区", display(version.workspaceName()), "负责人", display(version.ownerName())},
                new String[]{"版本类型", versionType(version.versionType()), "版本状态", versionStatus(version.status())},
                new String[]{"测试周期", format(version.startDate()) + " 至 " + format(version.releaseDate()), "计划提测", format(version.testDate())},
                new String[]{"版本目标", display(version.goal()), "测试计划", report.plans().size() + " 个"}
        ));
        canvas.space(18);
    }

    private void drawVersionSummary(ReportCanvas canvas, TestVersionReportData report) throws IOException {
        canvas.sectionTitle("版本质量概览");
        canvas.metrics(List.of(
                new Metric("测试计划", String.valueOf(report.plans().size()), 0x1D2129),
                new Metric("测试用例", String.valueOf(report.caseCount()), 0x1D2129),
                new Metric("已执行", String.valueOf(report.executedCount()), 0x165DFF),
                new Metric("用例通过率", percent(report.passRate()), 0x00B42A),
                new Metric("发现缺陷", String.valueOf(report.defects().size()), 0xF53F3F)
        ));
        canvas.space(18);
    }

    private void drawVersionQuality(ReportCanvas canvas, TestVersionReportData report) throws IOException {
        boolean allPassed = report.qualityPassedCount() == 7;
        canvas.callout(
                allPassed ? "版本已达到质量准出标准" : "版本仍有质量标准未达成",
                "执行率 " + percent(report.executeRate()) + "，通过率 " + percent(report.passRate())
                        + "，需求覆盖率 " + percent(report.requirementCoverRate())
                        + "，未关闭 P0/P1 缺陷 " + report.openP0Count() + "/" + report.openP1Count()
                        + "；当前 " + report.qualityPassedCount() + "/7 项达标。",
                allPassed
        );
        canvas.space(18);
    }

    private void drawVersionPlans(ReportCanvas canvas, List<TestVersionReportData.PlanItem> plans) throws IOException {
        canvas.sectionTitle("测试计划（" + plans.size() + "）");
        if (plans.isEmpty()) {
            canvas.empty("该版本尚未创建测试计划");
            return;
        }
        List<List<String>> rows = new ArrayList<>();
        for (TestVersionReportData.PlanItem item : plans) {
            rows.add(List.of(
                    display(item.planNo()), display(item.name()), planType(item.type()), planStatus(item.status()),
                    item.executedCount() + "/" + item.caseCount(), percent(item.passRate()), String.valueOf(item.defectCount())
            ));
        }
        canvas.table(
                List.of("计划编号", "计划名称", "类型", "状态", "执行", "通过率", "缺陷"),
                new float[]{66, 150, 60, 54, 48, 54, 50}, rows
        );
        canvas.space(14);
    }

    private void drawVersionRequirements(ReportCanvas canvas, List<TestVersionReportData.RequirementItem> requirements) throws IOException {
        canvas.sectionTitle("版本需求（" + requirements.size() + "）");
        if (requirements.isEmpty()) {
            canvas.empty("该版本尚未关联需求");
            return;
        }
        List<List<String>> rows = new ArrayList<>();
        for (TestVersionReportData.RequirementItem item : requirements) {
            rows.add(List.of(
                    display(item.requirementNo()), display(item.title()), item.priority() == null ? "—" : item.priority().name(),
                    requirementQuality(item.qualityStatus()), item.caseReviewed() + "/" + item.caseTotal()
            ));
        }
        canvas.table(
                List.of("需求编号", "需求名称", "优先级", "覆盖状态", "评审用例"),
                new float[]{78, 240, 50, 64, 50}, rows
        );
        canvas.space(14);
    }

    private void drawHeader(ReportCanvas canvas, TestPlanResponse plan, TestPlanReportResponse report) throws IOException {
        canvas.text("测试计划报告", 22, 0x1D2129, 0, 28);
        canvas.text(plan.name(), 14, 0x1D2129, 0, 24);
        canvas.text("计划编号：" + display(plan.planNo()) + "    报告生成：" + format(report.generatedAt()), 9, 0x86909C, 0, 15);
        canvas.rule(0xE5E6EB, 14);

        List<String[]> metadata = List.of(
                new String[]{"工作区", display(plan.workspaceName()), "负责人", display(plan.ownerName())},
                new String[]{"计划类型", planType(plan.planType()), "关联版本", display(plan.versionName())},
                new String[]{"计划周期", format(plan.startDate()) + " 至 " + format(plan.endDate()), "完成时间", format(plan.completedAt())},
                new String[]{"测试目标", display(plan.goal()), "报告状态", report.status() == PlanReportStatus.SIGNED ? "已签署" : "已生成"}
        );
        canvas.keyValueGrid(metadata);
        canvas.space(18);
    }

    private void drawSummary(ReportCanvas canvas, TestPlanResponse plan, List<BugEntity> defects) throws IOException {
        canvas.sectionTitle("执行概览");
        List<Metric> metrics = List.of(
                new Metric("测试用例", String.valueOf(plan.caseCount()), 0x1D2129),
                new Metric("已执行", String.valueOf(plan.executedCount()), 0x165DFF),
                new Metric("用例通过率", percent(plan.passRate()), 0x00B42A),
                new Metric("发现缺陷", String.valueOf(defects.size()), 0xF53F3F)
        );
        canvas.metrics(metrics);
        canvas.space(18);
    }

    private void drawQualityConclusion(
            ReportCanvas canvas,
            TestPlanResponse plan,
            TestPlanReportResponse report,
            List<BugEntity> defects
    ) throws IOException {
        long openP0 = openDefectCount(defects, "P0");
        long openP1 = openDefectCount(defects, "P1");
        boolean executePassed = plan.executeRate().compareTo(plan.minExecuteRate()) >= 0;
        boolean passPassed = plan.passRate().compareTo(plan.minPassRate()) >= 0;
        boolean p0Passed = plan.allowP0() || openP0 == 0;
        boolean p1Passed = openP1 <= plan.maxP1();
        boolean ownerPassed = !plan.ownerConfirmRequired() || report.status() == PlanReportStatus.SIGNED;
        int passed = (executePassed ? 1 : 0) + (passPassed ? 1 : 0) + (p0Passed ? 1 : 0) + (p1Passed ? 1 : 0) + (ownerPassed ? 1 : 0);
        boolean allPassed = passed == 5;

        canvas.callout(
                allPassed ? "测试通过，可进入下一环节" : "仍有质量标准未达成",
                "执行率 " + percent(plan.executeRate())
                        + "，通过率 " + percent(plan.passRate())
                        + "，未关闭 P0/P1 缺陷 " + openP0 + "/" + openP1
                        + "；当前 " + passed + "/5 项质量标准达标。",
                allPassed
        );
        canvas.space(18);
    }

    private void drawRequirements(ReportCanvas canvas, List<TestPlanRequirementItem> requirements) throws IOException {
        canvas.sectionTitle("关联需求（" + requirements.size() + "）");
        if (requirements.isEmpty()) {
            canvas.empty("该测试计划未关联需求");
            return;
        }
        List<List<String>> rows = new ArrayList<>();
        for (TestPlanRequirementItem requirement : requirements) {
            rows.add(List.of(
                    display(requirement.requirementNo()),
                    display(requirement.title()),
                    requirement.priority() == null ? "—" : requirement.priority().name(),
                    reviewStatus(requirement.reviewStatus()),
                    String.valueOf(requirement.passedCaseCount())
            ));
        }
        canvas.table(
                List.of("需求编号", "需求名称", "优先级", "评审状态", "通过用例"),
                new float[]{76, 224, 48, 72, 62},
                rows
        );
        canvas.space(14);
    }

    private void drawCases(ReportCanvas canvas, List<TestPlanCaseItem> cases) throws IOException {
        canvas.sectionTitle("测试用例执行明细（" + cases.size() + "）");
        if (cases.isEmpty()) {
            canvas.empty("该测试计划没有测试用例快照");
            return;
        }
        List<List<String>> rows = new ArrayList<>();
        for (TestPlanCaseItem item : cases) {
            rows.add(List.of(
                    display(item.caseNo()),
                    display(item.title()),
                    display(item.module()),
                    executionStatus(item.executionStatus()),
                    display(item.assigneeName()),
                    String.valueOf(item.defectCount())
            ));
        }
        canvas.table(
                List.of("用例编号", "用例名称", "模块", "结果", "负责人", "缺陷"),
                new float[]{72, 188, 70, 54, 66, 32},
                rows
        );
        canvas.space(14);
    }

    private void drawDefects(ReportCanvas canvas, List<BugEntity> defects) throws IOException {
        canvas.sectionTitle("关联缺陷（" + defects.size() + "）");
        if (defects.isEmpty()) {
            canvas.empty("本次测试未关联缺陷");
            return;
        }
        List<List<String>> rows = new ArrayList<>();
        for (BugEntity defect : defects) {
            rows.add(List.of(
                    display(defect.getBugNo()),
                    display(defect.getTitle()),
                    display(defect.getPriority()),
                    defectSeverity(defect.getSeverity()),
                    defectStatus(defect.getStatus())
            ));
        }
        canvas.table(
                List.of("缺陷编号", "缺陷标题", "优先级", "严重程度", "状态"),
                new float[]{78, 234, 52, 62, 56},
                rows
        );
        canvas.space(8);
    }

    private void drawSignature(ReportCanvas canvas, TestPlanResponse plan, TestPlanReportResponse report) throws IOException {
        canvas.ensure(89);
        canvas.sectionTitle("负责人签字确认");
        if (report.status() == PlanReportStatus.SIGNED) {
            canvas.callout(
                    display(report.signerName()) + " 已确认签字",
                    "签字时间：" + format(report.signedAt()),
                    true
            );
        } else {
            canvas.callout(
                    display(plan.ownerName()) + " 尚未确认本次测试报告",
                    "当前导出版本为未签署报告。",
                    false
            );
        }
    }

    private Path resolveFont() {
        List<Path> candidates = new ArrayList<>();
        if (configuredFontPath != null && !configuredFontPath.isBlank()) {
            candidates.add(Path.of(configuredFontPath.trim()));
        }
        String environmentFont = System.getenv("AUTOPLATFORM_PDF_FONT_PATH");
        if (environmentFont != null && !environmentFont.isBlank()) {
            candidates.add(Path.of(environmentFont.trim()));
        }
        candidates.add(Path.of("C:/Windows/Fonts/simhei.ttf"));
        candidates.add(Path.of("C:/Windows/Fonts/msyh.ttf"));
        candidates.add(Path.of("/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf"));
        candidates.add(Path.of("/usr/share/fonts/opentype/source-han-sans/SourceHanSansCN-Regular.otf"));
        candidates.add(Path.of("/usr/share/fonts/truetype/wqy/wqy-microhei.ttf"));
        return candidates.stream()
                .filter(Files::isRegularFile)
                .findFirst()
                .orElseThrow(() -> TestManagementException.reportExportFailed(
                        "服务器缺少可用的中文 PDF 字体，请配置 autoplatform.pdf.font-path"
                ));
    }

    private String safeFileName(TestPlanResponse plan) {
        String source = display(plan.planNo()) + "-" + display(plan.name()) + "-测试报告.pdf";
        return source.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
    }

    private String safeFileName(TestVersionResponse version) {
        String source = display(version.versionNo()) + "-" + display(version.name()) + "-版本测试汇总报告.pdf";
        return source.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
    }

    private long openDefectCount(List<BugEntity> defects, String priority) {
        return defects.stream()
                .filter(item -> priority.equalsIgnoreCase(item.getPriority()))
                .filter(item -> !"CLOSED".equalsIgnoreCase(item.getStatus()) && !"REJECTED".equalsIgnoreCase(item.getStatus()))
                .count();
    }

    private String display(Object value) {
        if (value == null) return "—";
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? "—" : text;
    }

    private String format(java.time.LocalDate value) {
        return value == null ? "—" : DATE.format(value);
    }

    private String format(java.time.LocalDateTime value) {
        return value == null ? "—" : DATE_TIME.format(value);
    }

    private String percent(BigDecimal value) {
        return value == null ? "0%" : value.stripTrailingZeros().toPlainString() + "%";
    }

    private String planType(PlanType value) {
        if (value == null) return "—";
        return switch (value) {
            case SMOKE -> "冒烟测试";
            case FUNCTIONAL -> "功能测试";
            case REGRESSION -> "回归测试";
            case RELEASE -> "发布验收";
            case MIXED -> "混合测试";
        };
    }

    private String planStatus(PlanStatus value) {
        if (value == null) return "—";
        return switch (value) {
            case DRAFT -> "草稿";
            case PENDING -> "待开始";
            case RUNNING -> "进行中";
            case BLOCKED -> "已阻塞";
            case COMPLETED -> "已完成";
            case CANCELLED -> "已取消";
        };
    }

    private String versionType(VersionType value) {
        if (value == null) return "—";
        return switch (value) {
            case ITERATION -> "迭代版本";
            case RELEASE -> "正式版本";
            case PATCH -> "补丁版本";
            case HOTFIX -> "紧急修复";
        };
    }

    private String versionStatus(VersionStatus value) {
        if (value == null) return "—";
        return switch (value) {
            case PLANNING -> "规划中";
            case DEVELOPING -> "开发中";
            case TESTING -> "测试中";
            case PENDING_RELEASE -> "待发布";
            case RELEASED -> "已发布";
            case ARCHIVED -> "已归档";
        };
    }

    private String requirementQuality(String value) {
        if (value == null) return "—";
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "UNCOVERED" -> "未覆盖";
            case "PARTIAL" -> "部分覆盖";
            case "COVERED" -> "已覆盖";
            case "PASSED" -> "测试通过";
            default -> value;
        };
    }

    private String reviewStatus(RequirementReviewStatus value) {
        if (value == null) return "—";
        return switch (value) {
            case PENDING -> "待评审";
            case REVIEWING -> "评审中";
            case PASSED -> "已通过";
            case REJECTED -> "已驳回";
        };
    }

    private String executionStatus(PlanCaseExecutionStatus value) {
        if (value == null) return "—";
        return switch (value) {
            case PENDING -> "未执行";
            case PASSED -> "通过";
            case FAILED -> "失败";
            case BLOCKED -> "阻塞";
            case SKIPPED -> "跳过";
        };
    }

    private String defectSeverity(String value) {
        if (value == null) return "—";
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> "致命";
            case "HIGH" -> "严重";
            case "MEDIUM" -> "一般";
            case "LOW" -> "轻微";
            default -> value;
        };
    }

    private String defectStatus(String value) {
        if (value == null) return "—";
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "NEW" -> "新建";
            case "ASSIGNED" -> "已指派";
            case "IN_PROGRESS" -> "处理中";
            case "RESOLVED" -> "待验证";
            case "VERIFIED" -> "已验证";
            case "CLOSED" -> "已关闭";
            case "REJECTED" -> "已驳回";
            default -> value;
        };
    }

    private record Metric(String label, String value, int color) {
    }

    private static final class ReportCanvas implements AutoCloseable {
        private static final float TOP = PDRectangle.A4.getHeight() - PAGE_MARGIN;
        private static final float BOTTOM = PAGE_MARGIN;
        private final PDDocument document;
        private final PDFont font;
        private PDPageContentStream stream;
        private float y;
        private int pageNumber;

        private ReportCanvas(PDDocument document, PDFont font) throws IOException {
            this.document = document;
            this.font = font;
            newPage();
        }

        private void newPage() throws IOException {
            closeStream();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = TOP;
            pageNumber++;
            if (pageNumber > 1) {
                text("测试计划报告（续）", 9, 0x86909C, 0, 18);
                rule(0xE5E6EB, 12);
            }
        }

        private void ensure(float requiredHeight) throws IOException {
            if (y - requiredHeight < BOTTOM) newPage();
        }

        private void text(String value, float size, int color, float xOffset, float lineHeight) throws IOException {
            ensure(lineHeight);
            drawText(value, PAGE_MARGIN + xOffset, y - size, size, color);
            y -= lineHeight;
        }

        private void drawText(String value, float x, float baseline, float size, int color) throws IOException {
            stream.beginText();
            stream.setFont(font, size);
            stream.setNonStrokingColor(asColor(color));
            stream.newLineAtOffset(x, baseline);
            stream.showText(clean(value));
            stream.endText();
        }

        private void sectionTitle(String value) throws IOException {
            ensure(27);
            drawText(value, PAGE_MARGIN, y - 12, 13, 0x1D2129);
            y -= 27;
        }

        private void rule(int color, float marginBottom) throws IOException {
            stream.setStrokingColor(asColor(color));
            stream.setLineWidth(0.7f);
            stream.moveTo(PAGE_MARGIN, y);
            stream.lineTo(PAGE_MARGIN + CONTENT_WIDTH, y);
            stream.stroke();
            y -= marginBottom;
        }

        private void space(float height) throws IOException {
            ensure(height);
            y -= height;
        }

        private void keyValueGrid(List<String[]> rows) throws IOException {
            float rowHeight = 27;
            ensure(rowHeight * rows.size());
            for (String[] row : rows) {
                drawText(row[0], PAGE_MARGIN, y - 11, 9, 0x86909C);
                drawText(ellipsize(row[1], 130, 9), PAGE_MARGIN + 56, y - 11, 9, 0x1D2129);
                drawText(row[2], PAGE_MARGIN + 255, y - 11, 9, 0x86909C);
                drawText(ellipsize(row[3], 170, 9), PAGE_MARGIN + 315, y - 11, 9, 0x1D2129);
                y -= rowHeight;
            }
        }

        private void metrics(List<Metric> metrics) throws IOException {
            float gap = 8;
            float width = (CONTENT_WIDTH - gap * Math.max(0, metrics.size() - 1)) / Math.max(1, metrics.size());
            float height = 64;
            ensure(height);
            for (int index = 0; index < metrics.size(); index++) {
                Metric metric = metrics.get(index);
                float x = PAGE_MARGIN + index * (width + gap);
                fillRect(x, y - height, width, height, 0xFAFBFE, 0xE5E6EB);
                drawText(ellipsize(metric.value(), width - 18, 19), x + 9, y - 27, 19, metric.color());
                drawText(metric.label(), x + 9, y - 48, 9, 0x86909C);
            }
            y -= height;
        }

        private void callout(String title, String description, boolean success) throws IOException {
            ensure(62);
            int border = success ? 0x8AD99B : 0xFFC4C4;
            int background = success ? 0xF7FFF9 : 0xFFFAFA;
            int foreground = success ? 0x00B42A : 0xF53F3F;
            fillRect(PAGE_MARGIN, y - 62, CONTENT_WIDTH, 62, background, border);
            drawText(ellipsize(title, CONTENT_WIDTH - 28, 11), PAGE_MARGIN + 14, y - 23, 11, foreground);
            drawText(ellipsize(description, CONTENT_WIDTH - 28, 9), PAGE_MARGIN + 14, y - 43, 9, 0x4E5969);
            y -= 62;
        }

        private void empty(String message) throws IOException {
            ensure(42);
            fillRect(PAGE_MARGIN, y - 42, CONTENT_WIDTH, 42, 0xFAFBFE, 0xE5E6EB);
            drawText(message, PAGE_MARGIN + 14, y - 25, 9, 0x86909C);
            y -= 42;
        }

        private void table(List<String> headers, float[] widths, List<List<String>> rows) throws IOException {
            float rowHeight = 25;
            drawTableRow(headers, widths, rowHeight, true);
            for (List<String> row : rows) {
                if (y - rowHeight < BOTTOM) {
                    newPage();
                    drawTableRow(headers, widths, rowHeight, true);
                }
                drawTableRow(row, widths, rowHeight, false);
            }
        }

        private void drawTableRow(List<String> values, float[] widths, float height, boolean header) throws IOException {
            ensure(height);
            float x = PAGE_MARGIN;
            int background = header ? 0xF2F3F5 : 0xFFFFFF;
            fillRect(PAGE_MARGIN, y - height, CONTENT_WIDTH, height, background, 0xE5E6EB);
            for (int index = 0; index < widths.length; index++) {
                String value = index < values.size() ? values.get(index) : "";
                drawText(ellipsize(value, widths[index] - 10, 8), x + 5, y - 16, 8, header ? 0x4E5969 : 0x1D2129);
                x += widths[index];
            }
            y -= height;
        }

        private void fillRect(float x, float bottom, float width, float height, int fill, int border) throws IOException {
            stream.setNonStrokingColor(asColor(fill));
            stream.addRect(x, bottom, width, height);
            stream.fill();
            stream.setStrokingColor(asColor(border));
            stream.setLineWidth(0.6f);
            stream.addRect(x, bottom, width, height);
            stream.stroke();
        }

        private String ellipsize(String value, float maxWidth, float size) throws IOException {
            String safe = clean(value);
            if (textWidth(safe, size) <= maxWidth) return safe;
            String suffix = "…";
            StringBuilder result = new StringBuilder();
            for (int offset = 0; offset < safe.length();) {
                int codePoint = safe.codePointAt(offset);
                String candidate = result + new String(Character.toChars(codePoint)) + suffix;
                if (textWidth(candidate, size) > maxWidth) break;
                result.appendCodePoint(codePoint);
                offset += Character.charCount(codePoint);
            }
            return result + suffix;
        }

        private float textWidth(String value, float size) throws IOException {
            return font.getStringWidth(value) / 1000f * size;
        }

        private String clean(String value) {
            return value == null ? "—" : value.replaceAll("[\\r\\n\\t]+", " ").trim();
        }

        private int red(int color) {
            return color >> 16 & 0xFF;
        }

        private int green(int color) {
            return color >> 8 & 0xFF;
        }

        private int blue(int color) {
            return color & 0xFF;
        }

        private Color asColor(int color) {
            return new Color(red(color), green(color), blue(color));
        }

        private void closeStream() throws IOException {
            if (stream != null) {
                stream.close();
                stream = null;
            }
        }

        @Override
        public void close() throws IOException {
            closeStream();
        }
    }
}
