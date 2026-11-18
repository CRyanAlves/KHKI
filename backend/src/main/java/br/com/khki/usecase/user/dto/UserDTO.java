package br.com.khki.usecase.user.dto;

import java.util.UUID;

public record UserDTO(UUID id, String name, String role) {}
