package br.com.khki.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class ModeratedContent {

  @Id
  public UUID id = UUID.randomUUID();

  @Column(nullable = false)
  public UUID authorId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public Status status = Status.PENDING;

  @Column(length = 500)
  public String reason;

  @Column(nullable = false)
  public Instant createdAt = Instant.now();

  @Version
  public long version;
}
