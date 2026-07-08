package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiAssertionResult;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiExecutionSuiteRunItemSnapshot;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiRequestSnapshot;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiResponseSnapshot;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiRunStepResultResponse;

@Service
public class ApiReportShareDomainService {

    private static final String SUITE_HISTORY = "SUITE_HISTORY";
    private static final int DEFAULT_EXPIRES_IN_DAYS = 30;
    private static final int MAX_BLOCK_LENGTH = 20000;
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
            "(?i)(password|passwd|pwd|token|authorization|cookie|secret|session|access[_-]?key|refresh[_-]?token|phone|mobile|account)");
    private static final Pattern JSON_SENSITIVE_FIELD_PATTERN = Pattern.compile(
            "(?i)(\"[^\"]*(?:password|passwd|pwd|token|authorization|cookie|secret|session|access[_-]?key|refresh[_-]?token|phone|mobile|account)[^\"]*\"\\s*:\\s*\")([^\"]*)(\")");

    private final ApiReportShareMapper reportShareMapper;
    private final ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper;
    private final WorkspaceService workspaceService;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public ApiReportShareDomainService(
            ApiReportShareMapper reportShareMapper,
            ApiExecutionSuiteRunHistoryMapper suiteRunHistoryMapper,
            WorkspaceService workspaceService,
            ObjectMapper objectMapper
    ) {
        this.reportShareMapper = reportShareMapper;
        this.suiteRunHistoryMapper = suiteRunHistoryMapper;
        this.workspaceService = workspaceService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public String createSuiteHistoryShareLink(ApiExecutionSuiteRunHistoryEntity history) {
        if (history == null || history.getId() == null) {
            return null;
        }
        String rawToken = generateRawToken();
        LocalDateTime now = LocalDateTime.now();
        ApiReportShareEntity entity = new ApiReportShareEntity();
        entity.setWorkspaceId(history.getWorkspaceId());
        entity.setShareType(SUITE_HISTORY);
        entity.setTargetId(history.getId());
        entity.setTokenHash(sha256(rawToken));
        entity.setStatus(1);
        entity.setExpiresAt(now.plusDays(DEFAULT_EXPIRES_IN_DAYS));
        entity.setCreatedBy(blankToFallback(history.getOperatorName(), "系统"));
        entity.setAccessCount(0);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        reportShareMapper.insert(entity);
        return "/api/public/automation/api/report-shares/" + rawToken + "/html";
    }

    @Transactional
    public String renderSharedHtmlReport(String rawToken) {
        ApiReportShareEntity share = requireActiveShare(rawToken);
        ApiExecutionSuiteRunHistoryEntity history = suiteRunHistoryMapper.selectById(share.getTargetId());
        if (history == null || !Objects.equals(history.getWorkspaceId(), share.getWorkspaceId())) {
            throw new NotFoundException("API report share not found");
        }
        LocalDateTime now = LocalDateTime.now();
        share.setLastAccessedAt(now);
        share.setAccessCount((share.getAccessCount() == null ? 0 : share.getAccessCount()) + 1);
        share.setUpdatedAt(now);
        reportShareMapper.updateById(share);
        return renderHtml(history, share, now);
    }

    private ApiReportShareEntity requireActiveShare(String rawToken) {
        String token = blankToNull(rawToken);
        if (token == null) {
            throw new NotFoundException("API report share not found");
        }
        ApiReportShareEntity entity = reportShareMapper.selectOne(new LambdaQueryWrapper<ApiReportShareEntity>()
                .eq(ApiReportShareEntity::getTokenHash, sha256(token))
                .last("limit 1"));
        LocalDateTime now = LocalDateTime.now();
        if (entity == null
                || entity.getStatus() == null
                || entity.getStatus() != 1
                || !SUITE_HISTORY.equals(entity.getShareType())
                || (entity.getExpiresAt() != null && entity.getExpiresAt().isBefore(now))) {
            throw new NotFoundException("API report share not found");
        }
        return entity;
    }

    private String renderHtml(ApiExecutionSuiteRunHistoryEntity history, ApiReportShareEntity share, LocalDateTime accessTime) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(history.getWorkspaceId());
        List<ApiRunStepResultResponse> steps = ApiAutomationJsonSupport.readList(
                history.getDetailJson(),
                new TypeReference<>() {
                },
                List.of()
        );
        List<ApiExecutionSuiteRunItemSnapshot> snapshots = ApiAutomationJsonSupport.readList(
                history.getItemSnapshotJson(),
                new TypeReference<>() {
                },
                List.of()
        );
        List<ReportGroup> groups = buildGroups(snapshots, steps);
        String result = normalizeResult(history.getResult());
        StringBuilder html = new StringBuilder(65536);
        html.append("""
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>接口自动化测试报告</title>
                <style>
                :root { --bg:#f4f6fa; --surface:#fff; --surface-soft:#fafbff; --muted-surface:#fafafa; --border:#e5e6eb; --border-soft:#f2f3f5; --text:#1d2129; --muted:#4e5969; --subtle:#86909c; --primary:#165dff; --primary-hover:#0e4fe8; --primary-soft:#e8f3ff; --success:#00b42a; --success-soft:#e8ffea; --danger:#f53f3f; --danger-soft:#ffe8e8; --warning:#ff7d00; --warning-soft:#fff3e8; --info:#4e5969; --code:#0f172a; --code-text:#dbeafe; --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --shadow:0 1px 4px rgba(0,0,0,.04); --shadow-hover:0 4px 16px rgba(22,93,255,.08); }
                * { box-sizing:border-box; }
                html { background:var(--bg); font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
                body { margin:0; min-height:100vh; padding:20px; background:var(--bg); color:var(--text); font-family:Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; font-size:13px; line-height:1.55; }
                .report { max-width:none; margin:0 auto; }
                .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:18px 20px; border:1px solid var(--border); border-radius:var(--radius-lg); background:var(--surface); box-shadow:var(--shadow); margin-bottom:16px; }
                h1 { margin:0; font-size:20px; line-height:1.35; font-weight:650; color:var(--text); }
                .meta { color:var(--muted); line-height:1.8; margin-top:6px; }
                .actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; align-items:center; }
                button { height:32px; border:1px solid var(--border); background:var(--surface); border-radius:var(--radius-sm); padding:0 14px; color:var(--text); cursor:pointer; font:inherit; font-weight:500; transition:color .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
                button:hover { color:var(--primary); border-color:#a9c8ff; background:var(--surface-soft); }
                button:focus-visible, input:focus-visible { outline:0; box-shadow:0 0 0 3px rgba(22,93,255,.18); border-color:var(--primary); }
                .theme-toggle { display:inline-flex; align-items:center; gap:8px; border:1px solid transparent; background:transparent; color:var(--muted); padding:0 4px; }
                .theme-toggle:hover { color:var(--primary); background:transparent; border-color:transparent; }
                .theme-switch { position:relative; width:38px; height:20px; border-radius:999px; background:#c9cdd4; transition:background .18s ease; }
                .theme-switch::after { content:''; position:absolute; width:16px; height:16px; top:2px; left:2px; border-radius:50%; background:#fff; transition:transform .18s ease; }
                .theme-toggle.is-on .theme-switch { background:var(--primary); }
                .theme-toggle.is-on .theme-switch::after { transform:translateX(18px); }
                .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:12px; line-height:18px; white-space:nowrap; font-weight:500; }
                .badge.success { color:var(--success); background:var(--success-soft); }
                .badge.failed { color:var(--danger); background:var(--danger-soft); }
                .badge.skipped { color:var(--info); background:#f2f3f5; }
                .summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
                .card { padding:14px 16px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface); box-shadow:var(--shadow); text-align:left; }
                .card span { color:var(--muted); font-size:13px; font-weight:500; }
                .card strong { display:block; margin-top:8px; font-size:26px; line-height:1.15; font-weight:650; letter-spacing:0; }
                .card strong.total { color:var(--primary); }
                .card strong.success { color:var(--success); }
                .card strong.failed { color:var(--danger); }
                .card strong.skipped { color:var(--subtle); }
                .card strong.time { color:var(--warning); }
                .toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface); box-shadow:var(--shadow); margin-bottom:12px; }
                .toolbar input { width:280px; max-width:100%; height:32px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:0 12px; background:#fff; color:var(--text); font:inherit; }
                .filter-button { position:relative; border:0; background:transparent; color:var(--muted); padding:0 8px 0 22px; }
                .filter-button::before { content:''; position:absolute; left:2px; top:50%; width:12px; height:12px; border-radius:50%; border:1px solid #c9cdd4; transform:translateY(-50%); background:var(--surface); }
                .filter-button.is-active { color:var(--primary); }
                .filter-button.is-active::before { border-color:var(--primary); box-shadow:inset 0 0 0 3px var(--surface); background:var(--primary); }
                .group { border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface); box-shadow:var(--shadow); margin-bottom:10px; overflow:hidden; }
                .group:hover { box-shadow:var(--shadow-hover); }
                .group summary { list-style:none; cursor:pointer; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; background:var(--muted-surface); border-bottom:1px solid transparent; }
                .group[open] summary { border-bottom-color:var(--border-soft); }
                .group summary:hover { background:var(--primary-soft); }
                .group summary::-webkit-details-marker { display:none; }
                .group-title { display:flex; align-items:center; gap:8px; min-width:0; }
                .group-title strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:650; color:var(--text); }
                .group-meta { color:var(--subtle); white-space:nowrap; }
                .step { padding:14px 16px; border-top:1px solid var(--border-soft); }
                .step:first-of-type { border-top:0; }
                .step.is-scenario-group { margin:10px 14px 0; border:1px solid var(--primary-soft); border-radius:var(--radius-sm); background:var(--surface-soft); }
                .step-head { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:10px; }
                .step-name { font-weight:650; color:var(--text); }
                .step-kind { display:inline-flex; align-items:center; margin-right:8px; padding:1px 6px; border-radius:var(--radius-sm); background:var(--primary-soft); color:var(--primary); font-size:11px; font-weight:500; }
                .method { color:#fff; background:#4e5969; border-radius:var(--radius-sm); padding:1px 6px; margin-right:6px; font-size:11px; font-weight:650; }
                .url { color:var(--muted); word-break:break-all; }
                .detail-stack { display:flex; flex-direction:column; gap:12px; }
                .block h4, .log h4 { margin:8px 0 6px; font-size:13px; font-weight:650; color:var(--muted); }
                .response-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; color:var(--muted); }
                .response-line strong { color:var(--text); }
                pre { margin:0; padding:12px; border-radius:var(--radius-sm); background:var(--code); color:var(--code-text); overflow:auto; max-height:360px; font-family:"JetBrains Mono", "SFMono-Regular", Consolas, monospace; font-size:12px; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
                table { width:100%; border-collapse:collapse; margin-top:8px; background:#fff; }
                th, td { border:1px solid var(--border-soft); padding:8px 10px; text-align:left; vertical-align:top; }
                th { background:var(--muted-surface); color:var(--muted); font-weight:650; }
                .footer { text-align:center; color:var(--subtle); margin:24px 0 4px; font-size:12px; }
                body.dark { --bg:#0f172a; --surface:#111827; --surface-soft:#162033; --muted-surface:#1f2937; --border:#263449; --border-soft:#223047; --text:#e5e7eb; --muted:#cbd5e1; --subtle:#94a3b8; --primary:#6aa6ff; --primary-hover:#8dbbff; --primary-soft:#132b4d; --success:#34d399; --success-soft:#0f2f25; --danger:#fb7185; --danger-soft:#3a1720; --warning:#f59e0b; --warning-soft:#3b2608; --info:#cbd5e1; --code:#020617; --code-text:#dbeafe; --shadow:0 1px 4px rgba(0,0,0,.24); --shadow-hover:0 8px 24px rgba(0,0,0,.28); }
                body.dark table { background:var(--surface); }
                body.dark button { background:var(--surface); color:var(--text); border-color:var(--border); }
                body.dark button:hover { background:var(--surface-soft); color:var(--primary); border-color:#31527c; }
                body.dark .toolbar input { background:var(--surface); color:var(--text); border-color:var(--border); }
                body.dark .filter-button, body.dark .theme-toggle { background:transparent; color:var(--muted); border-color:transparent; }
                body.dark .filter-button.is-active, body.dark .theme-toggle.is-on { color:var(--primary); }
                body.dark .step.is-scenario-group { background:var(--surface-soft); border-color:#31527c; }
                body.dark .step-kind { background:var(--primary-soft); color:var(--primary); }
                @media (max-width: 900px) { body { padding:12px; } .header { flex-direction:column; } .summary { grid-template-columns:repeat(2,minmax(0,1fr)); } }
                </style>
                </head>
                <body class="light">
                <main class="report">
                """);
        html.append("<section class=\"header\"><div><h1>接口自动化套件测试报告</h1><div class=\"meta\">")
                .append("执行名称：").append(escape(history.getSuiteName()))
                .append("｜执行人：").append(escape(history.getOperatorName()))
                .append("｜执行时间：").append(formatTime(history.getCreatedAt()))
                .append("｜工作空间：").append(escape(workspace.getWorkspaceName()))
                .append("</div><div class=\"meta\">结果：").append(resultBadge(result))
                .append("｜报告有效期：").append(formatTime(share.getExpiresAt()))
                .append("</div></div><div class=\"actions\"><button id=\"themeToggle\" class=\"theme-toggle\" onclick=\"toggleDark()\" type=\"button\"><span class=\"theme-switch\"></span><span id=\"themeLabel\">浅色模式</span></button><button onclick=\"window.print()\">导出离线报告</button></div></section>");
        html.append("<section class=\"summary\">")
                .append(statCard("总步骤数", history.getTotalCount(), "total"))
                .append(statCard("成功步骤", history.getSuccessCount(), "success"))
                .append(statCard("失败步骤", history.getFailedCount(), "failed"))
                .append(statCard("跳过步骤", history.getSkippedCount(), "skipped"))
                .append(statCard("总耗时(ms)", history.getDurationMs(), "time"))
                .append("</section>");
        if (blankToNull(history.getFailureSummary()) != null) {
            html.append("<section class=\"toolbar\"><span class=\"badge failed\">失败摘要</span><span>")
                    .append(escape(history.getFailureSummary()))
                    .append("</span></section>");
        }
        html.append("""
                <section class="toolbar">
                    <span>结果筛选：</span>
                    <button class="filter-button is-active" data-filter="all" onclick="filterResult('all')">全部</button>
                    <button class="filter-button" data-filter="success" onclick="filterResult('success')">仅成功</button>
                    <button class="filter-button" data-filter="failed" onclick="filterResult('failed')">仅失败</button>
                    <input id="searchBox" placeholder="搜索步骤名称 / URL" oninput="filterText(this.value)">
                    <button onclick="setAllOpen(true)">全部展开</button>
                    <button onclick="setAllOpen(false)">全部折叠</button>
                </section>
                """);
        for (ReportGroup group : groups) {
            appendGroup(html, group);
        }
        html.append("<div class=\"footer\">自动化测试平台接口 HTML 报告 · 访问时间：")
                .append(formatTime(accessTime))
                .append("</div></main>");
        html.append("""
                <script>
                function toggleDark(){
                  const isDark = document.body.classList.toggle('dark');
                  document.body.classList.toggle('light', !isDark);
                  const toggle = document.getElementById('themeToggle');
                  const label = document.getElementById('themeLabel');
                  if (toggle) toggle.classList.toggle('is-on', isDark);
                  if (label) label.textContent = isDark ? '深色模式' : '浅色模式';
                }
                function setAllOpen(open){ document.querySelectorAll('details.group').forEach(item => item.open = open); }
                function filterResult(result){
                  document.querySelectorAll('.filter-button').forEach(button => button.classList.toggle('is-active', button.dataset.filter === result));
                  document.querySelectorAll('.step').forEach(item => { item.style.display = (result === 'all' || item.dataset.result === result) ? '' : 'none'; });
                  syncGroups();
                }
                function filterText(text){
                  const keyword = (text || '').trim().toLowerCase();
                  document.querySelectorAll('.step').forEach(item => { item.style.display = !keyword || item.dataset.search.includes(keyword) ? '' : 'none'; });
                  syncGroups();
                }
                function syncGroups(){
                  document.querySelectorAll('details.group').forEach(group => {
                    const visible = Array.from(group.querySelectorAll('.step')).some(item => item.style.display !== 'none');
                    group.style.display = visible ? '' : 'none';
                  });
                }
                </script>
                </body></html>
                """);
        return html.toString();
    }

    private List<ReportGroup> buildGroups(List<ApiExecutionSuiteRunItemSnapshot> snapshots, List<ApiRunStepResultResponse> steps) {
        Map<Long, List<ApiRunStepResultResponse>> stepsBySuiteItem = steps.stream()
                .filter(step -> step.suiteItemId() != null)
                .collect(Collectors.groupingBy(ApiRunStepResultResponse::suiteItemId, LinkedHashMap::new, Collectors.toList()));
        List<ReportGroup> groups = new ArrayList<>();
        snapshots.stream()
                .sorted(Comparator.comparing(ApiExecutionSuiteRunItemSnapshot::sortOrder, Comparator.nullsLast(Integer::compareTo)))
                .forEach(snapshot -> groups.add(new ReportGroup(
                        snapshot.itemName(),
                        normalizeResult(snapshot.result()),
                        snapshot.durationMs(),
                        stepsBySuiteItem.getOrDefault(snapshot.suiteItemId(), List.of())
                )));
        List<ApiRunStepResultResponse> ungrouped = steps.stream()
                .filter(step -> step.suiteItemId() == null || snapshots.stream().noneMatch(snapshot -> Objects.equals(snapshot.suiteItemId(), step.suiteItemId())))
                .toList();
        if (!ungrouped.isEmpty() || groups.isEmpty()) {
            groups.add(new ReportGroup(
                    "未分组步骤",
                    normalizeResult(ungrouped.stream().allMatch(ApiRunStepResultResponse::success) ? "SUCCESS" : "FAILED"),
                    sumDuration(ungrouped),
                    ungrouped
            ));
        }
        return groups;
    }

    private void appendGroup(StringBuilder html, ReportGroup group) {
        html.append("<details class=\"group\"><summary><div class=\"group-title\"><strong>")
                .append(escape(group.name()))
                .append("</strong>")
                .append(resultBadge(group.result()))
                .append("</div><span class=\"group-meta\">步骤 ")
                .append(group.steps().size())
                .append("｜耗时：")
                .append(defaultNumber(group.durationMs()))
                .append("ms</span></summary>");
        for (ApiRunStepResultResponse step : group.steps()) {
            appendStep(html, step);
        }
        if (group.steps().isEmpty()) {
            html.append("<div class=\"step\"><span class=\"badge skipped\">无步骤明细</span></div>");
        }
        html.append("</details>");
    }

    private void appendStep(StringBuilder html, ApiRunStepResultResponse step) {
        if (isScenarioGroupStep(step)) {
            appendScenarioGroupStep(html, step);
            return;
        }
        ApiRequestSnapshot request = step.request();
        ApiResponseSnapshot response = step.response();
        String result = step.success() ? "success" : "failed";
        String method = request == null ? "-" : blankToFallback(request.method(), "-");
        String url = request == null ? "-" : blankToFallback(request.url(), "-");
        String searchText = (blankToFallback(step.stepName(), "") + " " + method + " " + url).toLowerCase(Locale.ROOT);
        html.append("<article class=\"step\" data-result=\"").append(result).append("\" data-search=\"")
                .append(escapeAttribute(searchText)).append("\"")
                .append(stepIndentStyle(step))
                .append(">");
        html.append("<div class=\"step-head\"><div><span class=\"step-name\">")
                .append(escape(step.stepName()))
                .append("</span><div><span class=\"method\">")
                .append(escape(method))
                .append("</span> <span class=\"url\">")
                .append(escape(url))
                .append("</span></div></div><div>")
                .append(resultBadge(result))
                .append(" <span class=\"group-meta\">")
                .append(defaultNumber(step.durationMs()))
                .append("ms</span></div></div>");
        html.append("<div class=\"detail-stack\">")
                .append(block("请求 Headers", prettyMap(request == null ? null : request.headers())))
                .append(block("请求 Body", requestBody(request)))
                .append(responseInfo(response))
                .append(block("响应 Body", responseBody(response)))
                .append("</div>");
        appendAssertions(html, step.assertionResults());
        appendProcessors(html, step);
        if (blankToNull(step.errorMessage()) != null) {
            html.append("<div class=\"log\"><h4>错误信息</h4><pre>").append(escape(maskSensitive(step.errorMessage()))).append("</pre></div>");
        }
        html.append("</article>");
    }

    private void appendScenarioGroupStep(StringBuilder html, ApiRunStepResultResponse step) {
        String result = step.success() ? "success" : "failed";
        String searchText = blankToFallback(step.stepName(), "").toLowerCase(Locale.ROOT);
        html.append("<article class=\"step is-scenario-group\" data-result=\"").append(result).append("\" data-search=\"")
                .append(escapeAttribute(searchText)).append("\"")
                .append(stepIndentStyle(step))
                .append(">");
        html.append("<div class=\"step-head\"><div><span class=\"step-kind\">引用场景</span><span class=\"step-name\">")
                .append(escape(step.stepName()))
                .append("</span><div class=\"url\">下面为该引用场景实际执行的接口步骤</div></div><div>")
                .append(resultBadge(result))
                .append(" <span class=\"group-meta\">")
                .append(defaultNumber(step.durationMs()))
                .append("ms</span></div></div>");
        if (blankToNull(step.errorMessage()) != null) {
            html.append("<div class=\"log\"><h4>错误信息</h4><pre>").append(escape(maskSensitive(step.errorMessage()))).append("</pre></div>");
        }
        html.append("</article>");
    }

    private void appendAssertions(StringBuilder html, List<ApiAssertionResult> assertions) {
        html.append("<h4>断言校验</h4><table><thead><tr><th>断言名称</th><th>字段</th><th>预期值</th><th>实际值</th><th>结果</th><th>信息</th></tr></thead><tbody>");
        List<ApiAssertionResult> safeAssertions = assertions == null ? List.of() : assertions;
        if (safeAssertions.isEmpty()) {
            html.append("<tr><td colspan=\"6\">无断言结果</td></tr>");
        }
        for (ApiAssertionResult assertion : safeAssertions) {
            html.append("<tr><td>").append(escape(blankToFallback(assertion.name(), assertion.type())))
                    .append("</td><td>").append(escape(assertion.subject()))
                    .append("</td><td>").append(escape(maskSensitive(assertion.expectedValue())))
                    .append("</td><td>").append(escape(maskSensitive(assertion.actualValue())))
                    .append("</td><td>").append(resultBadge(assertion.success() ? "success" : "failed"))
                    .append("</td><td>").append(escape(assertion.message()))
                    .append("</td></tr>");
        }
        html.append("</tbody></table>");
    }

    private void appendProcessors(StringBuilder html, ApiRunStepResultResponse step) {
        List<String> logs = new ArrayList<>();
        if (step.extractionResults() != null) {
            step.extractionResults().forEach(item -> logs.add((item.success() ? "[提取成功] " : "[提取失败] ")
                    + blankToFallback(item.name(), "-") + " = " + maskSensitive(item.value()) + " " + blankToFallback(item.message(), "")));
        }
        if (step.processorResults() != null) {
            step.processorResults().forEach(item -> {
                logs.add((item.success() ? "[处理成功] " : "[处理失败] ")
                        + blankToFallback(item.stage(), "-") + " / " + blankToFallback(item.name(), "-") + " " + blankToFallback(item.message(), ""));
                if (item.logs() != null) {
                    logs.addAll(item.logs());
                }
            });
        }
        if (!logs.isEmpty()) {
            html.append("<div class=\"log\"><h4>执行日志</h4><pre>")
                    .append(escape(maskSensitive(String.join("\n", logs))))
                    .append("</pre></div>");
        }
    }

    private String block(String title, String content) {
        return "<div class=\"block\"><h4>" + escape(title) + "</h4><pre>" + escape(content) + "</pre></div>";
    }

    private String prettyMap(Map<String, String> value) {
        if (value == null || value.isEmpty()) {
            return "{}";
        }
        Map<String, String> masked = new LinkedHashMap<>();
        value.forEach((key, current) -> masked.put(key, isSensitiveKey(key) ? "******" : maskSensitive(current)));
        return prettyJson(masked);
    }

    private String requestBody(ApiRequestSnapshot request) {
        if (request == null) {
            return "{}";
        }
        if (request.body() != null && !request.body().isBlank()) {
            return prettyJsonString(maskSensitive(request.body()));
        }
        if (request.bodyFormItems() != null && !request.bodyFormItems().isEmpty()) {
            return prettyJson(request.bodyFormItems());
        }
        return "{}";
    }

    private String responseInfo(ApiResponseSnapshot response) {
        if (response == null) {
            return "<div class=\"block\"><h4>响应信息</h4><div class=\"response-line\"><span>状态码：<strong>-</strong></span></div></div>";
        }
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"block\"><h4>响应信息</h4><div class=\"response-line\"><span>状态码：<strong>")
                .append(escape(response.statusCode() == null ? "-" : String.valueOf(response.statusCode())))
                .append("</strong></span>");
        if (blankToNull(response.contentType()) != null) {
            html.append("<span>类型：").append(escape(response.contentType())).append("</span>");
        }
        html.append("</div></div>");
        return html.toString();
    }

    private String responseBody(ApiResponseSnapshot response) {
        if (response == null || response.body() == null) {
            return "{}";
        }
        return prettyJsonString(maskSensitive(response.body()));
    }

    private String prettyJson(Object value) {
        try {
            return limitBlock(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(sanitizeForReport(value)));
        } catch (JsonProcessingException ignored) {
            return limitBlock(String.valueOf(value));
        }
    }

    private String prettyJsonString(String value) {
        String text = blankToFallback(value, "{}");
        try {
            Object json = objectMapper.readValue(text, Object.class);
            return prettyJson(json);
        } catch (Exception ignored) {
            return limitBlock(text);
        }
    }

    private Object sanitizeForReport(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sanitized = new LinkedHashMap<>();
            map.forEach((key, current) -> {
                String textKey = key == null ? "" : String.valueOf(key);
                sanitized.put(textKey, isSensitiveKey(textKey) ? "******" : sanitizeForReport(current));
            });
            return sanitized;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::sanitizeForReport).toList();
        }
        if (value instanceof String text) {
            return maskSensitive(text);
        }
        return value;
    }

    private String resultBadge(String result) {
        String normalized = normalizeResult(result);
        String label = switch (normalized) {
            case "success" -> "成功";
            case "failed" -> "失败";
            default -> "跳过";
        };
        return "<span class=\"badge " + normalized + "\">" + label + "</span>";
    }

    private String statCard(String label, Number value, String type) {
        return "<div class=\"card\"><span>" + escape(label) + "</span><strong class=\"" + escapeAttribute(type) + "\">"
                + defaultNumber(value) + "</strong></div>";
    }

    private String normalizeResult(String value) {
        String normalized = blankToFallback(value, "SKIPPED").toUpperCase(Locale.ROOT);
        if ("SUCCESS".equals(normalized) || "PASS".equals(normalized) || "PASSED".equals(normalized)) {
            return "success";
        }
        if ("FAILED".equals(normalized) || "FAIL".equals(normalized) || "ERROR".equals(normalized)) {
            return "failed";
        }
        return "skipped";
    }

    private String maskSensitive(String value) {
        if (value == null) {
            return "";
        }
        return JSON_SENSITIVE_FIELD_PATTERN.matcher(value).replaceAll("$1******$3");
    }

    private boolean isSensitiveKey(String key) {
        return key != null && SENSITIVE_KEY_PATTERN.matcher(key).find();
    }

    private String limitBlock(String value) {
        String text = value == null ? "" : value;
        if (text.length() <= MAX_BLOCK_LENGTH) {
            return text;
        }
        return text.substring(0, MAX_BLOCK_LENGTH) + "\n... 内容过长，已截断 ...";
    }

    private long sumDuration(List<ApiRunStepResultResponse> steps) {
        return steps.stream()
                .map(ApiRunStepResultResponse::durationMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? "-" : value.format(DATE_TIME_FORMATTER);
    }

    private String defaultNumber(Number value) {
        return value == null ? "0" : String.valueOf(value);
    }

    private boolean isScenarioGroupStep(ApiRunStepResultResponse step) {
        return step != null && "SCENARIO_GROUP".equalsIgnoreCase(blankToFallback(step.stepKind(), ""));
    }

    private String stepIndentStyle(ApiRunStepResultResponse step) {
        int depth = step == null || step.depth() == null ? 0 : Math.max(0, step.depth());
        if (depth == 0) {
            return "";
        }
        return " style=\"margin-left:" + Math.min(depth * 18, 72) + "px\"";
    }

    private String blankToFallback(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? fallback : normalized;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String escapeAttribute(String value) {
        return escape(value).replace("\n", " ").replace("\r", " ");
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return "api_share_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private record ReportGroup(
            String name,
            String result,
            Long durationMs,
            List<ApiRunStepResultResponse> steps
    ) {
    }
}
