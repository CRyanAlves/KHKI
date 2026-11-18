package br.com.khki.usecase.user.service;

import br.com.khki.shared.api.ApiException;
import br.com.khki.usecase.user.dto.RegisterRequest;
import br.com.khki.usecase.user.dto.UserView;
import br.com.khki.usecase.user.model.User;
import br.com.khki.usecase.user.model.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

  private final UserRepository users;
  private final PasswordEncoder passwords;

  public UserService(UserRepository users, PasswordEncoder passwords) {
    this.users = users;
    this.passwords = passwords;
  }

  public User current(Principal principal) {
    if (principal == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Entre na sua conta para continuar.");
    return users.findByEmail(principal.getName()).orElseThrow(ApiException::missing);
  }

  public UserView view(User user) {
    return new UserView(user.getId(), user.getName(), user.getRole());
  }

  public UserView register(RegisterRequest input) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw new ApiException(HttpStatus.BAD_REQUEST, "A senha deve ter no máximo 72 bytes.");
    String email = input.email().strip().toLowerCase(Locale.ROOT);
    if (users.findByEmail(email).isPresent()) throw new ApiException(HttpStatus.CONFLICT, "Não foi possível cadastrar com os dados informados.");
    var user = new User();
    user.setName(input.name().strip());
    user.setEmail(email);
    user.setPassword(passwords.encode(input.password()));
    return view(users.save(user));
  }
}
