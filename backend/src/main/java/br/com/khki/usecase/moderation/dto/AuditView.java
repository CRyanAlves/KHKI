package br.com.khki.usecase.moderation.dto;

import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import java.time.Instant;
import java.util.UUID;

public record AuditView(UUID id, TargetType targetType, UUID targetId, UUID moderatorId, String moderator, Status decision, String reason, Instant createdAt, UUID duplicateOfId) {}
