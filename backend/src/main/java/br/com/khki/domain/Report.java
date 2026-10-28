package br.com.khki.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "reports")
public class Report {
    @Id public UUID id = UUID.randomUUID();
    @Enumerated(EnumType.STRING) @Column(nullable = false) public TargetType targetType;
    @Column(nullable = false) public UUID targetId;
    @Column(nullable = false, length = 40) public String reason;
    public Instant createdAt = Instant.now();
    public boolean resolved;
}