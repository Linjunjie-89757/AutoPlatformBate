package com.company.autoplatform.audit;

import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class OperationAuditClassifier {

    public OperationAuditDescriptor classify(String method, String path) {
        String normalizedMethod = method == null ? "UNKNOWN" : method.toUpperCase(Locale.ROOT);
        String normalizedPath = path == null || path.isBlank() ? "/" : path;
        String category = resolveCategory(normalizedPath);
        String resource = resolveResource(normalizedPath);
        String verb = resolveVerb(normalizedMethod, normalizedPath);
        String actionCode = category + "_" + normalizedMethod + "_" + resourceCode(resource);
        return new OperationAuditDescriptor(category, actionCode, verb + resource, normalizedPath);
    }

    private String resolveCategory(String path) {
        if (path.startsWith("/api/auth/")) return "AUTH";
        if (path.startsWith("/api/workspaces") || path.startsWith("/api/users")) return "WORKSPACE";
        if (path.startsWith("/api/settings") || path.startsWith("/api/ai-provider")) return "CONFIG";
        if (path.startsWith("/api/test-management/plans") && containsTestPlanAction(path)) return "EXECUTION";
        if (path.startsWith("/api/tasks") || path.startsWith("/api/reports")
                || path.startsWith("/api/report-shares") || containsExecutionAction(path)) return "EXECUTION";
        if (path.startsWith("/api/cases") || path.startsWith("/api/bugs")
                || path.startsWith("/api/test-management")
                || path.startsWith("/api/automation/api") || path.startsWith("/api/automation/web")
                || path.startsWith("/api/ai-case")) return "TEST_ASSET";
        return "OTHER";
    }

    private boolean containsExecutionAction(String path) {
        return path.contains("/run") || path.contains("/execute") || path.contains("/batches")
                || path.contains("/reports") || path.contains("/report-shares");
    }

    private boolean containsTestPlanAction(String path) {
        return path.contains("/start") || path.contains("/block") || path.contains("/resume")
                || path.contains("/complete") || path.contains("/cancel") || path.contains("/results")
                || path.contains("/report");
    }

    private String resolveResource(String path) {
        if (path.equals("/api/auth/login")) return "系统登录";
        if (path.equals("/api/auth/logout")) return "系统登录态";
        if (path.matches("/api/workspaces/[^/]+/members(?:/.*)?")) return "工作区成员";
        if (path.startsWith("/api/workspaces")) return "工作区";
        if (path.startsWith("/api/users")) return "用户";
        if (path.startsWith("/api/bugs")) return "缺陷";
        if (path.startsWith("/api/test-management/versions")) return "测试版本";
        if (path.startsWith("/api/test-management/requirements")) return "测试需求";
        if (path.startsWith("/api/test-management/plans")) return "测试计划";
        if (path.startsWith("/api/cases")) return "用例";
        if (path.startsWith("/api/tasks")) return "任务";
        if (path.startsWith("/api/reports") || path.startsWith("/api/report-shares")) return "报告";
        if (path.startsWith("/api/settings/db-connections")) return "数据库配置";
        if (path.startsWith("/api/settings/envs")) return "环境配置";
        if (path.startsWith("/api/settings/params")) return "参数配置";
        if (path.startsWith("/api/settings/notifications/channels")) return "通知渠道";
        if (path.startsWith("/api/settings/notifications/rules")) return "通知规则";
        if (path.startsWith("/api/settings")) return "平台配置";
        if (path.contains("/execution-suites")) return "接口执行套件";
        if (path.contains("/scenarios")) return "接口场景";
        if (path.contains("/definitions")) return "接口定义";
        if (path.contains("/elements")) return "Web UI 元素";
        if (path.contains("/automation/web/cases")) return "Web UI 用例";
        if (path.contains("/automation/web/environments")) return "Web UI 环境";
        if (path.contains("/ci/tokens")) return "CI Token";
        if (path.startsWith("/api/ai-case")) return "AI 生成用例";
        return "业务资源";
    }

    private String resolveVerb(String method, String path) {
        if (path.equals("/api/auth/login")) return "登录";
        if (path.equals("/api/auth/logout")) return "退出";
        if (path.contains("/attachments") && "DELETE".equals(method)) return "删除";
        if (path.contains("/attachments")) return "上传";
        if (path.contains("/import")) return "导入";
        if (path.contains("/validate") || path.endsWith("/test")) return "验证";
        if (path.contains("/run") || path.contains("/execute") || path.contains("/debug")) return "执行";
        if (path.contains("/transition") || path.endsWith("/status")) return "变更状态";
        if (path.contains("/assign")) return "指派";
        if (path.contains("/move")) return "移动";
        if (path.contains("/review")) return "评审";
        if (path.contains("/regenerate") || path.contains("/rotate")) return "重新生成";
        if (path.contains("/reset-password")) return "重置密码";
        if ("DELETE".equals(method)) return "删除";
        if ("PUT".equals(method) || "PATCH".equals(method)) return "更新";
        if ("POST".equals(method)) return "创建";
        return "操作";
    }

    private String resourceCode(String resource) {
        return Integer.toUnsignedString(resource.hashCode(), 36).toUpperCase(Locale.ROOT);
    }
}
