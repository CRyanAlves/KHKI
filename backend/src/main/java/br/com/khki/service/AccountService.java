package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.*;
import br.com.khki.domain.AppUser;
import br.com.khki.repository.AppUserRepository;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AccountService {

  private final AppUserRepository users;
  private final PasswordEncoder passwords;

  public AccountService(AppUserRepository users, PasswordEncoder passwords) {
    this.users = users;
    this.passwords = passwords;
  }

  public AppUser current(Principal principal) {
    if (principal == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Entre na sua conta para continuar.");
    return users.findByEmail(principal.getName()).orElseThrow(ApiException::missing);
  }

  public UserView view(AppUser user) {
    return new UserView(user.getId(), user.getName(), user.getRole());
  }

  public UserView register(Register input) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw new ApiException(HttpStatus.BAD_REQUEST, "A senha deve ter no máximo 72 bytes.");
    String email = input.email().strip().toLowerCase(Locale.ROOT);
    if (users.findByEmail(email).isPresent()) throw new ApiException(HttpStatus.CONFLICT, "Não foi possível cadastrar com os dados informados.");
    var user = new AppUser();
    user.setName(input.name().strip());
    user.setEmail(email);
    user.setPassword(passwords.encode(input.password()));
    return view(users.save(user));
  }
}
