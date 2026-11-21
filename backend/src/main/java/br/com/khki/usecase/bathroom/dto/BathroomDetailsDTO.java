package br.com.khki.usecase.bathroom.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record BathroomDetailsDTO(
  @Pattern(regexp = "PUBLIC|CUSTOMERS|AUTHORIZATION|OTHER|UNKNOWN") String audience,
  @Pattern(regexp = "YES|NO|UNKNOWN") String charge,
  @DecimalMin("0.01") @Digits(integer = 6, fraction = 2) BigDecimal feeAmount,
  @Size(max = 3) Set<@NotNull @Pattern(regexp = "INDIVIDUAL|FEMALE|MALE") String> bathroomTypes,
  Boolean stepFreeAccess,
  Boolean elevator,
  Boolean adaptedCabin,
  Boolean grabBars,
  @PastOrPresent LocalDate lastVisited
) {}
