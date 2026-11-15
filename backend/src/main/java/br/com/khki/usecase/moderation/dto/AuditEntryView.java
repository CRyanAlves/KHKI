package br.com.khki.usecase.moderation.dto;

import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import java.time.Instant;
import java.util.UUID;

public record AuditEntryView(UUID id, TargetType targetType, UUID targetId, UUID moderatorId, UUID duplicateOfId, Status decision, String reason, Instant createdAt) {}
