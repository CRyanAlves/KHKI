package db.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Move URLs para os conteúdos e redireciona o histórico, sem publicar anexos ainda não aprovados. */
public class V14__images_belong_to_content extends BaseJavaMigration {
  private record Parent(String type, UUID id) {}

  @Override
  public void migrate(Context context) throws Exception {
    Connection connection = context.getConnection();
    if (connection.getMetaData().getDatabaseProductName().equals("PostgreSQL")) execute(connection, "LOCK TABLE bathrooms, reviews, bathroom_images, review_images, reports, moderation_audit, submission_receipts IN ACCESS EXCLUSIVE MODE");
    execute(connection, "ALTER TABLE bathrooms ADD COLUMN image_urls JSONB NOT NULL DEFAULT '[]'");
    execute(connection, "ALTER TABLE reviews ADD COLUMN image_urls JSONB NOT NULL DEFAULT '[]'");
    var urls = new LinkedHashMap<Parent, List<String>>();
    var owners = new HashMap<UUID, Parent>();
    collect(connection, "SELECT i.*, b.author_id, b.status AS parent_status FROM bathroom_images i JOIN bathrooms b ON b.id = i.bathroom_id ORDER BY i.bathroom_id, i.image_order", true, urls, owners);
    collect(connection, "SELECT i.*, r.author_id, r.bathroom_id, r.status AS parent_status FROM review_images i JOIN reviews r ON r.id = i.review_id ORDER BY i.review_id, i.image_order", false, urls, owners);
    ObjectMapper json = new ObjectMapper();
    for (var entry : urls.entrySet()) {
      String table = entry.getKey().type().equals("BATHROOM") ? "bathrooms" : "reviews";
      try (var update = connection.prepareStatement("UPDATE " + table + " SET image_urls = CAST(? AS JSONB) WHERE id = ?")) {
        update.setString(1, json.writeValueAsString(entry.getValue()));
        update.setObject(2, entry.getKey().id());
        if (update.executeUpdate() != 1) throw new SQLException("Conteúdo da imagem indisponível durante a migração.");
      }
    }
    for (String table : List.of("reports", "moderation_audit", "submission_receipts")) {
      execute(connection, "ALTER TABLE " + table + " DROP CONSTRAINT " + table + "_target_fk_check");
      for (var entry : owners.entrySet()) {
        Parent parent = entry.getValue();
        try (var update = connection.prepareStatement("UPDATE " + table + " SET target_type = ?, target_id = ?, bathroom_target_id = ?, review_target_id = ? WHERE target_type = 'PHOTO' AND target_id = ?")) {
          update.setString(1, parent.type());
          update.setObject(2, parent.id());
          update.setObject(3, parent.type().equals("BATHROOM") ? parent.id() : null);
          update.setObject(4, parent.type().equals("REVIEW") ? parent.id() : null);
          update.setObject(5, entry.getKey());
          update.executeUpdate();
        }
      }
      execute(connection, "ALTER TABLE " + table + " DROP COLUMN bathroom_image_target_id");
      execute(connection, "ALTER TABLE " + table + " DROP COLUMN review_image_target_id");
      execute(connection, "ALTER TABLE " + table + " ADD CONSTRAINT " + table + "_target_fk_check CHECK ((target_type = 'BATHROOM' AND bathroom_target_id IS NOT NULL AND bathroom_target_id = target_id AND review_target_id IS NULL) OR (target_type = 'REVIEW' AND review_target_id IS NOT NULL AND review_target_id = target_id AND bathroom_target_id IS NULL))");
    }
    execute(connection, "DROP TABLE bathroom_images");
    execute(connection, "DROP TABLE review_images");
  }

  private void collect(Connection connection, String query, boolean bathroom, Map<Parent, List<String>> urls, Map<UUID, Parent> owners) throws SQLException {
    try (var statement = connection.createStatement(); var rows = statement.executeQuery(query)) {
      while (rows.next()) {
        UUID imageId = rows.getObject("image_id", UUID.class);
        Parent parent = new Parent(bathroom ? "BATHROOM" : "REVIEW", rows.getObject(bathroom ? "bathroom_id" : "review_id", UUID.class));
        if (!rows.getString("status").equals(rows.getString("parent_status")) && !rows.getString("status").equals("APPROVED")) {
          // Anexos não aprovados com decisão diferente ficam em avaliações históricas sem nota, preservando sua privacidade.
          try (var insert = connection.prepareStatement("INSERT INTO reviews (id, author_id, bathroom_id, status, reason, created_at, version, photo_only) VALUES (?, ?, ?, ?, ?, ?, 0, TRUE)")) {
            insert.setObject(1, imageId);
            insert.setObject(2, rows.getObject("author_id"));
            insert.setObject(3, rows.getObject("bathroom_id"));
            insert.setString(4, rows.getString("status"));
            insert.setString(5, rows.getString("reason"));
            insert.setTimestamp(6, rows.getTimestamp("created_at"));
            if (!parent.id().equals(imageId)) insert.executeUpdate();
          }
          parent = new Parent("REVIEW", imageId);
          try (var update = connection.prepareStatement("UPDATE reviews SET status = ? WHERE id = ?")) {
            update.setString(1, rows.getString("status"));
            update.setObject(2, imageId);
            update.executeUpdate();
          }
        }
        urls.computeIfAbsent(parent, ignored -> new ArrayList<>()).add(rows.getString("url"));
        owners.put(imageId, parent);
      }
    }
  }

  private void execute(Connection connection, String sql) throws SQLException {
    try (var statement = connection.createStatement()) { statement.execute(sql); }
  }
}
