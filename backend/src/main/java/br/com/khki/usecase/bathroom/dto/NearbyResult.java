package br.com.khki.usecase.bathroom.dto;

import java.util.List;

public record NearbyResult(double radiusMeters, List<NearbyCandidate> candidates) {}
