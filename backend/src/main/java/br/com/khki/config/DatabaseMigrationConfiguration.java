package br.com.khki.config;

import br.com.khki.storage.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.*;

@Configuration
public class DatabaseMigrationConfiguration {
  @Bean
  public FlywayMigrationStrategy verifiedImageMigration(ImageStorage storage, @Value("${khki.storage.migrate-legacy:false}") boolean allowed) {
    return flyway -> {
      try {
        var current = flyway.info().current();
        if (current == null || current.getVersion().compareTo(org.flywaydb.core.api.MigrationVersion.fromVersion("10")) < 0) org.flywaydb.core.Flyway.configure().configuration(flyway.getConfiguration()).target("10").load().migrate();
        LegacyImageExporter.export(flyway.getConfiguration().getDataSource(), flyway.getConfiguration().getDefaultSchema(), storage, allowed);
        flyway.migrate();
      } catch (java.sql.SQLException exception) {
        throw new IllegalStateException("Não foi possível preparar a migração das imagens.", exception);
      }
    };
  }
}
