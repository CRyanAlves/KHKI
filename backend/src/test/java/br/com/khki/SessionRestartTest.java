package br.com.khki;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;

class SessionRestartTest {
  @TempDir Path directory;

  private ServletWebServerApplicationContext start() {
    return (ServletWebServerApplicationContext) new SpringApplicationBuilder(KhkiApplication.class).run("--server.address=127.0.0.1", "--server.port=0", "--spring.datasource.url=jdbc:h2:file:" + directory.resolve("sessions").toString().replace('\\', '/') + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "--spring.datasource.username=sa", "--spring.datasource.password=", "--khki.admin-email=restart@khki.test", "--khki.admin-password=Restart-test-password-123", "--khki.demo=false", "--server.servlet.session.cookie.secure=false");
  }

  private URI address(ServletWebServerApplicationContext context, String path) {
    return URI.create("http://127.0.0.1:" + context.getWebServer().getPort() + "/api" + path);
  }

  @Test
  void sessionSurvivesApplicationRestartWithoutPasswordAndIsRevokedOnLogout() throws Exception {
    var cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    var client = HttpClient.newBuilder().cookieHandler(cookies).connectTimeout(Duration.ofSeconds(10)).build();
    var mapper = new ObjectMapper();
    try (var first = start()) {
      var csrf = client.send(HttpRequest.newBuilder(address(first, "/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
      String token = mapper.readTree(csrf.body()).get("token").asText();
      var login = client.send(HttpRequest.newBuilder(address(first, "/auth/login")).header("Content-Type", "application/json").header("X-XSRF-TOKEN", token).POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"restart@khki.test\",\"password\":\"Restart-test-password-123\",\"rememberMe\":true}")).build(), HttpResponse.BodyHandlers.ofString());
      assertThat(login.statusCode()).isEqualTo(200);
      assertThat(cookies.getCookieStore().getCookies()).anyMatch(cookie -> cookie.getName().equals("KHKI_SESSION") && cookie.getMaxAge() > 0 && cookie.isHttpOnly());
    }
    try (var restarted = start()) {
      var account = client.send(HttpRequest.newBuilder(address(restarted, "/auth/me")).GET().build(), HttpResponse.BodyHandlers.ofString());
      assertThat(account.statusCode()).isEqualTo(200);
      assertThat(mapper.readTree(account.body()).get("role").asText()).isEqualTo("ADMIN");
      var csrf = client.send(HttpRequest.newBuilder(address(restarted, "/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
      var logout = client.send(HttpRequest.newBuilder(address(restarted, "/auth/logout")).header("X-XSRF-TOKEN", mapper.readTree(csrf.body()).get("token").asText()).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
      assertThat(logout.statusCode()).isEqualTo(204);
      var expired = client.send(HttpRequest.newBuilder(address(restarted, "/auth/me")).GET().build(), HttpResponse.BodyHandlers.ofString());
      assertThat(expired.statusCode()).isEqualTo(401);
    }
  }
}
