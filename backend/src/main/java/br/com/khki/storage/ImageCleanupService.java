package br.com.khki.storage;

import java.util.UUID;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.*;

/** Exclusões físicas são reprocessadas se o armazenamento estiver indisponível. */
@Service
@EnableScheduling
public class ImageCleanupService {
  private static final Logger logger = LoggerFactory.getLogger(ImageCleanupService.class);
  private final JdbcTemplate jdbc;
  private final ImageStorage storage;
  private final String table;

  public ImageCleanupService(JdbcTemplate jdbc, ImageStorage storage, @Value("${spring.jpa.properties.hibernate.default_schema:}") String schema) {
    this.jdbc = jdbc;
    this.storage = storage;
    if (!schema.isBlank() && !schema.matches("[A-Za-z_][A-Za-z0-9_]*")) throw new IllegalArgumentException("Schema inválido.");
    this.table = schema.isBlank() ? "image_deletions" : schema + ".image_deletions";
  }

  public void enqueue(UUID id) {
    jdbc.update("INSERT INTO " + table + " (image_id) VALUES (?)", id);
    if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCommit() { remove(id); }
    });
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void retry() {
    jdbc.query("SELECT image_id FROM " + table + " ORDER BY created_at FETCH FIRST 50 ROWS ONLY", (row, index) -> row.getObject(1, UUID.class)).forEach(this::remove);
  }

  private void remove(UUID id) {
    try {
      storage.delete(id);
      jdbc.update("DELETE FROM " + table + " WHERE image_id = ?", id);
    } catch (RuntimeException exception) {
      logger.warn("A exclusão de um arquivo privado será tentada novamente.");
    }
  }
}
