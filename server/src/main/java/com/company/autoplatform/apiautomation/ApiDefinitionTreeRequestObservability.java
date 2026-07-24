package com.company.autoplatform.apiautomation;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

@Component
public class ApiDefinitionTreeRequestObservability implements HandlerInterceptor, WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(ApiDefinitionTreeRequestObservability.class);
    private static final String STARTED_AT_ATTRIBUTE =
            ApiDefinitionTreeRequestObservability.class.getName() + ".startedAt";

    private final long slowRequestThresholdMs;

    public ApiDefinitionTreeRequestObservability(
            @Value("${app.api-directory.observability.slow-request-ms:500}") long slowRequestThresholdMs
    ) {
        this.slowRequestThresholdMs = Math.max(1L, slowRequestThresholdMs);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns(
                "/api/automation/api/definitions",
                "/api/automation/api/definition-modules",
                "/api/automation/api/definition-modules/children",
                "/api/automation/api/definition-tree/search"
        );
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(STARTED_AT_ATTRIBUTE, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception
    ) {
        Object startedAt = request.getAttribute(STARTED_AT_ATTRIBUTE);
        if (!(startedAt instanceof Long startedAtNanos)) {
            return;
        }

        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos);
        String workspaceCode = safeValue(request.getHeader("X-Workspace-Code"), "ALL");
        String requestContext = requestContext(request);
        int status = response.getStatus();

        if (exception != null || status >= 500) {
            log.error(
                    "API directory tree request failed: method={}, path={}, status={}, durationMs={}, workspace={}, context={}",
                    request.getMethod(), request.getRequestURI(), status, durationMs, workspaceCode, requestContext,
                    exception
            );
        } else if (status >= 400) {
            log.warn(
                    "API directory tree request rejected: method={}, path={}, status={}, durationMs={}, workspace={}, context={}",
                    request.getMethod(), request.getRequestURI(), status, durationMs, workspaceCode, requestContext
            );
        } else if (durationMs >= slowRequestThresholdMs) {
            log.warn(
                    "API directory tree request slow: method={}, path={}, status={}, durationMs={}, workspace={}, context={}",
                    request.getMethod(), request.getRequestURI(), status, durationMs, workspaceCode, requestContext
            );
        } else {
            log.debug(
                    "API directory tree request completed: method={}, path={}, status={}, durationMs={}, workspace={}, context={}",
                    request.getMethod(), request.getRequestURI(), status, durationMs, workspaceCode, requestContext
            );
        }
    }

    private String requestContext(HttpServletRequest request) {
        return "rootOnly=" + safeValue(request.getParameter("rootOnly"), "false")
                + ",moduleId=" + safeValue(request.getParameter("moduleId"), "-")
                + ",parentId=" + safeValue(request.getParameter("parentId"), "-")
                + ",pageNo=" + safeValue(request.getParameter("pageNo"), "-")
                + ",pageSize=" + safeValue(request.getParameter("pageSize"), "-")
                + ",keywordLength=" + safeLength(request.getParameter("keyword"));
    }

    private String safeValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private int safeLength(String value) {
        return value == null ? 0 : value.length();
    }
}
