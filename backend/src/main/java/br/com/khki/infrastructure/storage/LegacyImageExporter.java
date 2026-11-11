package br.com.khki.infrastructure.storage;

import java.security.MessageDigest;
import java.sql.*;
import java.util.UUID;
import javax.sql.DataSource;

/** Copia e verifica os arquivos antes que a migração SQL retire a coluna BYTEA. */
public final class LegacyImageExporter {
  private LegacyImageExporter() { }

  public static int export(DataSource dataSource, String schema, ImageStorage storage, boolean allowed) throws SQLException {
    if (schema == null || schema.isBlank()) schema = "public";
    if (!schema.matches("[A-Za-z_][A-Za-z0-9_]*")) throw new IllegalArgumentException("Schema inválido.");
    String table = schema + ".photos";
    try (var connection = dataSource.getConnection()) {
      boolean exists;
      try (var tables = connection.getMetaData().getTables(null, schema, "photos", new String[] { "TABLE", "BASE TABLE" })) {
        exists = tables.next();
      }
      if (!exists) return 0;
      try (var statement = connection.prepareStatement("SELECT id, data FROM " + table + " WHERE status <> 'REMOVED' ORDER BY id")) {
        statement.setFetchSize(20);
        try (var rows = statement.executeQuery()) {
          int count = 0;
          while (rows.next()) {
            if (!allowed) throw new IllegalStateException("A migração requer exportar as imagens existentes. Faça backup e configure MEDIA_MIGRATE_LEGACY=true com armazenamento persistente.");
            UUID id = rows.getObject(1, UUID.class);
            byte[] bytes = rows.getBytes(2);
            if (bytes == null || bytes.length == 0) throw new IllegalStateException("Imagem legada vazia. Corrija o registro antes de migrar.");
            storage.put(id, bytes);
            if (!MessageDigest.isEqual(bytes, storage.read(id))) throw new IllegalStateException("A verificação da cópia falhou. O banco não foi migrado.");
            try (var mark = connection.prepareStatement("UPDATE " + table + " SET storage_url = ? WHERE id = ?")) {
              mark.setString(1, "/api/photos/" + id);
              mark.setObject(2, id);
              mark.executeUpdate();
            }
            count++;
          }
          return count;
        }
      }
    }
  }
}
