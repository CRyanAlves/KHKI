package br.com.khki;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class StandaloneSchemaTest {
  @Test
  void startsAgainstSqlOnlySchemaWithHibernateValidationAndFlywayDisabled() throws Exception {
    String url = System.getenv("TEST_DATABASE_URL");
    assumeTrue(url != null && url.startsWith("jdbc:postgresql://127.0.0.1:"), "Requer PostgreSQL local isolado.");
    var source = new DriverManagerDataSource(url, System.getenv().getOrDefault("TEST_DATABASE_USER", "khki"), System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", ""));
    var jdbc = new JdbcTemplate(source);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'khki'", Integer.class)).isZero();
    Path script = Path.of("../database/schema.sql");
    if (!Files.exists(script)) script = Path.of("database/schema.sql");
    try {
      jdbc.execute(Files.readString(script));
      try (var application = (ServletWebServerApplicationContext) new SpringApplicationBuilder(KhkiApplication.class).run("--server.address=127.0.0.1", "--server.port=0", "--spring.datasource.url=" + url, "--spring.datasource.username=" + source.getUsername(), "--spring.datasource.password=" + source.getPassword(), "--spring.flyway.enabled=false", "--spring.jpa.properties.hibernate.default_schema=khki", "--spring.session.jdbc.table-name=khki.SPRING_SESSION", "--khki.admin-email=", "--khki.admin-password=", "--khki.demo=false")) {
        var response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + application.getWebServer().getPort() + "/api/bathrooms")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("[]");
      }
      assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_tables WHERE schemaname = 'khki' AND NOT rowsecurity", Integer.class)).isZero();
    } finally {
      jdbc.execute("DROP SCHEMA khki CASCADE");
    }
  }
}
