package br.com.khki.usecase.moderation;

import br.com.khki.shared.domain.ContentReference;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.account.User;
import br.com.khki.usecase.bathroom.Bathroom;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "moderation_audit")
public class ModerationAudit {

  @Id
  private UUID id = UUID.randomUUID();

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "moderator_id", nullable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private User moderator;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "duplicate_of_id")
  @com.fasterxml.jackson.annotation.JsonIgnore
  private Bathroom duplicateOf;

  @Enumerated(EnumType.STRING)
  private Status decision;

  @Column(nullable = false, length = 500)
  private String reason;

  private Instant createdAt = Instant.now();

  @Embedded
  @com.fasterxml.jackson.annotation.JsonIgnore
  private ContentReference reference;

  public UUID getId() {
    return id;
  }

  public void setId(UUID value) {
    id = value;
  }

  @Transient
  public TargetType getTargetType() {
    return reference.getTargetType();
  }

  @Transient
  public UUID getTargetId() {
    return reference.getTargetId();
  }

  public User getModerator() {
    return moderator;
  }

  public void setModerator(User value) {
    moderator = value;
  }

  public Bathroom getDuplicateOf() {
    return duplicateOf;
  }

  public void setDuplicateOf(Bathroom value) {
    duplicateOf = value;
  }

  public Status getDecision() {
    return decision;
  }

  public void setDecision(Status value) {
    decision = value;
  }

  public String getReason() {
    return reason;
  }

  public void setReason(String value) {
    reason = value;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant value) {
    createdAt = value;
  }

  public ContentReference getReference() {
    return reference;
  }

  public void setReference(ContentReference value) {
    reference = value;
  }
}
