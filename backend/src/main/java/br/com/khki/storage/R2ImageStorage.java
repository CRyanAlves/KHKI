package br.com.khki.storage;

import br.com.khki.api.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

/** Bucket privado: o navegador recebe somente a URL da API, que valida a moderação. */
public final class R2ImageStorage implements ImageStorage, AutoCloseable {
  private final S3Client client;
  private final String bucket;

  public R2ImageStorage(S3Client client, String bucket) {
    this.client = client;
    this.bucket = bucket;
  }

  private String key(UUID id) {
    return "images/" + id + ".jpg";
  }

  public void put(UUID id, byte[] bytes) {
    try {
      client.putObject(PutObjectRequest.builder().bucket(bucket).key(key(id)).contentType("image/jpeg").build(), RequestBody.fromBytes(bytes));
    } catch (RuntimeException exception) {
      throw unavailable();
    }
  }

  public byte[] read(UUID id) {
    try {
      return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key(id)).build()).asByteArray();
    } catch (NoSuchKeyException exception) {
      throw ApiException.missing();
    } catch (RuntimeException exception) {
      throw unavailable();
    }
  }

  public void delete(UUID id) {
    try {
      client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key(id)).build());
    } catch (RuntimeException exception) {
      throw unavailable();
    }
  }

  public void close() { client.close(); }

  private ApiException unavailable() {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Armazenamento de imagens indisponível. Tente novamente.");
  }
}
