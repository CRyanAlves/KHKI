package br.com.khki;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.khki.security.SessionPolicy;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = { "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE}", "spring.datasource.username=${TEST_DATABASE_USER:sa}", "spring.datasource.password=${TEST_DATABASE_PASSWORD:}", "khki.admin-email=admin@khki.test", "khki.admin-password=Test-admin-password-123", "khki.demo=false" })
@AutoConfigureMockMvc
class SessionPersistenceTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  DataSource database;

  @Autowired
  JdbcIndexedSessionRepository sessions;

  @Autowired
  br.com.khki.security.AbuseGuard abuse;

  @Autowired
  br.com.khki.repository.AppUserRepository users;

  @Autowired
  org.springframework.security.crypto.password.PasswordEncoder passwords;

  @BeforeEach
  void resetLimits() {
    ((java.util.Map<?, ?>) org.springframework.test.util.ReflectionTestUtils.getField(abuse, "buckets")).clear();
  }

  private MvcResult login(boolean remembered, Cookie... cookies) throws Exception {
    var request = post("/api/auth/login")
      .with(csrf())
      .contentType("application/json")
      .content("{\"email\":\"admin@khki.test\",\"password\":\"Test-admin-password-123\",\"rememberMe\":" + remembered + "}");
    if (cookies.length > 0) request.cookie(cookies);
    return mvc.perform(request).andExpect(status().isOk()).andReturn();
  }

  @SuppressWarnings("unchecked")
  private SessionRepository<Session> repository() {
    return (SessionRepository<Session>) (SessionRepository<?>) sessions;
  }

  private String sessionId(Cookie cookie) {
    return new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
  }

  @Test
  void normalLoginUsesProtectedBrowserSessionAndThirtyMinuteIdleTimeout() throws Exception {
    var result = login(false);
    var cookie = result.getResponse().getCookie("KHKI_SESSION");
    assertThat(cookie).isNotNull();
    assertThat(cookie.getMaxAge()).isEqualTo(-1);
    assertThat(cookie.isHttpOnly()).isTrue();
    assertThat(cookie.getPath()).isEqualTo("/");
    assertThat(result.getResponse().getHeaders("Set-Cookie")).anyMatch(value -> value.contains("KHKI_SESSION=") && value.contains("SameSite=Lax"));
    assertThat(((Session) sessions.findById(sessionId(cookie))).getMaxInactiveInterval().getSeconds()).isEqualTo(1800);
    mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());
  }

  @Test
  void rememberedSessionReloadsAuthenticationFromANewJdbcRepositoryAndLogoutRevokesIt() throws Exception {
    var result = login(true);
    var cookie = result.getResponse().getCookie("KHKI_SESSION");
    assertThat(cookie.getMaxAge()).isBetween(1209500, 1209600);
    var reloadedRepository = new JdbcIndexedSessionRepository(new JdbcTemplate(database), new TransactionTemplate(new DataSourceTransactionManager(database)));
    Session stored = reloadedRepository.findById(sessionId(cookie));
    assertThat(stored).isNotNull();
    SecurityContext context = stored.getAttribute("SPRING_SECURITY_CONTEXT");
    assertThat(context.getAuthentication().getName()).isEqualTo("admin@khki.test");
    assertThat(stored.getMaxInactiveInterval().getSeconds()).isEqualTo(1209600);
    mvc.perform(post("/api/auth/logout").cookie(cookie).with(csrf())).andExpect(status().isNoContent());
    assertThat(reloadedRepository.findById(sessionId(cookie))).isNull();
    mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
  }

  @Test
  void loginRotatesSessionIdAndCanDisableRemembering() throws Exception {
    var previous = login(true).getResponse().getCookie("KHKI_SESSION");
    var current = login(false, previous).getResponse().getCookie("KHKI_SESSION");
    assertThat(current.getValue()).isNotEqualTo(previous.getValue());
    assertThat(current.getMaxAge()).isEqualTo(-1);
    assertThat(sessions.findById(sessionId(previous))).isNull();
    mvc.perform(get("/api/auth/me").cookie(previous)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/me").cookie(current)).andExpect(status().isOk());
  }

  @Test
  void absoluteDeadlineAndIdleExpiryBothRejectOldCookies() throws Exception {
    var absoluteCookie = login(true).getResponse().getCookie("KHKI_SESSION");
    Session absolute = sessions.findById(sessionId(absoluteCookie));
    absolute.setAttribute(SessionPolicy.class.getName() + ".deadline", System.currentTimeMillis() - 1000);
    repository().save(absolute);
    mvc.perform(get("/api/auth/me").cookie(absoluteCookie)).andExpect(status().isUnauthorized());
    assertThat(sessions.findById(sessionId(absoluteCookie))).isNull();
    var idleCookie = login(false).getResponse().getCookie("KHKI_SESSION");
    Session idle = sessions.findById(sessionId(idleCookie));
    idle.setLastAccessedTime(java.time.Instant.now().minusSeconds(3600));
    repository().save(idle);
    mvc.perform(get("/api/auth/me").cookie(idleCookie)).andExpect(status().isUnauthorized());
  }

  @Test
  void sessionSupportsTheFullEmailLengthAcceptedByTheAccountContract() throws Exception {
    var account = new br.com.khki.domain.AppUser();
    account.setName("Conta com e-mail longo");
    account.setEmail("a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61));
    account.setPassword(passwords.encode("Test-user-password-123"));
    account.setRole("USER");
    users.save(account);
    try {
      var result = mvc
        .perform(
          post("/api/auth/login")
            .with(csrf())
            .contentType("application/json")
            .content("{\"email\":\"" + account.getEmail() + "\",\"password\":\"Test-user-password-123\"}")
        )
        .andExpect(status().isOk())
        .andReturn();
      mvc.perform(get("/api/auth/me").cookie(result.getResponse().getCookie("KHKI_SESSION"))).andExpect(status().isOk());
    } finally {
      users.delete(account);
    }
  }

  @Test
  void csrfAndCredentialValidationRemainRequired() throws Exception {
    mvc.perform(post("/api/auth/login").contentType("application/json").content("{}")).andExpect(status().isForbidden());
    mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"admin@khki.test\",\"password\":\"wrong\",\"rememberMe\":true}")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"invalid\",\"password\":\"wrong\"}")).andExpect(status().isBadRequest());
    mvc
      .perform(
        post("/api/auth/login")
          .with(csrf())
          .contentType("application/json")
          .content("{\"email\":\"admin@khki.test\",\"password\":\"" + "á".repeat(50) + "\"}")
      )
      .andExpect(status().isUnauthorized());
    var cookie = login(true).getResponse().getCookie("KHKI_SESSION");
    mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isForbidden());
  }
}
