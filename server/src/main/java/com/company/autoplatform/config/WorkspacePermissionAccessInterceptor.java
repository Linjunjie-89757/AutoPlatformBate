package com.company.autoplatform.config;

import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspacePermissionCatalog;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Component
public class WorkspacePermissionAccessInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    private final WorkspaceAccessSupport workspaceAccessSupport;

    public WorkspacePermissionAccessInterceptor(WorkspaceAccessSupport workspaceAccessSupport) {
        this.workspaceAccessSupport = workspaceAccessSupport;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String uri = request.getRequestURI();
        if (uri.startsWith("/api/automation/web/ci/batches/run")) {
            return true;
        }

        String module = resolveModule(uri);
        String action = resolveAction(module, uri, request.getMethod());
        String permissionCode = module + "." + action;
        if (!WorkspacePermissionCatalog.contains(permissionCode)) {
            return true;
        }

        String workspaceCode = WorkspaceScope.normalize(request.getHeader(WorkspaceScope.HEADER));
        if (WorkspaceScope.isAll(workspaceCode)) {
            workspaceAccessSupport.requirePlatformAdmin();
        } else {
            workspaceAccessSupport.requirePermission(workspaceCode, permissionCode);
        }
        return true;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns(
                        "/api/cases/**",
                        "/api/test-management/**",
                        "/api/automation/api/**",
                        "/api/automation/web/**",
                        "/api/bugs/**",
                        "/api/tasks/**",
                        "/api/reports/**",
                        "/api/report-shares/**",
                        "/api/settings/**"
                )
                .order(20);
    }

    private String resolveModule(String uri) {
        if (uri.matches("^/api/(cases|reports)/[^/]+/bugs(?:/.*)?$")) {
            return "bugs";
        }
        if (uri.startsWith("/api/automation/api/")
                && (uri.contains("/environments") || uri.contains("/variable-sets"))) {
            return "config";
        }
        if (uri.startsWith("/api/automation/web/")
                && (uri.contains("/environments") || uri.contains("/variables"))) {
            return "config";
        }
        if (uri.startsWith("/api/automation/api/")) {
            return "api";
        }
        if (uri.startsWith("/api/test-management/")) {
            return "test_management";
        }
        if (uri.startsWith("/api/automation/web/")) {
            return "webui";
        }
        if (uri.startsWith("/api/bugs/")) {
            return "bugs";
        }
        if (uri.startsWith("/api/tasks/")) {
            return "tasks";
        }
        if (uri.startsWith("/api/reports/") || uri.startsWith("/api/report-shares/")) {
            return "reports";
        }
        if (uri.startsWith("/api/settings/")) {
            return "config";
        }
        return "cases";
    }

    private String resolveAction(String module, String uri, String method) {
        if (HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method)) {
            if (uri.contains("/export") || uri.endsWith("-export")
                    || ("test_management".equals(module) && uri.endsWith("/report/pdf"))) {
                return "export";
            }
            return "view";
        }
        if (HttpMethod.DELETE.matches(method)) {
            if ("test_management".equals(module) && uri.matches("^/api/test-management/plans/[^/]+/cases/[^/]+$")) {
                return "edit";
            }
            if ("test_management".equals(module)
                    && (uri.matches("^/api/test-management/plans/[^/]+/cases/[^/]+/evidence/[^/]+$")
                    || uri.matches("^/api/test-management/plans/[^/]+/cases/[^/]+/defects/[^/]+$"))) {
                return "execute";
            }
            if (uri.contains("/attachments/")
                    || uri.contains("/comments/")
                    || ("bugs".equals(module) && uri.matches("^/api/bugs/[^/]+/cases/[^/]+$"))) {
                return "edit";
            }
            if ("reports".equals(module) && uri.contains("share")) {
                return "share";
            }
            return "config".equals(module) ? "manage" : "delete";
        }
        if (HttpMethod.PUT.matches(method) || HttpMethod.PATCH.matches(method)) {
            return "config".equals(module) ? "manage" : "edit";
        }
        if (HttpMethod.POST.matches(method)) {
            if ("test_management".equals(module)) {
                if (uri.matches("^/api/test-management/plans/[^/]+/cases$")) {
                    return "edit";
                }
                if (uri.matches("^/api/test-management/plans/[^/]+/cases/[^/]+/(evidence|defects/link)$")) {
                    return "execute";
                }
                if (uri.matches("^/api/test-management/versions/[^/]+/transition$")) {
                    return "release";
                }
                if (uri.contains("/review") || uri.contains("/report/sign") || uri.contains("/report/revoke-signature")) {
                    return "review";
                }
                if (uri.endsWith("/start") || uri.endsWith("/block") || uri.endsWith("/resume")
                        || uri.endsWith("/complete") || uri.endsWith("/cancel") || uri.endsWith("/results")
                        || uri.endsWith("/report/generate") || uri.endsWith("/defects")) {
                    return "execute";
                }
            }
            if ("reports".equals(module) && uri.contains("share")) {
                return "share";
            }
            if ("bugs".equals(module) && (uri.endsWith("/assign") || uri.endsWith("/transition"))) {
                return "review";
            }
            if (uri.contains("/batch/delete")) {
                return "delete";
            }
            if (uri.contains("/batch/move")
                    || uri.contains("/batch/update")
                    || uri.contains("/attachments")
                    || uri.contains("/comments")
                    || uri.endsWith("/review")
                    || uri.endsWith("/ai-review")) {
                return "config".equals(module) ? "manage" : "edit";
            }
            if (uri.endsWith("/run")
                    || uri.contains("/debug-run")
                    || uri.endsWith("/execute")
                    || uri.endsWith("/rerun")
                    || ("tasks".equals(module) && uri.endsWith("/transition"))) {
                return "execute";
            }
            return "config".equals(module) ? "manage" : "create";
        }
        return "view";
    }
}
