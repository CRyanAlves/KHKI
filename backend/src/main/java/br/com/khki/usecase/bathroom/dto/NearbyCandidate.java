package br.com.khki.usecase.bathroom.dto;

public record NearbyCandidate(BathroomView bathroom, double distanceMeters, boolean possibleDuplicate, boolean differentComplement) {}
