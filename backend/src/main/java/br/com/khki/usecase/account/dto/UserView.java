package br.com.khki.usecase.account.dto;

import java.util.UUID;

public record UserView(UUID id, String name, String role) {}
