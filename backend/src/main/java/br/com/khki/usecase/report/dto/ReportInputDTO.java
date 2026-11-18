package br.com.khki.usecase.report.dto;

import br.com.khki.shared.domain.TargetType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record ReportInputDTO(@NotNull TargetType targetType, @NotNull UUID targetId, @NotNull @Pattern(regexp = "INCORRECT|CLOSED|PRIVACY|INAPPROPRIATE|SPAM|OTHER") String reason) {}
