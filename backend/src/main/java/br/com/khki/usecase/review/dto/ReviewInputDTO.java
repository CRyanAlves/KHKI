package br.com.khki.usecase.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ReviewInputDTO(@Min(1) @Max(5) int cleanliness, @Min(1) @Max(5) int structure, @Size(max = 1500) String comment) {}
