package br.com.khki.usecase.account;

import br.com.khki.infrastructure.security.SessionAuthenticationService;
import br.com.khki.shared.api.ApiException;
import br.com.khki.usecase.account.dto.LoginRequest;
import br.com.khki.usecase.account.dto.UserView;
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
  private final AccountService accountService;
  private final SessionAuthenticationService sessionAuthenticationService;

  public LoginService(AuthenticationManager authenticationManager, AccountService accountService, SessionAuthenticationService sessionAuthenticationService) {
    this.authenticationManager = authenticationManager;
    this.accountService = accountService;
    this.sessionAuthenticationService = sessionAuthenticationService;
  }

  public UserView login(LoginRequest input, HttpServletRequest request, HttpServletResponse response) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw invalidCredentials();
    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(input.email().strip().toLowerCase(Locale.ROOT), input.password()));
    } catch (AuthenticationServiceException exception) {
      throw exception;
    } catch (AuthenticationException exception) {
      throw invalidCredentials();
    }
    var user = accountService.view(accountService.current(authentication));
    sessionAuthenticationService.start(authentication, input.rememberMe(), request, response);
    return user;
  }

  private static ApiException invalidCredentials() {
    return new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
  }
}
