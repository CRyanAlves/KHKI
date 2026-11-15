package br.com.khki.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

@Service
public class SessionAuthenticationService {

  private final SessionPolicy sessionPolicy;
  private final SecurityContextRepository securityContextRepository;

  public SessionAuthenticationService(SessionPolicy sessionPolicy, SecurityContextRepository securityContextRepository) {
    this.sessionPolicy = sessionPolicy;
    this.securityContextRepository = securityContextRepository;
  }

  public void start(Authentication authentication, boolean rememberMe, HttpServletRequest request, HttpServletResponse response) {
    if (request.getSession(false) != null) request.changeSessionId();
    sessionPolicy.start(request.getSession(), rememberMe);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, request, response);
  }
}
