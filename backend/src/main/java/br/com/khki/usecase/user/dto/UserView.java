package br.com.khki.usecase.user.dto;

import java.util.UUID;

public record UserView(UUID id, String name, String role) {}
