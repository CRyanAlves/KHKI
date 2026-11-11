package br.com.khki.storage;

import br.com.khki.api.ApiException;
import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/** Arquivos privados locais para desenvolvimento; IDs UUID impedem navegação de diretórios. */
public final class FileImageStorage implements ImageStorage {
  private final Path directory;

  public FileImageStorage(Path directory) {
    this.directory = directory.toAbsolutePath().normalize();
  }

  private Path path(UUID id) {
    return directory.resolve(id + ".jpg");
  }

  public void put(UUID id, byte[] bytes) {
    Path temporary = null;
    try {
      Files.createDirectories(directory);
      temporary = Files.createTempFile(directory, "image-", ".tmp");
      Files.write(temporary, bytes);
      try {
        Files.move(temporary, path(id), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
      } catch (AtomicMoveNotSupportedException exception) {
        Files.move(temporary, path(id), StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException exception) {
      throw unavailable();
    } finally {
      if (temporary != null) try { Files.deleteIfExists(temporary); } catch (IOException ignored) { }
    }
  }

  public byte[] read(UUID id) {
    try {
      return Files.readAllBytes(path(id));
    } catch (NoSuchFileException exception) {
      throw ApiException.missing();
    } catch (IOException exception) {
      throw unavailable();
    }
  }

  public void delete(UUID id) {
    try {
      Files.deleteIfExists(path(id));
    } catch (IOException exception) {
      throw unavailable();
    }
  }

  private ApiException unavailable() {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Armazenamento de imagens indisponível. Tente novamente.");
  }
}
