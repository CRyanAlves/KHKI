package br.com.khki.usecase.moderation.dto;

import br.com.khki.shared.domain.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record Decision(@NotNull Status status, @NotBlank @Size(max = 500) String reason, @PositiveOrZero Long expectedVersion, UUID duplicateOfId) {}
