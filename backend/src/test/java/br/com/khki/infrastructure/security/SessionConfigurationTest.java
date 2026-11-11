package br.com.khki.infrastructure.security;

import br.com.khki.infrastructure.security.SessionConfiguration;
import br.com.khki.infrastructure.security.SessionPolicy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.session.web.http.CookieSerializer.CookieValue;

class SessionConfigurationTest {

  @Test
  void productionCookiesAreSecureHttpOnlySameSiteAndDoNotSetASharedDomain() {
    var policy = new SessionPolicy("30m", "14d", "12h");
    var serializer = new SessionConfiguration().cookieSerializer(policy, true);
    var request = new MockHttpServletRequest();
    policy.start(request.getSession(), true);
    var response = new MockHttpServletResponse();
    serializer.writeCookieValue(new CookieValue(request, response, "test-session-identifier"));
    assertThat(response.getHeader("Set-Cookie")).contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=").doesNotContain("Domain=");
    var logout = new MockHttpServletResponse();
    var expired = new CookieValue(request, logout, "");
    expired.setCookieMaxAge(0);
    serializer.writeCookieValue(expired);
    assertThat(logout.getHeader("Set-Cookie")).contains("Max-Age=0");
  }

  @Test
  void sessionConfigurationRejectsUnlimitedOrExcessiveDurations() {
    assertThatThrownBy(() -> new SessionPolicy("0s", "14d", "12h")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new SessionPolicy("30m", "91d", "12h")).isInstanceOf(IllegalArgumentException.class);
  }
}
