package br.com.khki.security;

import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.stereotype.Component;

@Component
public class SessionPolicy {
  private static final String DEADLINE = SessionPolicy.class.getName() + ".deadline";
  private static final String REMEMBERED = SessionPolicy.class.getName() + ".remembered";
  private final Duration idle;
  private final Duration remembered;
  private final Duration maximum;

  public SessionPolicy(@Value("${server.servlet.session.timeout:30m}") String idle, @Value("${khki.session.remember-duration:14d}") String remembered, @Value("${khki.session.maximum-duration:12h}") String maximum) {
    this.idle = bounded(idle);
    this.remembered = bounded(remembered);
    this.maximum = bounded(maximum);
  }

  private static Duration bounded(String value) {
    Duration duration = DurationStyle.detectAndParse(value);
    if (duration.getSeconds() < 1 || duration.compareTo(Duration.ofDays(90)) > 0) throw new IllegalArgumentException("Prazo de sessão inválido.");
    return duration;
  }

  public void start(HttpSession session, boolean remember) {
    session.setMaxInactiveInterval(Math.toIntExact((remember ? remembered : idle).getSeconds()));
    session.setAttribute(DEADLINE, Instant.now().plus(remember ? remembered : maximum).toEpochMilli());
    session.setAttribute(REMEMBERED, remember);
  }

  public boolean expired(HttpSession session) {
    return session.getAttribute(DEADLINE) instanceof Long deadline && deadline <= System.currentTimeMillis();
  }

  public int cookieMaxAge(HttpSession session) {
    if (!Boolean.TRUE.equals(session.getAttribute(REMEMBERED))) return -1;
    if (!(session.getAttribute(DEADLINE) instanceof Long deadline)) return 0;
    return Math.toIntExact(Math.max(0, (deadline - System.currentTimeMillis()) / 1000));
  }
}
