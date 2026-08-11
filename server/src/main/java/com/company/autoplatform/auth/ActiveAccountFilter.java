package com.company.autoplatform.auth;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class ActiveAccountFilter extends OncePerRequestFilter {

    private final UserMapper userMapper;
    private final AuthenticatedSessionService authenticatedSessionService;
    private final ObjectMapper objectMapper;

    public ActiveAccountFilter(
            UserMapper userMapper,
            AuthenticatedSessionService authenticatedSessionService,
            ObjectMapper objectMapper
    ) {
        this.userMapper = userMapper;
        this.authenticatedSessionService = authenticatedSessionService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CurrentUserPrincipal principal)) {
            filterChain.doFilter(request, response);
            return;
        }

        HttpSession session = request.getSession(false);
        UserEntity user = userMapper.selectById(principal.userId());
        boolean inactive = user == null || user.getStatus() == null || user.getStatus() != 1;
        boolean expired = session != null && authenticatedSessionService.isExpired(session.getId());
        if (!inactive && !expired) {
            filterChain.doFilter(request, response);
            return;
        }

        if (session != null) {
            authenticatedSessionService.remove(session.getId());
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String message = inactive && user != null
                ? "账号已停用，请联系管理员"
                : "登录状态已失效，请重新登录";
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.fail(message));
    }
}
