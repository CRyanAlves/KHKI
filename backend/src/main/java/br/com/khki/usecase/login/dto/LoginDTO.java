package br.com.khki.usecase.login.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginDTO(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 72) String password, boolean rememberMe) {}
