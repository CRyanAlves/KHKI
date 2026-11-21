package br.com.khki;

import static org.assertj.core.api.Assertions.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AuditTargetMigrationTest {
  @Test
  void derivesAuditTargetsFromForeignKeysWithoutLosingHistory() {
    String schema = "audit_migration_" + UUID.randomUUID().toString().replace("-", "");
    String url = System.getenv("TEST_DATABASE_URL");
    if (url == null) url = "jdbc:h2:mem:" + schema + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
    else url += (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
    var source = new DriverManagerDataSource(url, System.getenv().getOrDefault("TEST_DATABASE_USER", "sa"), System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", ""));
    Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").target("16").load().migrate();
    if (url.startsWith("jdbc:h2:")) source.setUrl(url + ";SCHEMA=" + schema);
    var jdbc = new JdbcTemplate(source);
    try {
      UUID author = UUID.randomUUID(), bathroom = UUID.randomUUID(), review = UUID.randomUUID(), bathroomAudit = UUID.randomUUID(), reviewAudit = UUID.randomUUID();
      Instant created = Instant.parse("2026-11-14T12:00:00Z");
      jdbc.update("INSERT INTO \"user\" (id,name,email,password,role) VALUES (?,?,?,?,?)", author, "Moderador", "moderador@khki.test", "unused", "ADMIN");
      jdbc.update("INSERT INTO bathrooms (id,author_id,status,created_at,name,address,category,latitude,longitude,access) VALUES (?,?,?,?,?,?,?,?,?,?)", bathroom, author, "APPROVED", Timestamp.from(created), "Biblioteca", "Rua de teste", "Biblioteca", -23.1, -47.2, "FREE");
      jdbc.update("INSERT INTO reviews (id,author_id,status,created_at,bathroom_id,cleanliness,structure) VALUES (?,?,?,?,?,?,?)", review, author, "APPROVED", Timestamp.from(created), bathroom, 4, 5);
      jdbc.update("INSERT INTO moderation_audit (id,target_type,target_id,moderator_id,decision,reason,created_at,bathroom_target_id) VALUES (?,?,?,?,?,?,?,?)", bathroomAudit, "BATHROOM", bathroom, author, "APPROVED", "Cadastro aprovado", Timestamp.from(created), bathroom);
      jdbc.update("INSERT INTO moderation_audit (id,target_type,target_id,moderator_id,decision,reason,created_at,review_target_id,duplicate_of_id) VALUES (?,?,?,?,?,?,?,?,?)", reviewAudit, "REVIEW", review, author, "APPROVED", "Avaliação aprovada", Timestamp.from(created), review, bathroom);
      var before = jdbc.queryForList("SELECT id,moderator_id,decision,reason,created_at,bathroom_target_id,review_target_id,duplicate_of_id FROM moderation_audit ORDER BY reason");
      Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
      assertThat(jdbc.queryForList("SELECT id,moderator_id,decision,reason,created_at,bathroom_target_id,review_target_id,duplicate_of_id FROM moderation_audit ORDER BY reason")).isEqualTo(before);
      assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'moderation_audit' AND column_name IN ('target_type','target_id')", Integer.class, schema)).isZero();
      assertThatThrownBy(() -> jdbc.update("UPDATE moderation_audit SET bathroom_target_id = NULL WHERE id = ?", bathroomAudit)).isInstanceOf(DataIntegrityViolationException.class);
      assertThatThrownBy(() -> jdbc.update("UPDATE moderation_audit SET review_target_id = ? WHERE id = ?", review, bathroomAudit)).isInstanceOf(DataIntegrityViolationException.class);
      assertThatThrownBy(() -> jdbc.update("UPDATE moderation_audit SET review_target_id = ? WHERE id = ?", UUID.randomUUID(), reviewAudit)).isInstanceOf(DataIntegrityViolationException.class);
      assertThat(jdbc.queryForObject("SELECT count(*) FROM moderation_audit", Integer.class)).isEqualTo(2);
    } finally {
      jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }
  }
}
