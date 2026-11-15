package br.com.khki.usecase.report.dto;

import br.com.khki.shared.domain.TargetType;
import java.time.Instant;
import java.util.UUID;

public record ReportView(UUID id, TargetType targetType, UUID targetId, String reason, Instant createdAt, boolean resolved, long version, String title, String address) {}
