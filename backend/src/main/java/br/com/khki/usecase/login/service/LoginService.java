package br.com.khki.usecase.login.service;

import br.com.khki.infrastructure.security.SessionAuthenticationService;
import br.com.khki.shared.api.ApiException;
import br.com.khki.usecase.login.dto.LoginDTO;
import br.com.khki.usecase.user.dto.UserDTO;
import br.com.khki.usecase.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
public class LoginService {

  private final AuthenticationManager authenticationManager;
  private final UserService userService;
  private final SessionAuthenticationService sessionAuthenticationService;

  public LoginService(AuthenticationManager authenticationManager, UserService userService, SessionAuthenticationService sessionAuthenticationService) {
    this.authenticationManager = authenticationManager;
    this.userService = userService;
    this.sessionAuthenticationService = sessionAuthenticationService;
  }

  public UserDTO login(LoginDTO input, HttpServletRequest request, HttpServletResponse response) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw invalidCredentials();
    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(input.email().strip().toLowerCase(Locale.ROOT), input.password()));
    } catch (AuthenticationServiceException exception) {
      throw exception;
    } catch (AuthenticationException exception) {
      throw invalidCredentials();
    }
    var user = userService.view(userService.current(authentication));
    sessionAuthenticationService.start(authentication, input.rememberMe(), request, response);
    return user;
  }

  private static ApiException invalidCredentials() {
    return new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
  }
}
