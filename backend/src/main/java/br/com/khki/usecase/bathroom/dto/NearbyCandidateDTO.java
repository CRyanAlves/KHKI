package br.com.khki.usecase.bathroom.dto;

public record NearbyCandidateDTO(BathroomDTO bathroom, double distanceMeters, boolean possibleDuplicate, boolean differentComplement) {}
