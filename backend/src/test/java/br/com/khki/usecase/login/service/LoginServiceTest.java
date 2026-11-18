package br.com.khki.usecase.login.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import br.com.khki.infrastructure.security.SessionAuthenticationService;
import br.com.khki.shared.api.ApiException;
import br.com.khki.usecase.login.dto.LoginRequest;
import br.com.khki.usecase.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.InternalAuthenticationServiceException;

class LoginServiceTest {

  private final AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
  private final UserService userService = mock(UserService.class);
  private final SessionAuthenticationService sessionAuthenticationService = mock(SessionAuthenticationService.class);
  private final LoginService loginService = new LoginService(authenticationManager, userService, sessionAuthenticationService);

  @Test
  void infrastructureFailuresAreNotReportedAsInvalidCredentialsAndDoNotStartSessions() {
    var failure = new InternalAuthenticationServiceException("Falha interna de teste");
    when(authenticationManager.authenticate(any())).thenThrow(failure);
    assertThatThrownBy(() -> loginService.login(new LoginRequest("conta@khki.test", "Test-password-123", false), new MockHttpServletRequest(), new MockHttpServletResponse())).isSameAs(failure);
    verifyNoInteractions(userService, sessionAuthenticationService);
  }

  @Test
  void multibytePasswordsAboveTheBcryptLimitCannotBeTruncatedAndAuthenticated() {
    assertThatThrownBy(() -> loginService.login(new LoginRequest("conta@khki.test", "á".repeat(40), false), new MockHttpServletRequest(), new MockHttpServletResponse()))
      .isInstanceOf(ApiException.class)
      .hasMessage("E-mail ou senha inválidos.");
    verifyNoInteractions(authenticationManager, userService, sessionAuthenticationService);
  }
}
