package com.company.autoplatform.auth;

import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.stereotype.Service;

@Service
public class AuthenticatedSessionService {

    private final SessionRegistry sessionRegistry;

    public AuthenticatedSessionService(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    public void register(HttpSession session, Authentication authentication) {
        sessionRegistry.removeSessionInformation(session.getId());
        sessionRegistry.registerNewSession(session.getId(), authentication.getPrincipal());
    }

    public void remove(String sessionId) {
        sessionRegistry.removeSessionInformation(sessionId);
    }

    public boolean isExpired(String sessionId) {
        SessionInformation information = sessionRegistry.getSessionInformation(sessionId);
        return information != null && information.isExpired();
    }

    public void expireUserSessions(Long userId) {
        sessionRegistry.getAllPrincipals().stream()
                .filter(CurrentUserPrincipal.class::isInstance)
                .map(CurrentUserPrincipal.class::cast)
                .filter(principal -> principal.userId().equals(userId))
                .flatMap(principal -> sessionRegistry.getAllSessions(principal, false).stream())
                .forEach(SessionInformation::expireNow);
    }
}
