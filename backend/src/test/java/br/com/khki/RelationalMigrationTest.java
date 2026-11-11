package br.com.khki;

import static org.assertj.core.api.Assertions.*;

import br.com.khki.storage.*;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class RelationalMigrationTest {
  @TempDir
  Path files;

  private DriverManagerDataSource dataSource;
  private JdbcTemplate jdbc;
  private String schema;
  private UUID author;
  private UUID bathroom;
  private UUID review;
  private final List<UUID> pictures = new ArrayList<>();
  private final Instant created = Instant.parse("2026-01-10T15:00:00Z");

  @BeforeEach
  void legacyDatabase() {
    String url = System.getenv("TEST_DATABASE_URL");
    schema = "migration_" + UUID.randomUUID().toString().replace("-", "");
    if (url == null) url = "jdbc:h2:mem:" + schema + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
    else url += (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
    dataSource = new DriverManagerDataSource(url, System.getenv().getOrDefault("TEST_DATABASE_USER", "sa"), System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", ""));
    Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").target("8").load().migrate();
    if (url.startsWith("jdbc:h2:")) dataSource.setUrl(url + ";SCHEMA=" + schema);
    jdbc = new JdbcTemplate(dataSource);
    author = UUID.randomUUID();
    bathroom = UUID.randomUUID();
    review = UUID.randomUUID();
    jdbc.update("INSERT INTO app_users (id,name,email,password,role) VALUES (?,?,?,?,?)", author, "Autor", "autor@khki.test", "unused", "USER");
    jdbc.update("INSERT INTO bathrooms (id,author_id,status,created_at,name,address,category,latitude,longitude,access,items,bathroom_types) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", bathroom, author, "APPROVED", Timestamp.from(created), "Biblioteca", "Rua de teste", "Biblioteca", -23.1, -47.2, "FREE", "PAPER,SINK", "FEMALE,MALE");
    jdbc.update("INSERT INTO reviews (id,author_id,status,created_at,bathroom_id,cleanliness,structure) VALUES (?,?,?,?,?,?,?)", review, author, "APPROVED", Timestamp.from(created), bathroom, 4, 5);
    for (int index = 0; index < 4; index++) {
      UUID id = UUID.randomUUID();
      pictures.add(id);
      jdbc.update("INSERT INTO photos (id,author_id,status,reason,created_at,bathroom_id,review_id,registration_attachment,data) VALUES (?,?,?,?,?,?,?,?,?)", id, author, index == 3 ? "REMOVED" : index == 2 ? "PENDING" : "APPROVED", "Histórico preservado", Timestamp.from(created), bathroom, index == 1 ? review : null, index == 0, index == 3 ? new byte[0] : new byte[] { 1, 2, 3, (byte) index });
    }
    jdbc.update("INSERT INTO reports (id,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?)", UUID.randomUUID(), "PHOTO", pictures.get(0), "OTHER", Timestamp.from(created));
  }

  @AfterEach
  void cleanup() {
    if (jdbc != null && schema.matches("migration_[a-f0-9]{32}")) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
  }

  @Test
  void exportsFilesAndPreservesUrlsModerationAndRelationalIntegrity() throws Exception {
    Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").target("10").load().migrate();
    var storage = new FileImageStorage(files);
    assertThat(LegacyImageExporter.export(dataSource, schema, storage, true)).isEqualTo(3);
    assertThat(LegacyImageExporter.export(dataSource, schema, storage, true)).isEqualTo(3);
    Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
    assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'photos'", Integer.class, schema)).isZero();
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bathroom_images", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM review_images", Integer.class)).isEqualTo(3);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM reviews WHERE photo_only AND cleanliness IS NULL AND structure IS NULL AND comment IS NULL", Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM reviews WHERE NOT photo_only", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bathroom_items", Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bathroom_types", Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT bathroom_image_target_id FROM reports", UUID.class)).isEqualTo(pictures.get(0));
    assertThat(jdbc.queryForObject("SELECT status FROM reviews WHERE id = ?", String.class, pictures.get(2))).isEqualTo("PENDING");
    for (int index = 0; index < 3; index++) assertThat(storage.read(pictures.get(index))).containsExactly(1, 2, 3, index);
    assertThat(jdbc.queryForObject("SELECT url FROM bathroom_images", String.class)).isEqualTo("/api/photos/" + pictures.get(0));
    assertThat(jdbc.queryForObject("SELECT created_at FROM bathroom_images", Timestamp.class).toInstant()).isEqualTo(created);
    assertThatThrownBy(() -> jdbc.update("INSERT INTO bathroom_items VALUES (?,?)", UUID.randomUUID(), "PAPER")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    assertThatThrownBy(() -> jdbc.update("INSERT INTO bathroom_items VALUES (?,?)", bathroom, "INVENTED")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    assertThatThrownBy(() -> jdbc.update("UPDATE reviews SET cleanliness = 5 WHERE photo_only")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    assertThatThrownBy(() -> jdbc.update("UPDATE reports SET target_id = ?", UUID.randomUUID())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  }

  @Test
  void sqlRefusesToRemoveBytesWithoutConfirmedExport() {
    Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").target("10").load().migrate();
    assertThatThrownBy(() -> Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate()).isInstanceOf(org.flywaydb.core.api.FlywayException.class);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM photos", Integer.class)).isEqualTo(4);
  }

  @Test
  void blocksMigrationWhenExportIsNotAuthorizedOrCopyCannotBeVerified() {
    assertThatThrownBy(() -> LegacyImageExporter.export(dataSource, schema, new FileImageStorage(files), false)).isInstanceOf(IllegalStateException.class);
    ImageStorage broken = new ImageStorage() {
      public void put(UUID id, byte[] bytes) { }
      public byte[] read(UUID id) { return new byte[] { 99 }; }
      public void delete(UUID id) { }
    };
    assertThatThrownBy(() -> LegacyImageExporter.export(dataSource, schema, broken, true)).isInstanceOf(IllegalStateException.class);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM photos", Integer.class)).isEqualTo(4);
  }
}
