package br.com.khki.usecase.bathroom.dto;

import java.util.List;

public record NearbyResultDTO(double radiusMeters, List<NearbyCandidateDTO> candidates) {}
