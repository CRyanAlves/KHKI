package br.com.khki.security;

import br.com.khki.api.ApiException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AbuseGuard extends OncePerRequestFilter {
    private record Bucket(long expires, int count) {}
    private final Map<String, Bucket> buckets = new HashMap<>();
    public synchronized void check(String key, int maximum, int seconds) {
        long now = Instant.now().getEpochSecond();
        buckets.entrySet().removeIf(entry -> entry.getValue().expires <= now);
        Bucket bucket = buckets.getOrDefault(key, new Bucket(now + seconds, 0));
        if (bucket.count >= maximum || buckets.size() >= 10000) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        buckets.put(key, new Bucket(bucket.expires, bucket.count + 1));
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        try {
            if (request.getMethod().equals("POST") && request.getRequestURI().startsWith("/api/")) {
                boolean credentials = request.getRequestURI().equals("/api/auth/login") || request.getRequestURI().equals("/api/auth/register");
                check((credentials ? "credentials:" : "write:") + request.getRemoteAddr(), credentials ? 20 : 60, 300);
            }
        } catch (ApiException exception) {
            response.setStatus(429); response.setHeader("Retry-After", "300"); response.setContentType("application/problem+json;charset=UTF-8"); response.getWriter().write("{\"status\":429,\"detail\":\"Muitas tentativas. Aguarde alguns minutos.\"}"); return;
        }
        chain.doFilter(request, response);
    }
}
