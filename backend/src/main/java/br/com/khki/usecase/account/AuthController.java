package br.com.khki.usecase.account;

import br.com.khki.usecase.account.dto.LoginRequest;
import br.com.khki.usecase.account.dto.RegisterRequest;
import br.com.khki.usecase.account.dto.UserView;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

  private final AccountService accountService;
  private final LoginService loginService;

  public AuthController(AccountService accountService, LoginService loginService) {
    this.accountService = accountService;
    this.loginService = loginService;
  }

  @GetMapping("/auth/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  public UserView register(@Valid @RequestBody RegisterRequest input) {
    return accountService.register(input);
  }

  @GetMapping("/auth/me")
  public UserView me(Principal principal) {
    return accountService.view(accountService.current(principal));
  }

  @PostMapping("/auth/login")
  public UserView login(@Valid @RequestBody LoginRequest input, HttpServletRequest request, HttpServletResponse response) {
    return loginService.login(input, request, response);
  }
}
