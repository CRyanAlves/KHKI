package br.com.khki.usecase.bathroom.dto;

import br.com.khki.usecase.bathroom.model.AccessType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record BathroomInputDTO(
  @NotBlank @Size(max = 120) String name,
  @NotBlank @Size(max = 300) String address,
  @NotBlank @Size(max = 80) String category,
  @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
  @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
  @NotNull AccessType access,
  @Size(max = 300) String accessDetails,
  @Size(max = 200) String hours,
  Boolean accessible,
  @NotNull @Size(max = 8) Set<@Pattern(regexp = "PAPER|SOAP|SINK|DRYER|BIN|CHANGING_TABLE") String> items,
  @Size(max = 200) String complement,
  @Valid @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) BathroomDetailsDTO details
) {}
