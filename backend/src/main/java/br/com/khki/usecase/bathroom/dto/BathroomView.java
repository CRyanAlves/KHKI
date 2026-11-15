package br.com.khki.usecase.bathroom.dto;

import br.com.khki.usecase.bathroom.AccessType;
import java.util.List;
import java.util.UUID;

public record BathroomView(UUID id, String name, String address, String category, double latitude, double longitude, AccessType access, String accessDetails, String hours, Boolean accessible, List<String> items, Double rating, int reviewCount, List<UUID> photoIds, boolean demo, String complement, BathroomDetails details) {}
