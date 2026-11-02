package br.com.khki;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class PhotoAttachmentMigrationTest {

  @Test
  void migrationRecoversRegistrationPhotosWithoutReclassifyingStandaloneOrReviewPhotos() {
    String url = "jdbc:h2:mem:photo_migration_" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
    Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").target("6").load().migrate();
    var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));
    UUID owner = UUID.randomUUID(),
      outsider = UUID.randomUUID();
    for (UUID author : new UUID[] { owner, outsider }) jdbc.update("INSERT INTO app_users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)", author, "Teste", author + "@khki.test", "unused", "USER");
    Instant created = Instant.parse("2020-01-01T00:00:00Z");
    UUID approved = UUID.randomUUID(),
      pending = UUID.randomUUID(),
      unaudited = UUID.randomUUID();
    for (UUID id : new UUID[] { approved, pending, unaudited }) jdbc.update("INSERT INTO bathrooms (id, author_id, status, created_at, name, address, category, latitude, longitude, access, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, owner, id.equals(pending) ? "PENDING" : "APPROVED", Timestamp.from(created), "Local", "Endereço", "Teste", -23.5, -46.6, "FREE", "");
    jdbc.update("INSERT INTO moderation_audit (id, target_type, target_id, moderator_id, decision, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", UUID.randomUUID(), "BATHROOM", approved, owner, "APPROVED", "Aprovação", Timestamp.from(created.plusSeconds(60)));
    UUID review = UUID.randomUUID();
    jdbc.update("INSERT INTO reviews (id, author_id, status, created_at, bathroom_id, cleanliness, structure) VALUES (?, ?, ?, ?, ?, ?, ?)", review, owner, "PENDING", Timestamp.from(created), approved, 3, 3);
    UUID initial = UUID.randomUUID(),
      standalone = UUID.randomUUID(),
      linkedReview = UUID.randomUUID(),
      pendingInitial = UUID.randomUUID(),
      foreign = UUID.randomUUID(),
      unknownSeed = UUID.randomUUID();
    Object[][] rows = {
      { initial, owner, approved, null, created.plusSeconds(30) },
      { standalone, owner, approved, null, created.plusSeconds(90) },
      { linkedReview, owner, approved, review, created.plusSeconds(30) },
      { pendingInitial, owner, pending, null, created.plusSeconds(30) },
      { foreign, outsider, pending, null, created.plusSeconds(30) },
      { unknownSeed, owner, unaudited, null, created.plusSeconds(30) }
    };
    for (Object[] row : rows) jdbc.update("INSERT INTO photos (id, author_id, status, created_at, bathroom_id, review_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)", row[0], row[1], "PENDING", Timestamp.from((Instant) row[4]), row[2], row[3], new byte[] { 1 });
    Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load().migrate();
    for (UUID id : new UUID[] { initial, pendingInitial }) assertThat(jdbc.queryForObject("SELECT registration_attachment FROM photos WHERE id = ?", Boolean.class, id)).isTrue();
    for (UUID id : new UUID[] { standalone, linkedReview, foreign, unknownSeed }) assertThat(jdbc.queryForObject("SELECT registration_attachment FROM photos WHERE id = ?", Boolean.class, id)).isFalse();
  }
}
