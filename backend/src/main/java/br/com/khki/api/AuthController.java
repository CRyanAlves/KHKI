package br.com.khki.api;

import br.com.khki.api.Contracts.*;
import br.com.khki.repository.AppUserRepository;
import br.com.khki.security.SessionPolicy;
import br.com.khki.service.AccountService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

  private final AccountService accounts;
  private final AppUserRepository users;
  private final PasswordEncoder passwords;
  private final String dummyHash;
  private final SessionPolicy sessions;

  public AuthController(AccountService accounts, AppUserRepository users, PasswordEncoder passwords, SessionPolicy sessions) {
    this.accounts = accounts;
    this.users = users;
    this.passwords = passwords;
    this.sessions = sessions;
    this.dummyHash = passwords.encode("dummy-password-never-used");
  }

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }

  @GetMapping("/auth/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  public UserView register(@Valid @RequestBody Register input) {
    return accounts.register(input);
  }

  @GetMapping("/auth/me")
  public UserView me(Principal principal) {
    return accounts.view(accounts.current(principal));
  }

  @PostMapping("/auth/login")
  public UserView login(@Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
    var user = users.findByEmail(input.email().strip().toLowerCase(Locale.ROOT)).orElse(null);
    boolean matches = passwords.matches(input.password(), user == null ? dummyHash : user.password);
    if (user == null || !matches) throw new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
    if (request.getSession(false) != null) request.changeSessionId();
    sessions.start(request.getSession(), input.rememberMe());
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user.email, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role))));
    SecurityContextHolder.setContext(context);
    new HttpSessionSecurityContextRepository().saveContext(context, request, response);
    return accounts.view(user);
  }
}
