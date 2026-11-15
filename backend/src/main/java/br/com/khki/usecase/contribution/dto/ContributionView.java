package br.com.khki.usecase.contribution.dto;

import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import java.time.Instant;
import java.util.UUID;

public record ContributionView(UUID id, TargetType type, String title, Status status, String reason, Instant createdAt, UUID bathroomId) {}
