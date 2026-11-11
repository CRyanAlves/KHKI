package br.com.khki.usecase.report;

import br.com.khki.shared.domain.ContentReference;
import br.com.khki.shared.domain.TargetType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reports")
public class Report {

  @Id
  private UUID id = UUID.randomUUID();

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TargetType targetType;

  @Column(nullable = false)
  private UUID targetId;

  @Column(nullable = false, length = 40)
  private String reason;

  private Instant createdAt = Instant.now();
  private boolean resolved;

  @Version
  private long version;
  @Embedded
  @com.fasterxml.jackson.annotation.JsonIgnore
  private ContentReference reference;

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public TargetType getTargetType() { return targetType; }
  public void setTargetType(TargetType value) { targetType = value; }

  public UUID getTargetId() { return targetId; }
  public void setTargetId(UUID value) { targetId = value; }

  public String getReason() { return reason; }
  public void setReason(String value) { reason = value; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant value) { createdAt = value; }

  public boolean getResolved() { return resolved; }
  public void setResolved(boolean value) { resolved = value; }

  public long getVersion() { return version; }
  public void setVersion(long value) { version = value; }

  public ContentReference getReference() { return reference; }
  public void setReference(ContentReference value) { reference = value; }
}
