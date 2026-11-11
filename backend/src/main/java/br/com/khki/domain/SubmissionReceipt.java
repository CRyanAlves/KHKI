package br.com.khki.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submission_receipts")
public class SubmissionReceipt {

  @Id
  private UUID id;

  @Version
  private Long version;

  @Column(name = "author_id", nullable = false)
  private UUID authorId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", insertable = false, updatable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private AppUser author;

  @Column(nullable = false, length = 80)
  private String operation;

  @Column(nullable = false, length = 64)
  private String fingerprint;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private TargetType targetType;

  @Column(nullable = false)
  private UUID targetId;

  @Column(nullable = false)
  private Instant createdAt = Instant.now();
  @Embedded
  @com.fasterxml.jackson.annotation.JsonIgnore
  private ContentReference reference;

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public Long getVersion() { return version; }
  public void setVersion(Long value) { version = value; }

  public UUID getAuthorId() { return authorId; }
  public void setAuthorId(UUID value) { authorId = value; }

  public AppUser getAuthor() { return author; }
  public void setAuthor(AppUser value) { author = value; }

  public String getOperation() { return operation; }
  public void setOperation(String value) { operation = value; }

  public String getFingerprint() { return fingerprint; }
  public void setFingerprint(String value) { fingerprint = value; }

  public TargetType getTargetType() { return targetType; }
  public void setTargetType(TargetType value) { targetType = value; }

  public UUID getTargetId() { return targetId; }
  public void setTargetId(UUID value) { targetId = value; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant value) { createdAt = value; }

  public ContentReference getReference() { return reference; }
  public void setReference(ContentReference value) { reference = value; }
}
