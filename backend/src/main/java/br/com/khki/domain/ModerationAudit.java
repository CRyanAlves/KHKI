package br.com.khki.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "moderation_audit")
public class ModerationAudit {
    @Id public UUID id = UUID.randomUUID();
    @Enumerated(EnumType.STRING) public TargetType targetType;
    public UUID targetId;
    public UUID moderatorId;
    @Enumerated(EnumType.STRING) public Status decision;
    @Column(nullable = false, length = 500) public String reason;
    public Instant createdAt = Instant.now();
}