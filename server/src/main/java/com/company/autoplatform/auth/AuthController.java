package com.company.autoplatform.auth;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.platformadmin.PlatformLoginFailureNotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AuthService authService;
    private final AuthenticatedSessionService authenticatedSessionService;
    private final PlatformLoginFailureNotificationService loginFailureNotificationService;

    public AuthController(
            AuthenticationManager authenticationManager,
            AuthService authService,
            AuthenticatedSessionService authenticatedSessionService,
            PlatformLoginFailureNotificationService loginFailureNotificationService
    ) {
        this.authenticationManager = authenticationManager;
        this.authService = authService;
        this.authenticatedSessionService = authenticatedSessionService;
        this.loginFailureNotificationService = loginFailureNotificationService;
    }

    @PostMapping("/login")
    public ApiResponse<CurrentUserResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
        } catch (AuthenticationException exception) {
            if (exception instanceof BadCredentialsException) {
                loginFailureNotificationService.recordFailure(request.username());
            }
            throw exception;
        }
        loginFailureNotificationService.clear(request.username());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        HttpSession session = httpServletRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        authenticatedSessionService.register(session, authentication);
        return ApiResponse.ok(authService.currentUser(), "Login successful");
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> currentUser() {
        return ApiResponse.ok(authService.currentUser());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest httpServletRequest) {
        HttpSession session = httpServletRequest.getSession(false);
        if (session != null) {
            authenticatedSessionService.remove(session.getId());
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ApiResponse.ok(null, "Logout successful");
    }
}
