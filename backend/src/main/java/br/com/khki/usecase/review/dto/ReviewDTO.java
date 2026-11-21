package br.com.khki.usecase.review.dto;

import java.time.Instant;
import java.util.UUID;

public record ReviewDTO(UUID id, String author, Integer cleanliness, Integer structure, String comment, Instant createdAt) {}
