package br.com.khki.infrastructure.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionConfiguration {

  @Bean
  CookieSerializer cookieSerializer(SessionPolicy policy, @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
    var serializer = new DefaultCookieSerializer() {
      @Override
      public void writeCookieValue(CookieValue value) {
        var session = value.getRequest().getSession(false);
        if (!value.getCookieValue().isEmpty() && session != null) value.setCookieMaxAge(policy.cookieMaxAge(session));
        super.writeCookieValue(value);
      }
    };
    serializer.setCookieName("KHKI_SESSION");
    serializer.setCookiePath("/");
    serializer.setUseHttpOnlyCookie(true);
    serializer.setUseSecureCookie(secure);
    serializer.setSameSite("Lax");
    return serializer;
  }
}
