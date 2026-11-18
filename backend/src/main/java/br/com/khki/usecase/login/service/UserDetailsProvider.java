package br.com.khki.usecase.login.service;

import br.com.khki.usecase.user.model.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsProvider implements UserDetailsService {

  private final UserRepository userRepository;

  public UserDetailsProvider(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Override
  public UserDetails loadUserByUsername(String email) {
    var user = userRepository.findByEmail(email).orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas."));
    return org.springframework.security.core.userdetails.User.withUsername(user.getEmail()).password(user.getPassword()).roles(user.getRole()).build();
  }
}
