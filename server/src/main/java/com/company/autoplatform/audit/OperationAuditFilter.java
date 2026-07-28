package com.company.autoplatform.audit;

import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class OperationAuditFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(OperationAuditFilter.class);
    private static final Set<String> AUDITED_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Pattern WORKSPACE_PATH = Pattern.compile("^/api/workspaces/([^/]+)(?:/.*)?$");

    private final OperationAuditClassifier classifier;
    private final OperationAuditLogService service;

    public OperationAuditFilter(OperationAuditClassifier classifier, OperationAuditLogService service) {
        this.classifier = classifier;
        this.service = service;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        String path = request.getRequestURI();
        if (!AUDITED_METHODS.contains(method) || !path.startsWith("/api/")) return true;
        return path.startsWith("/api/public/")
                || path.startsWith("/api/mock/")
                || path.startsWith("/api/local-runner/")
                || path.startsWith("/api/automation/web/ci/batches/run")
                || path.startsWith("/api/audit-logs");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startedAt = System.nanoTime();
        CurrentUserPrincipal operatorBefore = currentUserOrNull();
        int statusCode;
        try {
            filterChain.doFilter(request, response);
            statusCode = response.getStatus();
        } catch (ServletException | IOException | RuntimeException exception) {
            statusCode = response.getStatus() >= 400 ? response.getStatus() : 500;
            recordSafely(request, operatorBefore, statusCode, startedAt);
            throw exception;
        }
        CurrentUserPrincipal operator = operatorBefore != null ? operatorBefore : currentUserOrNull();
        recordSafely(request, operator, statusCode, startedAt);
    }

    private void recordSafely(
            HttpServletRequest request,
            CurrentUserPrincipal operator,
            int statusCode,
            long startedAt
    ) {
        try {
            OperationAuditDescriptor descriptor = classifier.classify(request.getMethod(), request.getRequestURI());
            service.record(
                    resolveWorkspaceCode(request),
                    operator,
                    descriptor,
                    request.getMethod().toUpperCase(Locale.ROOT),
                    resolveClientIp(request),
                    statusCode,
                    (System.nanoTime() - startedAt) / 1_000_000
            );
        } catch (RuntimeException auditException) {
            log.warn("Failed to persist operation audit log for {} {}", request.getMethod(), request.getRequestURI(), auditException);
        }
    }

    private CurrentUserPrincipal currentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return authentication.getPrincipal() instanceof CurrentUserPrincipal currentUser ? currentUser : null;
    }

    private String resolveWorkspaceCode(HttpServletRequest request) {
        Matcher matcher = WORKSPACE_PATH.matcher(request.getRequestURI());
        if (matcher.matches()) return matcher.group(1);
        String workspaceCode = request.getHeader(WorkspaceScope.HEADER);
        return workspaceCode == null || workspaceCode.isBlank() || WorkspaceScope.isAll(workspaceCode)
                ? null
                : workspaceCode.trim();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",", 2)[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        return realIp == null || realIp.isBlank() ? request.getRemoteAddr() : realIp.trim();
    }
}
