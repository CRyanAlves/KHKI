package br.com.khki.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "submission_receipts")
public class SubmissionReceipt {
    @Id public UUID id;
    @Version public Long version;
    @Column(nullable = false) public UUID authorId;
    @Column(nullable = false, length = 80) public String operation;
    @Column(nullable = false, length = 64) public String fingerprint;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) public TargetType targetType;
    @Column(nullable = false) public UUID targetId;
    @Column(nullable = false) public Instant createdAt = Instant.now();
}