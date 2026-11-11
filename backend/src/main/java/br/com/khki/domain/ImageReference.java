package br.com.khki.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Valor pertencente ao banheiro ou à avaliação; não é uma entidade independente. */
@Embeddable
public class ImageReference {
  @Column(name = "image_id", nullable = false)
  private UUID id = UUID.randomUUID();

  @Column(nullable = false, length = 500)
  private String url;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private Status status = Status.PENDING;

  @Column(length = 500)
  private String reason;

  @Column(nullable = false)
  private Instant createdAt = Instant.now();

  @Column(nullable = false)
  private long version;

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public String getUrl() { return url; }
  public void setUrl(String value) { url = value; }

  public Status getStatus() { return status; }
  public void setStatus(Status value) { status = value; }

  public String getReason() { return reason; }
  public void setReason(String value) { reason = value; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant value) { createdAt = value; }

  public long getVersion() { return version; }
  public void setVersion(long value) { version = value; }
}
