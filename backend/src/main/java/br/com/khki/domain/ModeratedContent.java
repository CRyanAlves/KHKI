package br.com.khki.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class ModeratedContent {

  @Id
  private UUID id = UUID.randomUUID();

  @Column(name = "author_id", nullable = false)
  private UUID authorId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", insertable = false, updatable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private AppUser author;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Status status = Status.PENDING;

  @Column(length = 500)
  private String reason;

  @Column(nullable = false)
  private Instant createdAt = Instant.now();

  @Version
  private long version;

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public UUID getAuthorId() { return authorId; }
  public void setAuthorId(UUID value) { authorId = value; }

  public AppUser getAuthor() { return author; }
  public void setAuthor(AppUser value) { author = value; }

  public Status getStatus() { return status; }
  public void setStatus(Status value) { status = value; }

  public String getReason() { return reason; }
  public void setReason(String value) { reason = value; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant value) { createdAt = value; }

  public long getVersion() { return version; }
  public void setVersion(long value) { version = value; }
}
