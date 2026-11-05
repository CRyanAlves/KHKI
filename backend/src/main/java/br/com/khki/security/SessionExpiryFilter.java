package br.com.khki.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class SessionExpiryFilter extends OncePerRequestFilter {

  private final SessionPolicy policy;

  public SessionExpiryFilter(SessionPolicy policy) {
    this.policy = policy;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    var session = request.getSession(false);
    if (session != null && policy.expired(session)) {
      session.invalidate();
      SecurityContextHolder.clearContext();
    }
    chain.doFilter(request, response);
  }
}
