package br.com.khki.usecase.login.controller;

import br.com.khki.usecase.login.dto.LoginRequest;
import br.com.khki.usecase.login.service.LoginService;
import br.com.khki.usecase.user.dto.UserView;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class LoginController {

  private final LoginService loginService;

  public LoginController(LoginService loginService) {
    this.loginService = loginService;
  }

  @GetMapping("/auth/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/auth/login")
  public UserView login(@Valid @RequestBody LoginRequest input, HttpServletRequest request, HttpServletResponse response) {
    return loginService.login(input, request, response);
  }
}
