package br.com.khki.usecase.user.controller;

import br.com.khki.usecase.user.dto.RegisterRequest;
import br.com.khki.usecase.user.dto.UserView;
import br.com.khki.usecase.user.service.UserService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  public UserView register(@Valid @RequestBody RegisterRequest input) {
    return userService.register(input);
  }

  @GetMapping("/auth/me")
  public UserView me(Principal principal) {
    return userService.view(userService.current(principal));
  }
}
