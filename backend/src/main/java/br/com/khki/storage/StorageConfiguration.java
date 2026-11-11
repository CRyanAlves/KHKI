package br.com.khki.storage;

import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class StorageConfiguration {
  @Bean
  public ImageStorage imageStorage(Environment environment, @Value("${khki.storage.driver:local}") String driver, @Value("${khki.storage.directory:./data/images}") String directory) {
    if (driver.equals("local")) {
      if (environment.matchesProfiles("production")) throw new IllegalStateException("Produção exige armazenamento persistente R2. Configure MEDIA_STORAGE_DRIVER=r2.");
      return new FileImageStorage(Path.of(directory));
    }
    if (!driver.equals("r2")) throw new IllegalStateException("Provedor de imagens inválido.");
    return new R2ImageStorage(r2Client(environment), required(environment, "khki.storage.bucket"));
  }

  private S3Client r2Client(Environment environment) {
    URI endpoint = URI.create(required(environment, "khki.storage.endpoint"));
    if (!"https".equals(endpoint.getScheme()) || endpoint.getUserInfo() != null || endpoint.getHost() == null || !endpoint.getHost().endsWith(".r2.cloudflarestorage.com") || endpoint.getQuery() != null || endpoint.getFragment() != null) throw new IllegalStateException("Endpoint R2 inválido.");
    return S3Client.builder().endpointOverride(endpoint).region(Region.of("auto")).serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build()).credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(required(environment, "khki.storage.access-key"), required(environment, "khki.storage.secret-key")))).httpClientBuilder(UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(10)).socketTimeout(Duration.ofSeconds(30))).overrideConfiguration(config -> config.apiCallTimeout(Duration.ofSeconds(45))).build();
  }

  private String required(Environment environment, String name) {
    String value = environment.getProperty(name, "");
    if (value.isBlank()) throw new IllegalStateException("Configuração obrigatória de armazenamento ausente: " + name);
    return value;
  }
}
