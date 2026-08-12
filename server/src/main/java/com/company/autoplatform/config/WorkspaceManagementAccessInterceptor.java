package com.company.autoplatform.config;

import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Component
public class WorkspaceManagementAccessInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    private final WorkspaceAccessSupport workspaceAccessSupport;

    public WorkspaceManagementAccessInterceptor(WorkspaceAccessSupport workspaceAccessSupport) {
        this.workspaceAccessSupport = workspaceAccessSupport;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (request.getRequestURI().startsWith("/api/settings/")
                && (HttpMethod.GET.matches(request.getMethod())
                || HttpMethod.HEAD.matches(request.getMethod())
                || HttpMethod.OPTIONS.matches(request.getMethod()))) {
            return true;
        }
        String workspaceCode = WorkspaceScope.normalize(request.getHeader(WorkspaceScope.HEADER));
        if (WorkspaceScope.isAll(workspaceCode)) {
            workspaceAccessSupport.requirePlatformAdmin();
        } else {
            workspaceAccessSupport.requireWorkspaceAdmin(workspaceCode);
        }
        return true;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns("/api/audit-logs/**");
    }
}
