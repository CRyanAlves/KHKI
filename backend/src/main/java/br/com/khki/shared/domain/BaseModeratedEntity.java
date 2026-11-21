package br.com.khki.shared.domain;

import br.com.khki.usecase.account.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@MappedSuperclass
public abstract class BaseModeratedEntity {

  @Id
  private UUID id = UUID.randomUUID();

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", nullable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private User author;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Status status = Status.PENDING;

  @Column(length = 500)
  private String reason;

  @Column(nullable = false)
  private Instant createdAt = Instant.now();

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
  @Column(name = "image_urls", nullable = false, columnDefinition = "jsonb")
  private List<String> imageUrls = new ArrayList<>();

  @Version
  private long version;

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public User getAuthor() { return author; }
  public void setAuthor(User value) { author = value; }

  public Status getStatus() { return status; }
  public void setStatus(Status value) { status = value; }

  public String getReason() { return reason; }
  public void setReason(String value) { reason = value; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant value) { createdAt = value; }

  public List<String> getImageUrls() { return imageUrls; }
  public void setImageUrls(List<String> value) { imageUrls = value; }

  public long getVersion() { return version; }
  public void setVersion(long value) { version = value; }
}
